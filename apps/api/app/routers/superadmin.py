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
