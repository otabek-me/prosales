from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.config import settings
from app.models import (
    Plan, Subscription, SubscriptionStatusEnum, PaymentRequest,
    PaymentRequestStatusEnum, Organization, Product, Conversation, Customer
)
from app.schemas import StandardResponse
from app.dependencies import get_current_organization_id, get_current_user

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions SaaS"])


class PaymentSubmitRequest(BaseModel):
    plan_id: str
    sender_name: str
    sender_phone: Optional[str] = None
    transaction_id: Optional[str] = None
    receipt_image_url: Optional[str] = None
    notes: Optional[str] = None


def get_configured_plans():
    """Tariflar va ularning limitlarini .env (settings) orqali dinamik oladi."""
    return [
        {
            "name": settings.PLAN_TRIAL_NAME,
            "slug": "free-trial",
            "price_monthly": settings.PLAN_TRIAL_PRICE,
            "limits_json": {
                "conversations": settings.PLAN_TRIAL_MAX_CONVERSATIONS,
                "products": settings.PLAN_TRIAL_MAX_PRODUCTS,
                "operators": 1,
                "ai_messages": settings.PLAN_TRIAL_MAX_AI_MESSAGES,
                "max_file_size_mb": settings.PLAN_TRIAL_MAX_FILE_SIZE_MB,
                "max_media_per_product": settings.PLAN_TRIAL_MAX_MEDIA_PER_PRODUCT
            },
            "features_json": [
                "14 kunlik bepul to'liq sinov",
                "1 ta Telegram Bot ulash",
                f"{settings.PLAN_TRIAL_MAX_PRODUCTS} tagacha mahsulot qo'shish",
                f"{settings.PLAN_TRIAL_MAX_AI_MESSAGES} ta AI xabarlari",
                f"Rasm va video yuklash ({settings.PLAN_TRIAL_MAX_FILE_SIZE_MB} MB gacha)",
                "Jonli Live Inbox",
                "Buyurtmalar boshqaruvi"
            ]
        },
        {
            "name": settings.PLAN_STARTER_NAME,
            "slug": "starter",
            "price_monthly": settings.PLAN_STARTER_PRICE,
            "limits_json": {
                "conversations": settings.PLAN_STARTER_MAX_CONVERSATIONS,
                "products": settings.PLAN_STARTER_MAX_PRODUCTS,
                "operators": 2,
                "ai_messages": settings.PLAN_STARTER_MAX_AI_MESSAGES,
                "max_file_size_mb": settings.PLAN_STARTER_MAX_FILE_SIZE_MB,
                "max_media_per_product": settings.PLAN_STARTER_MAX_MEDIA_PER_PRODUCT
            },
            "features_json": [
                "Telegram Bot ulash",
                f"AI Sotuvchi ({int(settings.PLAN_STARTER_MAX_AI_MESSAGES):,} ta xabar)",
                f"{settings.PLAN_STARTER_MAX_PRODUCTS} tagacha mahsulotlar",
                f"Video va rasm yuklash ({settings.PLAN_STARTER_MAX_FILE_SIZE_MB} MB gacha)",
                "Jonli Live Inbox va Operator rejimi",
                "Buyurtmalarni to'liq boshqarish",
                "Tezkor qidiruv va statistika"
            ]
        },
        {
            "name": settings.PLAN_BUSINESS_NAME,
            "slug": "business",
            "price_monthly": settings.PLAN_BUSINESS_PRICE,
            "limits_json": {
                "conversations": settings.PLAN_BUSINESS_MAX_CONVERSATIONS,
                "products": settings.PLAN_BUSINESS_MAX_PRODUCTS,
                "operators": 5,
                "ai_messages": settings.PLAN_BUSINESS_MAX_AI_MESSAGES,
                "max_file_size_mb": settings.PLAN_BUSINESS_MAX_FILE_SIZE_MB,
                "max_media_per_product": settings.PLAN_BUSINESS_MAX_MEDIA_PER_PRODUCT
            },
            "features_json": [
                "Barcha Starter imkoniyatlari",
                f"AI Sotuvchi ({int(settings.PLAN_BUSINESS_MAX_AI_MESSAGES):,} ta xabar)",
                f"{settings.PLAN_BUSINESS_MAX_PRODUCTS} tagacha mahsulotlar",
                f"Katta HD video yuklash ({settings.PLAN_BUSINESS_MAX_FILE_SIZE_MB} MB gacha)",
                "Tezkor AI javoblari",
                "5 tagacha operatorlar",
                "Kengaytirilgan savdo analitikasi"
            ]
        },
        {
            "name": settings.PLAN_PRO_NAME,
            "slug": "pro",
            "price_monthly": settings.PLAN_PRO_PRICE,
            "limits_json": {
                "conversations": settings.PLAN_PRO_MAX_CONVERSATIONS,
                "products": settings.PLAN_PRO_MAX_PRODUCTS,
                "operators": 99,
                "ai_messages": settings.PLAN_PRO_MAX_AI_MESSAGES,
                "max_file_size_mb": settings.PLAN_PRO_MAX_FILE_SIZE_MB,
                "max_media_per_product": settings.PLAN_PRO_MAX_MEDIA_PER_PRODUCT
            },
            "features_json": [
                "Cheksiz mahsulotlar",
                "Cheksiz AI xabarlari",
                f"Maksimal video/media hajmi ({settings.PLAN_PRO_MAX_FILE_SIZE_MB} MB gacha)",
                "Maxsus AI xulq-atvori va shaxsiy prompt",
                "Prioritetli tezkor server",
                "24/7 Shaxsiy menejer qo'llab-quvvatlashi"
            ]
        }
    ]


async def _ensure_seed_plans(db: AsyncSession):
    """Admin .env faylida narx yoki limitlarni o'zgartirganda bazadagi rejalarni ham yangilaydi."""
    configured = get_configured_plans()
    res = await db.execute(select(Plan))
    existing_plans = {p.slug: p for p in res.scalars().all()}

    for cfg in configured:
        p_slug = cfg["slug"]
        if p_slug in existing_plans:
            p = existing_plans[p_slug]
            p.name = cfg["name"]
            p.price_monthly = cfg["price_monthly"]
            p.limits_json = cfg["limits_json"]
            p.features_json = cfg["features_json"]
        else:
            db.add(Plan(
                name=cfg["name"],
                slug=cfg["slug"],
                price_monthly=cfg["price_monthly"],
                limits_json=cfg["limits_json"],
                features_json=cfg["features_json"]
            ))
    await db.commit()


@router.get("/plans", response_model=StandardResponse)
async def list_plans(db: AsyncSession = Depends(get_db)):
    await _ensure_seed_plans(db)
    res = await db.execute(select(Plan).where(Plan.is_active == True).order_by(Plan.price_monthly.asc()))
    plans = res.scalars().all()

    plan_list = [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "price_monthly": float(p.price_monthly),
            "limits": p.limits_json,
            "features": p.features_json
        }
        for p in plans
    ]
    return StandardResponse(success=True, data=plan_list)


@router.get("/payment-info", response_model=StandardResponse)
async def get_payment_info():
    """To'lov qilish uchun bank kartasi ma'lumotlarini .env dan olib beradi."""
    return StandardResponse(
        success=True,
        data={
            "card_number": settings.PAYMENT_CARD_NUMBER,
            "card_holder": settings.PAYMENT_CARD_HOLDER,
            "bank_name": settings.PAYMENT_CARD_BANK,
            "currency": "UZS",
            "instructions": "Ko'rsatilgan bank kartasiga tarif summasini o'tkazing va chek / to'lovchi ismini pastdagi shaklga kiriting. Operator tekshirib obunani darhol faollashtiradi."
        }
    )


@router.get("/current", response_model=StandardResponse)
async def get_current_subscription(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    await _ensure_seed_plans(db)
    res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = res.scalars().first()

    # If organization has no subscription yet, auto-create Free Trial for 14 days
    if not sub:
        trial_res = await db.execute(select(Plan).where(Plan.slug == "free-trial"))
        trial_plan = trial_res.scalars().first()
        if not trial_plan:
            trial_res = await db.execute(select(Plan).order_by(Plan.price_monthly.asc()).limit(1))
            trial_plan = trial_res.scalars().first()

        if trial_plan:
            now = datetime.utcnow()
            sub = Subscription(
                organization_id=org_id,
                plan_id=trial_plan.id,
                status=SubscriptionStatusEnum.TRIAL,
                current_period_start=now,
                current_period_end=now + timedelta(days=14)
            )
            db.add(sub)
            await db.commit()

    plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
    plan = plan_res.scalars().first()

    # Count current usage (products count, conversations count)
    prod_count_res = await db.execute(select(Product).where(Product.organization_id == org_id))
    current_products_count = len(prod_count_res.scalars().all())

    conv_count_res = await db.execute(select(Conversation).where(Conversation.organization_id == org_id))
    current_conv_count = len(conv_count_res.scalars().all())

    is_expired = datetime.utcnow() > sub.current_period_end

    return StandardResponse(
        success=True,
        data={
            "subscription_id": str(sub.id),
            "status": "EXPIRED" if is_expired else sub.status.value,
            "is_trial": sub.status == SubscriptionStatusEnum.TRIAL,
            "is_active": sub.status in [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.TRIAL] and not is_expired,
            "current_period_start": sub.current_period_start.isoformat(),
            "current_period_end": sub.current_period_end.isoformat(),
            "days_left": max(0, (sub.current_period_end - datetime.utcnow()).days),
            "plan": {
                "id": str(plan.id),
                "name": plan.name,
                "slug": plan.slug,
                "price_monthly": float(plan.price_monthly),
                "limits": plan.limits_json,
                "features": plan.features_json
            } if plan else None,
            "usage": {
                "products_count": current_products_count,
                "products_limit": plan.limits_json.get("products", 5) if plan else 5,
                "conversations_count": current_conv_count,
                "conversations_limit": plan.limits_json.get("conversations", 50) if plan else 50,
                "max_file_size_mb": plan.limits_json.get("max_file_size_mb", 15) if plan else 15,
                "max_media_per_product": plan.limits_json.get("max_media_per_product", 3) if plan else 3
            }
        }
    )


@router.post("/pay", response_model=StandardResponse)
async def submit_payment(
    data: PaymentSubmitRequest,
    org_id: UUID = Depends(get_current_organization_id),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mijoz bank kartasiga to'lov qilgach, chek ma'lumotlarini tasdiqlash uchun yuboradi."""
    try:
        plan_uuid = UUID(data.plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tarif tanlangan.")

    plan_res = await db.execute(select(Plan).where(Plan.id == plan_uuid))
    plan = plan_res.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Tanlangan tarif topilmadi.")

    payment = PaymentRequest(
        organization_id=org_id,
        user_id=current_user.id if current_user else None,
        plan_id=plan.id,
        amount=plan.price_monthly,
        currency="UZS",
        card_number=settings.PAYMENT_CARD_NUMBER,
        sender_name=data.sender_name,
        sender_phone=data.sender_phone or getattr(current_user, "phone", None),
        receipt_image_url=data.receipt_image_url or data.notes,
        transaction_id=data.transaction_id,
        status=PaymentRequestStatusEnum.PENDING
    )
    db.add(payment)
    await db.commit()

    return StandardResponse(
        success=True,
        data={
            "payment_id": str(payment.id),
            "status": "PENDING",
            "message": "To'lovingiz qabul qilindi! Admin tekshirib tasdiqlagach, obunangiz faollashadi."
        }
    )


@router.get("/my-payments", response_model=StandardResponse)
async def get_my_payments(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(PaymentRequest)
        .where(PaymentRequest.organization_id == org_id)
        .order_by(PaymentRequest.created_at.desc())
    )
    payments = res.scalars().all()

    payment_list = []
    for p in payments:
        plan_res = await db.execute(select(Plan).where(Plan.id == p.plan_id))
        pl = plan_res.scalars().first()
        payment_list.append({
            "id": str(p.id),
            "plan_name": pl.name if pl else "Tarif",
            "amount": float(p.amount),
            "currency": p.currency,
            "sender_name": p.sender_name,
            "status": p.status.value,
            "admin_notes": p.admin_notes,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return StandardResponse(success=True, data=payment_list)

