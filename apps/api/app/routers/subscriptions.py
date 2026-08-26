from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.models import Plan, Subscription, SubscriptionStatusEnum
from app.schemas import StandardResponse
from app.dependencies import get_current_organization_id

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions SaaS"])

@router.get("/plans", response_model=StandardResponse)
async def list_plans(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Plan).where(Plan.is_active == True))
    plans = res.scalars().all()
    if not plans:
        # Seed default plan objects if empty
        plans_data = [
            Plan(
                name="Starter",
                slug="starter",
                price_monthly=290000,
                limits_json={"conversations": 500, "products": 30, "operators": 2, "ai_messages": 2500},
                features_json=["Telegram Bot", "Standard AI Sales Engine", "Basic Analytics", "Product Catalog"]
            ),
            Plan(
                name="Business",
                slug="business",
                price_monthly=590000,
                limits_json={"conversations": 2000, "products": 150, "operators": 5, "ai_messages": 10000},
                features_json=["Everything in Starter", "Advanced AI RAG Knowledge Base", "Human Operator Live Inbox", "Full Analytics"]
            ),
            Plan(
                name="Pro",
                slug="pro",
                price_monthly=1200000,
                limits_json={"conversations": 10000, "products": 1000, "operators": 20, "ai_messages": 50000},
                features_json=["Everything in Business", "Priority Dedicated LLM", "Unlimited Webhooks", "Custom System Prompt", "24/7 SLA Support"]
            )
        ]
        for p in plans_data:
            db.add(p)
        await db.commit()
        res = await db.execute(select(Plan).where(Plan.is_active == True))
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

@router.get("/current", response_model=StandardResponse)
async def get_current_subscription(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = res.scalars().first()
    if not sub:
        return StandardResponse(success=True, data=None)

    plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
    plan = plan_res.scalars().first()

    return StandardResponse(
        success=True,
        data={
            "subscription_id": str(sub.id),
            "status": sub.status,
            "current_period_end": sub.current_period_end.isoformat(),
            "plan": {
                "id": str(plan.id),
                "name": plan.name,
                "slug": plan.slug,
                "price_monthly": float(plan.price_monthly),
                "limits": plan.limits_json
            } if plan else None
        }
    )
