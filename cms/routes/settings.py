"""Settings: configuration, GitHub token, connection tests."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from cms import config
from cms.security import current_user, require_csrf, require_user
from cms.services import git_service, pelican_service
from cms.templating import render

router = APIRouter()

_EDITABLE = {
    "repo_url",
    "branch",
    "site_url",
    "default_author",
    "github_username",
    "primary_color",
    "font",
    "theme_mode",
    "autosave_enabled",
    "autosave_interval",
    "locale",
    "categories",
    "suggested_tags",
}


class SettingsPayload(BaseModel):
    model_config = {"extra": "ignore"}
    repo_url: str | None = None
    branch: str | None = None
    site_url: str | None = None
    default_author: str | None = None
    github_username: str | None = None
    primary_color: str | None = None
    font: str | None = None
    theme_mode: str | None = None
    autosave_enabled: bool | None = None
    autosave_interval: int | None = None
    locale: str | None = None
    categories: list[str] | None = None
    suggested_tags: list[str] | None = None


class TokenPayload(BaseModel):
    token: str = ""


def _masked(token: str) -> str:
    if not token:
        return ""
    if len(token) < 8:
        return "•" * len(token)
    return f"{token[:4]}{'•' * 12}{token[-4:]}"


@router.get("/settings")
def settings_page(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    cfg = config.load_config()
    return render(
        request,
        "settings.html",
        {
            "nav_active": "settings",
            "paths": {
                "content": str(config.CONTENT_DIR),
                "media": str(config.IMAGES_DIR),
                "theme": str(config.THEME_DIR),
                "posts": str(config.POSTS_DIR),
            },
            "masked_token": _masked(config.get_token()),
            "has_token": bool(config.get_token()),
            "token_source": config.token_source(),
            "default_password": config.is_default_password(),
            "cfg": cfg,
        },
    )


@router.get("/api/settings")
def api_get(_: str = Depends(require_user)):
    cfg = config.load_config()
    return {
        "config": cfg,
        "has_token": bool(config.get_token()),
        "masked_token": _masked(config.get_token()),
        "token_source": config.token_source(),
    }


@router.post("/api/settings")
def api_save(
    payload: SettingsPayload,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    patch = {k: v for k, v in payload.model_dump().items() if k in _EDITABLE and v is not None}
    if "autosave_interval" in patch:
        patch["autosave_interval"] = max(5, min(600, int(patch["autosave_interval"])))
    cfg = config.save_config(patch)
    return {"ok": True, "config": cfg}


@router.post("/api/settings/token")
def api_token(
    payload: TokenPayload,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    config.set_token(payload.token.strip() or None)
    return {"ok": True, "has_token": bool(config.get_token()), "source": config.token_source()}


@router.post("/api/settings/test-github")
def api_test_github(_: str = Depends(require_user), __: None = Depends(require_csrf)):
    cfg = config.load_config()
    try:
        result = git_service.test_connection(cfg.get("repo_url", ""), config.get_token(), cfg.get("branch", "main"))
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"ok": True, **result}


@router.post("/api/settings/test-pelican")
def api_test_pelican(_: str = Depends(require_user), __: None = Depends(require_csrf)):
    return {"ok": True, **pelican_service.version()}
