"""Post CRUD, publishing and preview."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from cms import config
from cms.security import current_user, require_csrf, require_user
from cms.services import file_service, git_service, markdown_service
from cms.templating import render

router = APIRouter()


class PostPayload(BaseModel):
    title: str = ""
    slug: str = ""
    date: str = ""
    category: str = ""
    tags: list[str] = Field(default_factory=list)
    author: str = ""
    image: str = ""
    summary: str = ""
    content: str = ""
    status: str = "draft"
    original_slug: str = ""


class PreviewPayload(BaseModel):
    content: str = ""


def _blank_post() -> dict:
    cfg = config.load_config()
    return {
        "title": "",
        "slug": "",
        "date": markdown_service.now_date(),
        "category": (cfg.get("categories") or [""])[0],
        "tags": [],
        "author": cfg.get("default_author", ""),
        "image": "",
        "summary": "",
        "content": "## Overview\n\n",
        "status": "draft",
        "is_new": True,
    }


def _editor_context(post: dict) -> dict:
    cfg = config.load_config()
    media = file_service.list_media()
    fields = ("name", "source", "url", "preview", "value", "ext", "is_image", "size_human")
    return {
        "post": post,
        "post_json": post,
        "categories": cfg.get("categories", []),
        "suggested_tags": cfg.get("suggested_tags", []),
        "media": [m for m in media if m["is_image"]],
        "media_json": [{k: m.get(k) for k in fields} for m in media],
        "autosave": cfg.get("autosave_enabled", True),
        "autosave_interval": cfg.get("autosave_interval", 30),
    }


@router.get("/posts")
def posts_page(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    posts = file_service.list_posts()
    cfg = config.load_config()
    fields = ("slug", "title", "date", "category", "tags", "status", "summary", "words", "reading_time")
    return render(
        request,
        "posts.html",
        {
            "nav_active": "posts",
            "posts": posts,
            "posts_json": [{k: p.get(k) for k in fields} for p in posts],
            "categories": cfg.get("categories", []),
            "published_count": len([p for p in posts if p["status"] == "published"]),
            "draft_count": len([p for p in posts if p["status"] == "draft"]),
        },
    )


@router.get("/posts/new")
def new_post(request: Request):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    return render(request, "editor.html", {"nav_active": "posts", **_editor_context(_blank_post())})


@router.get("/posts/{slug}/edit")
def edit_post(request: Request, slug: str):
    if not current_user(request):
        return RedirectResponse("/login", status_code=303)
    post = file_service.get_post(slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post["is_new"] = False
    return render(request, "editor.html", {"nav_active": "posts", **_editor_context(post)})


@router.get("/api/posts")
def api_list(_: str = Depends(require_user)):
    return {"posts": file_service.list_posts()}


@router.post("/api/posts")
def api_save(
    payload: PostPayload,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="error.required")

    slug = markdown_service.slugify(payload.slug or payload.title)
    original = payload.original_slug.strip()

    # Rename: move the existing file to the new slug.
    if original and original != slug:
        if file_service.post_path(slug).exists():
            raise HTTPException(status_code=409, detail="error.slug_taken")
        old = file_service.post_path(original)
        if old.exists():
            new_path = file_service.post_path(slug)
            os.replace(old, new_path)
    elif not original:
        # New post — avoid overwriting an existing file.
        base = slug
        counter = 2
        while file_service.post_path(slug).exists():
            slug = f"{base}-{counter}"
            counter += 1

    post = payload.model_dump()
    post["slug"] = slug
    post["tags"] = [t.strip() for t in post.get("tags", []) if t.strip()]
    saved = file_service.save_post(post)
    saved["is_new"] = False
    return {"ok": True, "post": saved}


@router.delete("/api/posts/{slug}")
def api_delete(
    slug: str,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    if not file_service.delete_post(slug):
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True, "slug": slug}


@router.post("/api/posts/{slug}/duplicate")
def api_duplicate(
    slug: str,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    post = file_service.get_post(slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post["title"] = f"{post['title']} (copy)"
    post["slug"] = f"{post['slug']}-copy"
    post["status"] = "draft"
    base = post["slug"]
    counter = 2
    while file_service.post_path(post["slug"]).exists():
        post["slug"] = f"{base}-{counter}"
        counter += 1
    saved = file_service.save_post(post)
    return {"ok": True, "post": saved}


@router.post("/api/posts/{slug}/publish")
def api_publish(
    slug: str,
    _: str = Depends(require_user),
    __: None = Depends(require_csrf),
):
    post = file_service.get_post(slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Publish implies the post should no longer be a draft.
    if post["status"] != "published":
        post["status"] = "published"
        file_service.save_post(post)

    backup_dir = None
    try:
        backup_dir = file_service.backup([config.CONTENT_DIR])
    except Exception:  # pragma: no cover - backup is best-effort
        backup_dir = None

    try:
        # Stage everything (respecting .gitignore) so the commit includes the
        # root-level build config the CI needs — not just content/theme/cms.
        result = git_service.publish(f"Publish: {post['title']}")
    except git_service.GitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {
        "ok": True,
        "commit": result.get("commit"),
        "branch": result.get("branch"),
        "backup": str(backup_dir) if backup_dir else None,
    }


@router.post("/api/posts/preview")
def api_preview(payload: PreviewPayload, _: str = Depends(require_user)):
    return {"html": markdown_service.markdown_to_html(payload.content)}
