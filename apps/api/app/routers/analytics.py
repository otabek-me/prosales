from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.database import get_db
from app.models import Order, Customer, Conversation, Message, OrderItem, CustomerStageEnum, OrderStatusEnum, SenderTypeEnum
from app.schemas import StandardResponse, OrderResponse
from app.dependencies import get_current_organization_id

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard", response_model=StandardResponse)
async def get_dashboard_analytics(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    # Total conversations count
    conv_count_res = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.organization_id == org_id)
    )
    total_convs = conv_count_res.scalar() or 0

    # Total customers/leads count
    cust_count_res = await db.execute(
        select(func.count(Customer.id)).where(Customer.organization_id == org_id)
    )
    total_custs = cust_count_res.scalar() or 0

    # Total orders count & revenue
    orders_res = await db.execute(
        select(Order).where(Order.organization_id == org_id, Order.status != OrderStatusEnum.CANCELLED)
    )
    orders = orders_res.scalars().all()
    total_orders = len(orders)
    total_revenue = sum(float(o.total_amount or 0) for o in orders)

    # Conversion rate
    conversion_rate = round((total_orders / total_custs * 100), 1) if total_custs > 0 else 0.0

    # Sales funnel stages aggregation
    funnel = {}
    for stage in CustomerStageEnum:
        stage_cnt_res = await db.execute(
            select(func.count(Customer.id)).where(Customer.organization_id == org_id, Customer.stage == stage)
        )
        funnel[stage.value] = stage_cnt_res.scalar() or 0

    # Recent 5 Orders
    rec_orders_res = await db.execute(
        select(Order)
        .where(Order.organization_id == org_id)
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    recent_orders = rec_orders_res.scalars().all()
    recent_orders_data = [OrderResponse.model_validate(o) for o in recent_orders]

    # AI handled rate: AI messages / (AI + Operator messages)
    conv_ids_sub = select(Conversation.id).where(Conversation.organization_id == org_id)
    ai_msg_res = await db.execute(
        select(func.count(Message.id)).where(
            Message.conversation_id.in_(conv_ids_sub),
            Message.sender_type == SenderTypeEnum.AI
        )
    )
    ai_msg_count = ai_msg_res.scalar() or 0

    op_msg_res = await db.execute(
        select(func.count(Message.id)).where(
            Message.conversation_id.in_(conv_ids_sub),
            Message.sender_type == SenderTypeEnum.OPERATOR
        )
    )
    op_msg_count = op_msg_res.scalar() or 0

    total_replies = ai_msg_count + op_msg_count
    ai_handled_rate = round(ai_msg_count / total_replies * 100, 1) if total_replies > 0 else 0.0

    return StandardResponse(
        success=True,
        data={
            "total_conversations": total_convs,
            "total_customers": total_custs,
            "total_leads": total_custs,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "conversion_rate": conversion_rate,
            "ai_handled_rate": ai_handled_rate,
            "sales_funnel": funnel,
            "recent_orders": recent_orders_data
        }
    )
