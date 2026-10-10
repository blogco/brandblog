"""Authentication: sign-in page, login/logout and password change."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from cms import config
from cms.security import current_user, require_csrf, require_user
from cms.templating import render

router = APIRouter()


class LoginPayload(BaseModel):
    username: str = ""
    password: str = ""


class PasswordPayload(BaseModel):
    current: str = ""
    new: str = Field(min_length=4, max_length=128)


@router.get("/login")
def login_page(request: Request):
    if current_user(request):
        return RedirectResponse("/", status_code=303)
    return render(request, "login.html")


@router.post("/api/login")
def do_login(request: Request, payload: LoginPayload, _: None = Depends(require_csrf)):
    auth = config.get_auth()
    username_ok = payload.username.strip() == auth.get("username", "admin")
    password_ok = config.verify_password(payload.password)
    if not (username_ok and password_ok):
        raise HTTPException(status_code=401, detail="auth.invalid")
    request.session["user"] = auth.get("username", "admin")
    return {"ok": True, "user": request.session["user"]}


@router.post("/api/logout")
def do_logout(request: Request, _: None = Depends(require_csrf)):
    request.session.clear()
    return {"ok": True}


@router.post("/api/password")
def change_password(
    request: Request,
    payload: PasswordPayload,
    user: str = Depends(require_user),
    _: None = Depends(require_csrf),
):
    if not config.verify_password(payload.current):
        raise HTTPException(status_code=400, detail="auth.invalid")
    config.set_password(payload.new)
    return {"ok": True}
