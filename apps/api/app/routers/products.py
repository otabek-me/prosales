from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional, List
from uuid import UUID
import re

from app.database import get_db
from app.models import Product, ProductCategory, ProductVariant
from app.schemas import (
    ProductCreate, ProductResponse, CategoryCreate, CategoryResponse, StandardResponse
)
from app.dependencies import get_current_organization_id, RequirePermission

router = APIRouter(prefix="/products", tags=["Products"])

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text or "cat"

# --- CATEGORIES ---
@router.get("/categories", response_model=StandardResponse)
async def list_categories(
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(ProductCategory).where(ProductCategory.organization_id == org_id)
    )
    cats = res.scalars().all()
    return StandardResponse(
        success=True,
        data=[CategoryResponse.model_validate(c) for c in cats]
    )

@router.post("/categories", response_model=StandardResponse, dependencies=[Depends(RequirePermission("products.create"))])
async def create_category(
    data: CategoryCreate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    cat = ProductCategory(
        organization_id=org_id,
        name=data.name,
        slug=slugify(data.name),
        parent_id=data.parent_id
    )
    db.add(cat)
    await db.commit()
    return StandardResponse(success=True, data=CategoryResponse.model_validate(cat))

# --- PUBLIC PRODUCTS (for Telegram bot, no auth required) ---
@router.get("/public/{org_id}", response_model=StandardResponse)
async def list_products_public(
    org_id: UUID,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Public product catalog for Telegram bot — no authentication required."""
    stmt = select(Product).where(Product.organization_id == org_id, Product.is_active == True, Product.stock > 0)
    if search:
        stmt = stmt.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%")
            )
        )
    stmt = stmt.order_by(Product.created_at.desc()).limit(10)
    res = await db.execute(stmt)
    products = res.scalars().all()
    return StandardResponse(success=True, data=[ProductResponse.model_validate(p) for p in products])

# --- PRODUCTS ---
@router.get("", response_model=StandardResponse)
async def list_products(
    search: Optional[str] = None,
    category_id: Optional[UUID] = None,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(Product.organization_id == org_id, Product.is_active == True)
    if search:
        stmt = stmt.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%")
            )
        )
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)

    stmt = stmt.order_by(Product.created_at.desc())
    res = await db.execute(stmt)
    products = res.scalars().all()
    return StandardResponse(success=True, data=[ProductResponse.model_validate(p) for p in products])

@router.post("", response_model=StandardResponse, dependencies=[Depends(RequirePermission("products.create"))])
async def create_product(
    data: ProductCreate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    product = Product(
        organization_id=org_id,
        category_id=data.category_id,
        name=data.name,
        description=data.description,
        sku=data.sku,
        price=data.price,
        currency=data.currency,
        stock=data.stock,
        image_url=data.image_url,
        tags=data.tags
    )
    db.add(product)
    await db.flush()

    # Create Variants if supplied
    for v in data.variants:
        variant = ProductVariant(
            product_id=product.id,
            variant_name=v.variant_name,
            sku=v.sku,
            price_modifier=v.price_modifier,
            stock=v.stock
        )
        db.add(variant)

    await db.commit()

    # Reload product with variants loaded
    res = await db.execute(select(Product).where(Product.id == product.id))
    created_product = res.scalars().first()

    return StandardResponse(success=True, data=ProductResponse.model_validate(created_product))

@router.get("/{product_id}", response_model=StandardResponse)
async def get_product(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Product).where(Product.id == product_id, Product.organization_id == org_id)
    )
    product = res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    return StandardResponse(success=True, data=ProductResponse.model_validate(product))

@router.delete("/{product_id}", response_model=StandardResponse, dependencies=[Depends(RequirePermission("products.delete"))])
async def delete_product(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Product).where(Product.id == product_id, Product.organization_id == org_id)
    )
    product = res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    product.is_active = False
    await db.commit()
    return StandardResponse(success=True, data={"message": "Mahsulot o'chirildi"})
