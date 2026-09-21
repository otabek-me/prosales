from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import (
    Organization, User, Order, TelegramBot, OrderStatusEnum, Membership, RoleEnum,
    AISettings, Plan, Subscription, SubscriptionStatusEnum, Product, Customer,
    Conversation, Message, OrderItem, PaymentRequest, PaymentRequestStatusEnum
)
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
    """Barcha bizneslarni yuqori tezlikda (batch aggregation) yuklash."""
    res = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = res.scalars().all()
    if not orgs:
        return StandardResponse(success=True, data=[])

    org_ids = [o.id for o in orgs]
    now = datetime.utcnow()

    # 1. Barcha obunalar va planlar bir vaqtda
    subs_res = await db.execute(
        select(Subscription, Plan)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .where(Subscription.organization_id.in_(org_ids))
    )
    subs_map = {sub.organization_id: (sub, plan) for sub, plan in subs_res.all()}

    # 2. Barcha Telegram botlar bir vaqtda
    bots_res = await db.execute(
        select(TelegramBot).where(TelegramBot.organization_id.in_(org_ids))
    )
    bots_map = {b.organization_id: b for b in bots_res.scalars().all()}

    # 3. Barcha Ownerlar bir vaqtda
    owners_res = await db.execute(
        select(Membership.organization_id, User)
        .join(User, User.id == Membership.user_id)
        .where(Membership.organization_id.in_(org_ids), Membership.role == RoleEnum.OWNER)
    )
    owners_map = {org_id: u for org_id, u in owners_res.all()}

    # 4. Mahsulotlar soni - bitta aggregate query
    prod_counts_res = await db.execute(
        select(Product.organization_id, func.count(Product.id))
        .where(Product.organization_id.in_(org_ids))
        .group_by(Product.organization_id)
    )
    prod_counts_map = dict(prod_counts_res.all())

    # 5. Buyurtmalar soni va daromad - bitta aggregate query
    orders_res = await db.execute(
        select(
            Order.organization_id,
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_amount), 0)
        )
        .where(Order.organization_id.in_(org_ids), Order.status != OrderStatusEnum.CANCELLED)
        .group_by(Order.organization_id)
    )
    orders_map = {org_id: (cnt, float(rev)) for org_id, cnt, rev in orders_res.all()}

    data = []
    for o in orgs:
        sub_info = subs_map.get(o.id)
        sub, plan = sub_info if sub_info else (None, None)
        plan_name = plan.name if plan else "Obunasiz"
        plan_id_str = str(sub.plan_id) if sub and sub.plan_id else None
        days_left = 0
        sub_status = "NO_SUB"
        if sub:
            is_expired = sub.current_period_end and sub.current_period_end < now
            sub_status = "EXPIRED" if is_expired else getattr(sub.status, 'value', str(sub.status))
            if sub.current_period_end:
                days_left = max(0, (sub.current_period_end - now).days)

        owner = owners_map.get(o.id)
        tg_bot = bots_map.get(o.id)
        prod_count = prod_counts_map.get(o.id, 0)
        order_count, total_revenue = orders_map.get(o.id, (0, 0.0))

        data.append({
            "id": str(o.id),
            "name": o.name,
            "slug": o.slug,
            "phone": o.phone,
            "category": o.category,
            "is_active": o.is_active,
            "created_at": o.created_at.isoformat() if o.created_at else "-",
            "owner": {
                "id": str(owner.id) if owner else None,
                "full_name": owner.full_name if owner else "Noma'lum",
                "email": owner.email if owner else "-",
                "phone": owner.phone if owner else "-"
            } if owner else None,
            "bot": {
                "username": tg_bot.bot_username if tg_bot else None,
                "status": getattr(tg_bot, 'status', 'DISCONNECTED') if tg_bot else "DISCONNECTED"
            } if tg_bot else None,
            "subscription": {
                "plan_name": plan_name,
                "plan_id": plan_id_str,
                "status": sub_status,
                "days_left": days_left,
                "period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None
            },
            "stats": {
                "products_count": prod_count,
                "orders_count": order_count,
                "total_revenue": total_revenue
            }
        })

    return StandardResponse(success=True, data=data)


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


# =========================================================================
# SUPERADMINLARNI BOSHQARISH VA YANGI SUPERADMIN QO'SHISH (Boshqa adminlar uchun)
# =========================================================================

class NewAdminCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None


class GrantAdminRequest(BaseModel):
    email: str


class UpdateBusinessSubscriptionRequest(BaseModel):
    plan_slug: str
    extend_days: int = 30
    status: Optional[str] = "ACTIVE"


@router.get("/admins", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def list_superadmins(db: AsyncSession = Depends(get_db)):
    """Barcha SuperAdminlarni ko'rish."""
    res = await db.execute(select(User).where(User.is_superadmin == True).order_by(User.created_at.asc()))
    admins = res.scalars().all()
    return StandardResponse(
        success=True,
        data=[
            {
                "id": str(a.id),
                "email": a.email,
                "full_name": a.full_name,
                "phone": a.phone,
                "created_at": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "-"
            }
            for a in admins
        ]
    )


@router.post("/admins", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def create_new_superadmin(
    data: NewAdminCreate,
    current_admin: User = Depends(verify_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """
    Tizimga kirgan SuperAdmin tomonidan yangi SuperAdmin yaratish.
    Maxfiy kalit talab etilmaydi (chunki hozirgi user allaqachon superadmin).
    """
    res = await db.execute(select(User).where(User.email == data.email.strip().lower()))
    if res.scalars().first():
        raise HTTPException(status_code=400, detail=f"'{data.email}' emaili bilan foydalanuvchi allaqachon mavjud.")

    new_user = User(
        email=data.email.strip().lower(),
        password_hash=get_password_hash(data.password),
        full_name=data.full_name.strip(),
        phone=data.phone.strip() if data.phone else None,
        is_superadmin=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return StandardResponse(
        success=True,
        data={
            "message": f"✅ Yangi SuperAdmin '{new_user.full_name}' ({new_user.email}) muvaffaqiyatli yaratildi!",
            "admin": {
                "id": str(new_user.id),
                "email": new_user.email,
                "full_name": new_user.full_name,
                "phone": new_user.phone
            }
        }
    )


@router.post("/admins/grant", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def grant_superadmin_role(
    data: GrantAdminRequest,
    current_admin: User = Depends(verify_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Mavjud ro'yxatdan o'tgan foydalanuvchiga SuperAdmin vakolatini berish."""
    res = await db.execute(select(User).where(User.email == data.email.strip().lower()))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail=f"'{data.email}' emailli foydalanuvchi topilmadi.")

    if user.is_superadmin:
        raise HTTPException(status_code=400, detail=f"'{user.email}' allaqachon SuperAdmin hisoblanadi.")

    user.is_superadmin = True
    await db.commit()

    return StandardResponse(
        success=True,
        data={"message": f"✅ {user.full_name} ({user.email}) ga SuperAdmin vakolati berildi!"}
    )


@router.delete("/admins/{admin_id}", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def revoke_superadmin_role(
    admin_id: str,
    current_admin: User = Depends(verify_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """SuperAdmin vakolatini bekor qilish."""
    from uuid import UUID
    try:
        target_uuid = UUID(admin_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri ID")

    if current_admin.id == target_uuid:
        raise HTTPException(status_code=400, detail="O'zingizning superadmin huquqingizni bekor qila olmaysiz!")

    res = await db.execute(select(User).where(User.id == target_uuid))
    target = res.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    target.is_superadmin = False
    await db.commit()

    return StandardResponse(success=True, data={"message": f"{target.full_name} dan SuperAdmin huquqi olib tashlandi."})


@router.post("/businesses/{org_id}/subscription", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def update_business_subscription(
    org_id: str,
    data: UpdateBusinessSubscriptionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    SuperAdmin tomonidan istalgan biznesning tarifini o'zgartirish va muddatini uzaytirish.
    """
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    org_res = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    plan_res = await db.execute(select(Plan).where(Plan.slug == data.plan_slug))
    plan = plan_res.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"'{data.plan_slug}' tarifi topilmadi")

    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_uuid))
    sub = sub_res.scalars().first()

    now = datetime.utcnow()
    new_end = now + timedelta(days=data.extend_days)
    if sub and sub.current_period_end and sub.current_period_end > now:
        new_end = sub.current_period_end + timedelta(days=data.extend_days)

    if sub:
        sub.plan_id = plan.id
        sub.status = SubscriptionStatusEnum.ACTIVE
        sub.current_period_start = now
        sub.current_period_end = new_end
    else:
        sub = Subscription(
            organization_id=org_uuid,
            plan_id=plan.id,
            status=SubscriptionStatusEnum.ACTIVE,
            current_period_start=now,
            current_period_end=new_end
        )
        db.add(sub)

    await db.commit()
    return StandardResponse(
        success=True,
        data={
            "message": f"✅ '{org.name}' biznesining obunasi '{plan.name}' tarifiga o'tkazildi va {data.extend_days} kunga uzaytirildi!",
            "period_end": new_end.strftime("%Y-%m-%d %H:%M")
        }
    )


@router.post("/businesses/{org_id}/toggle-status", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def toggle_business_status(
    org_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Biznesni bloklash yoki faollashtirish."""
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    org_res = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    org.is_active = not org.is_active
    await db.commit()

    status_str = "faollashtirildi" if org.is_active else "bloklandi"
    return StandardResponse(
        success=True,
        data={"message": f"'{org.name}' biznesi muvaffaqiyatli {status_str}.", "is_active": org.is_active}
    )


class ResetPasswordRequest(BaseModel):
    new_password: str


class UpdateBusinessInfoRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None


@router.get("/businesses/{org_id}/details", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def get_business_details(org_id: str, db: AsyncSession = Depends(get_db)):
    """Biznes haqida to'liq va batafsil barcha ma'lumotlarni olish."""
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    org_res = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    # Egasi (Owner)
    owner_res = await db.execute(
        select(User)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == org_uuid, Membership.role == RoleEnum.OWNER)
    )
    owner = owner_res.scalars().first()

    # Bot
    bot_res = await db.execute(select(TelegramBot).where(TelegramBot.organization_id == org_uuid))
    tg_bot = bot_res.scalars().first()

    # Obuna
    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_uuid))
    sub = sub_res.scalars().first()
    plan = None
    if sub:
        plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
        plan = plan_res.scalars().first()

    # AI Sozlamalari
    ai_res = await db.execute(select(AISettings).where(AISettings.organization_id == org_uuid))
    ai_settings = ai_res.scalars().first()

    # Mahsulotlar (oxirgi 10 ta)
    prods_res = await db.execute(
        select(Product).where(Product.organization_id == org_uuid).order_by(Product.created_at.desc()).limit(10)
    )
    prods = prods_res.scalars().all()
    total_prods_count = (await db.execute(
        select(func.count(Product.id)).where(Product.organization_id == org_uuid)
    )).scalar() or 0

    # Buyurtmalar (oxirgi 10 ta)
    orders_res = await db.execute(
        select(Order).where(Order.organization_id == org_uuid).order_by(Order.created_at.desc()).limit(10)
    )
    recent_orders = orders_res.scalars().all()
    all_orders = (await db.execute(select(Order).where(Order.organization_id == org_uuid))).scalars().all()
    total_revenue = sum(float(o.total_amount or 0) for o in all_orders if o.status != OrderStatusEnum.CANCELLED)

    # Mijozlar soni
    total_customers_count = (await db.execute(
        select(func.count(Customer.id)).where(Customer.organization_id == org_uuid)
    )).scalar() or 0

    # To'lovlar tarixi
    payments_res = await db.execute(
        select(PaymentRequest).where(PaymentRequest.organization_id == org_uuid).order_by(PaymentRequest.created_at.desc()).limit(10)
    )
    payments = payments_res.scalars().all()

    now = datetime.utcnow()
    days_left = 0
    if sub and sub.current_period_end:
        days_left = max(0, (sub.current_period_end - now).days)

    return StandardResponse(
        success=True,
        data={
            "business": {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "phone": org.phone,
                "category": org.category,
                "is_active": org.is_active,
                "created_at": org.created_at.strftime("%Y-%m-%d %H:%M") if org.created_at else "-"
            },
            "owner": {
                "id": str(owner.id) if owner else None,
                "full_name": owner.full_name if owner else "Noma'lum",
                "email": owner.email if owner else "-",
                "phone": owner.phone if owner else "-",
                "is_superadmin": owner.is_superadmin if owner else False
            } if owner else None,
            "bot": {
                "id": str(tg_bot.id) if tg_bot else None,
                "bot_username": tg_bot.bot_username if tg_bot else None,
                "bot_name": tg_bot.bot_name if tg_bot else None,
                "status": tg_bot.status if tg_bot else "DISCONNECTED",
                "webhook_url": tg_bot.webhook_url if tg_bot else None,
                "connected_at": tg_bot.created_at.strftime("%Y-%m-%d %H:%M") if tg_bot and tg_bot.created_at else None
            } if tg_bot else None,
            "subscription": {
                "id": str(sub.id) if sub else None,
                "plan_name": plan.name if plan else "Obunasiz",
                "plan_slug": plan.slug if plan else None,
                "price_monthly": float(plan.price_monthly) if plan and hasattr(plan, 'price_monthly') else 0,
                "status": "EXPIRED" if sub and sub.current_period_end and sub.current_period_end < now else (getattr(sub.status, 'value', str(sub.status)) if sub else "NO_SUB"),
                "days_left": days_left,
                "period_start": sub.current_period_start.strftime("%Y-%m-%d %H:%M") if sub and sub.current_period_start else None,
                "period_end": sub.current_period_end.strftime("%Y-%m-%d %H:%M") if sub and sub.current_period_end else None
            },
            "ai_settings": {
                "bot_name": ai_settings.bot_name if ai_settings else "AI Sotuvchi",
                "personality": ai_settings.personality if ai_settings else "-",
                "system_instructions": getattr(ai_settings, "custom_instructions", None) if ai_settings else None,
                "model": getattr(ai_settings, "model", None) or "llama-3.3-70b-versatile"
            } if ai_settings else None,
            "stats": {
                "total_products": total_prods_count,
                "total_customers": total_customers_count,
                "total_orders": len(all_orders),
                "total_revenue": total_revenue
            },
            "recent_products": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "price": float(p.price or 0),
                    "stock": p.stock,
                    "is_active": p.is_active
                }
                for p in prods
            ],
            "recent_orders": [
                {
                    "id": str(o.id),
                    "order_number": o.order_number,
                    "customer_name": o.customer_name or "Mijoz",
                    "total_amount": float(o.total_amount or 0),
                    "status": getattr(o.status, 'value', str(o.status)),
                    "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "-"
                }
                for o in recent_orders
            ],
            "payments_history": [
                {
                    "id": str(pay.id),
                    "amount": float(pay.amount or 0),
                    "status": getattr(pay.status, 'value', str(pay.status)),
                    "sender_name": pay.sender_name,
                    "created_at": pay.created_at.strftime("%Y-%m-%d %H:%M") if pay.created_at else "-"
                }
                for pay in payments
            ]
        }
    )


@router.post("/businesses/{org_id}/reset-password", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def reset_business_owner_password(
    org_id: str,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """Biznes egasining parolini yangilash (Admin tomonidan tiklash)."""
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    # Egasi (Owner) ni topish
    owner_res = await db.execute(
        select(User)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == org_uuid, Membership.role == RoleEnum.OWNER)
    )
    owner = owner_res.scalars().first()
    if not owner:
        raise HTTPException(status_code=404, detail="Biznes egasi (Owner) topilmadi.")

    if len(data.new_password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.")

    owner.password_hash = get_password_hash(data.new_password.strip())
    await db.commit()

    return StandardResponse(
        success=True,
        data={
            "message": f"✅ '{owner.full_name}' ({owner.email}) paroli muvaffaqiyatli yangilandi!",
            "owner_email": owner.email,
            "owner_name": owner.full_name
        }
    )


@router.post("/businesses/{org_id}/cancel-subscription", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def cancel_business_subscription(
    org_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Biznes obunasini bekor qilish (status = CANCELLED)."""
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_uuid))
    sub = sub_res.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Biznesda faol obuna topilmadi.")

    sub.status = SubscriptionStatusEnum.CANCELLED
    sub.current_period_end = datetime.utcnow()
    await db.commit()

    return StandardResponse(
        success=True,
        data={"message": "Biznes obunasi muvaffaqiyatli bekor qilindi (xizmatlar to'xtatildi)."}
    )


@router.put("/businesses/{org_id}", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def update_business_info(
    org_id: str,
    data: UpdateBusinessInfoRequest,
    db: AsyncSession = Depends(get_db)
):
    """Biznes ma'lumotlarini (nom, telefon, kategoriya) yangilash."""
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    org_res = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    if data.name is not None and data.name.strip():
        org.name = data.name.strip()
    if data.phone is not None:
        org.phone = data.phone.strip() or None
    if data.category is not None:
        org.category = data.category.strip() or None

    await db.commit()
    return StandardResponse(
        success=True,
        data={"message": f"'{org.name}' ma'lumotlari muvaffaqiyatli yangilandi!"}
    )


@router.delete("/businesses/{org_id}", response_model=StandardResponse, dependencies=[Depends(verify_superadmin)])
async def delete_business(
    org_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Biznesni barcha ma'lumotlari bilan to'liq va xavfsiz o'chirib yuborish."""
    from uuid import UUID
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri tashkilot ID si")

    org_res = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    org_name = org.name

    # Bog'langan barcha jadvallardan xavfsiz tozalash
    # 1. OrderItems & Orders
    orders_res = await db.execute(select(Order).where(Order.organization_id == org_uuid))
    orders = orders_res.scalars().all()
    for o in orders:
        await db.execute(OrderItem.__table__.delete().where(OrderItem.order_id == o.id))
        await db.delete(o)

    # 2. Messages & Conversations
    convs_res = await db.execute(select(Conversation).where(Conversation.organization_id == org_uuid))
    convs = convs_res.scalars().all()
    for c in convs:
        await db.execute(Message.__table__.delete().where(Message.conversation_id == c.id))
        await db.delete(c)

    # 3. Customers
    await db.execute(Customer.__table__.delete().where(Customer.organization_id == org_uuid))

    # 4. Products
    await db.execute(Product.__table__.delete().where(Product.organization_id == org_uuid))

    # 5. TelegramBot
    await db.execute(TelegramBot.__table__.delete().where(TelegramBot.organization_id == org_uuid))

    # 6. AISettings
    await db.execute(AISettings.__table__.delete().where(AISettings.organization_id == org_uuid))

    # 7. Subscriptions & Payments
    await db.execute(PaymentRequest.__table__.delete().where(PaymentRequest.organization_id == org_uuid))
    await db.execute(Subscription.__table__.delete().where(Subscription.organization_id == org_uuid))

    # 8. Memberships
    await db.execute(Membership.__table__.delete().where(Membership.organization_id == org_uuid))

    # 9. Organization o'zi
    await db.delete(org)
    await db.commit()

    return StandardResponse(
        success=True,
        data={"message": f"'{org_name}' biznesi va unga tegishli barcha ma'lumotlar butunlay o'chirildi."}
    )



