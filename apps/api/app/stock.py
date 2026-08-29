"""Markazlashtirilgan stock (zaxira) boshqaruvi.

Buyurtma tasdiqlanganda mahsulot zaxirasidan miqdor ayiriladi, buyurtma bekor
qilinganda (CANCELLED / REFUNDED) esa qaytariladi. Barcha amallar idempotent —
Order.stock_deducted bayrog'i orqali ayirish/qaytarish faqat bir marta bajariladi,
shu bilan takroriy chaqiruvlar natijada ikki marta ayirish/qaytarish qilmaydi.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Order, OrderItem, Product, OrderStatusEnum

# Shu statuslarga o'tganda zaxira qaytariladi.
TERMINAL_STATUSES = {OrderStatusEnum.CANCELLED, OrderStatusEnum.REFUNDED}


async def _iter_items(db: AsyncSession, order: Order):
    res = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    return res.scalars().all()


async def _change_product_stock(db: AsyncSession, org_id, product_id, delta: int):
    """Bitta mahsulot zaxirasini delta ga o'zgartiradi (salbiy manfiy bo'lmasligi uchun max(0))."""
    if product_id is None:
        return
    res = await db.execute(
        select(Product).where(Product.id == product_id, Product.organization_id == org_id)
    )
    prod = res.scalars().first()
    if prod is not None:
        new_val = (prod.stock or 0) + delta
        prod.stock = max(0, new_val)


async def deduct_stock_for_order(db: AsyncSession, order: Order) -> bool:
    """Buyurtmadagi har bir mahsulot zaxirasidan miqdorini ayiradi.

    Agar stock allaqachon ayirilgan bo'lsa (stock_deducted=True) hech narsa qilmaydi.
    Qaytar: ayirish bajarilgan bo'lsa True, aks holda False.
    """
    if order.stock_deducted:
        return False
    for item in await _iter_items(db, order):
        await _change_product_stock(db, order.organization_id, item.product_id, -item.quantity)
    order.stock_deducted = True
    return True


async def restore_stock_for_order(db: AsyncSession, order: Order) -> bool:
    """Buyurtma bekor qilinganda har bir mahsulot zaxirasini qaytaradi.

    Agar zaxira ayirilmagan bo'lsa (stock_deducted=False) hech narsa qilmaydi.
    Qaytar: qaytarish bajarilgan bo'lsa True, aks holda False.
    """
    if not order.stock_deducted:
        return False
    for item in await _iter_items(db, order):
        await _change_product_stock(db, order.organization_id, item.product_id, item.quantity)
    order.stock_deducted = False
    return True


def status_needs_restock(status: OrderStatusEnum) -> bool:
    """Bu statusga o'tganda zaxira qaytarilishi kerakmi."""
    return status in TERMINAL_STATUSES