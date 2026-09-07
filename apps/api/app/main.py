from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
import json
import os

from app.config import settings
from app.database import engine, Base
from app.routers import (
    auth, organizations, bots, products, orders, customers,
    conversations, knowledge, analytics, subscriptions, superadmin, webhook, meta, uploads
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_sales_api")

app = FastAPI(
    title="AI Sales SaaS Platform API",
    description="Multi-tenant AI Sales Assistant + CRM + Telegram Bot SaaS Platform for Uzbekistan",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware — Vercel, localhost dev, va boshqa frontendlar uchun
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"(https?://localhost(:\d+)?|https://.*\.vercel\.app|https://.*\.netlify\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple request logging middleware (development only)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        body_bytes = await request.body()
        body = None
        if body_bytes:
            try:
                body = json.loads(body_bytes.decode('utf-8'))
                # mask sensitive fields
                if isinstance(body, dict):
                    if 'password' in body:
                        body['password'] = '****'
                    if 'bot_token' in body:
                        body['bot_token'] = '****'
            except Exception:
                body = '<non-json body>'
    except Exception:
        body = '<could not read body>'

    logging.getLogger('ai_sales_api').debug(f"Incoming request: {request.method} {request.url.path} body={body}")
    response = await call_next(request)
    logging.getLogger('ai_sales_api').debug(f"Response: {request.method} {request.url.path} status={response.status_code}")
    return response

# Global Exception Handler (Standardized Error Response)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc) if settings.ENVIRONMENT == "development" else "Ichki tizim xatoligi yuz berdi"
            }
        }
    )

# Health Checks
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "api", "version": "1.0.0"}

@app.get("/ready")
def readiness_check():
    return {"status": "ready"}

# Include API Routers
v1 = settings.API_V1_STR
app.include_router(auth.router, prefix=v1)
app.include_router(organizations.router, prefix=v1)
app.include_router(bots.router, prefix=v1)
app.include_router(products.router, prefix=v1)
app.include_router(orders.router, prefix=v1)
app.include_router(customers.router, prefix=v1)
app.include_router(conversations.router, prefix=v1)
app.include_router(knowledge.router, prefix=v1)
app.include_router(analytics.router, prefix=v1)
app.include_router(subscriptions.router, prefix=v1)
app.include_router(superadmin.router, prefix=v1)
app.include_router(meta.router, prefix=v1)
app.include_router(uploads.router, prefix=v1)
app.include_router(webhook.router, prefix=v1)
# Also mount webhook at root /webhook for backward compatibility
app.include_router(webhook.router)

# Mount static files for media uploads (rasm va videolarni streaming/brauzerda ko'rish uchun)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "products"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


async def _ensure_column(conn, dialect, table, column, sqlite_type, pg_type):
    """Yengil (idempotent) migration: jadvalda ustun yo'q bo'lsa qo'shadi.

    SQLAlchemy create_all mavjud jadvalga ustun qo'shmaydi, shuning uchun bu yerda
    SQL orqali idempotent tarzda qo'shamiz.
    """
    from sqlalchemy import text
    if dialect == "sqlite":
        res = await conn.execute(text(
            f"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = :c"
        ), {"c": column})
        has_col = bool((res.scalar() or 0) > 0)
        if not has_col:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_type}"))
            logger.info("Added %s.%s (sqlite)", table, column)
    else:
        res = await conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ), {"t": table, "c": column})
        has_col = bool((res.scalar() or 0) > 0)
        if not has_col:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {pg_type}"))
            logger.info("Added %s.%s (postgres)", table, column)


async def _run_lightweight_migrations(conn) -> None:
    dialect = conn.dialect.name
    # Tanlangan mahsulotning aniq row ID si (narx noto'g'ri topilmasligi uchun).
    await _ensure_column(conn, dialect, "customers", "draft_product_id", "CHAR(32)", "UUID")
    # Buyurtma zaxirasi ayirilganligi bayrog'i (idempotent stock boshqaruvi).
    await _ensure_column(conn, dialect, "orders", "stock_deducted", "BOOLEAN", "BOOLEAN")
    # Mahsulot media (rasmlar va videolar ro'yxati).
    await _ensure_column(conn, dialect, "products", "media", "JSON DEFAULT '[]'", "JSONB DEFAULT '[]'::jsonb")


@app.on_event("startup")
async def on_startup():
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_lightweight_migrations(conn)
    logger.info("Database tables initialized.")

    # Avtomatik tariflar (.env dagi limit va narxlar) ni bazaga sinxronlash
    try:
        from app.database import AsyncSessionLocal
        from app.routers.subscriptions import _ensure_seed_plans
        async with AsyncSessionLocal() as session:
            await _ensure_seed_plans(session)
            await session.commit()
        logger.info("Subscription plans synchronized from .env.")
    except Exception as e:
        logger.warning(f"Error seeding plans on startup: {e}")

    # Avtomatik Webhook Sinxronizatsiyasi (.env dagi TELEGRAM_WEBHOOK_DOMAIN bo'yicha)
    wh_domain = (settings.TELEGRAM_WEBHOOK_DOMAIN or "").strip().rstrip("/")
    if wh_domain and wh_domain.startswith("https://"):
        try:
            from sqlalchemy import select
            from app.database import AsyncSessionLocal
            from app.models import TelegramBot
            from app.security import decrypt_token
            from app.routers.bots import setup_telegram_webhook

            async with AsyncSessionLocal() as session:
                bots_res = await session.execute(select(TelegramBot))
                all_bots = bots_res.scalars().all()
                for b in all_bots:
                    plain_tok = decrypt_token(b.bot_token_encrypted)
                    if plain_tok:
                        logger.info(f"Auto-syncing webhook for bot @{b.bot_username} to {wh_domain}...")
                        res = await setup_telegram_webhook(plain_tok, str(b.organization_id))
                        if res.get("success"):
                            b.webhook_url = res["webhook_url"]
                            b.status = "CONNECTED"
                            logger.info(f"Bot @{b.bot_username} webhook successfully set to {b.webhook_url}")
                await session.commit()
        except Exception as e:
            logger.warning(f"Startup webhook auto-sync error: {e}")

    logger.info("Application startup completed successfully.")
