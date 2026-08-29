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

# ========== TOOL TA'RIFLARI ==========
# create_order endi product_name ni asosiy parametr sifatida oladi,
# product_id ixtiyoriy (fallback) bo'lib qoldi.
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
                        "description": "Mahsulot nomi yoki tavsifi bo'yicha qidiruv so'zi"
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
            "description": "Muayyan mahsulotning barcha batafsil ma'lumotlarini olish.",
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
            "description": "Mijoz barcha ma'lumotlarni tasdiqlaganidan so'ng yangi buyurtma yaratish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "Mahsulot nomi (masalan: 'zaryadchik')"
                    },
                    "product_id": {
                        "type": "string",
                        "description": "Mahsulot UUID (ixtiyoriy)"
                    },
                    "variant_id": {
                        "type": "string",
                        "description": "Variant/razmer UUID (ixtiyoriy)"
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "Soni (dona)"
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Mijozning to'liq ismi"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "Mijozning telefon raqami"
                    },
                    "delivery_address": {
                        "type": "string",
                        "description": "Yetkazib berish manzili"
                    }
                },
                "required": ["product_name", "customer_name", "customer_phone", "delivery_address"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": "Buyurtma raqami (masalan: ORD-A13CEA) bo'yicha buyurtma holati, summasi, yetkazish manzili va statusini tekshirish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_number": {
                        "type": "string",
                        "description": "Buyurtma kodi yoki raqami (masalan: 'ORD-A13CEA')"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "handoff_to_operator",
            "description": "Mijoz jonli inson operator bilan gaplashmoqchi bo'lganda suhbatni operatorga o'tkazish.",
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
            "description": "Biznesning yetkazib berish, to'lov, ish vaqti va boshqa qoidalari bo'yicha ma'lumot olish.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Savol yoki mavzu"}
                },
                "required": ["query"]
            }
        }
    }
]
# ========== TOOL IJROCHISI ==========
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
        import re
        query_text = (arguments.get("query") or "").strip()
        max_price = arguments.get("max_price")

        stmt = select(Product).where(
            Product.organization_id == org_id,
            Product.is_active == True,
            Product.stock > 0
        )

        generic_stop_words = {"all", "barcha", "katalog", "hamma", "mahsulotlar", "tovarlar", "ro'yxat", "list", "bor", "mavjud", "iltimos", "taqdim", "qiling", "eting", "chiroyli"}
        words = [w.strip() for w in re.split(r'[\s,;.!?]+', query_text) if len(w.strip()) > 1]
        specific_words = [w for w in words if w.lower() not in generic_stop_words and len(w) > 2]

        if specific_words:
            conditions = []
            for w in specific_words:
                conditions.append(Product.name.ilike(f"%{w}%"))
                conditions.append(Product.description.ilike(f"%{w}%"))
            stmt = stmt.where(or_(*conditions))
        elif query_text and query_text.lower() not in generic_stop_words and len(words) <= 2:
            stmt = stmt.where(
                or_(
                    Product.name.ilike(f"%{query_text}%"),
                    Product.description.ilike(f"%{query_text}%")
                )
            )

        if max_price:
            try:
                stmt = stmt.where(Product.price <= float(max_price))
            except (ValueError, TypeError):
                pass

        stmt = stmt.order_by(Product.created_at.desc()).limit(8)
        result = await db.execute(stmt)
        products = result.scalars().all()

        if not products:
            # If search with specific keywords returned empty, fallback to latest in-stock products
            res_all = await db.execute(
                select(Product).where(
                    Product.organization_id == org_id,
                    Product.is_active == True,
                    Product.stock > 0
                ).order_by(Product.created_at.desc()).limit(5)
            )
            products = res_all.scalars().all()
            if not products:
                return json.dumps({"status": "empty", "message": "Do'konda hozircha mahsulotlar mavjud emas."})

        res_data = []
        for p in products:
            res_data.append({
                "id": str(p.id),
                "name": p.name,
                "price": float(p.price),
                "currency": p.currency,
                "stock": p.stock,
                "description": (p.description or "")[:120],
                "image_url": p.image_url
            })
        return json.dumps({"status": "success", "products": res_data}, ensure_ascii=False)

    elif function_name == "get_product_details":
        # Xavfsiz UUID tekshiruvi
        try:
            prod_id = UUID(arguments.get("product_id", ""))
        except (ValueError, TypeError):
            return json.dumps({"status": "error", "message": "Mahsulot ID noto'g'ri formatda."})

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
        # --- 1. Mahsulotni topish ---
        product = None
        product_id_raw = arguments.get("product_id")
        product_name_raw = (arguments.get("product_name") or "").strip()

        # Avval product_id orqali qidiramiz (agar to'g'ri UUID bo'lsa)
        if product_id_raw:
            try:
                prod_id = UUID(product_id_raw)
                res = await db.execute(
                    select(Product).where(Product.id == prod_id, Product.organization_id == org_id)
                )
                product = res.scalars().first()
            except (ValueError, TypeError):
                # noto'g'ri UUID bo'lsa, product_name orqali qidirishga o'tamiz
                product = None

        # Agar product topilmagan bo'lsa va product_name berilgan bo'lsa, nom bo'yicha qidiramiz
        if not product and product_name_raw:
            res = await db.execute(
                select(Product).where(
                    Product.organization_id == org_id,
                    Product.is_active == True,
                    Product.stock > 0,
                    Product.name.ilike(f"%{product_name_raw}%")
                ).limit(1)
            )
            product = res.scalars().first()

        if not product:
            return json.dumps({"status": "error", "message": "Mahsulot topilmadi yoki omborda yetarli emas."})

        # --- 2. Boshqa parametrlarni olish ---
        variant_id = None
        if arguments.get("variant_id"):
            try:
                variant_id = UUID(arguments["variant_id"])
            except (ValueError, TypeError):
                variant_id = None

        try:
            qty = int(arguments.get("quantity", 1))
        except (ValueError, TypeError):
            qty = 1
        if qty < 1:
            qty = 1

        c_name = (arguments.get("customer_name") or "").strip()
        c_phone = (arguments.get("customer_phone") or "").strip()
        c_addr = (arguments.get("delivery_address") or "").strip()

        if not c_name or not c_phone or not c_addr:
            return json.dumps({"status": "error", "message": "Buyurtma uchun ism, telefon va manzil to'liq kerak."})

        if product.stock < qty:
            return json.dumps({"status": "error", "message": "Mahsulot omborda yetarli emas!"})

        # --- 3. Narxni hisoblash ---
        unit_price = float(product.price)
        if variant_id:
            vr = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
            var_obj = vr.scalars().first()
            if var_obj:
                unit_price += float(var_obj.price_modifier)

        import random
        order_num = f"ORD-{random.randint(100000, 999999)}"
        total_sum = round(unit_price * qty, 2)

        # --- 4. Buyurtma yaratish ---
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

        # --- 5. Mahsulot zaxirasini yangilash ---
        product.stock -= qty

        # --- 6. Mijoz ma'lumotlarini yangilash ---
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

    elif function_name == "get_order_status":
        order_num = (arguments.get("order_number") or "").strip()
        stmt = select(Order).where(Order.organization_id == org_id)

        if order_num:
            stmt = stmt.where(Order.order_number.ilike(f"%{order_num}%"))
        else:
            stmt = stmt.where(Order.customer_id == customer_id)

        stmt = stmt.order_by(Order.created_at.desc()).limit(1)
        res = await db.execute(stmt)
        order = res.scalars().first()

        if not order:
            return json.dumps({
                "status": "not_found",
                "message": f"Kechirasiz, '{order_num}' raqamli buyurtma topilmadi."
            }, ensure_ascii=False)

        status_labels = {
            "PENDING": "Kutilmoqda (tez orada operator tasdiqlaydi)",
            "CONFIRMED": "Tasdiqlangan (yetkazishga tayyorlanmoqda)",
            "PROCESSING": "Tayyorlanmoqda",
            "SHIPPED": "Yo'lda (kuryer orqali yetkazilmoqda)",
            "DELIVERED": "Yetkazib berildi",
            "CANCELLED": "Bekor qilingan"
        }
        human_status = status_labels.get(order.status.value, order.status.value)

        items_info = []
        if order.items:
            for it in order.items:
                items_info.append(f"{it.product_name} ({it.quantity} dona)")

        return json.dumps({
            "status": "found",
            "order_number": order.order_number,
            "status": human_status,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "delivery_address": order.delivery_address,
            "total_amount": float(order.total_amount),
            "currency": order.currency,
            "items": ", ".join(items_info) if items_info else order.notes or "Mavjud",
            "created_at": order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else ""
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