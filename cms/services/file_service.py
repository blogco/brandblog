"""Safe filesystem helpers: path validation, atomic writes, backups, trash."""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Iterable

from cms import config
from cms.services import markdown_service


class UnsafePathError(ValueError):
    """Raised when a path escapes the project root."""


def safe_path(base: Path, *parts: str) -> Path:
    """Join ``parts`` onto ``base`` and guarantee the result stays inside it."""
    candidate = (base.joinpath(*parts)).resolve()
    base_resolved = base.resolve()
    if candidate != base_resolved and base_resolved not in candidate.parents:
        raise UnsafePathError(f"Path escapes {base_resolved}: {candidate}")
    return candidate


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


# --------------------------------------------------------------------------- #
# Posts
# --------------------------------------------------------------------------- #
def post_path(slug: str) -> Path:
    return safe_path(config.POSTS_DIR, f"{slug}.md")


def list_posts() -> list[dict]:
    posts: list[dict] = []
    if not config.POSTS_DIR.exists():
        return posts
    for path in sorted(config.POSTS_DIR.glob("*.md")):
        try:
            post = markdown_service.read_post_text(read_text(path), fallback_slug=path.stem)
        except Exception:  # pragma: no cover - skip unreadable files
            continue
        post["filename"] = path.name
        post["words"] = markdown_service.word_count(post["content"])
        post["reading_time"] = markdown_service.reading_time(post["content"])
        posts.append(post)
    posts.sort(key=lambda p: p.get("date", ""), reverse=True)
    return posts


def get_post(slug: str) -> dict | None:
    path = post_path(slug)
    if not path.exists():
        return None
    post = markdown_service.read_post_text(read_text(path), fallback_slug=slug)
    post["filename"] = path.name
    return post


def save_post(post: dict) -> dict:
    slug = markdown_service.slugify(post.get("slug") or post.get("title", ""))
    post["slug"] = slug
    path = post_path(slug)
    write_text(path, markdown_service.render_post_text(post))
    return post


def delete_post(slug: str) -> bool:
    path = post_path(slug)
    if not path.exists():
        return False
    config.TRASH_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = safe_path(config.TRASH_DIR, f"{stamp}-{path.name}")
    shutil.move(str(path), str(target))
    return True


# --------------------------------------------------------------------------- #
# Media
# --------------------------------------------------------------------------- #
def _save_image_variants(path: Path) -> None:
    """Best-effort: create a thumbnail for large raster images."""
    if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return
    try:
        from PIL import Image
    except Exception:  # pragma: no cover
        return
    try:
        with Image.open(path) as img:
            if max(img.size) <= 640:
                return
            img.thumbnail((640, 640))
            thumb = path.with_name(f"{path.stem}.thumb{path.suffix}")
            img.save(thumb)
    except Exception:  # pragma: no cover - thumbnails are optional
        return


def media_dirs() -> list[tuple[str, Path]]:
    """Return (label, directory) pairs shown in the media library."""
    return [
        ("uploads", config.IMAGES_DIR),
        ("theme", config.THEME_IMAGES_DIR),
    ]


def resolve_media(source: str, name: str) -> Path:
    dirs = dict(media_dirs())
    if source not in dirs:
        raise UnsafePathError(f"Unknown media source: {source}")
    return safe_path(dirs[source], name)


def list_media() -> list[dict]:
    items: list[dict] = []
    for label, directory in media_dirs():
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*")):
            if not path.is_file() or path.name.endswith((".tmp",)):
                continue
            stat = path.stat()
            items.append(
                {
                    "name": path.name,
                    "source": label,
                    "ext": path.suffix.lower().lstrip("."),
                    "size": stat.st_size,
                    "size_human": human_size(stat.st_size),
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "is_image": path.suffix.lower() in {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"},
                    "url": media_url(label, path.name),
                    "preview": f"/media/file/{label}/{path.name}",
                    "value": f"images/{path.name}" if label == "uploads" else path.name,
                }
            )
    items.sort(key=lambda i: i["modified"], reverse=True)
    return items


def media_url(source: str, name: str) -> str:
    if source == "uploads":
        return f"/images/{name}"
    return f"/static/images/{name}"


def human_size(num: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if num < 1024:
            return f"{num:.0f} {unit}" if unit == "B" else f"{num:.1f} {unit}"
        num /= 1024  # type: ignore[assignment]
    return f"{num:.1f} TB"


def usages_of_media(name: str) -> list[dict]:
    """Find posts that reference a given media filename."""
    hits: list[dict] = []
    for post in list_posts():
        haystack = (post.get("content", "") + " " + post.get("image", "")).lower()
        if name.lower() in haystack:
            hits.append({"slug": post["slug"], "title": post["title"]})
    return hits


# --------------------------------------------------------------------------- #
# Backups
# --------------------------------------------------------------------------- #
def backup(paths: Iterable[Path] | None = None) -> Path:
    """Copy the content directory into ``.backups/<timestamp>/``."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = config.BACKUPS_DIR / stamp
    target.mkdir(parents=True, exist_ok=True)
    for path in paths or [config.CONTENT_DIR]:
        if not path.exists():
            continue
        dest = target / path.name
        if path.is_dir():
            shutil.copytree(path, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(path, dest)
    return target
