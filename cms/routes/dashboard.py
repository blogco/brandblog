"""Dashboard: overview stats, recent posts and git status."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from cms.security import current_user, require_user
from cms.services import file_service, git_service
from cms.templating import render

router = APIRouter()


def _stats() -> dict:
    posts = file_service.list_posts()
    published = [p for p in posts if p["status"] == "published"]
    drafts = [p for p in posts if p["status"] == "draft"]
    media = file_service.list_media()
    return {
        "posts": posts,
        "published_count": len(published),
        "draft_count": len(drafts),
        "media_count": len(media),
        "total_words": sum(p.get("words", 0) for p in posts),
    }


@router.get("/")
def dashboard(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    stats = _stats()
    git = {}
    try:
        git = git_service.status()
        commits = git_service.log(5)
    except Exception as exc:  # pragma: no cover - repo may be unavailable
        git = {"dirty": False, "error": str(exc)}
        commits = []
    return render(
        request,
        "dashboard.html",
        {
            "nav_active": "dashboard",
            **stats,
            "recent_posts": stats["posts"][:5],
            "git": git,
            "commits": commits,
        },
    )


@router.get("/api/stats")
def api_stats(_: str = Depends(require_user)):
    stats = _stats()
    stats.pop("posts", None)
    return stats
