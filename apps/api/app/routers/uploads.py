import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.config import settings
from app.models import Organization, Subscription, Plan
from app.schemas import StandardResponse
from app.dependencies import get_current_organization_id

router = APIRouter(prefix="/uploads", tags=["Uploads"])

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"}

CHUNK_SIZE = 1024 * 1024  # 1 MB chunk reading


@router.post("/media", response_model=StandardResponse)
async def upload_media_file(
    file: UploadFile = File(...),
    org_id: UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Mahsulot rasmi yoki videosini yuklash.
    Fayl hajmi foydalanuvchining joriy tarifi bo'yicha cheklanadi (admin .env dan nazorat qiladi).
    Yuklash oqimli (chunked streaming) tarzda amalga oshirilib, tezlik va xotira samaradorligi ta'minlanadi.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Fayl tanlanmagan")

    # 1. Kengaytmani aniqlash
    orig_name = file.filename
    ext = os.path.splitext(orig_name)[1].lower()

    media_type = None
    if ext in ALLOWED_IMAGE_EXTS:
        media_type = "image"
    elif ext in ALLOWED_VIDEO_EXTS:
        media_type = "video"
    else:
        allowed_str = ", ".join(list(ALLOWED_IMAGE_EXTS) + list(ALLOWED_VIDEO_EXTS))
        raise HTTPException(
            status_code=400,
            detail=f"Qo'llab-quvvatlanmaydigan fayl formati ({ext}). Faqat quyidagi formatlar ruxsat etilgan: {allowed_str}"
        )

    # 2. Tashkilotning joriy tarifidagi fayl hajmi limitini olish
    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = sub_res.scalars().first()

    max_file_size_mb = settings.PLAN_TRIAL_MAX_FILE_SIZE_MB
    if sub:
        plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
        plan = plan_res.scalars().first()
        if plan and plan.limits_json and "max_file_size_mb" in plan.limits_json:
            max_file_size_mb = plan.limits_json["max_file_size_mb"]

    max_bytes = max_file_size_mb * 1024 * 1024

    # 3. Faylni saqlash papkasini tayyorlash
    upload_folder = os.path.join(settings.UPLOAD_DIR, "products")
    os.makedirs(upload_folder, exist_ok=True)

    unique_filename = f"{str(org_id)[:8]}_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(upload_folder, unique_filename)

    # 4. Faylni chunkma-chunk oqimli xavfsiz yozish (RAM ni to'ldirmasdan)
    total_bytes = 0
    try:
        with open(dest_path, "wb") as out_file:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    # Limitdan oshdi: yuklangan bo'lakni o'chirish va 413 qaytarish
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"Fayl hajmi ({total_bytes / (1024 * 1024):.1f} MB) tarifingiz limitidan "
                            f"({max_file_size_mb} MB) oshib ketdi! Katta hajmdagi videolarni yuklash uchun "
                            "tarifingizni yuqorisiga yangilang."
                        )
                    )
                await out_file.write(chunk)
    except HTTPException:
        # Faylni tozalash
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=500, detail=f"Faylni yozishda xatolik yuz berdi: {str(e)}")

    rel_url = f"/uploads/products/{unique_filename}"
    return StandardResponse(
        success=True,
        data={
            "url": rel_url,
            "filename": orig_name,
            "type": media_type,
            "size_bytes": total_bytes,
            "size_mb": round(total_bytes / (1024 * 1024), 2)
        }
    )


@router.delete("/media", response_model=StandardResponse)
async def delete_media_file(
    url: str = Query(..., description="O'chiriladigan faylning /uploads/products/... URL manzili"),
    org_id: UUID = Depends(get_current_organization_id)
):
    """Yuklangan faylni serverdan o'chirish."""
    filename = os.path.basename(url)
    # Xavfsizlik tekshiruvi: fayl shu tashkilotga tegishlimi
    org_prefix = str(org_id)[:8]
    if not filename.startswith(org_prefix):
        raise HTTPException(status_code=403, detail="Ushbu faylni o'chirishga ruxsat yo'q")

    file_path = os.path.join(settings.UPLOAD_DIR, "products", filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    return StandardResponse(success=True, data={"message": "Fayl o'chirildi"})
