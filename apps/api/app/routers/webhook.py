from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional
from datetime import datetime
import httpx
import logging
import re

from app.config import settings
from app.database import get_db
from app.models import (
    Organization, TelegramBot, Customer, Conversation, Message,
    SenderTypeEnum, CustomerStageEnum
)
from app.security import decrypt_token
from app.ai.engine import ai_engine

logger = logging.getLogger("telegram_webhook")
router = APIRouter(prefix="/webhook", tags=["Telegram Webhook"])

# ==========================================
# ASOSIY MENYU TUGMALARI (REPLY KEYBOARD)
# ==========================================
MAIN_KEYBOARD = {
    "keyboard": [
        [{"text": "👟 Mahsulotlar"}, {"text": "📦 Buyurtmalarim"}],
        [{"text": "👨‍💼 Operatorga ulanish"}, {"text": "❓ Yordam / FAQ"}]
    ],
    "resize_keyboard": True
}

# ==========================================
# XABAR YUBORISH UCHUN YORDAMCHI FUNKSIYA
# ==========================================
async def send_telegram_message(bot_token: str, chat_id: str, text: str, reply_markup: dict = None):
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload)
            if res.status_code != 200:
                logger.error(f"Telegram API xatosi: {res.text}")
        except Exception as e:
            logger.error(f"Telegramga xabar yuborishda xatolik: {e}")

@router.post("/telegram/auto")
@router.post("/telegram/{org_id}")
async def telegram_webhook(
    request: Request,
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    update = await request.json()
    logger.info(f"Received Telegram Update (org={org_id}): {update}")

    message_data = update.get("message") or update.get("edited_message")
    if not message_data:
        return {"status": "ignored"}

    chat_id = str(message_data["chat"]["id"])
    text_content = message_data.get("text", "").strip()

    if not text_content:
        return {"status": "no_text"}

    # ==========================================
    # 1. TASHKILOT VA BOTNI ANIQLASH
    # ==========================================
    organization = None
    bot_obj = None

    if org_id and org_id != "auto":
        try:
            target_uuid = UUID(org_id)
            org_res = await db.execute(select(Organization).where(Organization.id == target_uuid))
            organization = org_res.scalars().first()
            if organization:
                bot_res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == target_uuid))
                bot_obj = bot_res.scalars().first()
        except Exception:
            pass

    if not organization:
        bot_res = await db.execute(select(TelegramBot).limit(1))
        bot_obj = bot_res.scalars().first()
        if bot_obj:
            org_res = await db.execute(select(Organization).where(Organization.id == bot_obj.organization_id))
            organization = org_res.scalars().first()

    if not organization:
        org_res = await db.execute(select(Organization).where(Organization.is_active == True).limit(1))
        organization = org_res.scalars().first()

    if not organization:
        return {"status": "org_not_found"}

    resolved_org_id = organization.id

    plain_bot_token = None
    if bot_obj and bot_obj.bot_token_encrypted:
        plain_bot_token = decrypt_token(bot_obj.bot_token_encrypted)
    elif settings.BOT_TOKEN:
        plain_bot_token = settings.BOT_TOKEN

    if not plain_bot_token:
        return {"status": "no_bot_token"}

    # ==========================================
    # 2. MIJOZ VA SUHBATNI TOPISH YOKI YARATISH
    # ==========================================
    tg_user = message_data.get("from", {})
    cust_res = await db.execute(
        select(Customer).where(
            Customer.organization_id == resolved_org_id,
            Customer.telegram_id == chat_id
        )
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
        select(Conversation).where(
            Conversation.organization_id == resolved_org_id,
            Conversation.customer_id == customer.id
        )
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

    # =======================================================
    # 3. TUGMALAR VA BUYRUQLARNI USHLAB QOLISH
    # =======================================================
    text_lower = text_content.lower()

    if text_lower == "/start":
        customer.stage = CustomerStageEnum.NEW 
        await db.commit()
        welcome_text = (
            f"Assalomu alaykum, *{tg_user.get('first_name', 'Mijoz')}*! 👋\n\n"
            f"Do'konimizning rasmiy *AI yordamchisiga* xush kelibsiz.\n"
            f"Sizga kerakli mahsulotni topish va buyurtma berishga yordam beraman.\n\n"
            f"Nima qidirayotganingizni yozing yoki tugmalardan foydalaning!"
        )
        await send_telegram_message(plain_bot_token, chat_id, welcome_text, MAIN_KEYBOARD)
        return {"status": "handled_start"}

    elif text_lower in ["/operator", "👨‍💼 operatorga ulanish"]:
        conversation.is_operator_mode = True
        await db.commit()
        await send_telegram_message(plain_bot_token, chat_id, "👨‍💼 Operatorga xabar berildi. Tez orada qo'shiladi.", MAIN_KEYBOARD)
        return {"status": "handled_operator"}

    elif text_lower in ["/help", "❓ yordam / faq"]:
        faq_text = "❓ *Yordam:*\n\n🚚 Yetkazib berish: 1-2 kun\n💳 To'lov: Naqd, Click, Payme."
        await send_telegram_message(plain_bot_token, chat_id, faq_text, MAIN_KEYBOARD)
        return {"status": "handled_help"}

    elif text_lower == "📦 buyurtmalarim":
        await send_telegram_message(plain_bot_token, chat_id, "📦 Buyurtma raqamini yozing.", MAIN_KEYBOARD)
        return {"status": "handled_orders"}

    if conversation.is_operator_mode:
        return {"status": "operator_mode_active"}

    # =======================================================
    # 4. KETMA-KETLIK (FSM) - BUYURTMA FORMASI
    # =======================================================
    current_stage = str(customer.stage)
    
    if current_stage == "ask_quantity":
        if text_content.isdigit():
            customer.draft_quantity = int(text_content)
            customer.stage = "ask_name"
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, "✍️ Ajoyib! Endi ismingizni yozing:")
        else:
            await send_telegram_message(plain_bot_token, chat_id, "❗️ Iltimos, faqat raqam kiriting. Nechta kerak? (masalan: 1, 2)")
        return {"status": "fsm_quantity"}

    elif current_stage == "ask_name":
        if len(text_content) > 1:
            customer.draft_name = text_content
            customer.stage = "ask_phone"
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, f"Rahmat, {text_content}! \n📞 Endi telefon raqamingizni yuboring (masalan: +998901234567):")
        else:
            await send_telegram_message(plain_bot_token, chat_id, "❗️ Ismingizni to'g'ri kiriting:")
        return {"status": "fsm_name"}

    elif current_stage == "ask_phone":
        if re.search(r'^\+?[0-9]{9,15}$', text_content.replace(" ", "")):
            customer.draft_phone = text_content
            customer.stage = "ask_address"
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, "📍 Zo'r! Endi yetkazib berish manzilini to'liq yozing (Viloyat, tuman, ko'cha, uy):")
        else:
            await send_telegram_message(plain_bot_token, chat_id, "❗️ Telefon raqam xato. Iltimos, to'g'ri raqam kiriting (masalan: +998901234567):")
        return {"status": "fsm_phone"}

    elif current_stage == "ask_address":
        if len(text_content) > 3:
            customer.draft_address = text_content
            customer.stage = "confirmation"
            await db.commit()
            
            product = getattr(customer, "draft_product", "Mahsulot")
            qty = getattr(customer, "draft_quantity", 1)
            name = getattr(customer, "draft_name", "")
            phone = getattr(customer, "draft_phone", "")
            
            conf_text = (
                "📄 **Buyurtmangizni tasdiqlaysizmi?**\n\n"
                f"📦 Mahsulot: {product} ({qty} dona)\n"
                f"👤 Ism: {name}\n"
                f"📞 Telefon: {phone}\n"
                f"📍 Manzil: {text_content}\n\n"
                "Tasdiqlash uchun *Ha* deb yozing, bekor qilish uchun *Yoq*."
            )
            await send_telegram_message(plain_bot_token, chat_id, conf_text)
        else:
            await send_telegram_message(plain_bot_token, chat_id, "❗️ Manzil juda qisqa. Iltimos, to'liqroq yozing:")
        return {"status": "fsm_address"}

    elif current_stage == "confirmation":
        if text_lower in ["ha", "tasdiqlayman", "ok", "yes"]:
            customer.stage = CustomerStageEnum.NEW 
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, "🎉 Buyurtmangiz muvaffaqiyatli qabul qilindi! Tez orada operatorlarimiz bog'lanadi.", MAIN_KEYBOARD)
        else:
            customer.stage = CustomerStageEnum.NEW
            await db.commit()
            await send_telegram_message(plain_bot_token, chat_id, "❌ Buyurtma bekor qilindi. Boshqa mahsulot qidirishni davom ettirishingiz mumkin.", MAIN_KEYBOARD)
        return {"status": "fsm_confirmation"}

    # =======================================================
    # 5. AI ENGINE GA YUBORISHDAN OLDIN "KUTING" XABARI
    # =======================================================
    # KUTTIRIB QO'YMASLIK UCHUN QO'SHILDI:
    if text_lower in ["/products", "👟 mahsulotlar"]:
        # 1. Darhol kutish xabarini yuboramiz
        await send_telegram_message(plain_bot_token, chat_id, "🔍 *Katalogdan ma'lumotlar yuklanmoqda, iltimos biroz kuting...* ⏳")
        # 2. AI mahsulotlarni topib berishi uchun mijozning gapini aniq qilib o'zgartiramiz:
        text_content = "Iltimos, bazada mavjud bo'lgan barcha mahsulotlarni ro'yxatini chiroyli qilib taqdim eting."
    
    # =======================================================
    # 6. AI SALES ENGINE
    # =======================================================
    ai_reply_text, tool_calls_made, is_handoff = await ai_engine.generate_response(
        db, organization, customer, conversation, text_content
    )

    # Buyurtma boshlanishini ushlash
    order_match = re.search(r'\[ORDER:(.*?)\]', ai_reply_text)
    if order_match:
        product_name = order_match.group(1).strip()
        customer.draft_product = product_name
        customer.stage = "ask_quantity"
        await db.commit()

        ai_reply_text = re.sub(r'\[ORDER:.*?\]', '', ai_reply_text).strip()
        final_text = f"{ai_reply_text}\n\n🔢 Iltimos, nechta **{product_name}** kerakligini yozing (faqat raqam, masalan: 1, 2):"
        
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