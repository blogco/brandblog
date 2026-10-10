"""Categories & tags overview."""

from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from cms import config
from cms.security import current_user
from cms.services import file_service
from cms.templating import render

router = APIRouter()


@router.get("/categories")
def categories_page(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    posts = file_service.list_posts()
    category_counts = Counter(p.get("category", "") for p in posts if p.get("category"))
    tag_counts = Counter(tag for p in posts for tag in p.get("tags", []))
    cfg = config.load_config()
    known_categories = cfg.get("categories", [])
    all_categories = dict(category_counts)
    for name in known_categories:
        all_categories.setdefault(name, 0)
    return render(
        request,
        "categories.html",
        {
            "nav_active": "categories",
            "categories": dict(sorted(all_categories.items(), key=lambda kv: (-kv[1], kv[0]))),
            "tags": dict(sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
            "post_count": len(posts),
        },
    )
