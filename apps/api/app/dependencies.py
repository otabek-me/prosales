from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.models import User, Organization, Membership, RoleEnum
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    user_id: str = payload.get("sub")
    if user_id is None or payload.get("type") != "access":
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalars().first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

async def get_current_organization_id(
    x_organization_id: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    # If user provided X-Organization-Id header, verify user is member of it
    if x_organization_id:
        org_uuid = UUID(x_organization_id)
        result = await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.organization_id == org_uuid
            )
        )
        membership = result.scalars().first()
        if not membership and not current_user.is_superadmin:
            raise HTTPException(status_code=403, detail="Access denied to this organization")
        return org_uuid

    # Otherwise pick first membership
    result = await db.execute(
        select(Membership).where(Membership.user_id == current_user.id)
    )
    membership = result.scalars().first()
    if not membership:
        raise HTTPException(status_code=400, detail="User does not belong to any organization")
    return membership.organization_id

class RequirePermission:
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    async def __call__(
        self,
        current_user: User = Depends(get_current_user),
        org_id: UUID = Depends(get_current_organization_id),
        db: AsyncSession = Depends(get_db)
    ):
        if current_user.is_superadmin:
            return True
        
        result = await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.organization_id == org_id
            )
        )
        membership = result.scalars().first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of organization")

        # Owner has all permissions
        if membership.role in [RoleEnum.OWNER, RoleEnum.ADMIN]:
            return True

        if self.required_permission not in (membership.permissions or []):
            raise HTTPException(status_code=403, detail=f"Missing required permission: {self.required_permission}")
        return True
