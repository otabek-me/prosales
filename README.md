# 🚀 Professional AI Sales SaaS Platform — Uzbekistan Market

Multi-tenant **AI Sales Assistant + CRM + Admin Dashboard + Analytics + Subscription SaaS Platform** built for small and medium businesses in Uzbekistan to automate sales via Telegram.

---

## 🌟 Key Capabilities

1. **Multi-Tenant SaaS Architecture**: Complete organization isolation with tenant schemas, role-based authorization (`SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `ANALYST`), and AES-256 encrypted Telegram bot tokens.
2. **AI Sales Engine (Gemini / Groq / OpenAI)**:
   - Dynamic prompt generation combining Business Identity, Products, Stock, FAQ, Delivery Policy, and Customer Stage.
   - Natural Uzbek (Latin script), Russian, and English natural dialogue support.
   - Strict Anti-Hallucination rules & prompt injection protections.
   - Function/Tool Calling (`search_products`, `get_product_details`, `create_order`, `handoff_to_operator`, `get_business_faq`).
3. **Live CRM Operator Inbox**: Real-time chat interface allowing human operators to take over from AI with a single toggle (`is_operator_mode`), view customer context, tags, order history, and hand back to AI.
4. **Orders Pipeline & Catalog Management**: Real-time product inventory tracking, variant selection, order placement in UZS currency with status workflow (`PENDING` -> `CONFIRMED` -> `PROCESSING` -> `DELIVERED`).
5. **Knowledge Base RAG (pgvector)**: Vector similarity search for answering complex customer policy queries (delivery, returns, working hours).
6. **Analytics & Funnel Tracking**: Comprehensive sales funnel visualization, conversion rates, AI handling metrics vs human handoffs.
7. **SaaS Billing & Subscriptions**: Usage limit enforcement (`conversations`, `products`, `operators`), payment provider abstraction prepared for Click, Payme, and Uzum.

---

## 📁 Monorepo Structure

```
ai_sales_saas/
├── apps/
│   ├── api/                  # Python FastAPI Backend (Async REST API, Dynamic AI Engine, RAG, Webhooks)
│   ├── bot/                  # Python aiogram 3.x Telegram Bot Runner
│   └── web/                  # Next.js 14+ TypeScript Admin Dashboard (shadcn/ui, Tailwind CSS, Dark mode)
├── infrastructure/
│   ├── docker/               # Dockerfiles for API, Bot, Web
│   └── docker-compose.yml    # Full local & production orchestration compose file
├── scripts/
│   └── seed_demo_data.py     # Demo database seeder for Uzbek e-commerce store
└── README.md
```

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Lucide React Icons
- **Backend**: Python 3.11+, FastAPI (Async architecture), SQLAlchemy (AsyncORM), Pydantic v2
- **Telegram Bot**: aiogram 3.x async Telegram Bot API runner & webhook handler
- **Database & RAG**: PostgreSQL 16 + `pgvector` extension
- **Cache & Queue**: Redis 7
- **AI Models**: Google Gemini API (`gemini-1.5-flash`), Groq (`llama-3.3-70b-versatile`), or OpenAI API

---

## 🚀 Quick Start Guide

### 1. Environment Configuration

Create `.env` inside `apps/api/`:

```env
ENVIRONMENT=development
SECRET_KEY=super_secret_key_32bytes_minimum_length_change_in_prod
ENCRYPTION_KEY=gAAAAABl8-9_SampleFernetKey32BytesForEncryption123=
DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ai_sales_saas

# AI Provider (Gemini / Groq / OpenAI)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEFAULT_AI_MODEL=gemini-1.5-flash
```

### 2. Local Backend Run

```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open Swagger API Documentation: `http://localhost:8000/docs`

### 3. Local Frontend Run

```bash
cd apps/web
npm install
npm run dev
```

Open SaaS Admin Dashboard: `http://localhost:3000/dashboard`

### 4. Docker Compose Run

```bash
docker-compose up --build
```

---

## 📊 API Endpoints Overview (`/api/v1`)

- `POST /auth/register`: Business & owner registration
- `POST /auth/login`: JWT login with access & refresh tokens
- `GET /products`: Multi-tenant product catalog list & search
- `POST /products`: Add new product with inventory stock
- `GET /orders`: Fetch order pipeline
- `POST /orders`: Atomically create order from Telegram AI tool
- `GET /conversations`: Operator Inbox active chats
- `POST /webhook/telegram/{org_id}`: Telegram bot message processor & AI response trigger
