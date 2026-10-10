"""Git operations exposed to the UI: status, commit, publish, pull, log."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from cms import config
from cms.security import require_csrf, require_user
from cms.services import git_service

router = APIRouter()


class CommitPayload(BaseModel):
    message: str = "Update from BrandBlog CMS"


@router.get("/api/git/status")
def api_status(_: str = Depends(require_user)):
    try:
        status = git_service.status()
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    status["token_source"] = config.token_source()
    return status


@router.get("/api/git/log")
def api_log(limit: int = 10, _: str = Depends(require_user)):
    try:
        return {"log": git_service.log(limit=limit)}
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/api/git/publish")
def api_publish(
    payload: CommitPayload,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    try:
        result = git_service.publish(payload.message, paths=["content", "theme", "cms"])
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"ok": True, **result}


@router.post("/api/git/commit")
def api_commit(
    payload: CommitPayload,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    try:
        result = git_service.commit(payload.message, paths=["content", "theme", "cms"])
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"ok": True, **result}


@router.post("/api/git/pull")
def api_pull(_: str = Depends(require_user), __: None = Depends(require_csrf)):
    try:
        result = git_service.pull()
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"ok": True, **result}
