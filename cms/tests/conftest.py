"""Pytest fixtures for the BrandBlog CMS.

Redirects every path into a throw-away tmp directory so tests never touch the
real blog content, and disables the auto-started Pelican preview server.
"""

import os

os.environ["BRANDBLOG_CMS_NO_PREVIEW"] = "1"

import re

import pytest
from fastapi.testclient import TestClient

from cms import config


@pytest.fixture()
def project(tmp_path, monkeypatch):
    content = tmp_path / "content"
    (content / "posts").mkdir(parents=True)
    (content / "images").mkdir(parents=True)
    theme_images = tmp_path / "theme" / "static" / "images"
    theme_images.mkdir(parents=True)

    monkeypatch.setattr(config, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(config, "CONTENT_DIR", content)
    monkeypatch.setattr(config, "POSTS_DIR", content / "posts")
    monkeypatch.setattr(config, "PAGES_DIR", content / "pages")
    monkeypatch.setattr(config, "IMAGES_DIR", content / "images")
    monkeypatch.setattr(config, "THEME_DIR", tmp_path / "theme")
    monkeypatch.setattr(config, "THEME_IMAGES_DIR", theme_images)
    monkeypatch.setattr(config, "TRASH_DIR", tmp_path / ".trash")
    monkeypatch.setattr(config, "BACKUPS_DIR", tmp_path / ".backups")
    monkeypatch.setattr(config, "CONFIG_FILE", tmp_path / ".cms_config.json")
    monkeypatch.setattr(config, "AUTH_FILE", tmp_path / ".cms_auth.json")
    # Never touch the real macOS Keychain during tests.
    monkeypatch.setattr(config, "get_token", lambda: "")
    monkeypatch.setattr(config, "set_token", lambda token=None: None)
    monkeypatch.setattr(config, "token_source", lambda: "none")

    config.set_password("testpass")
    return tmp_path


@pytest.fixture()
def client(project):
    from cms.app import app

    with TestClient(app) as test_client:
        yield test_client


def get_csrf(client: TestClient) -> str:
    page = client.get("/login")
    match = re.search(r'name="csrf-token" content="([^"]+)"', page.text)
    assert match, "CSRF token not found on login page"
    return match.group(1)


def login(client: TestClient) -> None:
    token = get_csrf(client)
    response = client.post(
        "/api/login",
        json={"username": "admin", "password": "testpass"},
        headers={"X-CSRF-Token": token},
    )
    assert response.status_code == 200, response.text
