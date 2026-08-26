from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
import httpx

from app.database import get_db
from app.models import Conversation, Message, Customer, TelegramBot, SenderTypeEnum
from app.schemas import ConversationResponse, MessageResponse, StandardResponse
from app.security import decrypt_token
from app.dependencies import get_current_organization_id

router = APIRouter(prefix="/conversations", tags=["Live Inbox Conversations"])

class SendOperatorMessageRequest(BaseModel):
    content: str

class ToggleOperatorModeRequest(BaseModel):
    is_operator_mode: bool

@router.get("", response_model=StandardResponse)
async def list_conversations(
    is_operator_mode: Optional[bool] = None,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation).where(Conversation.organization_id == org_id)
    if is_operator_mode is not None:
        stmt = stmt.where(Conversation.is_operator_mode == is_operator_mode)

    stmt = stmt.order_by(Conversation.last_message_at.desc())
    res = await db.execute(stmt)
    conversations = res.scalars().all()
    return StandardResponse(success=True, data=[ConversationResponse.model_validate(c) for c in conversations])

@router.get("/{conversation_id}/messages", response_model=StandardResponse)
async def get_conversation_messages(
    conversation_id: UUID,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    # Verify org access
    res = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.organization_id == org_id)
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    # Mark unread count as 0
    conv.unread_count = 0
    await db.commit()

    msg_res = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = msg_res.scalars().all()

    return StandardResponse(
        success=True,
        data=[MessageResponse.model_validate(m) for m in messages]
    )

@router.put("/{conversation_id}/operator-mode", response_model=StandardResponse)
async def toggle_operator_mode(
    conversation_id: UUID,
    data: ToggleOperatorModeRequest,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.organization_id == org_id)
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    conv.is_operator_mode = data.is_operator_mode
    await db.commit()

    return StandardResponse(
        success=True,
        data={"conversation_id": str(conv.id), "is_operator_mode": conv.is_operator_mode}
    )

@router.post("/{conversation_id}/messages", response_model=StandardResponse)
async def send_operator_message(
    conversation_id: UUID,
    data: SendOperatorMessageRequest,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    # Fetch Conversation & Customer
    res = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.organization_id == org_id)
    )
    conv = res.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    cust_res = await db.execute(select(Customer).where(Customer.id == conv.customer_id))
    customer = cust_res.scalars().first()

    # Save Message
    now = datetime.utcnow()
    new_msg = Message(
        conversation_id=conv.id,
        sender_type=SenderTypeEnum.OPERATOR,
        content=data.content,
        created_at=now
    )
    db.add(new_msg)
    conv.last_message_at = now
    await db.commit()

    # Send to Telegram via Bot API if customer has telegram_id
    bot_res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
    bot_obj = bot_res.scalars().first()
    if bot_obj and customer and customer.telegram_id:
        try:
            token = decrypt_token(bot_obj.bot_token_encrypted)
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": customer.telegram_id, "text": f"👨‍💼 Operator:\n{data.content}"}
                )
        except Exception:
            pass

    return StandardResponse(success=True, data=MessageResponse.model_validate(new_msg))
