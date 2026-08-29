from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import Organization, User, Order, TelegramBot, OrderStatusEnum
from app.schemas import StandardResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/superadmin", tags=["Super Admin Platform"])

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

