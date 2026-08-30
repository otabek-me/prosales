from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
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
    customer.draft_product_id = None
    customer.draft_quantity = None
    customer.draft_name = None
    customer.draft_surname = None
    customer.draft_phone = None
    customer.draft_address = None


async def send_chat_action(bot_token: str, chat_id: str, action: str = "typing") -> None:
    """Telegramda 'yozmoqda...' yoki 'izlamoqda...' holatini yoqadi."""
    url = f"https://api.telegram.org/bot{bot_token}/sendChatAction"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(url, json={"chat_id": chat_id, "action": action})
    except Exception:
        pass


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
                "📄 *Buyurtmangizni tasdiqlaysizmi?*\n\n"
                f"📦 *Mahsulot:* {escape_markdown(product)} ({qty} dona)\n"
                f"👤 *Xaridor:* {escape_markdown(name)} {escape_markdown(surname)}\n"
                f"📞 *Telefon:* {phone}\n"
                f"📍 *Manzil:* {escape_markdown(text_content)}\n\n"
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
            await db.flush()

            product_name = customer.draft_product or "Noma'lum mahsulot"
            qty = customer.draft_quantity or 1

            # Narxni ANIQ tanlangan mahsulotdan olamiz (draft_product_id orqali).
            # Ilgari bu yerda faqat nom bo'yicha "ilike ... first()" qidiruv bor edi —
            # nomda o'xshash bir nechta mahsulot bo'lsa, noto'g'ri (arxiv/cheap) birini
            # topib, summani buzardi. Endi aniq row ishlatiladi, nomga tushgan bo'lsa
            # fallback sifatida eski qidiruv saqlanadi.
            product_obj = None
            if customer.draft_product_id is not None:
                prod_id_res = await db.execute(select(Product).where(
                    Product.id == customer.draft_product_id,
                    Product.organization_id == organization_id
                ))
                product_obj = prod_id_res.scalars().first()

            if product_obj is None:
                prod_res = await db.execute(select(Product).where(
                    Product.organization_id == organization_id,
                    Product.name.ilike(f"%{product_name}%")
                ))
                product_obj = prod_res.scalars().first()

            if product_obj:
                total_price = float(product_obj.price) * qty
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
                customer.total_spent = float(customer.total_spent or 0) + total_price
                # Zaxiradan ayirish (salbiy bo'lmasligi uchun max(0)). Idempotent bayroq o'rnatiladi,
                # bekor qilinadigan bo'lsa stock.py orqali qaytariladi.
                product_obj.stock = max(0, (float(product_obj.stock) or 0) - qty)
                new_order.stock_deducted = True
            else:
                new_order.notes = f"AI qabul qilgan mahsulot: {product_name} ({qty} dona)."

            customer.total_orders = (customer.total_orders or 0) + 1
            customer.stage = CustomerStageEnum.ORDERED

            success_text = (
                f"🎉 *Buyurtmangiz muvaffaqiyatli qabul qilindi!*\n\n"
                f"🆔 Buyurtma raqami: *{order_num}*\n"
                f"💰 Jami summa: *{float(new_order.total_amount):,.0f} UZS*\n\n"
                "Tez orada operatorlarimiz siz bilan bog'lanishadi. Do'konimizni tanlaganingiz uchun rahmat! 😊"
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

    # 1. TASHKILOT VA BOTNI ANIQLASH
    organization = None
    bot_obj = None

    if org_id and org_id != "auto":
        try:
            target_uuid = UUID(org_id)
        except ValueError:
            return {"status": "invalid_org_id"}

        org_res = await db.execute(
            select(Organization).where(Organization.id == target_uuid, Organization.is_active == True)
        )
        organization = org_res.scalars().first()
        if not organization:
            return {"status": "org_not_found"}

        bot_res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == target_uuid))
        bot_obj = bot_res.scalars().first()
    else:
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

    # 2. CALLBACK QUERY (Inline Button Click) ISHLOV BERISH
    callback_query = update.get("callback_query")
    if callback_query:
        cb_chat_id = str(callback_query["message"]["chat"]["id"])
        cb_data = callback_query.get("data", "")
        cb_user = callback_query.get("from", {})

        # Find or create customer & conversation
        cust_res = await db.execute(
            select(Customer).where(Customer.organization_id == resolved_org_id, Customer.telegram_id == cb_chat_id)
        )
        customer = cust_res.scalars().first()
        if not customer:
            customer = Customer(
                organization_id=resolved_org_id,
                telegram_id=cb_chat_id,
                username=cb_user.get("username"),
                first_name=cb_user.get("first_name"),
                last_name=cb_user.get("last_name"),
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

        if cb_data.startswith("buy_"):
            prod_prefix = cb_data[4:]
            prod_res = await db.execute(
                select(Product).where(
                    Product.organization_id == resolved_org_id,
                    Product.is_active == True
                )
            )
            all_prods = prod_res.scalars().all()
            matched_prod = next((p for p in all_prods if str(p.id).startswith(prod_prefix)), None)

            if matched_prod:
                customer.draft_product = matched_prod.name
                customer.draft_product_id = matched_prod.id
                customer.order_flow_state = STAGE_ASK_QUANTITY
                customer.stage = CustomerStageEnum.CONSIDERING
                await db.commit()

                ask_text = (
                    f"✅ *{escape_markdown(matched_prod.name)}* tanlandi.\n"
                    f"💰 Narxi: *{float(matched_prod.price):,.0f} {matched_prod.currency}*\n\n"
                    "🔢 *Nechta dona buyurtma qilmoqchisiz?* (masalan: 1, 2):"
                )
                await send_telegram_message(plain_bot_token, cb_chat_id, ask_text, MAIN_KEYBOARD)
                return {"status": "handled_inline_buy"}

    # 3. ODDIY XABARLARNI QABUL QILISH
    message_data = update.get("message") or update.get("edited_message")
    if not message_data:
        return {"status": "ignored"}

    chat_id = str(message_data["chat"]["id"])
    text_content = (message_data.get("text") or "").strip()

    if not text_content:
        return {"status": "no_text"}

    try:
        # Trigger live typing action immediately
        await send_chat_action(plain_bot_token, chat_id, "typing")

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
        conversation.unread_count += 1
        await db.commit()

        text_lower = text_content.lower()

        # 4. UNIVERSAL BUYRUQLAR
        if text_lower == "/start":
            customer.stage = CustomerStageEnum.NEW
            customer.order_flow_state = None
            _clear_draft(customer)
            await db.commit()
            welcome_text = (
                f"Assalomu alaykum, *{escape_markdown(tg_user.get('first_name', 'Mijoz'))}*! 👋\n\n"
                f"*{escape_markdown(organization.name)}* rasmiy AI yordamchisiga xush kelibsiz.\n"
                "Sizga kerakli mahsulotni topish va buyurtma berishga yordam beraman.\n\n"
                "Quyidagi tugmalardan foydalaning yoki xohlagan savolingizni yozing!"
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
            conversation.unread_count += 1
            customer.order_flow_state = None
            _clear_draft(customer)
            await db.commit()
            await send_telegram_message(
                plain_bot_token, chat_id,
                "👨‍💼 *Operatorimizga xabar berildi!*\n\nOperatorimiz tez orada siz bilan bog'lanadi. Ungacha savollaringizni yozib qoldirishingiz mumkin.",
                MAIN_KEYBOARD
            )
            return {"status": "handled_operator"}

        # 5. FAOL BUYURTMA JARAYONI (FSM)
        if customer.order_flow_state:
            return await _handle_order_fsm(
                db, plain_bot_token, chat_id, resolved_org_id, customer, conversation, text_content, text_lower
            )

        # 6. ASOSIY MENYU BUYRUQLARI
        if text_lower in ["/help", "❓ yordam / faq"]:
            faq_text = (
                "❓ *Tez-tez beriladigan savollar:*\n\n"
                "🚚 *Yetkazib berish:* Toshkent bo'ylab 30,000 so'm (1-2 kun), viloyatlarga 40,000 so'm.\n"
                "💳 *To'lov turlari:* Naqd pul, Click, Payme orqali.\n"
                "🔄 *Kafolat & Qaytarish:* 14 kun ichida almashtirib beriladi.\n\n"
                "Operator bilan bog'lanish uchun *👨‍💼 Operatorga ulanish* tugmasini bosing."
            )
            await send_telegram_message(plain_bot_token, chat_id, faq_text, MAIN_KEYBOARD)
            return {"status": "handled_help"}

        if text_lower == "📦 buyurtmalarim":
            # Show customer's recent orders
            orders_res = await db.execute(
                select(Order).where(
                    Order.organization_id == resolved_org_id,
                    Order.customer_id == customer.id
                ).order_by(Order.created_at.desc()).limit(5)
            )
            cust_orders = orders_res.scalars().all()
            if cust_orders:
                ord_text = "📦 *Sizning so'nggi buyurtmalaringiz:*\n\n"
                status_labels = {
                    OrderStatusEnum.PENDING: "⏳ Kutilmoqda",
                    OrderStatusEnum.CONFIRMED: "✅ Tasdiqlangan",
                    OrderStatusEnum.PROCESSING: "📦 Tayyorlanmoqda",
                    OrderStatusEnum.SHIPPED: "🚚 Yo'lda",
                    OrderStatusEnum.DELIVERED: "🎉 Yetkazildi",
                    OrderStatusEnum.CANCELLED: "❌ Bekor qilingan"
                }
                for o in cust_orders:
                    st_label = status_labels.get(o.status, o.status.value)
                    ord_text += f"{st_label} *Buyurtma #{o.order_number}*\n"
                    ord_text += f"   💰 Summa: *{float(o.total_amount):,.0f} {o.currency}*\n"
                    if o.items:
                        items_str = ", ".join([f"{it.product_name} ({it.quantity} dona)" for it in o.items])
                        ord_text += f"   🛍 Mahsulot: _{escape_markdown(items_str[:60])}_\n"
                    ord_text += "\n"
                ord_text += "💡 _Buyurtma haqida to'liq ma'lumot olish uchun uning raqamini yozing (masalan: ORD-A13CEA)._"
                await send_telegram_message(plain_bot_token, chat_id, ord_text, MAIN_KEYBOARD)
            else:
                await send_telegram_message(plain_bot_token, chat_id, "Sizda hali buyurtmalar mavjud emas. Mahsulot tanlab buyurtma berishingiz mumkin!", MAIN_KEYBOARD)
            return {"status": "handled_orders"}

        # Buyurtma raqamini tekshirish (masalan: ORD-A13CEA yoki ORD12345)
        ord_match = re.search(r'ORD-?[A-Z0-9]{4,10}', text_content.upper())
        if ord_match:
            searched_code = ord_match.group(0).replace("-", "")
            found_res = await db.execute(
                select(Order).where(
                    Order.organization_id == resolved_org_id,
                    Order.customer_id == customer.id,
                    or_(
                        Order.order_number.ilike(f"%{ord_match.group(0)}%"),
                        Order.order_number.ilike(f"%{searched_code}%")
                    )
                )
            )
            found_ord = found_res.scalars().first()
            if found_ord:
                try:
                    status_labels = {
                        OrderStatusEnum.PENDING: "⏳ Kutilmoqda (operator tez orada tasdiqlaydi)",
                        OrderStatusEnum.CONFIRMED: "✅ Tasdiqlangan (yetkazishga tayyorlanmoqda)",
                        OrderStatusEnum.PROCESSING: "📦 Tayyorlanmoqda",
                        OrderStatusEnum.SHIPPED: "🚚 Yo'lda (kuryer yetkazmoqda)",
                        OrderStatusEnum.DELIVERED: "🎉 Yetkazib berildi",
                        OrderStatusEnum.CANCELLED: "❌ Bekor qilingan"
                    }
                    st_str = status_labels.get(found_ord.status, found_ord.status.value)
                    info_msg = (
                        f"📦 *Buyurtma #{escape_markdown(found_ord.order_number)} holati:*\n\n"
                        f"📊 *Status:* {st_str}\n"
                        f"💰 *Jami summa:* {float(found_ord.total_amount or 0):,.0f} {found_ord.currency or 'UZS'}\n"
                        f"👤 *Xaridor:* {escape_markdown(found_ord.customer_name or 'Mijoz')}\n"
                        f"📞 *Telefon:* {escape_markdown(found_ord.customer_phone or '-')}\n"
                        f"📍 *Manzil:* {escape_markdown(found_ord.delivery_address or '-')}\n"
                    )
                    if found_ord.items:
                        info_msg += "\n🛍 *Mahsulotlar:* \n"
                        for it in found_ord.items:
                            info_msg += f"▪️ {escape_markdown(it.product_name)} ({it.quantity} dona — {float(it.total or 0):,.0f} UZS)\n"
                    elif found_ord.notes:
                        info_msg += f"\n📝 *Qayd:* _{escape_markdown(found_ord.notes)}_\n"

                    info_msg += "\nQo'shimcha savollaringiz bo'lsa, bemalol so'rashingiz mumkin! 😊"
                    await send_telegram_message(plain_bot_token, chat_id, info_msg, MAIN_KEYBOARD)
                except Exception as e:
                    # Xabar tuzish/hos qilishda xatolik bo'lsa ham bot "jim" qolmasin.
                    logger.exception(f"Buyurtma holatini tayyorlashda xatolik: {e}")
                    await send_telegram_message(
                        plain_bot_token, chat_id,
                        "Kechirasiz, buyurtma ma'lumotlarini olishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
                        MAIN_KEYBOARD
                    )
                return {"status": "handled_order_number"}
            else:
                # Topilmagan — AI'ga o'tkazish o'rniga darhol aniqlik so'raymiz.
                # Ilgari bu yerda fall-through bo'lib, AI engine'ga tushib qolardi (sekin/hang ham mumkin).
                await send_telegram_message(
                    plain_bot_token, chat_id,
                    "⚠️ *Buyurtma topilmadi.*\n\n"
                    "Iltimos, buyurtma raqamini to'g'ri yozganingizni tekshiring "
                    "(masalan: `ORD-7A17FE`).\n"
                    "Buyurtmalar ro'yxatini ko'rish uchun *📦 Buyurtmalarim* tugmasini bosing.",
                    MAIN_KEYBOARD
                )
                return {"status": "handled_order_number_not_found"}

        if text_lower in ["/products", "👟 mahsulotlar"]:
            prod_res = await db.execute(
                select(Product).where(
                    Product.organization_id == resolved_org_id,
                    Product.is_active == True,
                    Product.stock > 0
                ).order_by(Product.created_at.desc()).limit(8)
            )
            products = prod_res.scalars().all()
            if products:
                catalog_text = "👟 *Do'konimizdagi mahsulotlar katalogi:*\n\n"
                inline_buttons = []
                for p in products:
                    catalog_text += f"▪️ *{escape_markdown(p.name)}*\n"
                    catalog_text += f"   💰 Narxi: *{float(p.price):,.0f} {p.currency}*\n"
                    if p.description:
                        catalog_text += f"   📝 _{escape_markdown(p.description[:70])}_\n"
                    catalog_text += "\n"
                    inline_buttons.append([{"text": f"🛒 {p.name[:25]} — Buyurtma", "callback_data": f"buy_{str(p.id)[:8]}"}])

                catalog_text += "💡 _Buyurtma qilish uchun mahsulot tugmasini bosing yoki nomini yozing._"
                reply_markup = {"inline_keyboard": inline_buttons} if inline_buttons else MAIN_KEYBOARD
                await send_telegram_message(plain_bot_token, chat_id, catalog_text, reply_markup)
                return {"status": "handled_products"}
            else:
                await send_telegram_message(
                    plain_bot_token, chat_id,
                    "Hozircha katalogda faol mahsulotlar mavjud emas. Tez orada yangi tovarlar qo'shiladi!",
                    MAIN_KEYBOARD
                )
                return {"status": "handled_products_empty"}

        # 7. AI SALES ENGINE BILAN JAVOB TAYYORLASH
        ai_reply_text, tool_calls_made, is_handoff = await ai_engine.generate_response(
            db, organization, customer, conversation, text_content
        )

        if is_handoff:
            conversation.is_operator_mode = True
            conversation.unread_count += 1
            await db.commit()

        # Buyurtma boshlanishini ushlash (AI javobidan [ORDER:Mahsulot_nomi] tegini izlash)
        order_match = re.search(r'\[ORDER:(.*?)\]', ai_reply_text)
        if order_match:
            product_name = order_match.group(1).strip()
            customer.draft_product = product_name
            # Narxni keyin aniq row'dan olish uchun mos mahsulotning ID sini ham saqlaymiz.
            match_res = await db.execute(
                select(Product).where(
                    Product.organization_id == resolved_org_id,
                    Product.is_active == True,
                    Product.name.ilike(f"%{product_name}%")
                ).order_by(Product.created_at.desc()).limit(1)
            )
            matched = match_res.scalars().first()
            customer.draft_product_id = matched.id if matched else None
            customer.order_flow_state = STAGE_ASK_QUANTITY
            customer.stage = CustomerStageEnum.CONSIDERING
            await db.commit()

            clean_reply = re.sub(r'\[ORDER:.*?\]', '', ai_reply_text).strip()
            final_text = f"✅ *{escape_markdown(product_name)}* tanlandi.\n\n🔢 *Nechta dona kerak?* (faqat raqam, masalan: 1, 2):"
            if clean_reply:
                final_text = f"{clean_reply}\n\n{final_text}"

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