from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Organization, User, Order, TelegramBot, OrderStatusEnum, Membership, RoleEnum, AISettings, Plan, Subscription, SubscriptionStatusEnum
from app.schemas import StandardResponse
from app.dependencies import get_current_user
from app.config import settings
from app.security import get_password_hash

router = APIRouter(prefix="/superadmin", tags=["Super Admin Platform"])

# ---- Maxfiy kalitni .env dan oladi (SUPER_ADMIN_SECRET) ----
SUPER_ADMIN_SECRET = getattr(settings, 'SUPER_ADMIN_SECRET', None) or settings.SECRET_KEY


class SetupSuperAdminRequest(BaseModel):
    email: str
    secret_key: str


class CreateSuperAdminRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    secret_key: str


@router.post("/setup", response_model=StandardResponse)
async def setup_superadmin(data: SetupSuperAdminRequest, db: AsyncSession = Depends(get_db)):
    """
    Mavjud foydalanuvchini superadmin qilish.
    Secret key talab qilinadi (.env dagi SECRET_KEY yoki SUPER_ADMIN_SECRET).
    """
    if data.secret_key != SUPER_ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Noto'g'ri maxfiy kalit (secret_key)")

    res = await db.execute(select(User).where(User.email == data.email))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail=f"'{data.email}' emailli foydalanuvchi topilmadi. Avval ro'yxatdan o'ting.")

    user.is_superadmin = True
    await db.commit()

    return StandardResponse(
        success=True,
        data={
            "message": f"✅ {user.full_name} ({user.email}) muvaffaqiyatli SuperAdmin qilindi!",
            "user_id": str(user.id),
            "email": user.email,
            "full_name": user.full_name
        }
    )


@router.post("/create", response_model=StandardResponse)
async def create_superadmin(data: CreateSuperAdminRequest, db: AsyncSession = Depends(get_db)):
    """
    Yangi SuperAdmin foydalanuvchi yaratish (ro'yxatdan o'tish + superadmin).
    Secret key talab qilinadi (.env dagi SECRET_KEY yoki SUPER_ADMIN_SECRET).
    """
    if data.secret_key != SUPER_ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Noto'g'ri maxfiy kalit (secret_key)")

    # Check existing
    res = await db.execute(select(User).where(User.email == data.email))
    if res.scalars().first():
        raise HTTPException(status_code=400, detail=f"'{data.email}' emailli foydalanuvchi allaqachon mavjud. /superadmin/setup ni ishlating.")

    import re
    def slugify(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[\s_-]+', '-', text)
        return text or "org"

    # Create SuperAdmin User
    new_user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        is_superadmin=True
    )
    db.add(new_user)
    await db.flush()

    # Create Organization
    import uuid
    org_name = f"{data.full_name}'s Business"
    slug = f"{slugify(data.full_name)}-{str(new_user.id)[:6]}"

    new_org = Organization(name=org_name, slug=slug, phone=data.phone)
    db.add(new_org)
    await db.flush()

    # Create Membership as OWNER
    db.add(Membership(
        organization_id=new_org.id,
        user_id=new_user.id,
        role=RoleEnum.OWNER,
        permissions=["*"]
    ))

    # Default AI Settings
    db.add(AISettings(
        organization_id=new_org.id,
        bot_name="AI Sotuvchi",
        personality="Professional, hushmuomala va samimiy sotuvchi"
    ))

    # Attach Free Trial Plan
    plan_res = await db.execute(select(Plan).where(Plan.slug == "free-trial"))
    plan = plan_res.scalars().first()
    if not plan:
        plan_res = await db.execute(select(Plan).order_by(Plan.price_monthly.asc()).limit(1))
        plan = plan_res.scalars().first()
    if plan:
        db.add(Subscription(
            organization_id=new_org.id,
            plan_id=plan.id,
            status=SubscriptionStatusEnum.TRIAL,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=14)
        ))

    await db.commit()

    # Generate tokens
    from app.security import create_access_token, create_refresh_token
    access_token = create_access_token({"sub": str(new_user.id)})
    refresh_token = create_refresh_token({"sub": str(new_user.id)})

    return StandardResponse(
        success=True,
        data={
            "message": f"✅ SuperAdmin '{data.full_name}' muvaffaqiyatli yaratildi!",
            "user_id": str(new_user.id),
            "email": data.email,
            "organization_id": str(new_org.id),
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            }
        }
    )


async def verify_superadmin(current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin ruxsati talab qilinadi")
    return current_user

@router.get("/metrics", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def get_system_metrics(db: AsyncSession = Depends(get_db)):
    orgs_cnt = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    users_cnt = (await db.execute(select(func.count(User.id)))).scalar() or 0
    bots_cnt = (await db.execute(select(func.count(TelegramBot.id)))).scalar() or 0
    
    orders_res = await db.execute(select(Order).where(Order.status != OrderStatusEnum.CANCELLED))
    orders = orders_res.scalars().all()
    total_platform_revenue = sum(float(o.total_amount) for o in orders)

    return StandardResponse(
        success=True,
        data={
            "total_businesses": orgs_cnt,
            "total_users": users_cnt,
            "total_connected_bots": bots_cnt,
            "total_platform_orders": len(orders),
            "total_platform_gmv": total_platform_revenue,
            "system_health": "100% Operational"
        }
    )

@router.get("/businesses", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def list_all_businesses(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = res.scalars().all()
    return StandardResponse(
        success=True,
        data=[
            {
                "id": str(o.id),
                "name": o.name,
                "slug": o.slug,
                "phone": o.phone,
                "category": o.category,
                "is_active": o.is_active,
                "created_at": o.created_at.isoformat()
            }
            for o in orgs
        ]
    )


@router.get("/payments", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def list_all_payments(db: AsyncSession = Depends(get_db)):
    """Barcha tushgan to'lov so'rovlarini ko'rish."""
    from app.models import PaymentRequest, Plan, Organization
    res = await db.execute(select(PaymentRequest).order_by(PaymentRequest.created_at.desc()))
    payments = res.scalars().all()

    payment_list = []
    for p in payments:
        org_res = await db.execute(select(Organization).where(Organization.id == p.organization_id))
        org = org_res.scalars().first()
        plan_res = await db.execute(select(Plan).where(Plan.id == p.plan_id))
        plan = plan_res.scalars().first()

        payment_list.append({
            "id": str(p.id),
            "organization_id": str(p.organization_id),
            "business_name": org.name if org else "Noma'lum",
            "plan_name": plan.name if plan else "Tarif",
            "amount": float(p.amount),
            "currency": p.currency,
            "sender_name": p.sender_name,
            "sender_phone": p.sender_phone,
            "transaction_id": p.transaction_id,
            "receipt_image_url": p.receipt_image_url,
            "status": p.status.value,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return StandardResponse(success=True, data=payment_list)


@router.post("/payments/{payment_id}/approve", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def approve_payment(payment_id: str, db: AsyncSession = Depends(get_db)):
    """To'lovni tasdiqlash va biznes uchun tanlangan tarif obunasini 30 kunga faollashtirish."""
    from app.models import PaymentRequest, PaymentRequestStatusEnum, Subscription, SubscriptionStatusEnum, Plan
    from uuid import UUID
    from datetime import datetime, timedelta

    try:
        pay_uuid = UUID(payment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri ID formati")

    p_res = await db.execute(select(PaymentRequest).where(PaymentRequest.id == pay_uuid))
    payment = p_res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="To'lov so'rovi topilmadi")

    payment.status = PaymentRequestStatusEnum.APPROVED
    payment.updated_at = datetime.utcnow()

    # Activate or renew organization subscription
    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == payment.organization_id))
    sub = sub_res.scalars().first()

    now = datetime.utcnow()
    new_end = now + timedelta(days=30)

    if sub:
        # If current active, extend from current end date
        if sub.current_period_end and sub.current_period_end > now and sub.status == SubscriptionStatusEnum.ACTIVE:
            new_end = sub.current_period_end + timedelta(days=30)
        sub.plan_id = payment.plan_id
        sub.status = SubscriptionStatusEnum.ACTIVE
        sub.current_period_start = now
        sub.current_period_end = new_end
    else:
        sub = Subscription(
            organization_id=payment.organization_id,
            plan_id=payment.plan_id,
            status=SubscriptionStatusEnum.ACTIVE,
            current_period_start=now,
            current_period_end=new_end
        )
        db.add(sub)

    await db.commit()
    return StandardResponse(success=True, data={"message": "To'lov tasdiqlandi va obuna 30 kunga faollashtirildi!"})


@router.post("/payments/{payment_id}/reject", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def reject_payment(payment_id: str, db: AsyncSession = Depends(get_db)):
    """To'lovni bekor qilish."""
    from app.models import PaymentRequest, PaymentRequestStatusEnum
    from uuid import UUID

    try:
        pay_uuid = UUID(payment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri ID formati")

    p_res = await db.execute(select(PaymentRequest).where(PaymentRequest.id == pay_uuid))
    payment = p_res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="To'lov so'rovi topilmadi")

    payment.status = PaymentRequestStatusEnum.REJECTED
    payment.updated_at = datetime.utcnow()
    await db.commit()
    return StandardResponse(success=True, data={"message": "To'lov so'rovi rad etildi."})

