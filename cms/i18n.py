"""Tiny i18n helper — JSON locale files with graceful fallback."""

from __future__ import annotations

import json
from pathlib import Path

from cms import config

LOCALES_DIR = config.CMS_DIR / "locales"
DEFAULT_LOCALE = "vi"
_cache: dict[str, dict[str, str]] = {}


def available_locales() -> list[str]:
    if not LOCALES_DIR.exists():
        return [DEFAULT_LOCALE]
    return sorted(p.stem for p in LOCALES_DIR.glob("*.json"))


def _load(locale: str) -> dict[str, str]:
    if locale in _cache:
        return _cache[locale]
    path = LOCALES_DIR / f"{locale}.json"
    data: dict[str, str] = {}
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:  # pragma: no cover
            data = {}
    _cache[locale] = data
    return data


def translate(locale: str, key: str, **kwargs) -> str:
    base = _load(DEFAULT_LOCALE)
    table = _load(locale) if locale != DEFAULT_LOCALE else base
    text = table.get(key) or base.get(key) or key
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, IndexError, ValueError):
            pass
    return text


def make_translator(locale: str):
    def t(key: str, **kwargs) -> str:
        return translate(locale, key, **kwargs)

    return t
