"""Local preview server and production build controls."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from cms.security import current_user, require_csrf, require_user
from cms.services import pelican_service

router = APIRouter()


@router.get("/preview")
def open_preview(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    result = pelican_service.start_preview()
    return RedirectResponse(result.get("url", "http://localhost:8000"), status_code=303)


@router.get("/api/preview/status")
def api_status(_: str = Depends(require_user)):
    return pelican_service.preview_status()


@router.post("/api/preview/start")
def api_start(_: str = Depends(require_user), __: None = Depends(require_csrf)):
    return pelican_service.start_preview()


@router.post("/api/preview/stop")
def api_stop(_: str = Depends(require_user), __: None = Depends(require_csrf)):
    return pelican_service.stop_preview()


@router.post("/api/preview/build")
def api_build(_: str = Depends(require_user), __: None = Depends(require_csrf)):
    return pelican_service.build()
