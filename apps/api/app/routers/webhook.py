from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import uuid
from typing import Optional
from datetime import datetime
import httpx
import logging
import re

from app.config import settings
from app.database import get_db
from app.models import (
    Organization, TelegramBot, Customer, Conversation, Message,
    SenderTypeEnum, CustomerStageEnum, Order, OrderItem, Product, OrderStatusEnum
)
from app.security import decrypt_token
from app.ai.engine import ai_engine

logger = logging.getLogger("telegram_webhook")
router = APIRouter(prefix="/webhook", tags=["Telegram Webhook"])

# ==========================================
# ASOSIY MENYU TUGMALARI
# ==========================================
MAIN_KEYBOARD = {
    "keyboard": [
        [{"text": "👟 Mahsulotlar"}, {"text": "📦 Buyurtmalarim"}],
        [{"text": "👨‍💼 Operatorga ulanish"}, {"text": "❓ Yordam / FAQ"}]
    ],
    "resize_keyboard": True
}

# ==========================================
# BUYURTMA FSM BOSQICHLARI (customer.order_flow_state ustunida saqlanadi,
# customer.stage (CRM enum) bilan ARALASHTIRILMAYDI)
# ==========================================
STAGE_ASK_QUANTITY = "ask_quantity"
STAGE_ASK_NAME = "ask_name"
STAGE_ASK_SURNAME = "ask_surname"
STAGE_ASK_PHONE = "ask_phone"
STAGE_ASK_ADDRESS = "ask_address"
STAGE_CONFIRMATION = "confirmation"

CANCEL_KEYWORDS = {"/cancel", "bekor qilish", "❌ bekor qilish"}
CONFIRM_KEYWORDS = {"ha", "ha.", "tasdiqlayman", "ok", "yes", "tasdiqlash"}

# Telegram legacy Markdown uchun xavfli belgilar. Foydalanuvchi kiritgan
# (ism, familiya, manzil, telefon) matnni xabar ichiga qo'yishdan oldin bu
# belgilarni ekranlaymiz — aks holda Telegram API xabarni rad etadi va bot
# "jim" qolib qoladi.
_MD_ESCAPE_RE = re.compile(r'([_*`\[])')


def escape_markdown(text: str) -> str:
    if not text:
        return text
    return _MD_ESCAPE_RE.sub(r'\\\1', text)


def _clear_draft(customer: Customer) -> None:
    customer.draft_product = None
    customer.draft_quantity = None
    customer.draft_name = None
    customer.draft_surname = None
    customer.draft_phone = None
    customer.draft_address = None


async def send_telegram_message(bot_token: str, chat_id: str, text: str, reply_markup: dict = None, parse_mode: Optional[str] = "Markdown") -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(url, json=payload)
            if res.status_code != 200:
                logger.error(f"Telegram API xatosi: {res.text}")
                # Ko'p hollarda xato Markdown belgilarini parse qila olmasligidan
                # kelib chiqadi. Shu holatda parse_mode'siz qayta yuboramiz —
                # foydalanuvchi hech bo'lmasa javob oladi.
                if parse_mode:
                    fallback_payload = dict(payload)
                    fallback_payload.pop("parse_mode", None)
                    retry = await client.post(url, json=fallback_payload)
                    if retry.status_code != 200:
                        logger.error(f"Telegram fallback yuborish ham muvaffaqiyatsiz: {retry.text}")
                        return False
                    return True
                return False
            return True
        except Exception as e:
            logger.error(f"Telegramga xabar yuborishda xatolik: {e}")
            return False


async def _handle_order_fsm(
    db: AsyncSession,
    bot_token: str,
    chat_id: str,
    organization_id,
    customer: Customer,
    conversation: Conversation,
    text_content: str,
    text_lower: str,
) -> dict:
    """Mahsulot tanlangandan keyingi buyurtma jarayonini boshqaradi.
    Holat customer.order_flow_state ichida saqlanadi (customer.stage emas)."""
    stage = customer.order_flow_state

    if stage == STAGE_ASK_QUANTITY:
        if text_content.isdigit() and int(text_content) > 0:
            qty = int(text_content)
            if qty > 1000:
                await send_telegram_message(bot_token, chat_id, "❗️ Miqdor juda katta. Iltimos, kichikroq son kiriting.")
                return {"status": "fsm_quantity_invalid"}
            customer.draft_quantity = qty
            customer.order_flow_state = STAGE_ASK_NAME
            await db.commit()
            await send_telegram_message(bot_token, chat_id, "1️⃣ Iltimos, ismingizni kiriting:")
        else:
            await send_telegram_message(bot_token, chat_id, "❗️ Faqat musbat raqam kiriting. Nechta kerak? (masalan: 1, 2)")
        return {"status": "fsm_quantity"}

    elif stage == STAGE_ASK_NAME:
        if len(text_content) > 1:
            customer.draft_name = text_content
            customer.order_flow_state = STAGE_ASK_SURNAME
            await db.commit()
            await send_telegram_message(
                bot_token, chat_id,
                f"Rahmat, {escape_markdown(text_content)}!\n\n2️⃣ Endi familiyangizni kiriting:"
            )
        else:
            await send_telegram_message(bot_token, chat_id, "❗️ Ismingizni to'g'ri kiriting:")
        return {"status": "fsm_name"}

    elif stage == STAGE_ASK_SURNAME:
        if len(text_content) > 1:
            customer.draft_surname = text_content
            customer.order_flow_state = STAGE_ASK_PHONE
            await db.commit()
            await send_telegram_message(bot_token, chat_id, "3️⃣ Ajoyib! Endi telefon raqamingizni yuboring (masalan: +998901234567):")
        else:
            await send_telegram_message(bot_token, chat_id, "❗️ Familiyangizni to'g'ri kiriting:")
        return {"status": "fsm_surname"}

    elif stage == STAGE_ASK_PHONE:
        cleaned_phone = re.sub(r'[\s\-]', '', text_content)
        if re.fullmatch(r'\+?[0-9]{9,15}', cleaned_phone):
            customer.draft_phone = cleaned_phone
            customer.order_flow_state = STAGE_ASK_ADDRESS
            await db.commit()
            await send_telegram_message(bot_token, chat_id, "4️⃣ Zo'r! Endi yetkazib berish manzilingizni to'liq yozing (Viloyat, tuman, ko'cha, uy):")
        else:
            await send_telegram_message(bot_token, chat_id, "❗️ Telefon raqam xato. Iltimos, to'g'ri raqam kiriting (masalan: +998901234567):")
        return {"status": "fsm_phone"}

    elif stage == STAGE_ASK_ADDRESS:
        if len(text_content) > 3:
            customer.draft_address = text_content
            customer.order_flow_state = STAGE_CONFIRMATION
            await db.commit()

            product = customer.draft_product or "Mahsulot"
            qty = customer.draft_quantity or 1
            name = customer.draft_name or ""
            surname = customer.draft_surname or ""
            phone = customer.draft_phone or ""

            conf_text = (
                "📄 Buyurtmangizni tasdiqlaysizmi?\n\n"
                f"📦 Mahsulot: {escape_markdown(product)} ({qty} dona)\n"
                f"👤 Xaridor: {escape_markdown(name)} {escape_markdown(surname)}\n"
                f"📞 Telefon: {phone}\n"
                f"📍 Manzil: {escape_markdown(text_content)}\n\n"
                "✅ Tasdiqlash uchun *Ha* deb yozing.\n"
                "❌ Bekor qilish uchun *Yo'q* yoki /cancel deb yozing."
            )
            await send_telegram_message(bot_token, chat_id, conf_text)
        else:
            await send_telegram_message(bot_token, chat_id, "❗️ Manzil juda qisqa. Iltimos, to'liqroq yozing:")
        return {"status": "fsm_address"}

    elif stage == STAGE_CONFIRMATION:
        if text_lower in CONFIRM_KEYWORDS:
            order_num = f"ORD-{uuid.uuid4().hex[:6].upper()}"
            customer_full_name = f"{customer.draft_name or ''} {customer.draft_surname or ''}".strip()

            new_order = Order(
                organization_id=organization_id,
                customer_id=customer.id,
                conversation_id=conversation.id,
                order_number=order_num,
                status=OrderStatusEnum.PENDING,
                customer_name=customer_full_name,
                customer_phone=customer.draft_phone or '',
                delivery_address=customer.draft_address or '',
                total_amount=0.00,
                currency="UZS"
            )
            db.add(new_order)
            await db.flush()  # ID olish uchun

            product_name = customer.draft_product or "Noma'lum mahsulot"
            qty = customer.draft_quantity or 1

            prod_res = await db.execute(select(Product).where(
                Product.organization_id == organization_id,
                Product.name.ilike(f"%{product_name}%")
            ))
            product_obj = prod_res.scalars().first()

            if product_obj:
                total_price = product_obj.price * qty
                order_item = OrderItem(
                    order_id=new_order.id,
                    product_id=product_obj.id,
                    product_name=product_obj.name,
                    price=product_obj.price,
                    quantity=qty,
                    total=total_price
                )
                db.add(order_item)
                new_order.total_amount = total_price
                customer.total_spent = (customer.total_spent or 0) + total_price
            else:
                new_order.notes = f"AI qabul qilgan mahsulot: {product_name} ({qty} dona). Baza bilan aniq mos kelmadi."

            customer.total_orders = (customer.total_orders or 0) + 1
            customer.stage = CustomerStageEnum.ORDERED

            success_text = (
                f"🎉 Buyurtmangiz muvaffaqiyatli qabul qilindi!\n\n"
                f"🆔 Buyurtma raqami: *{order_num}*\n"
                "Tez orada operatorlarimiz bog'lanadi."
            )
            await send_telegram_message(bot_token, chat_id, success_text, MAIN_KEYBOARD)
        else:
            customer.stage = CustomerStageEnum.NEW
            await send_telegram_message(
                bot_token, chat_id,
                "❌ Buyurtma bekor qilindi. Boshqa mahsulot qidirishni davom ettirishingiz mumkin.",
                MAIN_KEYBOARD
            )

        customer.order_flow_state = None
        _clear_draft(customer)
        await db.commit()
        return {"status": "fsm_confirmation_completed"}

    # Noma'lum/singan holat — xavfsizlik uchun jarayonni tozalab qayta boshlaymiz
    logger.warning(f"Noma'lum order_flow_state: {stage}. Jarayon tozalanmoqda.")
    customer.order_flow_state = None
    _clear_draft(customer)
    await db.commit()
    await send_telegram_message(
        bot_token, chat_id,
        "Kechirasiz, buyurtma jarayonida texnik nosozlik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
        MAIN_KEYBOARD
    )
    return {"status": "fsm_state_reset"}


@router.post("/telegram/auto")
@router.post("/telegram/{org_id}")
async def telegram_webhook(
    request: Request,
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        update = await request.json()
    except Exception:
        return {"status": "invalid_payload"}

    message_data = update.get("message") or update.get("edited_message")
    if not message_data:
        return {"status": "ignored"}

    chat_id = str(message_data["chat"]["id"])
    text_content = (message_data.get("text") or "").strip()

    if not text_content:
        return {"status": "no_text"}

    try:
        # 1. TASHKILOT VA BOTNI ANIQLASH
        # MUHIM: agar org_id aniq berilgan bo'lsa va topilmasa, boshqa
        # tashkilotga "jimgina" o'tib ketmaymiz (multi-tenant xavfsizligi).
        organization = None
        bot_obj = None

        if org_id and org_id != "auto":
            try:
                target_uuid = UUID(org_id)
            except ValueError:
                logger.warning(f"Noto'g'ri org_id formati: {org_id}")
                return {"status": "invalid_org_id"}

            org_res = await db.execute(
                select(Organization).where(Organization.id == target_uuid, Organization.is_active == True)
            )
            organization = org_res.scalars().first()
            if not organization:
                logger.warning(f"Tashkilot topilmadi yoki faol emas: {org_id}")
                return {"status": "org_not_found"}

            bot_res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == target_uuid))
            bot_obj = bot_res.scalars().first()
        else:
            # "auto" rejimi — faqat bitta bot ulangan tizimlar uchun (dev/test)
            bot_res = await db.execute(select(TelegramBot).limit(1))
            bot_obj = bot_res.scalars().first()
            if bot_obj:
                org_res = await db.execute(
                    select(Organization).where(Organization.id == bot_obj.organization_id, Organization.is_active == True)
                )
                organization = org_res.scalars().first()

        if not organization:
            return {"status": "org_not_found"}

        resolved_org_id = organization.id
        plain_bot_token = decrypt_token(bot_obj.bot_token_encrypted) if bot_obj and bot_obj.bot_token_encrypted else settings.BOT_TOKEN

        if not plain_bot_token:
            return {"status": "no_bot_token"}

        # 2. MIJOZ VA SUHBATNI TOPISH YOKI YARATISH
        tg_user = message_data.get("from", {})
        cust_res = await db.execute(
            select(Customer).where(Customer.organization_id == resolved_org_id, Customer.telegram_id == chat_id)
        )
        customer = cust_res.scalars().first()

        if not customer:
            customer = Customer(
                organization_id=resolved_org_id,
                telegram_id=chat_id,
                username=tg_user.get("username"),
                first_name=tg_user.get("first_name"),
                last_name=tg_user.get("last_name"),
                stage=CustomerStageEnum.NEW
            )
            db.add(customer)
            await db.flush()

        conv_res = await db.execute(
            select(Conversation).where(Conversation.organization_id == resolved_org_id, Conversation.customer_id == customer.id)
        )
        conversation = conv_res.scalars().first()

        if not conversation:
            conversation = Conversation(
                organization_id=resolved_org_id,
                customer_id=customer.id,
                is_operator_mode=False
            )
            db.add(conversation)
            await db.flush()

        now = datetime.utcnow()
        cust_msg = Message(
            conversation_id=conversation.id,
            sender_type=SenderTypeEnum.CUSTOMER,
            content=text_content,
            created_at=now
        )
        db.add(cust_msg)
        conversation.last_message_at = now
        if conversation.is_operator_mode:
            conversation.unread_count += 1
        await db.commit()

        text_lower = text_content.lower()

        # 3. UNIVERSAL BUYRUQLAR — har doim, hatto FSM/operator rejimida ham ishlaydi
        if text_lower == "/start":
            customer.stage = CustomerStageEnum.NEW
            customer.order_flow_state = None
            _clear_draft(customer)
            await db.commit()
            welcome_text = (
                f"Assalomu alaykum, *{escape_markdown(tg_user.get('first_name', 'Mijoz'))}*! 👋\n\n"
                "Do'konimizning rasmiy *AI yordamchisiga* xush kelibsiz.\n"
                "Sizga kerakli mahsulotni topish va buyurtma berishga yordam beraman.\n\n"
                "Nima qidirayotganingizni yozing yoki tugmalardan foydalaning!"
            )
            await send_telegram_message(plain_bot_token, chat_id, welcome_text, MAIN_KEYBOARD)
            return {"status": "handled_start"}

        if text_lower in CANCEL_KEYWORDS and customer.order_flow_state:
            customer.order_flow_state = None
            _clear_draft(customer)
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, "❌ Buyurtma jarayoni bekor qilindi.", MAIN_KEYBOARD)
            return {"status": "flow_cancelled"}

        if text_lower in ["/operator", "👨‍💼 operatorga ulanish"]:
            conversation.is_operator_mode = True
            customer.order_flow_state = None
            _clear_draft(customer)
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, "👨‍💼 Operatorga xabar berildi. Tez orada siz bilan bog'lanadi.", MAIN_KEYBOARD)
            return {"status": "handled_operator"}

        if conversation.is_operator_mode:
            return {"status": "operator_mode_active"}

        # 4. FAOL BUYURTMA JARAYONI — MENYU TUGMALARIDAN OLDIN ISHLAYDI
        # (aks holda foydalanuvchi ism/manzil yozayotganda tasodifan menyu
        # buyrug'iga o'xshab qolsa, jarayon uzilib qolardi)
        if customer.order_flow_state:
            return await _handle_order_fsm(
                db, plain_bot_token, chat_id, resolved_org_id, customer, conversation, text_content, text_lower
            )

        # 5. ASOSIY MENYU BUYRUQLARI
        if text_lower in ["/help", "❓ yordam / faq"]:
            faq_text = "❓ *Yordam:*\n\n🚚 Yetkazib berish: 1-2 kun\n💳 To'lov: Naqd, Click, Payme orqali.\nQo'shimcha savollar uchun operatorga ulanishingiz mumkin."
            await send_telegram_message(plain_bot_token, chat_id, faq_text, MAIN_KEYBOARD)
            return {"status": "handled_help"}

        if text_lower == "📦 buyurtmalarim":
            await send_telegram_message(plain_bot_token, chat_id, "📦 Buyurtma raqamini yozing.", MAIN_KEYBOARD)
            return {"status": "handled_orders"}

        if text_lower in ["/products", "👟 mahsulotlar"]:
            await send_telegram_message(plain_bot_token, chat_id, "🔍 *Katalogdan ma'lumotlar yuklanmoqda, iltimos biroz kuting...* ⏳")
            text_content = "Iltimos, bazada mavjud bo'lgan barcha mahsulotlarni ro'yxatini chiroyli qilib taqdim eting."

        # 6. AI SALES ENGINE ULANISHI
        ai_reply_text, tool_calls_made, is_handoff = await ai_engine.generate_response(
            db, organization, customer, conversation, text_content
        )

        # Buyurtma boshlanishini ushlash (AI javobidan [ORDER:Mahsulot_nomi] tegini izlash)
        order_match = re.search(r'\[ORDER:(.*?)\]', ai_reply_text)
        if order_match:
            product_name = order_match.group(1).strip()
            customer.draft_product = product_name
            customer.order_flow_state = STAGE_ASK_QUANTITY
            customer.stage = CustomerStageEnum.CONSIDERING
            await db.commit()

            final_text = f"✅ *{escape_markdown(product_name)}* tanlandi.\n\n🔢 Iltimos, nechta kerakligini yozing (faqat raqam, masalan: 1, 2):"

            ai_msg = Message(
                conversation_id=conversation.id,
                sender_type=SenderTypeEnum.AI,
                content=final_text,
                tool_calls_json=tool_calls_made
            )
            db.add(ai_msg)
            await db.commit()

            await send_telegram_message(plain_bot_token, chat_id, final_text, MAIN_KEYBOARD)
            return {"status": "ai_started_order", "handoff": is_handoff}

        # Oddiy AI javobi
        ai_msg = Message(
            conversation_id=conversation.id,
            sender_type=SenderTypeEnum.AI,
            content=ai_reply_text,
            tool_calls_json=tool_calls_made
        )
        db.add(ai_msg)
        await db.commit()

        await send_telegram_message(plain_bot_token, chat_id, ai_reply_text, MAIN_KEYBOARD)
        return {"status": "success", "handoff": is_handoff}

    except Exception as e:
        logger.exception(f"Webhook ichida kutilmagan xatolik: {e}")
        try:
            await db.rollback()
        except Exception:
            pass
        return {"status": "error"}