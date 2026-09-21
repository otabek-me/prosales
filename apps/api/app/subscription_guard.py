from datetime import datetime
from uuid import UUID
from typing import Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Subscription, SubscriptionStatusEnum, Plan, Product, TelegramBot
from app.config import settings


async def get_org_subscription(db: AsyncSession, org_id: UUID) -> Tuple[Optional[Subscription], Optional[Plan], bool]:
    """
    Tashkilotning obunasi va tarifini oladi.
    Qaytaradi: (subscription, plan, is_active)
    """
    res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = res.scalars().first()
    if not sub:
        return None, None, False

    plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
    plan = plan_res.scalars().first()

    now = datetime.utcnow()
    is_expired = sub.current_period_end and sub.current_period_end < now
    is_valid_status = sub.status in [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.TRIAL]
    is_active = is_valid_status and not is_expired

    return sub, plan, is_active


async def require_active_subscription(db: AsyncSession, org_id: UUID) -> Tuple[Subscription, Plan]:
    """
    Tashkilotda faol va muddati tugamagan obuna mavjudligini qat'iy talab qiladi.
    Aks holda 403 xato beradi.
    """
    sub, plan, is_active = await get_org_subscription(db, org_id)

    if not sub or not is_active:
        raise HTTPException(
            status_code=403,
            detail=(
                "⚠️ Sizning obuna tarifingiz muddati yakunlangan yoki faol emas! "
                "Yangi ma'lumotlar qo'shish, o'zgartirish va xizmatlardan foydalanish uchun "
                "iltimos, 'Tariflar va To'lov' bo'limida tarifingizni faollashtiring."
            )
        )

    return sub, plan


async def check_product_create_limit(db: AsyncSession, org_id: UUID) -> None:
    """
    Mahsulot yaratishdan oldin:
    1. Obuna faolligi va muddati o'tmaganini tekshiradi.
    2. Tarifdagi mahsulotlar soni limitini tekshiradi.
    """
    sub, plan = await require_active_subscription(db, org_id)

    if plan and plan.limits_json and "products" in plan.limits_json:
        limit = plan.limits_json["products"]
        prods_res = await db.execute(
            select(Product).where(Product.organization_id == org_id, Product.is_active == True)
        )
        curr_count = len(prods_res.scalars().all())
        if curr_count >= limit:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Sizning tarifingizda mahsulotlar soni cheklangan ({limit} ta). "
                    f"Sizda hozir {curr_count} ta faol mahsulot bor. "
                    "Yangi mahsulot qo'shish uchun tarifingizni yangilang!"
                )
            )


async def check_product_media_limit(db: AsyncSession, org_id: UUID, media_list: list) -> None:
    """
    Mahsulotga biriktirilgan media fayllar sonini tarif bo'yicha tekshiradi.
    """
    sub, plan = await require_active_subscription(db, org_id)

    if plan and plan.limits_json and "max_media_per_product" in plan.limits_json:
        max_media = plan.limits_json["max_media_per_product"]
        if len(media_list or []) > max_media:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Sizning tarifingizda bitta mahsulotga ko'pi bilan {max_media} ta rasm/video "
                    f"yuklash mumkin. Siz {len(media_list)} ta yuklamoqchisiz. "
                    "Ko'proq media yuklash uchun tarifingizni yangilang!"
                )
            )


async def check_media_upload_allowed(db: AsyncSession, org_id: UUID) -> int:
    """
    Fayl yuklashdan oldin obuna faolligini tekshiradi va ruxsat etilgan max_file_size_mb ni qaytaradi.
    """
    sub, plan = await require_active_subscription(db, org_id)

    max_mb = settings.PLAN_TRIAL_MAX_FILE_SIZE_MB
    if plan and plan.limits_json and "max_file_size_mb" in plan.limits_json:
        max_mb = plan.limits_json["max_file_size_mb"]

    return max_mb


async def check_bot_connect_allowed(db: AsyncSession, org_id: UUID) -> None:
    """
    Telegram bot ulashdan oldin obuna faolligini tekshiradi.
    """
    await require_active_subscription(db, org_id)
