"""BrandBlog CMS — FastAPI entry point.

Run directly (``python cms/app.py``) or via ``uvicorn cms.app:app``.
The server binds to 127.0.0.1 only, so it is never exposed to the LAN.
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Make ``import cms`` work when launched as ``python cms/app.py``.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse, RedirectResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from starlette.exceptions import HTTPException as StarletteHTTPException  # noqa: E402
from starlette.middleware.sessions import SessionMiddleware  # noqa: E402

from cms import config  # noqa: E402
from cms.routes import (  # noqa: E402
    auth,
    categories,
    dashboard,
    git_ops,
    media,
    posts,
    preview,
    settings,
)
from cms.security import current_user  # noqa: E402
from cms.services import pelican_service  # noqa: E402

HOST = os.environ.get("CMS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CMS_PORT", "5000"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.ensure_dirs()
    if os.environ.get("BRANDBLOG_CMS_NO_PREVIEW") != "1":
        try:
            pelican_service.start_preview()
        except Exception:  # pragma: no cover - preview is a convenience
            pass
    yield


app = FastAPI(
    title="BrandBlog CMS",
    description="Local GUI for writing, uploading media and publishing the BrandBlog static site.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=config.get_secret_key(),
    session_cookie="brandblog_cms",
    same_site="strict",
    https_only=False,  # local HTTP only
    max_age=60 * 60 * 24 * 14,
)

app.mount("/static", StaticFiles(directory=str(config.CMS_DIR / "static")), name="static")

for router in (
    auth.router,
    dashboard.router,
    posts.router,
    media.router,
    categories.router,
    git_ops.router,
    settings.router,
    preview.router,
):
    app.include_router(router)


@app.get("/healthz")
def healthz():
    return {"ok": True, "app": "BrandBlog CMS"}


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Unauthenticated page requests go to the login screen.
    if exc.status_code == 401 and not request.url.path.startswith("/api/"):
        return RedirectResponse("/login", status_code=303)
    detail = exc.detail
    if isinstance(detail, dict):
        payload = detail
    else:
        payload = {"detail": detail, "error": detail}
    return JSONResponse(payload, status_code=exc.status_code)


def main() -> None:
    import uvicorn

    print("=" * 62)
    print("  BrandBlog CMS")
    print(f"  → Open http://localhost:{PORT} in your browser")
    print("  → Press Ctrl+C to stop")
    print("=" * 62)
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
