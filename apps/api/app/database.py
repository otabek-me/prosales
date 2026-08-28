from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    connect_args = {"check_same_thread": False}
else:
    # MUHIM: Agar DATABASE_URL PgBouncer yoki boshqa transaction-pooling
    # connection pooler orqali ulansa (Render/Supabase/Neon kabi
    # platformalarda odatiy holat), asyncpg'ning server-side prepared
    # statement keshini O'CHIRISH SHART.
    #
    # Sababi: pooler har bir so'rovni turli backend Postgres connection'lariga
    # yo'naltirishi mumkin, lekin asyncpg statement'ni ma'lum bir backend
    # connection'da "prepare" qilib keshlaydi. Backend almashganda yoki
    # sxema o'zgarganda (masalan ALTER TABLE), eski keshlangan statement
    # yaroqsiz bo'lib qoladi va "InvalidCachedStatementError: cached
    # statement plan is invalid due to a database schema or configuration
    # change" xatosi takror-takror chiqaveradi.
    #
    # statement_cache_size=0 — asyncpg'ga har bir so'rovni keshlamasdan,
    # to'g'ridan-to'g'ri (oddiy query protocol bilan) bajarishni buyuradi.
    # Bu picha unumdorlikdan yutqazadi, lekin pooler bilan ishlashda
    # yagona ishonchli yechim hisoblanadi.
    connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()