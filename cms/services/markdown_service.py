"""Markdown + Pelican front-matter parsing and rendering."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import markdown as md
from slugify import slugify as _slugify

_META_KEYS = {
    "title",
    "date",
    "modified",
    "category",
    "tags",
    "slug",
    "author",
    "summary",
    "image",
    "status",
    "template",
    "lang",
    "save_as",
    "url",
}

_WORDS_PER_MINUTE = 200


def slugify(value: str) -> str:
    return _slugify(value or "", lowercase=True, max_length=80) or "untitled"


def _clean(value: str) -> str:
    return value.strip().strip('"').strip("'")


def parse_front_matter(text: str) -> tuple[dict[str, Any], str]:
    """Split Pelican "simple" front matter from the body.

    Supports the ``Key: value`` format used across the blog. Returns a
    ``(metadata, body)`` tuple.
    """
    lines = text.replace("\r\n", "\n").split("\n")
    meta: dict[str, Any] = {}
    index = 0

    if lines and lines[0].strip() == "---":  # YAML-style fence
        index = 1
        while index < len(lines) and lines[index].strip() != "---":
            line = lines[index]
            if ":" in line:
                key, _, value = line.partition(":")
                meta[key.strip().lower()] = _clean(value)
            index += 1
        index += 1  # skip closing fence
    else:
        while index < len(lines):
            line = lines[index]
            if not line.strip():
                index += 1
                break
            if ":" not in line:
                break
            key, _, value = line.partition(":")
            key_clean = key.strip().lower()
            if key_clean not in _META_KEYS:
                break
            meta[key_clean] = _clean(value)
            index += 1

    body = "\n".join(lines[index:]).strip("\n")
    if "tags" in meta and isinstance(meta["tags"], str):
        meta["tags"] = [t.strip() for t in re.split(r"[,]", meta["tags"]) if t.strip()]
    return meta, body


def read_post_text(text: str, fallback_slug: str = "") -> dict[str, Any]:
    meta, body = parse_front_matter(text)
    raw_date = meta.get("date", "")
    date_value = _normalise_date(raw_date)
    status = str(meta.get("status", "published")).lower()
    return {
        "title": meta.get("title", fallback_slug or "Untitled"),
        "slug": meta.get("slug") or fallback_slug or slugify(meta.get("title", "")),
        "date": date_value,
        "category": meta.get("category", ""),
        "tags": meta.get("tags", []) if isinstance(meta.get("tags"), list) else [],
        "author": meta.get("author", ""),
        "image": meta.get("image", ""),
        "summary": meta.get("summary", ""),
        "content": body,
        "status": "draft" if status in {"draft", "hidden"} else "published",
    }


def render_post_text(post: dict[str, Any]) -> str:
    """Serialise a post dict back into Pelican front matter + body."""
    lines = [f"Title: {post.get('title', '').strip()}"]
    if post.get("date"):
        lines.append(f"Date: {post['date']}")
    if post.get("category"):
        lines.append(f"Category: {post['category']}")
    tags = post.get("tags") or []
    if tags:
        lines.append(f"Tags: {', '.join(tags)}")
    if post.get("slug"):
        lines.append(f"Slug: {post['slug']}")
    if post.get("author"):
        lines.append(f"Author: {post['author']}")
    if post.get("image"):
        lines.append(f"Image: {post['image']}")
    if post.get("summary"):
        lines.append(f"Summary: {post['summary']}")
    if str(post.get("status", "published")).lower() == "draft":
        lines.append("Status: draft")
    body = (post.get("content") or "").strip("\n")
    return "\n".join(lines) + "\n\n" + body + "\n"


def now_date() -> str:
    """Current timestamp formatted for Pelican front matter."""
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _normalise_date(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return datetime.now().strftime("%Y-%m-%d %H:%M")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            continue
    return value


def human_date(value: str) -> str:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).strftime("%b %d, %Y")
        except ValueError:
            continue
    return value or "—"


def markdown_to_html(text: str) -> str:
    return md.markdown(
        text or "",
        extensions=["extra", "sane_lists", "toc", "tables", "fenced_code", "nl2br"],
        output_format="html5",
    )


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", text or ""))


def reading_time(text: str) -> int:
    return max(1, round(word_count(text) / _WORDS_PER_MINUTE))
