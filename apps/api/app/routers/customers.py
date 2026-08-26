from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.models import Customer, CustomerStageEnum
from app.schemas import CustomerResponse, StandardResponse
from app.dependencies import get_current_organization_id

router = APIRouter(prefix="/customers", tags=["Customers CRM"])

class CustomerUpdate(BaseModel):
    stage: Optional[CustomerStageEnum] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

@router.get("", response_model=StandardResponse)
async def list_customers(
    search: Optional[str] = None,
    stage: Optional[CustomerStageEnum] = None,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Customer).where(Customer.organization_id == org_id)
    if search:
        stmt = stmt.where(
            or_(
                Customer.first_name.ilike(f"%{search}%"),
                Customer.last_name.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
                Customer.username.ilike(f"%{search}%")
            )
        )
    if stage:
        stmt = stmt.where(Customer.stage == stage)

    stmt = stmt.order_by(Customer.updated_at.desc())
    res = await db.execute(stmt)
    customers = res.scalars().all()

    return StandardResponse(
        success=True,
        data=[CustomerResponse.model_validate(c) for c in customers]
    )

@router.get("/{customer_id}", response_model=StandardResponse)
async def get_customer(
    customer_id: UUID,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.organization_id == org_id))
    cust = res.scalars().first()
    if not cust:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")

    return StandardResponse(success=True, data=CustomerResponse.model_validate(cust))

@router.put("/{customer_id}", response_model=StandardResponse)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.organization_id == org_id))
    cust = res.scalars().first()
    if not cust:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")

    if data.stage is not None:
        cust.stage = data.stage
    if data.notes is not None:
        cust.notes = data.notes
    if data.tags is not None:
        cust.tags = data.tags

    await db.commit()
    return StandardResponse(success=True, data=CustomerResponse.model_validate(cust))
