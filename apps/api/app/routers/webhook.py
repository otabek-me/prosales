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

@router.post("/telegram/auto")
@router.post("/telegram/{org_id}")
async def telegram_webhook(
    request: Request,
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    update = await request.json()
    logger.info(f"Received Telegram Update (org={org_id}): {update}")

    # Process message object
    message_data = update.get("message") or update.get("edited_message")
    if not message_data:
        return {"status": "ignored"}

    chat_id = str(message_data["chat"]["id"])
    text_content = message_data.get("text", "").strip()

    if not text_content:
        return {"status": "no_text"}

    organization = None
    bot_obj = None

    # Resolve organization by org_id if provided
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

    # If organization not found yet, pick the first active organization that has a bot or any active org
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

    # 1. Find or create Customer
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

    # 2. Find or create Conversation
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

    # 3. Store Customer Message
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

    # If conversation is currently assigned to human operator, do not auto-reply with AI
    if conversation.is_operator_mode:
        return {"status": "operator_mode_active"}

    # 4. Generate AI Response via AI Sales Engine
    ai_reply_text, tool_calls_made, is_handoff = await ai_engine.generate_response(
        db, organization, customer, conversation, text_content
    )

    # 5. Store AI Message
    ai_msg = Message(
        conversation_id=conversation.id,
        sender_type=SenderTypeEnum.AI,
        content=ai_reply_text,
        tool_calls_json=tool_calls_made
    )
    db.add(ai_msg)
    await db.commit()

    # 6. Send AI Reply back to Telegram User
    try:
        plain_bot_token = None
        if bot_obj and bot_obj.bot_token_encrypted:
            plain_bot_token = decrypt_token(bot_obj.bot_token_encrypted)
        elif settings.BOT_TOKEN:
            plain_bot_token = settings.BOT_TOKEN

        if plain_bot_token:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{plain_bot_token}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": ai_reply_text
                    }
                )
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {str(e)}")

    return {"status": "success", "handoff": is_handoff}
