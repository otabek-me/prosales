import json
from uuid import UUID
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.models import (
    Product, ProductVariant, ProductCategory, Order, OrderItem,
    Customer, Conversation, Message, FAQ, KnowledgeBase, OrderStatusEnum,
    CustomerStageEnum
)

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Katalogdan mahsulotlarni izlash yoki tavsiya qilish. Qidiruv so'zi, kategoriya yoki maksimal narx bo'yicha filtrlash mumkin.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Mahsulot nomi yoki tavsifi bo'yicha qidiruv so'zi (masalan: 'krossovka', 'sport', 'qora shirt')"
                    },
                    "max_price": {
                        "type": "number",
                        "description": "Mijozning maksimal budjeti (so'mda)"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_details",
            "description": "Muayyan mahsulotning barcha batafsil ma'lumotlarini (variantlar, o'lchamlar, zaxira va aniq narx) olish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "Mahsulotning UUID identifikatori"
                    }
                },
                "required": ["product_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": "Mijoz barcha ma'lumotlarni (mahsulot, razmer/variant, ismi, telefoni, manzili) tasdiqlaganidan so'ng yangi buyurtma yaratish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "Tanlangan mahsulot UUID"},
                    "variant_id": {"type": "string", "description": "Tanlangan variant/razmer UUID (agar mavjud bo'lsa)"},
                    "quantity": {"type": "integer", "description": "Soni (dona)"},
                    "customer_name": {"type": "string", "description": "Mijozning to'liq ismi"},
                    "customer_phone": {"type": "string", "description": "Mijozning telefon raqami"},
                    "delivery_address": {"type": "string", "description": "Yetkazib berish manzili"}
                },
                "required": ["product_id", "customer_name", "customer_phone", "delivery_address"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "handoff_to_operator",
            "description": "Mijoz jonli inson operator bilan gaplashmoqchi bo'lganda, murakkab savollar berganda yoki shikoyat qilganda suhbatni operatorga o'tkazish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Operatorga o'tkazish sababi"}
                },
                "required": ["reason"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_business_faq",
            "description": "Biznesning yetkazib berish, to'lov, ish vaqti, qaytarish qoidalari yoki FAQ bo'yicha ma'lumotlarni olish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Savol yoki mavzu (masalan: 'dostavka', 'tolov', 'kafolat')"}
                },
                "required": ["query"]
            }
        }
    }
]

async def execute_tool_call(
    db: AsyncSession,
    org_id: UUID,
    customer_id: UUID,
    conversation_id: UUID,
    function_name: str,
    arguments: Dict[str, Any]
) -> str:
    """Executes a function tool call strictly isolated by organization_id."""
    
    if function_name == "search_products":
        query_text = arguments.get("query", "").strip()
        max_price = arguments.get("max_price")
        
        stmt = select(Product).where(
            Product.organization_id == org_id,
            Product.is_active == True,
            Product.stock > 0
        )
        
        if query_text:
            stmt = stmt.where(
                or_(
                    Product.name.ilike(f"%{query_text}%"),
                    Product.description.ilike(f"%{query_text}%")
                )
            )
        if max_price:
            stmt = stmt.where(Product.price <= float(max_price))
            
        stmt = stmt.limit(5)
        result = await db.execute(stmt)
        products = result.scalars().all()
        
        if not products:
            return json.dumps({"status": "empty", "message": "Mos mahsulotlar topilmadi yoki barchasi sotilib ketgan."})
            
        res_data = []
        for p in products:
            res_data.append({
                "id": str(p.id),
                "name": p.name,
                "price": float(p.price),
                "currency": p.currency,
                "stock": p.stock,
                "description": p.description[:120] if p.description else "",
                "image_url": p.image_url
            })
        return json.dumps({"status": "success", "products": res_data}, ensure_ascii=False)

    elif function_name == "get_product_details":
        prod_id = UUID(arguments["product_id"])
        result = await db.execute(
            select(Product).where(Product.id == prod_id, Product.organization_id == org_id)
        )
        product = result.scalars().first()
        if not product:
            return json.dumps({"status": "error", "message": "Mahsulot topilmadi"})

        v_result = await db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product.id)
        )
        variants = v_result.scalars().all()
        variant_list = [
            {"id": str(v.id), "name": v.variant_name, "price_mod": float(v.price_modifier), "stock": v.stock}
            for v in variants
        ]

        return json.dumps({
            "status": "success",
            "product": {
                "id": str(product.id),
                "name": product.name,
                "description": product.description,
                "price": float(product.price),
                "currency": product.currency,
                "stock": product.stock,
                "variants": variant_list
            }
        }, ensure_ascii=False)

    elif function_name == "create_order":
        prod_id = UUID(arguments["product_id"])
        variant_id = UUID(arguments["variant_id"]) if arguments.get("variant_id") else None
        qty = int(arguments.get("quantity", 1))
        c_name = arguments["customer_name"]
        c_phone = arguments["customer_phone"]
        c_addr = arguments["delivery_address"]

        # Fetch product
        res = await db.execute(
            select(Product).where(Product.id == prod_id, Product.organization_id == org_id)
        )
        product = res.scalars().first()
        if not product or product.stock < qty:
            return json.dumps({"status": "error", "message": "Mahsulot omborda yetarli emas!"})

        unit_price = float(product.price)
        if variant_id:
            vr = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
            var_obj = vr.scalars().first()
            if var_obj:
                unit_price += float(var_obj.price_modifier)

        import random
        order_num = f"ORD-{random.randint(100000, 999999)}"
        total_sum = round(unit_price * qty, 2)

        # Create Order
        new_order = Order(
            organization_id=org_id,
            customer_id=customer_id,
            conversation_id=conversation_id,
            order_number=order_num,
            status=OrderStatusEnum.PENDING,
            customer_name=c_name,
            customer_phone=c_phone,
            delivery_address=c_addr,
            total_amount=total_sum,
            currency=product.currency
        )
        db.add(new_order)
        await db.flush()

        # Add Order Item
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=product.id,
            variant_id=variant_id,
            product_name=product.name,
            price=unit_price,
            quantity=qty,
            total=total_sum
        )
        db.add(order_item)

        # Update product stock
        product.stock -= qty

        # Update customer stage & stats
        cust_res = await db.execute(select(Customer).where(Customer.id == customer_id))
        customer = cust_res.scalars().first()
        if customer:
            customer.stage = CustomerStageEnum.ORDERED
            customer.total_orders += 1
            customer.total_spent = float(customer.total_spent or 0) + total_sum
            customer.phone = c_phone

        await db.commit()

        return json.dumps({
            "status": "success",
            "order_number": order_num,
            "total_amount": total_sum,
            "currency": product.currency,
            "message": f"Buyurtma #{order_num} muvaffaqiyatli qabul qilindi!"
        }, ensure_ascii=False)

    elif function_name == "handoff_to_operator":
        reason = arguments.get("reason", "Operator so'raldi")
        res = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
        conv = res.scalars().first()
        if conv:
            conv.is_operator_mode = True
            await db.commit()

        return json.dumps({
            "status": "success",
            "message": "Suhbat jonli operatorga o'tkazildi. Tez orada operator javob beradi."
        }, ensure_ascii=False)

    elif function_name == "get_business_faq":
        q = arguments.get("query", "")
        res = await db.execute(
            select(FAQ).where(
                FAQ.organization_id == org_id,
                FAQ.is_active == True,
                or_(FAQ.question.ilike(f"%{q}%"), FAQ.answer.ilike(f"%{q}%"))
            ).limit(3)
        )
        faqs = res.scalars().all()
        if not faqs:
            return json.dumps({"status": "empty", "message": "Ushbu savol bo'yicha maxsus FAQ topilmadi."})
        
        faq_data = [{"q": f.question, "a": f.answer} for f in faqs]
        return json.dumps({"status": "success", "faqs": faq_data}, ensure_ascii=False)

    return json.dumps({"status": "error", "message": "Noma'lum funksiya"})
