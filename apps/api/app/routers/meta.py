from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta

from app.database import get_db
from app.models import (
    Product, Order, Customer, Conversation, OrderStatusEnum,
)
from app.schemas import ProductResponse, OrderResponse, CustomerResponse, StandardResponse
from app.dependencies import get_current_organization_id

router = APIRouter(prefix="/meta", tags=["Global Search & Notifications"])


@router.get("/search", response_model=StandardResponse)
async def global_search(
    q: Optional[str] = None,
    limit: int = 5,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Tashkilot bo'ylab mahsulot, buyurtma va mijozlarni qidirish (guruhlangan)."""
    query = (q or "").strip()
    data = {"products": [], "orders": [], "customers": []}
    limit = max(1, min(limit or 5, 20))

    if not query:
        return StandardResponse(success=True, data=data)

    # --- Products ---
    prod_res = await db.execute(
        select(Product).where(
            Product.organization_id == org_id,
            Product.is_active == True,
            or_(
                Product.name.ilike(f"%{query}%"),
                Product.sku.ilike(f"%{query}%"),
                Product.description.ilike(f"%{query}%"),
            ),
        ).order_by(Product.created_at.desc()).limit(limit)
    )
    data["products"] = [ProductResponse.model_validate(p) for p in prod_res.scalars().all()]

    # --- Orders ---
    # Client/qidiruvda order_number yoki mijoz nomi/telefoni bo'yicha
    ord_res = await db.execute(
        select(Order).where(
            Order.organization_id == org_id,
            or_(
                Order.order_number.ilike(f"%{query}%"),
                Order.customer_name.ilike(f"%{query}%"),
                Order.customer_phone.ilike(f"%{query}%"),
            ),
        ).order_by(Order.created_at.desc()).limit(limit)
    )
    data["orders"] = [OrderResponse.model_validate(o) for o in ord_res.scalars().all()]

    # --- Customers ---
    cust_res = await db.execute(
        select(Customer).where(
            Customer.organization_id == org_id,
            or_(
                Customer.first_name.ilike(f"%{query}%"),
                Customer.last_name.ilike(f"%{query}%"),
                Customer.username.ilike(f"%{query}%"),
                Customer.phone.ilike(f"%{query}%"),
            ),
        ).order_by(Customer.updated_at.desc()).limit(limit)
    )
    data["customers"] = [CustomerResponse.model_validate(c) for c in cust_res.scalars().all()]

    return StandardResponse(success=True, data=data)


@router.get("/notifications", response_model=StandardResponse)
async def get_notifications(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Live panel uchun bildirishnomalar: operator so'rovlari, kutilayotgan buyurtmalar, yangi mijozlar."""
    conversations_res = await db.execute(
        select(Conversation).where(
            Conversation.organization_id == org_id,
            Conversation.is_operator_mode == True,
        ).order_by(Conversation.last_message_at.desc()).limit(10)
    )
    conversations = conversations_res.scalars().all()

    pending_res = await db.execute(
        select(Order).where(
            Order.organization_id == org_id,
            Order.status == OrderStatusEnum.PENDING,
        ).order_by(Order.created_at.desc()).limit(10)
    )
    pending_orders = pending_res.scalars().all()

    # Oxirgi 24 soatdagi yangi mijozlar
    since = datetime.utcnow() - timedelta(hours=24)
    new_cust_res = await db.execute(
        select(Customer).where(
            Customer.organization_id == org_id,
            Customer.created_at >= since,
        ).order_by(Customer.created_at.desc()).limit(10)
    )
    new_customers = new_cust_res.scalars().all()

    items = []

    for c in conversations:
        name = c.customer.first_name or c.customer.username or "Mijoz"
        items.append({
            "type": "operator_request",
            "title": f"👨‍💼 Operator so'rovi: {name}",
            "body": "Mijoz operator bilan bog'lanishni kutmoqda",
            "unread": bool(c.unread_count > 0),
            "link": "/dashboard/inbox",
            "created_at": c.last_message_at.isoformat(),
        })

    for o in pending_orders:
        items.append({
            "type": "new_order",
            "title": f"🛒 Yangi buyurtma #{o.order_number}",
            "body": f"{o.customer_name or 'Mijoz'} • {float(o.total_amount or 0):,.0f} {o.currency or 'UZS'}",
            "unread": True,
            "link": "/dashboard/orders",
            "created_at": o.created_at.isoformat(),
        })

    for cu in new_customers:
        name = cu.first_name or cu.username or "Mijoz"
        items.append({
            "type": "new_customer",
            "title": f"🆕 Yangi mijoz: {name}",
            "body": f"(Telegram: {cu.telegram_id or '-'})",
            "unread": True,
            "link": "/dashboard/customers",
            "created_at": cu.created_at.isoformat(),
        })

    # Vaqt bo'yicha saralash (eng yangisi birinchi)
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    unread_count = sum(1 for it in items if it["unread"])

    return StandardResponse(
        success=True,
        data={"items": items, "unread_count": unread_count}
    )