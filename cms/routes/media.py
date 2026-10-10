"""Media library: list, upload, delete and usage checks."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse

from cms.security import current_user, require_csrf, require_user
from cms.services import file_service
from cms.templating import render

router = APIRouter()

ALLOWED_EXT = {"jpg", "jpeg", "png", "gif", "svg", "webp", "pdf"}
_MAX_BYTES = 25 * 1024 * 1024  # 25 MB per file


def _safe_name(name: str) -> str:
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name).strip(".-")
    return name or "upload"


@router.get("/media")
def media_page(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    items = file_service.list_media()
    return render(
        request,
        "media.html",
        {
            "nav_active": "media",
            "media": items,
            "uploads": [m for m in items if m["source"] == "uploads"],
            "theme_assets": [m for m in items if m["source"] == "theme"],
            "total_size": file_service.human_size(sum(m["size"] for m in items)),
        },
    )


@router.get("/api/media")
def api_list(_: str = Depends(require_user)):
    return {"media": file_service.list_media(), "allowed_ext": sorted(ALLOWED_EXT)}


@router.get("/media/file/{source}/{name}")
def media_file(request: Request, source: str, name: str):
    if not current_user(request):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        path = file_service.resolve_media(source, name)
    except file_service.UnsafePathError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@router.get("/api/media/usages")
def api_usages(name: str, _: str = Depends(require_user)):
    return {"name": name, "usages": file_service.usages_of_media(name)}


@router.post("/api/media/upload")
async def api_upload(
    files: list[UploadFile] = File(...),
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    saved: list[dict] = []
    errors: list[str] = []
    for upload in files:
        name = _safe_name(upload.filename or "upload")
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in ALLOWED_EXT:
            errors.append(f"{name}: unsupported file type")
            continue
        data = await upload.read()
        if len(data) > _MAX_BYTES:
            errors.append(f"{name}: exceeds 25 MB limit")
            continue
        target = file_service.safe_path(file_service.config.IMAGES_DIR, name)
        if target.exists():
            stem = target.stem
            suffix = target.suffix
            counter = 2
            while target.exists():
                target = file_service.safe_path(file_service.config.IMAGES_DIR, f"{stem}-{counter}{suffix}")
                counter += 1
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        file_service._save_image_variants(target)
        saved.append(
            {
                "name": target.name,
                "source": "uploads",
                "size": len(data),
                "size_human": file_service.human_size(len(data)),
                "url": file_service.media_url("uploads", target.name),
                "markdown": f"![{target.stem}]({file_service.media_url('uploads', target.name)})",
            }
        )
    return {"ok": True, "saved": saved, "errors": errors}


@router.delete("/api/media")
def api_delete(
    source: str,
    name: str,
    force: bool = False,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    try:
        path = file_service.resolve_media(source, name)
    except file_service.UnsafePathError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    usages = file_service.usages_of_media(path.name)
    if usages and not force:
        raise HTTPException(
            status_code=409,
            detail={"message": "File is still referenced", "usages": usages},
        )
    # Move to trash rather than hard-delete.
    trash = file_service.config.TRASH_DIR / "media"
    trash.mkdir(parents=True, exist_ok=True)
    path.replace(trash / path.name)
    return {"ok": True, "name": path.name}
