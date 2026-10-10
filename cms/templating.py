"""Shared Jinja2 templating helpers.

Wraps ``fastapi.templating.Jinja2Templates`` and injects the values every
page needs: configuration, translator, CSRF token and current user.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.templating import Jinja2Templates

from cms import config, i18n
from cms.security import current_user, ensure_csrf

templates = Jinja2Templates(directory=str(config.CMS_DIR / "templates"))


def base_context(request: Request) -> dict[str, Any]:
    cfg = config.load_config()
    locale = cfg.get("locale", "vi")
    if locale not in i18n.available_locales():
        locale = i18n.DEFAULT_LOCALE
    return {
        "request": request,
        "config": cfg,
        "locale": locale,
        "locales": i18n.available_locales(),
        "t": i18n.make_translator(locale),
        "csrf_token": ensure_csrf(request),
        "current_user": current_user(request),
        "app_name": "BrandBlog CMS",
        "site_url": cfg.get("site_url", ""),
        "default_password": config.is_default_password(),
        "nav_active": "",
    }


def render(
    request: Request,
    template: str,
    context: dict[str, Any] | None = None,
    status_code: int = 200,
):
    ctx = base_context(request)
    if context:
        ctx.update(context)
    return templates.TemplateResponse(request, template, ctx, status_code=status_code)
