from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import json

from app.config import settings
from app.database import engine, Base
from app.routers import (
    auth, organizations, bots, products, orders, customers,
    conversations, knowledge, analytics, subscriptions, superadmin, webhook
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

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(webhook.router, prefix=v1)
# Also mount webhook at root /webhook for backward compatibility
app.include_router(webhook.router)


@app.on_event("startup")
async def on_startup():
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized.")

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
