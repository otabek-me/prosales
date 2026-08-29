from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import httpx
import logging

from app.database import get_db
from app.config import settings
from app.models import TelegramBot
from app.schemas import BotConnectRequest, TelegramBotResponse, StandardResponse
from app.security import encrypt_token, decrypt_token
from app.dependencies import get_current_organization_id, RequirePermission

logger = logging.getLogger('ai_sales_api')

router = APIRouter(prefix="/bots", tags=["Telegram Bots"])


async def setup_telegram_webhook(bot_token: str, org_id: str) -> dict:
    """
    Avtomatik ravishda:
    1. Eski getUpdates yoki webhookni tozalaydi (deleteWebhook)
    2. .env dagi TELEGRAM_WEBHOOK_DOMAIN asosida yangi webhook o'rnatadi (setWebhook)
    3. Webhook holatini tekshiradi (getWebhookInfo)
    """
    domain = (settings.TELEGRAM_WEBHOOK_DOMAIN or "").strip().rstrip("/")
    if not domain or domain.startswith("http://localhost") or domain.startswith("http://127.0.0.1"):
        # Agar lokal domen bo'lsa (dev rejim)
        webhook_url = f"{domain}/api/v1/webhook/telegram/{org_id}" if domain else ""
    else:
        webhook_url = f"{domain}/api/v1/webhook/telegram/{org_id}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Eski webhook va kutilayotgan xabarlarni tozalash (polling bilan to'qnashmasligi uchun)
        try:
            await client.post(
                f"https://api.telegram.org/bot{bot_token}/deleteWebhook",
                json={"drop_pending_updates": True}
            )
        except Exception as e:
            logger.warning(f"deleteWebhook bajarilmadi: {e}")

        # 2. Agar domen mavjud bo'lsa, yangi webhook o'rnatamiz
        wh_ok = False
        wh_error = ""
        if webhook_url and webhook_url.startswith("https://"):
            try:
                wh_res = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/setWebhook",
                    json={
                        "url": webhook_url,
                        "drop_pending_updates": True,
                        "allowed_updates": ["message", "edited_message", "callback_query"]
                    }
                )
                wh_data = wh_res.json()
                wh_ok = wh_res.status_code == 200 and wh_data.get("ok", False)
                if not wh_ok:
                    wh_error = wh_data.get("description", "Noma'lum Telegram xatoligi")
            except Exception as e:
                wh_error = str(e)
        elif webhook_url:
            wh_error = "Telegram faqat HTTPS (SSL) webhook domenlarini qabul qiladi."

        # 3. Webhook holatini getWebhookInfo orqali tekshirish
        info = {}
        try:
            info_res = await client.get(f"https://api.telegram.org/bot{bot_token}/getWebhookInfo")
            if info_res.status_code == 200:
                info = info_res.json().get("result", {})
        except Exception:
            pass

        return {
            "success": wh_ok,
            "webhook_url": webhook_url,
            "error": wh_error,
            "info": info
        }


@router.post("/connect", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def connect_bot(
    data: BotConnectRequest,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    token_raw = data.bot_token or ""
    token = token_raw.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Bot token kiritilmadi!")

    try:
        # 1. Validate Token via Telegram API getMe
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            if res.status_code != 200 or not res.json().get("ok"):
                raise HTTPException(status_code=400, detail="Telegram bot token noto'g'ri yoki @BotFather tomonidan bekor qilingan!")
            bot_info = res.json()["result"]
            bot_username = bot_info.get("username")
            bot_name = bot_info.get("first_name")

        # 2. Avtomatik Webhook o'rnatish (.env TELEGRAM_WEBHOOK_DOMAIN dan oladi)
        wh_result = await setup_telegram_webhook(token, str(org_id))

        encrypted_token = encrypt_token(token)

        # 3. Ma'lumotlar bazasiga saqlash
        res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
        bot_obj = res.scalars().first()

        status_str = "CONNECTED" if (wh_result["success"] or not wh_result["webhook_url"].startswith("https://")) else "WEBHOOK_FAILED"

        if bot_obj:
            bot_obj.bot_token_encrypted = encrypted_token
            bot_obj.bot_username = bot_username
            bot_obj.bot_name = bot_name
            bot_obj.status = status_str
            bot_obj.webhook_url = wh_result["webhook_url"]
        else:
            bot_obj = TelegramBot(
                organization_id=org_id,
                bot_token_encrypted=encrypted_token,
                bot_username=bot_username,
                bot_name=bot_name,
                status=status_str,
                webhook_url=wh_result["webhook_url"]
            )
            db.add(bot_obj)

        await db.commit()
        logger.info("Bot ulangan: org=%s username=%s webhook=%s", org_id, bot_username, wh_result["webhook_url"])
        
        resp_data = TelegramBotResponse.model_validate(bot_obj).model_dump()
        resp_data["webhook_info"] = wh_result.get("info")
        resp_data["webhook_error"] = wh_result.get("error")
        return StandardResponse(success=True, data=resp_data)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error connecting bot for org=%s: %s", org_id, exc)
        raise HTTPException(status_code=500, detail=f"Botni ulashda xatolik yuz berdi: {str(exc)}") from exc


@router.post("/sync-webhook", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def sync_webhook(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    """Mavjud bot uchun .env dagi yangi TELEGRAM_WEBHOOK_DOMAIN bo'yicha webhookni qayta sozlaydi."""
    res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
    bot_obj = res.scalars().first()
    if not bot_obj:
        raise HTTPException(status_code=404, detail="Ushbu tashkilot uchun bot topilmadi.")

    plain_token = decrypt_token(bot_obj.bot_token_encrypted)
    if not plain_token:
        raise HTTPException(status_code=400, detail="Bot tokenini parolsizlantirishda xatolik.")

    wh_result = await setup_telegram_webhook(plain_token, str(org_id))
    bot_obj.webhook_url = wh_result["webhook_url"]
    bot_obj.status = "CONNECTED" if wh_result["success"] else "WEBHOOK_FAILED"
    await db.commit()

    return StandardResponse(
        success=True,
        data={
            "status": bot_obj.status,
            "webhook_url": bot_obj.webhook_url,
            "webhook_info": wh_result.get("info"),
            "error": wh_result.get("error")
        }
    )


@router.get("/status", response_model=StandardResponse)
async def get_bot_status(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
    bot_obj = res.scalars().first()
    if not bot_obj:
        return StandardResponse(success=True, data=None)

    resp_data = TelegramBotResponse.model_validate(bot_obj).model_dump()
    
    # Telegram live webhook info tekshirish
    try:
        plain_token = decrypt_token(bot_obj.bot_token_encrypted)
        if plain_token:
            async with httpx.AsyncClient(timeout=4.0) as client:
                info_res = await client.get(f"https://api.telegram.org/bot{plain_token}/getWebhookInfo")
                if info_res.status_code == 200:
                    resp_data["webhook_info"] = info_res.json().get("result", {})
    except Exception:
        pass

    return StandardResponse(success=True, data=resp_data)


@router.delete("/disconnect", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def disconnect_bot(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_id))
    bot_obj = res.scalars().first()
    if not bot_obj:
        raise HTTPException(status_code=404, detail="Bot topilmadi")

    try:
        plain_token = decrypt_token(bot_obj.bot_token_encrypted)
        if plain_token:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(f"https://api.telegram.org/bot{plain_token}/deleteWebhook", json={"drop_pending_updates": True})
    except Exception:
        pass

    await db.delete(bot_obj)
    await db.commit()
    return StandardResponse(success=True, data={"message": "Telegram bot uzildi va webhook o'chirildi"})
