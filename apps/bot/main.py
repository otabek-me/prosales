import os
import asyncio
import logging
import sys
import traceback
import httpx
from pathlib import Path
from aiogram import Bot, Dispatcher, Router, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from dotenv import load_dotenv

# Load .env from the script's own directory (works regardless of CWD)
# Fall back to the API's .env which contains the shared BOT_TOKEN
BOT_DIR = Path(__file__).resolve().parent
load_dotenv(BOT_DIR / ".env")
load_dotenv(BOT_DIR.parent / "api" / ".env")

# Configure logger to always print detailed errors to the terminal
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ai_sales_bot")

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
ORG_ID = os.getenv("DEFAULT_ORG_ID", "")

router = Router()

def main_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="👟 Mahsulotlar"), KeyboardButton(text="📦 Buyurtmalarim")],
            [KeyboardButton(text="👨‍💼 Operatorga ulanish"), KeyboardButton(text="❓ Yordam / FAQ")]
        ],
        resize_keyboard=True
    )

@router.message(Command("start"))
async def start_handler(message: types.Message):
    welcome_text = (
        f"Assalomu alaykum, *{message.from_user.first_name}*! 👋\n\n"
        f"Do'konimizning rasmiy *AI Sales yordamchisiga* xush kelibsiz.\n"
        f"Men sizga 24/7 rejimda kerakli mahsulotlarni topish va buyurtma berishga yordam beraman.\n\n"
        f"Savolingiz bo'lsa darhol yozing yoki tugmalardan foydalaning!"
    )
    await message.answer(welcome_text, parse_mode="Markdown", reply_markup=main_keyboard())

@router.message(Command("products"))
@router.message(lambda msg: msg.text == "👟 Mahsulotlar")
async def products_handler(message: types.Message):
    target_org = ORG_ID or "auto"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Try public endpoint first (no auth required)
            if ORG_ID:
                res = await client.get(f"{API_BASE_URL}/products/public/{ORG_ID}")
            else:
                # If no ORG_ID, try authenticated endpoint with empty headers
                # which will likely fail, so we show a helpful message
                res = await client.get(f"{API_BASE_URL}/products")
            
            if res.status_code == 200:
                data = res.json().get("data", [])
                if not data:
                    await message.answer("Hozircha katalogda faol mahsulotlar mavjud emas.")
                    return

                text = "🔥 *Katalogimizdagi mahsulotlar:*\n\n"
                kb_buttons = []
                for p in data[:8]:
                    price_str = f"{p['price']:,.0f}" if isinstance(p['price'], (int, float)) else str(p['price'])
                    text += f"▪️ *{p['name']}* — {price_str} UZS\n"
                    kb_buttons.append([InlineKeyboardButton(text=f"🛒 {p['name']} (Buyurtma)", callback_data=f"buy_{p['id'][:8]}")])
                
                kb = InlineKeyboardMarkup(inline_keyboard=kb_buttons)
                await message.answer(text, parse_mode="Markdown", reply_markup=kb)
            elif res.status_code == 401:
                await message.answer("Katalogni ko'rish uchun avval biznesni platformada ro'yxatdan o'tkazing va mahsulot qo'shing.")
            else:
                await message.answer("Katalogni yuklashda xatolik yuz berdi.")
        except Exception as e:
            logger.error(f"Error fetching products: {e}")
            await message.answer("Ulanish xatoligi.")

@router.message(Command("operator"))
@router.message(lambda msg: msg.text == "👨‍💼 Operatorga ulanish")
async def operator_handler(message: types.Message):
    await message.answer(
        "👨‍💼 Sizning so'rovingiz bo'yicha jonli operatorimizga xabar berildi.\n"
        "Tez orada operator suhbatga qo'shiladi va savollaringizga javob beradi.",
        reply_markup=main_keyboard()
    )

@router.message(Command("help"))
@router.message(lambda msg: msg.text == "❓ Yordam / FAQ")
async def help_handler(message: types.Message):
    faq_text = (
        "❓ *Ko'p beriladigan savollar:*\n\n"
        "🚚 *Yetkazib berish:* Toshkent shahri bo'ylab 30,000 so'm (1-2 kun ichida).\n"
        "💳 *To'lov turlari:* Naqd pul, Click va Payme.\n"
        "🔄 *Qaytarish:* 34 kun ichida almashtirib beriladi.\n\n"
        "Har qanday boshqa savolingizni shunchaki yozib qoldiring!"
    )
    await message.answer(faq_text, parse_mode="Markdown")

@router.callback_query()
async def callback_query_handler(callback: types.CallbackQuery):
    """Forwards inline button clicks to the FastAPI webhook."""
    target_org = ORG_ID if ORG_ID else "auto"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            payload = {
                "update_id": callback.id,
                "callback_query": {
                    "id": callback.id,
                    "from": {
                        "id": callback.from_user.id,
                        "first_name": callback.from_user.first_name,
                        "last_name": callback.from_user.last_name,
                        "username": callback.from_user.username
                    },
                    "message": {
                        "message_id": callback.message.message_id,
                        "chat": {"id": callback.message.chat.id, "type": "private"}
                    },
                    "data": callback.data
                }
            }
            await client.post(f"{API_BASE_URL}/webhook/telegram/{target_org}", json=payload)
            await callback.answer()
        except Exception as e:
            logger.error(f"Error forwarding callback query: {e}")
            await callback.answer()

@router.message()
async def default_ai_message_handler(message: types.Message):
    """Routes all unhandled text messages directly to the FastAPI Webhook endpoint for AI Processing."""
    target_org = ORG_ID if ORG_ID else "auto"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "update_id": message.message_id,
                "message": {
                    "message_id": message.message_id,
                    "date": int(message.date.timestamp()),
                    "chat": {"id": message.chat.id, "type": "private"},
                    "from": {
                        "id": message.from_user.id,
                        "first_name": message.from_user.first_name,
                        "last_name": message.from_user.last_name,
                        "username": message.from_user.username
                    },
                    "text": message.text
                }
            }
            res = await client.post(f"{API_BASE_URL}/webhook/telegram/{target_org}", json=payload)
            if res.status_code != 200:
                logger.error(f"Webhook processing error ({res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"Failed to forward message to AI API: {e}")

async def main():
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN is not set in environment. Skipping long-polling mode.")
        return

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)

    logger.info("Starting Aiogram 3.x Telegram Bot Runner...")
    try:
        # Delete any active webhook first to avoid TelegramConflictError
        # (can't use getUpdates while a webhook is active)
        webhook_info = await bot.get_webhook_info()
        if webhook_info.url:
            logger.info("Deleting active webhook: %s", webhook_info.url)
            await bot.delete_webhook(drop_pending_updates=True)
        else:
            logger.info("No active webhook found, proceeding with polling.")

        await dp.start_polling(bot)
    except Exception as exc:
        # Log full traceback to terminal for easier debugging
        logger.error("Unhandled exception in polling loop: %s", exc)
        tb = traceback.format_exc()
        logger.debug(tb)
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        # Ensure any exception bubbles with full traceback printed to terminal
        logger.critical("Fatal error in bot main", exc_info=True)
        sys.exit(1)
