"""Core CMS test cases: auth, CSRF, CRUD, media, preview, settings."""

from cms.tests.conftest import get_csrf, login

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_health(client):
    assert client.get("/healthz").json()["ok"] is True


def test_login_requires_csrf(client):
    response = client.post("/api/login", json={"username": "admin", "password": "testpass"})
    assert response.status_code == 403


def test_login_wrong_password(client):
    token = get_csrf(client)
    response = client.post(
        "/api/login",
        json={"username": "admin", "password": "nope"},
        headers={"X-CSRF-Token": token},
    )
    assert response.status_code == 401


def test_protected_page_redirects(client):
    response = client.get("/posts", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/login"


def test_login_then_dashboard(client):
    login(client)
    response = client.get("/")
    assert response.status_code == 200
    assert "Dashboard" in response.text or "dash" in response.text.lower()


def test_create_list_and_delete_post(client):
    login(client)
    token = get_csrf(client)
    headers = {"X-CSRF-Token": token}
    post = {
        "title": "Test Article",
        "slug": "test-article",
        "date": "2026-08-13 09:00",
        "category": "Insights",
        "tags": ["Corporate"],
        "author": "Tester",
        "summary": "A short summary.",
        "content": "## Heading\n\nBody text.",
        "status": "draft",
        "original_slug": "",
    }
    created = client.post("/api/posts", json=post, headers=headers)
    assert created.status_code == 200, created.text
    assert created.json()["post"]["slug"] == "test-article"

    listed = client.get("/api/posts").json()["posts"]
    assert any(p["slug"] == "test-article" for p in listed)

    # Rename
    renamed = dict(post, slug="test-article-renamed", original_slug="test-article")
    assert client.post("/api/posts", json=renamed, headers=headers).status_code == 200
    assert any(p["slug"] == "test-article-renamed" for p in client.get("/api/posts").json()["posts"])

    deleted = client.delete("/api/posts/test-article-renamed", headers=headers)
    assert deleted.status_code == 200
    assert not any(p["slug"] == "test-article-renamed" for p in client.get("/api/posts").json()["posts"])


def test_save_requires_csrf(client):
    login(client)
    response = client.post("/api/posts", json={"title": "x", "content": "y"})
    assert response.status_code == 403


def test_media_upload_and_list(client):
    login(client)
    token = get_csrf(client)
    response = client.post(
        "/api/media/upload",
        files={"files": ("pic.png", PNG, "image/png")},
        headers={"X-CSRF-Token": token},
    )
    assert response.status_code == 200, response.text
    assert response.json()["saved"][0]["name"] == "pic.png"

    media = client.get("/api/media").json()["media"]
    assert any(m["name"] == "pic.png" and m["source"] == "uploads" for m in media)

    # Unsupported type rejected
    bad = client.post(
        "/api/media/upload",
        files={"files": ("virus.exe", b"x", "application/octet-stream")},
        headers={"X-CSRF-Token": token},
    )
    assert bad.json()["errors"]


def test_markdown_preview(client):
    login(client)
    response = client.post("/api/posts/preview", json={"content": "## Hi\n\n**bold**"})
    assert response.status_code == 200
    html = response.json()["html"]
    assert "<h2" in html and "<strong>" in html


def test_settings_get(client):
    login(client)
    data = client.get("/api/settings").json()
    assert "repo_url" in data["config"]
    assert data["has_token"] is False
