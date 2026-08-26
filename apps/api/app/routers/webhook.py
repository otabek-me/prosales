from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional
from datetime import datetime
import httpx
import logging

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

    # Xabarni olish
    message_data = update.get("message") or update.get("edited_message")
    if not message_data:
        return {"status": "ignored"}

    chat_id = str(message_data["chat"]["id"])
    text_content = message_data.get("text", "").strip()

    if not text_content:
        return {"status": "no_text"}

    # Tashkilotni aniqlash
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

    # Bot tokenini olish (Javob yuborish uchun zudlik bilan kerak)
    plain_bot_token = None
    if bot_obj and bot_obj.bot_token_encrypted:
        plain_bot_token = decrypt_token(bot_obj.bot_token_encrypted)
    elif settings.BOT_TOKEN:
        plain_bot_token = settings.BOT_TOKEN

    if not plain_bot_token:
        logger.error("Bot token topilmadi!")
        return {"status": "no_bot_token"}

    # 1. Mijozni topish yoki yaratish
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

    # 2. Suhbatni (Conversation) topish yoki yaratish
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

    # 3. Mijoz xabarini bazaga saqlash
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
    # 4. TUGMALAR VA BUYRUQLARNI UShLAB QOLISH (INTERCEPTOR)
    # =======================================================
    text_lower = text_content.lower()

    if text_lower == "/start":
        welcome_text = (
            f"Assalomu alaykum, *{tg_user.get('first_name', 'Mijoz')}*! 👋\n\n"
            f"Do'konimizning rasmiy *AI Sales yordamchisiga* xush kelibsiz.\n"
            f"Men sizga 24/7 rejimda kerakli mahsulotlarni topish va buyurtma berishga yordam beraman.\n\n"
            f"Savolingiz bo'lsa darhol yozing yoki pastdagi tugmalardan foydalaning!"
        )
        await send_telegram_message(plain_bot_token, chat_id, welcome_text, MAIN_KEYBOARD)
        return {"status": "handled_start"}

    elif text_lower in ["/products", "👟 mahsulotlar"]:
        products_text = (
            "🔥 *Katalogimizdagi mahsulotlar:*\n\n"
            "Iltimos, menga aynan nima qidirayotganingizni yozing (masalan: Krossovka, futbolka).\n"
            "AI yordamchimiz sizga bazadagi eng yaxshi variantlarni topib beradi!"
        )
        await send_telegram_message(plain_bot_token, chat_id, products_text, MAIN_KEYBOARD)
        return {"status": "handled_products"}

    elif text_lower in ["/operator", "👨‍💼 operatorga ulanish"]:
        conversation.is_operator_mode = True
        await db.commit()
        op_text = (
            "👨‍💼 Sizning so'rovingiz bo'yicha jonli operatorimizga xabar berildi.\n"
            "Tez orada operator suhbatga qo'shiladi va savollaringizga javob beradi."
        )
        await send_telegram_message(plain_bot_token, chat_id, op_text, MAIN_KEYBOARD)
        return {"status": "handled_operator"}

    elif text_lower in ["/help", "❓ yordam / faq"]:
        faq_text = (
            "❓ *Ko'p beriladigan savollar:*\n\n"
            "🚚 *Yetkazib berish:* Toshkent shahri bo'ylab 30,000 so'm (1-2 kun ichida).\n"
            "💳 *To'lov turlari:* Naqd pul, Click va Payme.\n"
            "🔄 *Qaytarish:* 14 kun ichida almashtirib beriladi.\n\n"
            "Har qanday boshqa savolingizni shunchaki yozib qoldiring!"
        )
        await send_telegram_message(plain_bot_token, chat_id, faq_text, MAIN_KEYBOARD)
        return {"status": "handled_help"}

    elif text_lower == "📦 buyurtmalarim":
        orders_text = (
            "📦 *Buyurtmalarim*\n\n"
            "Sizning hozirgi buyurtmalaringizni ko‘rish uchun iltimos, *buyurtma raqamini* shu yerga yozib yuboring."
        )
        await send_telegram_message(plain_bot_token, chat_id, orders_text, MAIN_KEYBOARD)
        return {"status": "handled_orders"}

    # Agar operator rejimi faol bo'lsa, AI ga bormaydi (kod shu yerda to'xtaydi)
    if conversation.is_operator_mode:
        return {"status": "operator_mode_active"}

    # =======================================================
    # 5. AI SALES ENGINE (Qolgan matnlar AI ga ketadi)
    # =======================================================
    ai_reply_text, tool_calls_made, is_handoff = await ai_engine.generate_response(
        db, organization, customer, conversation, text_content
    )

    # 6. AI javobini bazaga yozish
    ai_msg = Message(
        conversation_id=conversation.id,
        sender_type=SenderTypeEnum.AI,
        content=ai_reply_text,
        tool_calls_json=tool_calls_made
    )
    db.add(ai_msg)
    await db.commit()

    # 7. AI javobini Telegramga yuborish (TUGMALAR bilan birga!)
    await send_telegram_message(plain_bot_token, chat_id, ai_reply_text, MAIN_KEYBOARD)

    return {"status": "success", "handoff": is_handoff}