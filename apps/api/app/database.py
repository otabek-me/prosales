import urllib.parse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

raw_db_url = (settings.DATABASE_URL or "").strip()
if raw_db_url.startswith("DATABASE_URL="):
    raw_db_url = raw_db_url.replace("DATABASE_URL=", "", 1).strip()

if raw_db_url.startswith("postgresql://"):
    raw_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)

is_sqlite = raw_db_url.startswith("sqlite")

if is_sqlite:
    connect_args = {"check_same_thread": False}
else:
    connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
    # Clean query parameters for asyncpg
    if "?" in raw_db_url:
        parsed = urllib.parse.urlparse(raw_db_url)
        q_dict = urllib.parse.parse_qs(parsed.query)
        q_dict.pop("sslmode", None)
        q_dict.pop("channel_binding", None)
        new_query = urllib.parse.urlencode(q_dict, doseq=True)
        raw_db_url = urllib.parse.urlunparse(parsed._replace(query=new_query))

engine = create_async_engine(
    raw_db_url,
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