from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.models import KnowledgeBase, FAQ
from app.schemas import (
    KnowledgeBaseCreate, KnowledgeBaseResponse, FAQCreate, FAQResponse, StandardResponse
)
from app.dependencies import get_current_organization_id, RequirePermission

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base & FAQs"])

# --- FAQ CRUD ---
@router.get("/faqs", response_model=StandardResponse)
async def list_faqs(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(FAQ).where(FAQ.organization_id == org_id))
    faqs = res.scalars().all()
    return StandardResponse(success=True, data=[FAQResponse.model_validate(f) for f in faqs])

@router.post("/faqs", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def create_faq(
    data: FAQCreate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    faq = FAQ(
        organization_id=org_id,
        question=data.question,
        answer=data.answer,
        category=data.category
    )
    db.add(faq)
    await db.commit()
    return StandardResponse(success=True, data=FAQResponse.model_validate(faq))

@router.delete("/faqs/{faq_id}", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def delete_faq(
    faq_id: UUID,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(FAQ).where(FAQ.id == faq_id, FAQ.organization_id == org_id))
    faq = res.scalars().first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ topilmadi")

    await db.delete(faq)
    await db.commit()
    return StandardResponse(success=True, data={"message": "FAQ o'chirildi"})

# --- KNOWLEDGE BASE DOCS ---
@router.get("/docs", response_model=StandardResponse)
async def list_docs(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(KnowledgeBase).where(KnowledgeBase.organization_id == org_id))
    docs = res.scalars().all()
    return StandardResponse(success=True, data=[KnowledgeBaseResponse.model_validate(d) for d in docs])

@router.post("/docs", response_model=StandardResponse, dependencies=[Depends(RequirePermission("settings.manage"))])
async def create_doc(
    data: KnowledgeBaseCreate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    doc = KnowledgeBase(
        organization_id=org_id,
        title=data.title,
        content=data.content,
        category=data.category
    )
    db.add(doc)
    await db.commit()
    return StandardResponse(success=True, data=KnowledgeBaseResponse.model_validate(doc))
