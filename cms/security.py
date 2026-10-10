"""Security helpers: authentication deps and CSRF protection."""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, Request


def current_user(request: Request) -> str | None:
    return request.session.get("user")


def require_user(request: Request) -> str:
    user = current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def ensure_csrf(request: Request) -> str:
    token = request.session.get("csrf")
    if not token:
        token = secrets.token_urlsafe(32)
        request.session["csrf"] = token
    return token


def require_csrf(request: Request, x_csrf_token: str | None = Header(default=None)) -> None:
    """Validate the CSRF header on state-changing requests.

    All mutating endpoints are called from JavaScript with an
    ``X-CSRF-Token`` header, which keeps validation simple and robust.
    """
    expected = request.session.get("csrf")
    if not expected or not x_csrf_token or not secrets.compare_digest(expected, x_csrf_token):
        raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
