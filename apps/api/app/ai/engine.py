import json
import logging
from uuid import UUID
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI

from app.config import settings
from app.models import (
    Organization, AISettings, Customer, Conversation, Message,
    SenderTypeEnum, CustomerStageEnum
)
from app.ai.tools import OPENAI_TOOLS, execute_tool_call

logger = logging.getLogger("ai_sales_engine")

class AISalesEngine:
    def __init__(self):
        self.client = None
        self.model = settings.DEFAULT_AI_MODEL

        provider = (settings.AI_PROVIDER or "groq").lower()

        # 1. If Groq selected or Groq API key available
        if provider == "groq" and settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"):
            self.client = AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
            self.model = settings.DEFAULT_AI_MODEL
        # 2. If Gemini selected or Gemini API key available
        elif provider == "gemini" and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
            self.client = AsyncOpenAI(
                api_key=settings.GEMINI_API_KEY,
                base_url=settings.OPENAI_BASE_URL or "https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            self.model = settings.DEFAULT_AI_MODEL
        # 3. If OpenAI selected or OpenAI key available
        elif provider == "openai" and settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("your_"):
            kwargs = {"api_key": settings.OPENAI_API_KEY}
            if settings.OPENAI_BASE_URL:
                kwargs["base_url"] = settings.OPENAI_BASE_URL
            self.client = AsyncOpenAI(**kwargs)
            self.model = settings.DEFAULT_AI_MODEL or "gpt-4o-mini"
        # Fallback to any valid key found
        elif settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"):
            self.client = AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
            self.model = settings.DEFAULT_AI_MODEL
        elif settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
            self.client = AsyncOpenAI(
                api_key=settings.GEMINI_API_KEY,
                base_url=settings.OPENAI_BASE_URL or "https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            self.model = settings.DEFAULT_AI_MODEL

    async def generate_response(
        self,
        db: AsyncSession,
        organization: Organization,
        customer: Customer,
        conversation: Conversation,
        user_message_text: str
    ) -> Tuple[str, List[Dict[str, Any]], bool]:
        """
        Main AI Sales Engine pipeline.
        Returns: (final_reply_text, tool_calls_made, is_handoff_requested)
        """

        # 1. Fetch AI Settings for Organization
        res = await db.execute(
            select(AISettings).where(AISettings.organization_id == organization.id)
        )
        ai_settings = res.scalars().first()

        bot_name = ai_settings.bot_name if ai_settings else "AI Sotuvchi"
        personality = ai_settings.personality if ai_settings else "Professional va hushmuomala sotuvchi"
        delivery_terms = ai_settings.delivery_terms if ai_settings else "Yetkazib berish mavjud."
        payment_terms = ai_settings.payment_terms if ai_settings else "Naqd, Click va Payme to'lovlari."
        custom_rules = ai_settings.custom_instructions if ai_settings else ""
        handoff_kw = ai_settings.handoff_keywords if ai_settings else ["operator", "odam", "shikoyat"]

        # Check for direct handoff keyword match
        if any(kw.lower() in user_message_text.lower() for kw in handoff_kw):
            conversation.is_operator_mode = True
            await db.commit()
            return (
                "Sizni jonli inson operatorimizga ulayapman. Iltimos, kutib turing...",
                [],
                True
            )

        # 2. Build Dynamic System Prompt with strict anti-hallucination guardrails
        custom_instructions_str = f"Qo'shimcha ko'rsatmalar: {custom_rules}" if custom_rules else ""

        system_prompt = f"""Siz '{organization.name}' do'konining tajribali va professional AI sotuvchi yordamchisiz.
Ismingiz: {bot_name}

=== MAQSAD VA SHAXSIYAT ===
- Shaxsiyatingiz: {personality}
- Asosiy vazifangiz: Mijozga mahsulot tanlashda yordam berish, savollariga javob berish va buyurtma olish.
- Doimo xushmuomala, tabiiy va professional tilda javob bering. Mijoz qaysi tilda yozsa (o'zbek, rus, ingliz), o'sha tilda javob bering.

=== ANTI-HALLUCINATION ROLES (QAT'IY QOIDALAR) ===
1. Siz do'konda yo'q mahsulot, yo'q narx yoki uydirma chegirmalarni HECH QACHON o'zingizdan to'qimaysiz!
2. Narx, mahsulot bor-yo'qligi va variantlar haqida FAQAT tool/funksiya javoblaridan foydalaning.
3. Agar ma'lumot topilmasa yoki noaniq bo'lsa, 'Bu ma'lumotni aniqlashtirish uchun sizni operatorga ulayman' deb ayting.
4. Yetkazib berish shartlari: {delivery_terms}
5. To'lov shartlari: {payment_terms}
{custom_instructions_str}

=== BUYURTMA OLISH FLOW-YI ===
Mijoz biror mahsulotni sotib olmoqchi bo'lsa, quyidagi tartibda ma'lumotlarni so'rang:
1. Mahsulot va uning varianti/razmerini aniqlang
2. Nechta dona kerakligini aniqlang
3. Mijozning ismini so'rang
4. Mijozning telefon raqamini so'rang
5. Yetkazib berish manzilini so'rang
6. Barcha ma'lumotlarni jami narx bilan tasdiqlash uchun ko'rsating.
7. Mijoz tasdiqlagach, `create_order` funksiyasini chaqiring.
   - Agar mahsulot UUID'sini bilmasangiz, `product_name` parametridan foydalaning (masalan: "zaryadchik").
   - Hech qachon noto'g'ri yoki xayoliy UUID yubormang.

=== MAVJUD TOOL-LAR ===
Sizda `search_products`, `get_product_details`, `create_order`, `handoff_to_operator`, `get_business_faq` funksiyalari bor. Kerak bo'lganda ushbu funksiyalarni chaqiring.
"""

        # 3. Load recent chat history (last 10 messages)
        msg_res = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(10)
        )
        recent_messages = list(reversed(msg_res.scalars().all()))

        # --- Tarixni qurish: tool natijalarini ham qo'shamiz ---
        messages_payload = [{"role": "system", "content": system_prompt}]
        for m in recent_messages:
            role = "user" if m.sender_type == SenderTypeEnum.CUSTOMER else "assistant"
            messages_payload.append({"role": role, "content": m.content})

            # Tool natijalarini tiklash (agar mavjud bo'lsa)
            if m.tool_calls_json:
                try:
                    # tool_calls_json JSON string yoki list bo'lishi mumkin
                    tool_calls = json.loads(m.tool_calls_json) if isinstance(m.tool_calls_json, str) else m.tool_calls_json
                    if isinstance(tool_calls, list):
                        for tc in tool_calls:
                            if isinstance(tc, dict) and tc.get("result"):
                                # Tool natijasini alohida xabar sifatida qo'shamiz
                                messages_payload.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", "unknown"),
                                    "content": tc["result"]
                                })
                except Exception:
                    pass  # noto'g'ri JSON bo'lsa, e'tiborsiz qoldiramiz

        # Add current user message
        messages_payload.append({"role": "user", "content": user_message_text})

        # If AI client is not configured, return structured intelligent fallback response
        if not self.client:
            return await self._fallback_response(db, organization.id, customer, conversation, user_message_text)

        tool_calls_executed = []
        is_handoff = False

        try:
            # 4. First LLM call with Function Calling
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages_payload,
                tools=OPENAI_TOOLS,
                tool_choice="auto",
                temperature=0.4
            )

            assistant_msg = response.choices[0].message

            # Check if AI triggered tool calls
            if assistant_msg.tool_calls:
                # Add assistant tool request to conversation
                messages_payload.append(assistant_msg)

                # --- HAR BIR TOOL CHAQIRUVINI ALOHIDA HIMOYALAYMIZ ---
                for tool_call in assistant_msg.tool_calls:
                    fn_name = tool_call.function.name
                    # Argumentlarni xavfsiz parse qilish
                    try:
                        fn_args = json.loads(tool_call.function.arguments or "{}")
                    except json.JSONDecodeError:
                        fn_args = {}

                    # Toolni bajarish, xatolik bo'lsa ham umumiy oqim davom etadi
                    try:
                        tool_result_str = await execute_tool_call(
                            db, organization.id, customer.id, conversation.id, fn_name, fn_args
                        )
                    except Exception as tool_exc:
                        logger.error(f"Tool '{fn_name}' bajarilmadi: {str(tool_exc)}", exc_info=True)
                        tool_result_str = json.dumps({
                            "status": "error",
                            "message": "Ichki xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring."
                        })

                    tool_calls_executed.append({
                        "name": fn_name,
                        "args": fn_args,
                        "result": tool_result_str
                    })

                    if fn_name == "handoff_to_operator":
                        is_handoff = True

                    # Tool natijasini xabarlar ro'yxatiga qo'shamiz
                    messages_payload.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result_str
                    })

                # 5. Second LLM call to summarize tool results naturally
                second_response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages_payload,
                    temperature=0.5
                )
                final_text = second_response.choices[0].message.content
            else:
                final_text = assistant_msg.content or "Sizga qanday yordam bera olaman?"

            # Update customer stage dynamically based on conversation
            await self._update_customer_stage(db, customer, user_message_text, final_text)

            return final_text, tool_calls_executed, is_handoff

        except Exception as e:
            logger.error(f"Error in AI Sales Engine: {str(e)}", exc_info=True)
            return await self._fallback_response(db, organization.id, customer, conversation, user_message_text)

    async def _fallback_response(
        self,
        db: AsyncSession,
        org_id: UUID,
        customer: Customer,
        conversation: Conversation,
        user_message_text: str
    ) -> Tuple[str, List[Dict[str, Any]], bool]:
        """Intelligent, rule-based fallback when OpenAI key is absent or API is unreachable."""
        lower_txt = user_message_text.lower()

        # Product Search intent
        if any(w in lower_txt for w in ["krossovka", "oyoq kiyim", "mahsulot", "katalog", "narx", "qancha", "bor"]):
            search_res = await execute_tool_call(db, org_id, customer.id, conversation.id, "search_products", {"query": user_message_text})
            res_json = json.loads(search_res)

            if res_json.get("status") == "success" and res_json.get("products"):
                reply = "Assalomu alaykum! 👟 Sizga mos quyidagi mahsulotlarni tavsiya etaman:\n\n"
                for i, p in enumerate(res_json["products"][:3], 1):
                    reply += f"{i}. *{p['name']}* — {p['price']:,.0f} {p['currency']}\n"
                reply += "\nQaysi birini batafsil ko'rib chiqishni va buyurtma berishni xohlaysiz?"
                return reply, [], False

        # Delivery or Payment Intent
        if any(w in lower_txt for w in ["dostavka", "yetkazib", "to'lov", "payme", "click", "naqd"]):
            faq_res = await execute_tool_call(db, org_id, customer.id, conversation.id, "get_business_faq", {"query": user_message_text})
            return "Yetkazib berish Toshkent shahri bo'ylab 30,000 so'm (1-2 kun). To'lovni Click, Payme yoki naqd pulda qilishingiz mumkin.", [], False

        # Default helpful intro
        return "Assalomu alaykum! Men do'konning AI sotuvchi yordamchisiman. Sizga qaysi mahsulotimiz bo'yicha ma'lumot kerak? Katalogimizni ko'rish uchun /products buyrug'ini yuborishingiz mumkin.", [], False

    async def _update_customer_stage(self, db: AsyncSession, customer: Customer, user_text: str, ai_text: str):
        """Updates customer stage based on natural dialogue intent."""
        lower_user = user_text.lower()
        if any(w in lower_user for w in ["olaman", "sotib", "buyurtma", "zakaz", "tayyorman"]):
            customer.stage = CustomerStageEnum.READY_TO_BUY
        elif customer.stage == CustomerStageEnum.NEW:
            customer.stage = CustomerStageEnum.INTERESTED
        await db.commit()

ai_engine = AISalesEngine()