from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timedelta
import re

from app.database import get_db
from app.models import User, Organization, Membership, RoleEnum, Plan, Subscription, SubscriptionStatusEnum, AISettings
from app.schemas import UserCreate, UserLogin, UserResponse, Token, StandardResponse
from app.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.dependencies import get_current_user
import logging

logger = logging.getLogger('ai_sales_api')

router = APIRouter(prefix="/auth", tags=["Auth"])

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text or "org"

@router.post("/register", response_model=StandardResponse)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    try:
        logger.debug("Register attempt: email=%s full_name=%s", data.email, data.full_name)
        # Check existing user
        res = await db.execute(select(User).where(User.email == data.email))
        if res.scalars().first():
            raise HTTPException(status_code=400, detail="Ushbu email bilan foydalanuvchi allaqachon mavjud")

        # Create User
        new_user = User(
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            phone=data.phone
        )
        db.add(new_user)
        await db.flush()
        
        # rest of logic continues below
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error during register for email=%s: %s", data.email, exc)
        raise HTTPException(status_code=500, detail="Ichki server xatosi") from exc
    # Create Default Organization for User
    org_name = f"{data.full_name}'s Business"
    base_slug = slugify(data.full_name)
    slug = f"{base_slug}-{str(new_user.id)[:6]}"
    
    new_org = Organization(
        name=org_name,
        slug=slug,
        phone=data.phone
    )
    db.add(new_org)
    await db.flush()

    # Create Membership as OWNER
    membership = Membership(
        organization_id=new_org.id,
        user_id=new_user.id,
        role=RoleEnum.OWNER,
        permissions=["*"]
    )
    db.add(membership)

    # Create Default AI Settings for Org
    ai_set = AISettings(
        organization_id=new_org.id,
        bot_name="AI Sotuvchi",
        personality="Professional, hushmuomala va samimiy sotuvchi"
    )
    db.add(ai_set)

    # Attach Free Trial Plan
    plan_res = await db.execute(select(Plan).where(Plan.slug == "starter"))
    plan = plan_res.scalars().first()
    if plan:
        sub = Subscription(
            organization_id=new_org.id,
            plan_id=plan.id,
            status=SubscriptionStatusEnum.TRIAL,
            current_period_end=datetime.utcnow() + timedelta(days=14)
        )
        db.add(sub)

    await db.commit()

    # Generate tokens
    access_token = create_access_token({"sub": str(new_user.id)})
    refresh_token = create_refresh_token({"sub": str(new_user.id)})

    return StandardResponse(
        success=True,
        data={
            "user": UserResponse.model_validate(new_user),
            "organization_id": str(new_org.id),
            "tokens": Token(access_token=access_token, refresh_token=refresh_token)
        }
    )

@router.post("/login", response_model=StandardResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    try:
        logger.debug("Login attempt for email=%s", data.email)
        res = await db.execute(select(User).where(User.email == data.email))
        user = res.scalars().first()
        
        if not user or not verify_password(data.password, user.password_hash):
            logger.warning("Failed login for email=%s", data.email)
            raise HTTPException(status_code=400, detail="Email yoki parol noto'g'ri")

        if not user.is_active:
            raise HTTPException(status_code=400, detail="Foydalanuvchi hisobi faol emas")

        # Fetch default membership org
        mem_res = await db.execute(select(Membership).where(Membership.user_id == user.id))
        membership = mem_res.scalars().first()
        org_id = str(membership.organization_id) if membership else None

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        return StandardResponse(
            success=True,
            data={
                "user": UserResponse.model_validate(user),
                "organization_id": org_id,
                "tokens": Token(access_token=access_token, refresh_token=refresh_token)
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error during login for email=%s: %s", data.email, exc)
        raise HTTPException(status_code=500, detail="Ichki server xatosi") from exc

@router.get("/me", response_model=StandardResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mem_res = await db.execute(
        select(Membership)
        .where(Membership.user_id == current_user.id)
    )
    memberships = mem_res.scalars().all()
    org_list = []
    for m in memberships:
        org_res = await db.execute(select(Organization).where(Organization.id == m.organization_id))
        org = org_res.scalars().first()
        if org:
            org_list.append({
                "id": str(org.id),
                "name": org.name,
                "role": m.role
            })

    return StandardResponse(
        success=True,
        data={
            "user": UserResponse.model_validate(current_user),
            "organizations": org_list
        }
    )
