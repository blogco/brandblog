"""Configuration, paths and secret storage for the BrandBlog CMS.

Everything the CMS needs to know about *where* things live and *how* it is
configured lives here. User-editable settings are persisted to
``.cms_config.json`` at the project root (git-ignored).
"""

from __future__ import annotations

import json
import os
import secrets
from pathlib import Path
from typing import Any

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
CMS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CMS_DIR.parent

CONTENT_DIR = PROJECT_ROOT / "content"
POSTS_DIR = CONTENT_DIR / "posts"
PAGES_DIR = CONTENT_DIR / "pages"
IMAGES_DIR = CONTENT_DIR / "images"  # primary upload target (Pelican STATIC_PATHS)
THEME_DIR = PROJECT_ROOT / "theme"
THEME_IMAGES_DIR = THEME_DIR / "static" / "images"
OUTPUT_DIR = PROJECT_ROOT / "output"
TRASH_DIR = PROJECT_ROOT / ".trash"
BACKUPS_DIR = PROJECT_ROOT / ".backups"

CONFIG_FILE = PROJECT_ROOT / ".cms_config.json"
AUTH_FILE = PROJECT_ROOT / ".cms_auth.json"
SECRET_FILE = PROJECT_ROOT / ".cms_secret"

# --------------------------------------------------------------------------- #
# Keyring (macOS Keychain)
# --------------------------------------------------------------------------- #
KEYRING_SERVICE = "brandblog-cms"
KEYRING_TOKEN_KEY = "github-token"
KEYRING_PASSWORD_KEY = "cms-password"


def _keyring():
    try:
        import keyring  # type: ignore

        return keyring
    except Exception:  # pragma: no cover - keyring is optional at runtime
        return None


# --------------------------------------------------------------------------- #
# Default configuration
# --------------------------------------------------------------------------- #
DEFAULT_CONFIG: dict[str, Any] = {
    "repo_url": "https://github.com/blogco/brandblog.git",
    "branch": "main",
    "site_url": "https://blogco.github.io/brandblog",
    "default_author": "BrandBlog Editorial",
    "github_username": "",
    # Appearance
    "primary_color": "#006C53",
    "font": "Helvetica Neue",
    "theme_mode": "light",
    # Auto-save
    "autosave_enabled": True,
    "autosave_interval": 30,
    # i18n
    "locale": "vi",
    # Content taxonomy presets
    "categories": ["Media Releases", "Company Announcements", "Insights"],
    "suggested_tags": [
        "Corporate",
        "Renewables",
        "Financial Results",
        "Innovation",
        "Community",
    ],
}


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write_json(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)
    try:
        os.chmod(path, 0o600)
    except OSError:  # pragma: no cover - best effort on non-POSIX
        pass


def load_config() -> dict[str, Any]:
    """Return the merged configuration (defaults + user overrides)."""
    config = dict(DEFAULT_CONFIG)
    config.update(_read_json(CONFIG_FILE))
    return config


def save_config(patch: dict[str, Any]) -> dict[str, Any]:
    """Merge ``patch`` into the stored config and return the result."""
    config = load_config()
    for key, value in patch.items():
        if value is not None:
            config[key] = value
    # Never persist the token inside the config file.
    config.pop("github_token", None)
    _write_json(CONFIG_FILE, config)
    return config


# --------------------------------------------------------------------------- #
# Session secret
# --------------------------------------------------------------------------- #
def get_secret_key() -> str:
    if SECRET_FILE.exists():
        value = SECRET_FILE.read_text(encoding="utf-8").strip()
        if value:
            return value
    value = secrets.token_urlsafe(48)
    SECRET_FILE.write_text(value, encoding="utf-8")
    try:
        os.chmod(SECRET_FILE, 0o600)
    except OSError:  # pragma: no cover
        pass
    return value


# --------------------------------------------------------------------------- #
# GitHub token (Keychain preferred, config file as fallback)
# --------------------------------------------------------------------------- #
def get_token() -> str:
    env = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if env:
        return env
    kr = _keyring()
    if kr is not None:
        try:
            value = kr.get_password(KEYRING_SERVICE, KEYRING_TOKEN_KEY)
            if value:
                return value
        except Exception:  # pragma: no cover - keychain may be locked
            pass
    # Plaintext fallback (only used when the Keychain is unavailable).
    return _read_json(CONFIG_FILE).get("github_token", "")


def set_token(token: str | None) -> None:
    kr = _keyring()
    stored = False
    if kr is not None and token:
        try:
            kr.set_password(KEYRING_SERVICE, KEYRING_TOKEN_KEY, token)
            stored = True
        except Exception:  # pragma: no cover
            stored = False
    data = _read_json(CONFIG_FILE)
    if stored or not token:
        data.pop("github_token", None)
    else:
        data["github_token"] = token
    _write_json(CONFIG_FILE, data)


def token_source() -> str:
    """Describe where the token comes from, for the Settings UI."""
    if os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"):
        return "environment"
    kr = _keyring()
    if kr is not None:
        try:
            if kr.get_password(KEYRING_SERVICE, KEYRING_TOKEN_KEY):
                return "keychain"
        except Exception:  # pragma: no cover
            pass
    if _read_json(CONFIG_FILE).get("github_token"):
        return "config"
    return "none"


# --------------------------------------------------------------------------- #
# Auth (single local user, bcrypt-hashed password)
# --------------------------------------------------------------------------- #
def _auth_data() -> dict[str, Any]:
    data = _read_json(AUTH_FILE)
    if not data:
        # First run: create a default local account.
        import bcrypt

        default_password = "brandblog"
        hashed = bcrypt.hashpw(default_password.encode(), bcrypt.gensalt()).decode()
        data = {"username": "admin", "password_hash": hashed, "is_default": True}
        _write_json(AUTH_FILE, data)
    return data


def get_auth() -> dict[str, Any]:
    return _auth_data()


def verify_password(password: str) -> bool:
    import bcrypt

    data = _auth_data()
    try:
        return bcrypt.checkpw(password.encode(), data["password_hash"].encode())
    except (KeyError, ValueError):
        return False


def set_password(new_password: str) -> None:
    import bcrypt

    data = _auth_data()
    data["password_hash"] = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    data["is_default"] = False
    _write_json(AUTH_FILE, data)


def is_default_password() -> bool:
    return bool(_auth_data().get("is_default"))


def ensure_dirs() -> None:
    for path in (POSTS_DIR, PAGES_DIR, IMAGES_DIR, TRASH_DIR, BACKUPS_DIR):
        path.mkdir(parents=True, exist_ok=True)
