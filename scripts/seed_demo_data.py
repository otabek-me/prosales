import asyncio
import uuid
import logging
import os
from sqlalchemy import select

from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    Organization, User, Membership, RoleEnum, Product, ProductCategory,
    AISettings, FAQ, Customer, CustomerStageEnum, Conversation, Message, SenderTypeEnum
)
from app.security import get_password_hash, encrypt_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_demo_data")

async def seed():
    logger.info("Starting demo data seed process...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        # Check if organization exists
        res = await db.execute(select(Organization).where(Organization.slug == "bek-krossovka"))
        existing_org = res.scalars().first()
        
        if existing_org:
            logger.info("Demo organization already exists. Skipping seed.")
            return

        # 1. Create Organization
        org = Organization(
            id=uuid.uuid4(),
            name="Bek Krossovka Uzbek Store",
            slug="bek-krossovka",
            phone="+998 90 123 45 67",
            category="Clothing & Shoes",
            is_active=True
        )
        db.add(org)
        await db.flush()

        # 2. Create Owner User
        user = User(
            id=uuid.uuid4(),
            email="admin@aisales.uz",
            password_hash=get_password_hash("Admin123!"),
            full_name="Bekzod Karimov",
            phone="+998 90 123 45 67",
            is_superadmin=True,
            is_active=True
        )
        db.add(user)
        await db.flush()

        # 3. Create Membership
        mem = Membership(
            organization_id=org.id,
            user_id=user.id,
            role=RoleEnum.OWNER,
            permissions=["*"]
        )
        db.add(mem)

        # 4. Create AI Settings
        ai_set = AISettings(
            organization_id=org.id,
            bot_name="Bek AI Sotuvchi",
            personality="Professional, hushmuomala va do'stona sotuvchi.",
            delivery_terms="Toshkent shahri bo'ylab yetkazib berish 30,000 so'm (1-2 kun ichida). Viloyatlarga 40,000 so'm.",
            payment_terms="Naqd pul, Click va Payme to'lov tizimlari."
        )
        db.add(ai_set)

        # 5. Create Product Category
        cat = ProductCategory(
            organization_id=org.id,
            name="Krossovkalar",
            slug="krossovkalar"
        )
        db.add(cat)
        await db.flush()

        # 6. Create Demo Products in UZS
        p1 = Product(
            organization_id=org.id,
            category_id=cat.id,
            name="Nike Air Max 270",
            description="Yengil va qulay sport krossovkasi. Kundalik va yugurish uchun mos.",
            sku="NK-AIR-270",
            price=450000.00,
            currency="UZS",
            stock=15,
            is_active=True
        )
        p2 = Product(
            organization_id=org.id,
            category_id=cat.id,
            name="Adidas Ultraboost",
            description="Yumshoq poshnali original sifatdagi krossovka.",
            sku="AD-ULTRA-01",
            price=420000.00,
            currency="UZS",
            stock=8,
            is_active=True
        )
        p3 = Product(
            organization_id=org.id,
            category_id=cat.id,
            name="Puma Sport Runner",
            description="Zamonaviy dizayndagi qora sport krossovkasi.",
            sku="PM-SPORT-99",
            price=390000.00,
            currency="UZS",
            stock=22,
            is_active=True
        )
        db.add_all([p1, p2, p3])

        # 7. Create Demo FAQs
        faq1 = FAQ(
            organization_id=org.id,
            question="Yetkazib berish shartlari qanday?",
            answer="Toshkent bo'ylab 30,000 so'm, 1-2 kun ichida uyingizgacha yetkaziladi."
        )
        faq2 = FAQ(
            organization_id=org.id,
            question="To'lov tizimlari qanday?",
            answer="Click, Payme yoki naqd pulda mahsulotni olganingizdan so'ng to'lashingiz mumkin."
        )
        db.add_all([faq1, faq2])

        # 8. Create Customer & Conversation
        customer = Customer(
            organization_id=org.id,
            telegram_id="987654321",
            username="alisher_v",
            first_name="Alisher",
            last_name="Vahobov",
            phone="+998 90 123 45 67",
            stage=CustomerStageEnum.READY_TO_BUY,
            language="uz"
        )
        db.add(customer)
        await db.flush()

        conv = Conversation(
            organization_id=org.id,
            customer_id=customer.id,
            is_operator_mode=False
        )
        db.add(conv)
        await db.flush()

        m1 = Message(
            conversation_id=conv.id,
            sender_type=SenderTypeEnum.CUSTOMER,
            content="Assalomu alaykum! 500 minggacha krossovka bormi?"
        )
        m2 = Message(
            conversation_id=conv.id,
            sender_type=SenderTypeEnum.AI,
            content="Albatta 👟 Sizning 500 000 so'mgacha budjetingizga mos 3 ta variant bor:\n1. Nike Air — 450 000 so'm\n2. Adidas Run — 420 000 so'm\n3. Puma Sport — 390 000 so'm"
        )
        db.add_all([m1, m2])

        await db.commit()
        
        org_id_str = str(org.id)
        logger.info(f"Demo data seeded successfully!")
        logger.info(f"")
        logger.info(f"╔══════════════════════════════════════════════════╗")
        logger.info(f"║  Organization ID: {org_id_str}  ║")
        logger.info(f"╚══════════════════════════════════════════════════╝")
        logger.info(f"")
        logger.info(f"Login: admin@aisales.uz / Admin123!")
        
        # Auto-update .env with DEFAULT_ORG_ID
        import os
        env_path = os.path.join(os.path.dirname(__file__), "..", "apps", "api", ".env")
        env_path = os.path.abspath(env_path)
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "DEFAULT_ORG_ID" in content:
                import re
                content = re.sub(r"DEFAULT_ORG_ID=.*", f"DEFAULT_ORG_ID={org_id_str}", content)
            else:
                content += f"\n# Auto-generated by seed script\nDEFAULT_ORG_ID={org_id_str}\n"
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f".env fayliga DEFAULT_ORG_ID={org_id_str} yozildi ✅")
        else:
            logger.warning(f".env fayli topilmadi: {env_path}")
            logger.warning(f"Qo'lda qo'shing: DEFAULT_ORG_ID={org_id_str}")

if __name__ == "__main__":
    if os.getenv("SEED_DEMO") != "1":
        print("Demo ma'lumotlar uchun SEED_DEMO=1 ni o'rnatish kerak.")
        print("Masalan: $env:SEED_DEMO='1'; python scripts/seed_demo_data.py")
    else:
        asyncio.run(seed())
