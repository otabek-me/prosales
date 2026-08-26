from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.models import Organization, AISettings
from app.schemas import OrganizationResponse, OrganizationBase, AISettingsResponse, AISettingsUpdate, StandardResponse
from app.dependencies import get_current_organization_id, RequirePermission

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.get("/current", response_model=StandardResponse)
async def get_current_org(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    
    return StandardResponse(success=True, data=OrganizationResponse.model_validate(org))

@router.put("/current", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def update_current_org(
    data: OrganizationBase,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    org.name = data.name
    if data.phone:
        org.phone = data.phone
    if data.category:
        org.category = data.category
    if data.logo_url:
        org.logo_url = data.logo_url

    await db.commit()
    return StandardResponse(success=True, data=OrganizationResponse.model_validate(org))

@router.get("/ai-settings", response_model=StandardResponse)
async def get_ai_settings(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(AISettings).where(AISettings.organization_id == org_id))
    ai_set = res.scalars().first()
    if not ai_set:
        ai_set = AISettings(organization_id=org_id)
        db.add(ai_set)
        await db.commit()

    return StandardResponse(success=True, data=AISettingsResponse.model_validate(ai_set))

@router.put("/ai-settings", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def update_ai_settings(
    data: AISettingsUpdate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(AISettings).where(AISettings.organization_id == org_id))
    ai_set = res.scalars().first()
    if not ai_set:
        ai_set = AISettings(organization_id=org_id)
        db.add(ai_set)

    if data.bot_name is not None:
        ai_set.bot_name = data.bot_name
    if data.personality is not None:
        ai_set.personality = data.personality
    if data.custom_instructions is not None:
        ai_set.custom_instructions = data.custom_instructions
    if data.preferred_language is not None:
        ai_set.preferred_language = data.preferred_language
    if data.handoff_keywords is not None:
        ai_set.handoff_keywords = data.handoff_keywords
    if data.delivery_terms is not None:
        ai_set.delivery_terms = data.delivery_terms
    if data.payment_terms is not None:
        ai_set.payment_terms = data.payment_terms

    await db.commit()
    return StandardResponse(success=True, data=AISettingsResponse.model_validate(ai_set))
