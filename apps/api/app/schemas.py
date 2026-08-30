from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from app.models import RoleEnum, CustomerStageEnum, SenderTypeEnum, OrderStatusEnum, SubscriptionStatusEnum

# Base response standard format
class StandardResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: UUID
    is_superadmin: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

# Organization Schemas
class OrganizationBase(BaseModel):
    name: str
    phone: Optional[str] = None
    category: Optional[str] = None
    logo_url: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: UUID
    slug: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Membership Schemas
class MembershipResponse(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    role: RoleEnum
    permissions: List[str]
    organization: Optional[OrganizationResponse] = None

    model_config = ConfigDict(from_attributes=True)

# Telegram Bot Schemas
class BotConnectRequest(BaseModel):
    bot_token: str

class TelegramBotResponse(BaseModel):
    id: UUID
    organization_id: UUID
    bot_username: Optional[str] = None
    bot_name: Optional[str] = None
    status: str
    webhook_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Product & Category Schemas
class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[UUID] = None

class CategoryResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    parent_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)

class ProductVariantCreate(BaseModel):
    variant_name: str
    sku: Optional[str] = None
    price_modifier: float = 0.00
    stock: int = 0

class ProductVariantResponse(ProductVariantCreate):
    id: UUID

    model_config = ConfigDict(from_attributes=True)

class ProductCreate(BaseModel):
    category_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    price: float
    currency: str = "UZS"
    stock: int = 0
    image_url: Optional[str] = None
    tags: List[str] = []
    variants: List[ProductVariantCreate] = []

class ProductUpdate(BaseModel):
    category_id: Optional[UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: UUID
    organization_id: UUID
    category_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    price: float
    currency: str
    stock: int
    image_url: Optional[str] = None
    tags: List[str]
    is_active: bool
    variants: List[ProductVariantResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Customer Schemas
class CustomerResponse(BaseModel):
    id: UUID
    organization_id: UUID
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    stage: CustomerStageEnum
    language: str
    total_orders: int
    total_spent: float
    tags: List[str]
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Message & Conversation Schemas
class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_type: SenderTypeEnum
    content: str
    tool_calls_json: Optional[Any] = None
    metadata_json: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    customer_id: UUID
    customer: CustomerResponse
    is_operator_mode: bool
    unread_count: int
    last_message_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Order Schemas
class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    product_name: str
    price: float
    quantity: int
    total: float

    model_config = ConfigDict(from_attributes=True)

class OrderCreate(BaseModel):
    customer_id: UUID
    conversation_id: Optional[UUID] = None
    customer_name: str
    customer_phone: str
    delivery_address: str
    delivery_option: str = "STANDARD"
    items: List[Dict[str, Any]] # [{product_id, variant_id, quantity}]

class OrderStatusUpdate(BaseModel):
    status: OrderStatusEnum

class OrderResponse(BaseModel):
    id: UUID
    organization_id: UUID
    customer_id: UUID
    order_number: str
    status: OrderStatusEnum
    customer_name: str
    customer_phone: str
    delivery_address: str
    delivery_option: str
    total_amount: float
    currency: str
    notes: Optional[str] = None
    items: List[OrderItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Knowledge Base & FAQ Schemas
class KnowledgeBaseCreate(BaseModel):
    title: str
    content: str
    category: str = "GENERAL"

class KnowledgeBaseResponse(KnowledgeBaseCreate):
    id: UUID
    organization_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FAQCreate(BaseModel):
    question: str
    answer: str
    category: str = "GENERAL"

class FAQResponse(FAQCreate):
    id: UUID
    organization_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# AI Settings Schemas
class AISettingsUpdate(BaseModel):
    bot_name: Optional[str] = None
    personality: Optional[str] = None
    custom_instructions: Optional[str] = None
    preferred_language: Optional[str] = None
    handoff_keywords: Optional[List[str]] = None
    delivery_terms: Optional[str] = None
    payment_terms: Optional[str] = None

class AISettingsResponse(BaseModel):
    id: UUID
    organization_id: UUID
    bot_name: str
    personality: str
    custom_instructions: Optional[str] = None
    preferred_language: str
    handoff_keywords: List[str]
    delivery_terms: str
    payment_terms: str

    model_config = ConfigDict(from_attributes=True)

# Dashboard & Analytics Schemas
class DashboardStatsResponse(BaseModel):
    total_conversations: int
    total_leads: int
    total_orders: int
    total_revenue: float
    conversion_rate: float
    ai_handled_rate: float
    recent_orders: List[OrderResponse]
    sales_funnel: Dict[str, int]
