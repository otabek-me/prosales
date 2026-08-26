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
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
