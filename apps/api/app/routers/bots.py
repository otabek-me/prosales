from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import httpx

from app.database import get_db
from app.config import settings
from app.models import TelegramBot
from app.schemas import BotConnectRequest, TelegramBotResponse, StandardResponse
from app.security import encrypt_token, decrypt_token
from app.dependencies import get_current_organization_id, RequirePermission
import logging

logger = logging.getLogger('ai_sales_api')

router = APIRouter(prefix="/bots", tags=["Telegram Bots"])

@router.post("/connect", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def connect_bot(
    data: BotConnectRequest,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    # Mask token for logs
    token_raw = data.bot_token or ""
    token = token_raw.strip()
    try:
        logger.debug(f"Bot connect attempt for org={org_id} token={('****' if token else '<empty>')})")

        # 1. Validate Token via Telegram API getMe
        async with httpx.AsyncClient() as client:
            res = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            if res.status_code != 200 or not res.json().get("ok"):
                logger.warning("Invalid Telegram token during connect for org=%s", org_id)
                raise HTTPException(status_code=400, detail="Telegram bot token noto'g'ri yoki haqiqiy emas!")
            bot_info = res.json()["result"]
            bot_username = bot_info.get("username")
            bot_name = bot_info.get("first_name")

        # 2. Set Webhook
        webhook_url = f"{settings.TELEGRAM_WEBHOOK_DOMAIN}/api/v1/webhook/telegram/{str(org_id)}"
        async with httpx.AsyncClient() as client:
            wh_res = await client.post(
                f"https://api.telegram.org/bot{token}/setWebhook",
                json={"url": webhook_url, "drop_pending_updates": True}
            )
            wh_ok = wh_res.status_code == 200 and wh_res.json().get("ok")

        # Encrypt token
        encrypted_token = encrypt_token(token)

        # Save to database
        res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
        bot_obj = res.scalars().first()

        if bot_obj:
            bot_obj.bot_token_encrypted = encrypted_token
            bot_obj.bot_username = bot_username
            bot_obj.bot_name = bot_name
            bot_obj.status = "CONNECTED" if wh_ok else "WEBHOOK_FAILED"
            bot_obj.webhook_url = webhook_url
        else:
            bot_obj = TelegramBot(
                organization_id=org_id,
                bot_token_encrypted=encrypted_token,
                bot_username=bot_username,
                bot_name=bot_name,
                status="CONNECTED" if wh_ok else "WEBHOOK_FAILED",
                webhook_url=webhook_url
            )
            db.add(bot_obj)

        await db.commit()
        logger.info("Bot connected for org=%s username=%s webhook_ok=%s", org_id, bot_username, wh_ok)
        return StandardResponse(success=True, data=TelegramBotResponse.model_validate(bot_obj))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error connecting bot for org=%s: %s", org_id, exc)
        raise HTTPException(status_code=500, detail="Ichki server xatosi - bot ulanmayapti") from exc

@router.get("/status", response_model=StandardResponse)
async def get_bot_status(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
    bot_obj = res.scalars().first()
    if not bot_obj:
        return StandardResponse(success=True, data=None)
    
    return StandardResponse(success=True, data=TelegramBotResponse.model_validate(bot_obj))

@router.delete("/disconnect", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def disconnect_bot(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
    bot_obj = res.scalars().first()
    if not bot_obj:
        raise HTTPException(status_code=404, detail="Bot topilmadi")

    # Delete Telegram webhook
    try:
        plain_token = decrypt_token(bot_obj.bot_token_encrypted)
        async with httpx.AsyncClient() as client:
            await client.post(f"https://api.telegram.org/bot{plain_token}/deleteWebhook")
    except Exception:
        pass

    await db.delete(bot_obj)
    await db.commit()
    return StandardResponse(success=True, data={"message": "Telegram bot uzildi"})
