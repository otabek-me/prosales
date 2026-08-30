from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional, List
from uuid import UUID
import uuid
import re

from app.database import get_db
from app.models import Product, ProductCategory, ProductVariant
from app.schemas import (
    ProductCreate, ProductUpdate, ProductResponse, CategoryCreate, CategoryResponse, StandardResponse
)
from app.dependencies import get_current_organization_id, RequirePermission

router = APIRouter(prefix="/products", tags=["Products"])

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text or "cat"

def generate_default_sku(name: str) -> str:
    """Mahsulot nomidan avtomatik chiroyli va unikal SKU kod generatsiya qiladi."""
    import random
    clean = re.sub(r'[^\w\s]', '', name).strip().upper()
    parts = clean.split()
    if not parts:
        prefix = "PRD"
    elif len(parts) == 1:
        prefix = parts[0][:6]
    else:
        prefix = "-".join(p[:3] for p in parts[:3])
    rand_suffix = str(random.randint(1000, 9999))
    return f"{prefix}-{rand_suffix}"


async def _sku_is_taken(db: AsyncSession, org_id, sku: str, exclude_id=None) -> bool:
    """Tashkilotda shu SKU boshqa mahsulotda bandmi (exclude_id bundan mustasno)."""
    if not sku:
        return False
    stmt = select(Product).where(
        Product.organization_id == org_id,
        Product.sku.ilike(sku),
        Product.is_active == True,
    )
    if exclude_id is not None:
        stmt = stmt.where(Product.id != exclude_id)
    res = await db.execute(stmt)
    return res.scalars().first() is not None

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
    stmt = select(Product).where(Product.organization_id == org_id)
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
    # Check subscription product limits
    from app.models import Subscription, Plan
    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = sub_res.scalars().first()
    if sub:
        plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
        plan = plan_res.scalars().first()
        if plan and plan.limits_json and "products" in plan.limits_json:
            limit = plan.limits_json["products"]
            curr_prods_cnt = len((await db.execute(select(Product).where(Product.organization_id == org_id, Product.is_active == True))).scalars().all())
            if curr_prods_cnt >= limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Sizning tarifingizda mahsulotlar soni cheklangan ({limit} ta). Ko'proq mahsulot qo'shish uchun tarifingizni yangilang!"
                )

    sku_final = data.sku.strip() if data.sku and data.sku.strip() else generate_default_sku(data.name)

    if await _sku_is_taken(db, org_id, sku_final):
        # Avtomatik SKU band bo'lib qolgan bo'lsa — yangi unikal generatsiya qilamiz,
        # sotuvchi bergan SKU band bo'lsa — xato.
        if data.sku and data.sku.strip():
            raise HTTPException(status_code=409, detail="Bu SKU kod allaqachon ishlatilgan. Boshqa SKU kiriting!")
        sku_final = generate_default_sku(f"{data.name} {uuid.uuid4().hex[:4]}")

    product = Product(
        organization_id=org_id,
        category_id=data.category_id,
        name=data.name,
        description=data.description,
        sku=sku_final,
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

@router.put("/{product_id}", response_model=StandardResponse, dependencies=[Depends(RequirePermission("products.update"))])
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Product).where(Product.id == product_id, Product.organization_id == org_id)
    )
    product = res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    if data.name is not None:
        product.name = data.name
    if data.description is not None:
        product.description = data.description
    if data.sku is not None:
        if data.sku.strip() and await _sku_is_taken(db, org_id, data.sku.strip(), exclude_id=product.id):
            raise HTTPException(status_code=409, detail="Bu SKU kod allaqachon ishlatilgan. Boshqa SKU kiriting!")
        product.sku = data.sku.strip()
    if data.price is not None:
        product.price = data.price
    if data.currency is not None:
        product.currency = data.currency
    if data.stock is not None:
        product.stock = data.stock
    if data.image_url is not None:
        product.image_url = data.image_url
    if data.category_id is not None:
        product.category_id = data.category_id
    if data.tags is not None:
        product.tags = data.tags
    if data.is_active is not None:
        product.is_active = data.is_active

    await db.commit()
    await db.refresh(product)
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

