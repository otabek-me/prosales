import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Numeric, DateTime, ForeignKey, Enum as SQLEnum, JSON, Index, Uuid
)
from sqlalchemy.orm import relationship
import enum

# Universal type compatibility for SQLite3 and PostgreSQL
UUID = Uuid
JSONB = JSON
Vector = lambda dim: JSON

from app.database import Base

# Enums
class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"
    ANALYST = "ANALYST"

class CustomerStageEnum(str, enum.Enum):
    NEW = "NEW"
    INTERESTED = "INTERESTED"
    CONSIDERING = "CONSIDERING"
    READY_TO_BUY = "READY_TO_BUY"
    ORDERED = "ORDERED"
    COMPLETED = "COMPLETED"
    LOST = "LOST"

class SenderTypeEnum(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AI = "AI"
    OPERATOR = "OPERATOR"
    SYSTEM = "SYSTEM"

class OrderStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"

class SubscriptionStatusEnum(str, enum.Enum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"

class PaymentRequestStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

# Models
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    category = Column(String(100), nullable=True)  # e.g. Clothing, Electronics, Food
    logo_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    memberships = relationship("Membership", back_populates="organization", cascade="all, delete-orphan")
    telegram_bot = relationship("TelegramBot", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="organization", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="organization", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="organization", cascade="all, delete-orphan")
    ai_settings = relationship("AISettings", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="organization", uselist=False, cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    is_superadmin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    memberships = relationship("Membership", back_populates="user", cascade="all, delete-orphan")


class Membership(Base):
    __tablename__ = "memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.OWNER, nullable=False)
    permissions = Column(JSONB, default=list, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="memberships")
    user = relationship("User", back_populates="memberships")


class TelegramBot(Base):
    __tablename__ = "telegram_bots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    bot_token_encrypted = Column(Text, nullable=False)
    bot_username = Column(String(255), nullable=True)
    bot_name = Column(String(255), nullable=True)
    status = Column(String(50), default="CONNECTED", nullable=False)  # CONNECTED, DISCONNECTED, ERROR
    webhook_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="telegram_bot")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    telegram_id = Column(String(100), nullable=False, index=True)
    username = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    stage = Column(SQLEnum(CustomerStageEnum), default=CustomerStageEnum.NEW, nullable=False, index=True)
    language = Column(String(10), default="uz", nullable=False)  # uz, ru, en
    total_orders = Column(Integer, default=0, nullable=False)
    total_spent = Column(Numeric(12, 2), default=0.00, nullable=False)
    tags = Column(JSONB, default=list, nullable=False)
    notes = Column(Text, nullable=True)

    # --- BUYURTMA FSM (order flow) uchun ustunlar ---
    # MUHIM: bu maydon `stage` (CustomerStageEnum) dan alohida — chunki `stage`
    # faqat CRM bosqichlari (NEW/INTERESTED/...) uchun cheklangan enum, unga
    # "ask_quantity" kabi erkin FSM qiymatlarini yozib bo'lmaydi (bazadan qayta
    # o'qishda enum konvertatsiyasi buziladi). Shu sabab alohida ustun kerak.
    order_flow_state = Column(String(50), nullable=True, index=True)
    draft_product = Column(String(255), nullable=True)
    # Tanlangan mahsulotning aniq row ID si. draft_product (nom) emas, balki shu ID
    # asosida narx hisoblanadi — chunki nomda o'xshash bir nechta mahsulot bo'lsa,
    # nom bo'yicha qayta qidirish ("ilike ... first()") noto'g'ri (arxiv, eski) birini
    # topib, narxni buzishi mumkin edi.
    draft_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    draft_quantity = Column(Integer, nullable=True)
    draft_name = Column(String(255), nullable=True)
    draft_surname = Column(String(255), nullable=True)
    draft_phone = Column(String(50), nullable=True)
    draft_address = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="customers")
    conversations = relationship("Conversation", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    is_operator_mode = Column(Boolean, default=False, nullable=False)
    unread_count = Column(Integer, default=0, nullable=False)
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="conversations", lazy="selectin")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", lazy="selectin")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_type = Column(SQLEnum(SenderTypeEnum), nullable=False)
    content = Column(Text, nullable=False)
    tool_calls_json = Column(JSONB, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    sku = Column(String(100), nullable=True)
    price = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="UZS", nullable=False)
    stock = Column(Integer, default=0, nullable=False)
    image_url = Column(Text, nullable=True)
    tags = Column(JSONB, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="products")
    category = relationship("ProductCategory", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan", lazy="selectin")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_name = Column(String(255), nullable=False)  # e.g. "Size: 42, Color: Black"
    sku = Column(String(100), nullable=True)
    price_modifier = Column(Numeric(12, 2), default=0.00, nullable=False)
    stock = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="variants")


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    status = Column(SQLEnum(OrderStatusEnum), default=OrderStatusEnum.PENDING, nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(50), nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_option = Column(String(100), default="STANDARD", nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="UZS", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    total = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="items")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), default="GENERAL", nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(100), default="GENERAL", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Plan(Base):
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    price_monthly = Column(Numeric(12, 2), nullable=False)
    limits_json = Column(JSONB, nullable=False)  # { "conversations": 500, "products": 50, "operators": 2, "ai_messages": 2000 }
    features_json = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    status = Column(SQLEnum(SubscriptionStatusEnum), default=SubscriptionStatusEnum.TRIAL, nullable=False)
    current_period_start = Column(DateTime, default=datetime.utcnow, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="subscription")
    plan = relationship("Plan")


class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="UZS", nullable=False)
    card_number = Column(String(50), nullable=True)
    sender_name = Column(String(255), nullable=True)
    sender_phone = Column(String(50), nullable=True)
    receipt_image_url = Column(Text, nullable=True)
    transaction_id = Column(String(100), nullable=True)
    status = Column(SQLEnum(PaymentRequestStatusEnum), default=PaymentRequestStatusEnum.PENDING, nullable=False, index=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization")
    plan = relationship("Plan")
    user = relationship("User")


class AISettings(Base):
    __tablename__ = "ai_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    bot_name = Column(String(100), default="AI Sotuvchi", nullable=False)
    personality = Column(Text, default="Professional, hushmuomala va do'stona sotuvchi.", nullable=False)
    custom_instructions = Column(Text, nullable=True)
    preferred_language = Column(String(10), default="uz", nullable=False)
    handoff_keywords = Column(JSONB, default=["operator", "odam", "inson", "shikoyat"], nullable=False)
    delivery_terms = Column(Text, default="Toshkent shahri bo'ylab yetkazib berish 30,000 so'm, viloyatlarga 40,000 so'm. 1-2 kun ichida yetkaziladi.", nullable=False)
    payment_terms = Column(Text, default="Naqd pul, Click, Payme orqali to'lov qilish mumkin.", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="ai_settings")


class AIAnalyticsEvent(Base):
    __tablename__ = "ai_analytics_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(100), nullable=False, index=True)  # INTENT_DETECTED, PRODUCT_RECOMMENDED, HANDOFF_TRIGGERED, ORDER_CREATED
    payload_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)