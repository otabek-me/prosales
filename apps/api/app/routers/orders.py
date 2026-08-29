from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.models import Order, OrderItem, OrderStatusEnum
from app.schemas import OrderResponse, OrderStatusUpdate, StandardResponse
from app.dependencies import get_current_organization_id, RequirePermission
from app.stock import deduct_stock_for_order, restore_stock_for_order, status_needs_restock

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.get("", response_model=StandardResponse)
async def list_orders(
    status: Optional[OrderStatusEnum] = None,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Order).where(Order.organization_id == org_id)
    if status:
        stmt = stmt.where(Order.status == status)
    
    stmt = stmt.order_by(Order.created_at.desc())
    res = await db.execute(stmt)
    orders = res.scalars().all()
    return StandardResponse(success=True, data=[OrderResponse.model_validate(o) for o in orders])

@router.get("/{order_id}", response_model=StandardResponse)
async def get_order_detail(
    order_id: UUID,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Order).where(Order.id == order_id, Order.organization_id == org_id))
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    return StandardResponse(success=True, data=OrderResponse.model_validate(order))

@router.put("/{order_id}/status", response_model=StandardResponse, dependencies=[Depends(RequirePermission("orders.update"))])
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Order).where(Order.id == order_id, Order.organization_id == org_id))
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    order.status = data.status

    # Status o'zgarishiga mos ravishda zaxirani boshqarish (idempotent):
    # - CANCELLED / REFUNDED -> zaxira qaytariladi.
    # - Boshqa (faol) statuslar -> zaxira ayirilganligi ta'minlanadi.
    if status_needs_restock(order.status):
        await restore_stock_for_order(db, order)
    else:
        await deduct_stock_for_order(db, order)

    await db.commit()

    res = await db.execute(select(Order).where(Order.id == order_id))
    updated_order = res.scalars().first()
    return StandardResponse(success=True, data=OrderResponse.model_validate(updated_order))
