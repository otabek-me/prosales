import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Sales SaaS"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_key_change_in_production_32bytes_min")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "gAAAAABl8-9_SampleFernetKey32BytesForEncryption123=")
    
    # Database (SQLite3 by default, supports PostgreSQL too)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite+aiosqlite:///./ai_sales_saas.db"
    )
    SYNC_DATABASE_URL: str = os.getenv(
        "SYNC_DATABASE_URL", 
        "sqlite:///./ai_sales_saas.db"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "jwt_secret_key_change_me_in_prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # AI Providers (Gemini, Groq, OpenAI)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "gemini") # "gemini", "groq", "openai"
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: Optional[str] = os.getenv("OPENAI_BASE_URL", "")
    
    DEFAULT_AI_MODEL: str = os.getenv("DEFAULT_AI_MODEL", "gemini-1.5-flash")
    STRONG_AI_MODEL: str = os.getenv("STRONG_AI_MODEL", "gemini-1.5-pro")
    
    # Telegram
    BOT_TOKEN: Optional[str] = os.getenv("BOT_TOKEN", "")
    TELEGRAM_WEBHOOK_DOMAIN: str = os.getenv("TELEGRAM_WEBHOOK_DOMAIN", "https://api.yourdomain.com")
    
    # Bank Card Payment Settings (.env dan olinadi)
    PAYMENT_CARD_NUMBER: str = os.getenv("PAYMENT_CARD_NUMBER", "9860 3501 2345 6789")
    PAYMENT_CARD_HOLDER: str = os.getenv("PAYMENT_CARD_HOLDER", "OTABEK R.")
    PAYMENT_CARD_BANK: str = os.getenv("PAYMENT_CARD_BANK", "Humo / Uzcard")

    # Storage & Uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    API_PUBLIC_BASE_URL: str = os.getenv("API_PUBLIC_BASE_URL", "http://localhost:8000")

    # Subscription Plans & Limits (admin .env orqali narxlar va limitlarni boshqaradi)
    PLAN_TRIAL_NAME: str = os.getenv("PLAN_TRIAL_NAME", "Free Trial (Sinov)")
    PLAN_TRIAL_PRICE: float = float(os.getenv("PLAN_TRIAL_PRICE", "0"))
    PLAN_TRIAL_MAX_PRODUCTS: int = int(os.getenv("PLAN_TRIAL_MAX_PRODUCTS", "5"))
    PLAN_TRIAL_MAX_CONVERSATIONS: int = int(os.getenv("PLAN_TRIAL_MAX_CONVERSATIONS", "50"))
    PLAN_TRIAL_MAX_AI_MESSAGES: int = int(os.getenv("PLAN_TRIAL_MAX_AI_MESSAGES", "100"))
    PLAN_TRIAL_MAX_FILE_SIZE_MB: int = int(os.getenv("PLAN_TRIAL_MAX_FILE_SIZE_MB", "15"))
    PLAN_TRIAL_MAX_MEDIA_PER_PRODUCT: int = int(os.getenv("PLAN_TRIAL_MAX_MEDIA_PER_PRODUCT", "3"))

    PLAN_STARTER_NAME: str = os.getenv("PLAN_STARTER_NAME", "Starter (Boshlang'ich)")
    PLAN_STARTER_PRICE: float = float(os.getenv("PLAN_STARTER_PRICE", "150000"))
    PLAN_STARTER_MAX_PRODUCTS: int = int(os.getenv("PLAN_STARTER_MAX_PRODUCTS", "30"))
    PLAN_STARTER_MAX_CONVERSATIONS: int = int(os.getenv("PLAN_STARTER_MAX_CONVERSATIONS", "500"))
    PLAN_STARTER_MAX_AI_MESSAGES: int = int(os.getenv("PLAN_STARTER_MAX_AI_MESSAGES", "2500"))
    PLAN_STARTER_MAX_FILE_SIZE_MB: int = int(os.getenv("PLAN_STARTER_MAX_FILE_SIZE_MB", "35"))
    PLAN_STARTER_MAX_MEDIA_PER_PRODUCT: int = int(os.getenv("PLAN_STARTER_MAX_MEDIA_PER_PRODUCT", "5"))

    PLAN_BUSINESS_NAME: str = os.getenv("PLAN_BUSINESS_NAME", "Business (Biznes)")
    PLAN_BUSINESS_PRICE: float = float(os.getenv("PLAN_BUSINESS_PRICE", "350000"))
    PLAN_BUSINESS_MAX_PRODUCTS: int = int(os.getenv("PLAN_BUSINESS_MAX_PRODUCTS", "200"))
    PLAN_BUSINESS_MAX_CONVERSATIONS: int = int(os.getenv("PLAN_BUSINESS_MAX_CONVERSATIONS", "3000"))
    PLAN_BUSINESS_MAX_AI_MESSAGES: int = int(os.getenv("PLAN_BUSINESS_MAX_AI_MESSAGES", "15000"))
    PLAN_BUSINESS_MAX_FILE_SIZE_MB: int = int(os.getenv("PLAN_BUSINESS_MAX_FILE_SIZE_MB", "100"))
    PLAN_BUSINESS_MAX_MEDIA_PER_PRODUCT: int = int(os.getenv("PLAN_BUSINESS_MAX_MEDIA_PER_PRODUCT", "10"))

    PLAN_PRO_NAME: str = os.getenv("PLAN_PRO_NAME", "Pro (Cheksiz VIP)")
    PLAN_PRO_PRICE: float = float(os.getenv("PLAN_PRO_PRICE", "700000"))
    PLAN_PRO_MAX_PRODUCTS: int = int(os.getenv("PLAN_PRO_MAX_PRODUCTS", "99999"))
    PLAN_PRO_MAX_CONVERSATIONS: int = int(os.getenv("PLAN_PRO_MAX_CONVERSATIONS", "99999"))
    PLAN_PRO_MAX_AI_MESSAGES: int = int(os.getenv("PLAN_PRO_MAX_AI_MESSAGES", "999999"))
    PLAN_PRO_MAX_FILE_SIZE_MB: int = int(os.getenv("PLAN_PRO_MAX_FILE_SIZE_MB", "500"))
    PLAN_PRO_MAX_MEDIA_PER_PRODUCT: int = int(os.getenv("PLAN_PRO_MAX_MEDIA_PER_PRODUCT", "25"))
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
