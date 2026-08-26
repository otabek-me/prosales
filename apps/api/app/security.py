from datetime import datetime, timedelta
from typing import Optional, Any
import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import hashlib

from app.config import settings

import bcrypt

# Password Hashing
def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

# JWT Tokens
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return {}

# Fernet Encryption for Telegram Tokens
def _get_fernet() -> Fernet:
    # Key must be 32 url-safe base64 encoded bytes
    key = settings.ENCRYPTION_KEY.encode('utf-8')
    if len(key) != 44: # Standard Fernet key length
        key = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
    return Fernet(key)

def encrypt_token(plain_text: str) -> str:
    f = _get_fernet()
    return f.encrypt(plain_text.encode('utf-8')).decode('utf-8')

def decrypt_token(cipher_text: str) -> str:
    f = _get_fernet()
    return f.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
