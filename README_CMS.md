# BrandBlog CMS

**CMS chạy local cho blog tĩnh Pelican** — viết, chỉnh sửa, tải ảnh và **publish 1 click** lên GitHub Pages qua giao diện đồ họa. Không cần mở Terminal sau khi khởi động.

> ⚠️ Đây là dự án học tập, phi thương mại và **không liên kết với Sembcorp Industries**.

---

## 1. Tính năng

| Nhóm | Chi tiết |
|------|----------|
| **Bài viết** | Tạo / sửa / xóa (chuyển vào `.trash/`) / nhân bản. Lọc theo trạng thái, tìm kiếm, sắp xếp. |
| **Editor** | Markdown có preview trực tiếp (EasyMDE), toolbar đầy đủ, đếm từ + thời gian đọc. |
| **Auto-save** | Tự động lưu mỗi 30 giây (cấu hình được), hỗ trợ `Cmd+S`. |
| **Media** | Kéo-thả tải ảnh, thumbnail, copy URL, kiểm tra ảnh đang dùng trong bài nào. |
| **Publish** | Tự commit + push lên GitHub → GitHub Actions rebuild → blog live sau ~1 phút. |
| **Preview** | Pelican dev server tự chạy ở `http://localhost:8000`. |
| **Dashboard** | Thống kê bài đã đăng / nháp / ảnh, trạng thái Git, commit gần đây. |
| **Settings** | Cấu hình repo, branch, token, màu sắc, font, ngôn ngữ, mật khẩu. |
| **i18n** | Giao diện Tiếng Việt + English. |
| **Bảo mật** | Chỉ bind `127.0.0.1`, CSRF cho mọi thao tác ghi, mật khẩu bcrypt, token lưu trong macOS Keychain. |

---

## 2. Cách chạy (dành cho người dùng Mac)

### Cách 1 — Double-click (khuyến nghị)

1. Mở thư mục dự án trong **Finder**.
2. Double-click file **`run_cms.command`**.
3. Lần đầu chạy sẽ tự tạo virtualenv + cài thư viện (mất 1–2 phút).
4. Trình duyệt tự mở tại **http://127.0.0.1:5000** (nếu cổng 5000 bận — thường do AirPlay — CMS tự dùng 5001, 5002… và mở đúng URL đó).

Nếu macOS chặn file: bấm **chuột phải → Open → Open** một lần, hoặc cấp quyền thực thi:

```bash
chmod +x run_cms.command
```

### Cách 2 — Terminal (cho lập trình viên)

```bash
cd /đường/dẫn/brandblog
python3 -m venv cms/venv
source cms/venv/bin/activate
pip install -r cms/requirements.txt
python cms/app.py
```

Mở **http://localhost:5000**.

### Đăng nhập mặc định

| Tên đăng nhập | Mật khẩu |
|---------------|----------|
| `admin` | `brandblog` |

> 🔐 Hãy đổi mật khẩu ngay trong **Settings → Change password**.

---

## 3. Quy trình viết bài

1. **+ New Post** ở sidebar (hoặc Dashboard).
2. Điền **Title**, **Slug**, **Summary**, chọn **Category** và **Tags**.
3. Viết nội dung Markdown ở cột trái; preview ở chế độ *side-by-side*.
4. **Kéo-thả ảnh** trực tiếp vào editor → ảnh tự tải lên `content/images/` và chèn Markdown.
5. Đặt **Featured Image** (bấm ô ảnh → chọn từ thư viện, hoặc kéo-thả).
6. Bấm **Save** (hoặc `Cmd+S`). Auto-save cũng chạy nền.
7. Bấm **🚀 Publish** → CMS commit + push → GitHub Actions build lại blog.

**Nút Publish có 3 trạng thái:** `🚀 Publish` → `⏳ Publishing...` → `❌ Failed - Retry` (kèm hướng dẫn khắc phục).

---

## 4. Cấu trúc thư mục

```
brandblog/
├── cms/                       # Ứng dụng CMS (mới)
│   ├── app.py                 # FastAPI entry point
│   ├── config.py              # Paths + cấu hình + Keychain + auth
│   ├── security.py            # CSRF + xác thực
│   ├── i18n.py                # Đa ngôn ngữ
│   ├── locales/{vi,en}.json
│   ├── routes/                # dashboard, posts, media, git_ops, settings, preview, auth, categories
│   ├── services/              # markdown, file, git, pelican
│   ├── templates/             # Jinja2 (base, dashboard, editor, media, settings…)
│   ├── static/                # css (Tailwind build), js, vendor (Alpine, EasyMDE, FontAwesome)
│   ├── tests/                 # pytest
│   └── requirements.txt
├── content/                   # Bài viết & ảnh (Pelican)
│   ├── posts/*.md
│   └── images/                # Ảnh tải lên từ CMS
├── theme/                     # Giao diện blog tĩnh
├── run_cms.command            # Double-click để chạy
└── README_CMS.md
```

---

## 5. Cấu hình

Settings lưu vào **`.cms_config.json`** (đã git-ignore). Các mục chính:

- **GitHub:** repo URL, branch, token (lưu trong macOS Keychain qua thư viện `keyring`).
- **Appearance:** màu chính, font, theme mode, ngôn ngữ.
- **Auto-save:** bật/tắt và khoảng thời gian.

### Token GitHub cần quyền gì?

Token cá nhân (PAT, `repo` + `workflow`) — quyền `workflow` bắt buộc vì repo có thư mục `.github/workflows/`.

**Tạo token:** GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained* hoặc *Classic* với scope `repo`, `workflow`.

Dán token vào **Settings → GitHub Token → Save Settings**. Token được lưu an toàn trong **macOS Keychain**, không ghi ra file.

---

## 6. Bảo mật

- Server **chỉ bind `127.0.0.1`** — không truy cập được từ mạng LAN.
- **CSRF** bắt buộc cho mọi request POST/PUT/DELETE (`X-CSRF-Token`).
- Cookie session `HttpOnly` + `SameSite=Strict`.
- Mật khẩu băm bằng **bcrypt**.
- **Chống path traversal:** mọi đường dẫn file đều được `Path.resolve()` và kiểm tra nằm trong thư mục dự án.

---

## 7. Backup & an toàn dữ liệu

- Trước **mỗi lần publish**, CMS tự sao lưu `content/` vào `.backups/<timestamp>/`.
- Bài viết bị xóa được **chuyển vào `.trash/`** (không xóa vĩnh viễn).
- Ảnh bị xóa cũng vào `.trash/media/`.

Các thư mục này đã được git-ignore.

---

## 8. API (tự động có tài liệu)

FastAPI sinh sẵn tài liệu tại **http://localhost:5000/api/docs**.

Các nhóm endpoint chính:

```
GET    /api/posts                      # danh sách bài viết
POST   /api/posts                      # tạo / lưu (kèm original_slug để đổi tên)
DELETE /api/posts/{slug}
POST   /api/posts/{slug}/duplicate
POST   /api/posts/{slug}/publish       # commit + push
POST   /api/posts/preview              # render Markdown → HTML

GET    /api/media                      # thư viện
POST   /api/media/upload               # multipart
DELETE /api/media?source=&name=

GET    /api/git/status  |  /api/git/log
POST   /api/git/publish |  /api/git/pull | /api/git/commit

GET    /api/settings
POST   /api/settings  |  /api/settings/token
POST   /api/settings/test-github  |  /api/settings/test-pelican

POST   /api/preview/start | /api/preview/stop | /api/preview/build
```

---

## 9. Phát triển & kiểm thử

```bash
# CSS cho CMS (Tailwind) — chạy sau khi sửa template/class
npm run build:cms-css        # hoặc: npm run build (build cả blog + CMS)

# Chạy test
cms/venv/bin/python -m pytest cms/tests -q
```

### Build CSS blog tĩnh

```bash
npm run build:css
```

### Build & deploy blog

```bash
npm run build:site                       # pelican content -s publishconf.py -o output
# hoặc push lên main → GitHub Actions tự build + deploy
```

---

## 10. Xử lý sự cố

| Vấn đề | Cách khắc phục |
|--------|----------------|
| **Mở `localhost:5000` báo 403** | Cổng 5000 bị **AirPlay Receiver** của macOS chiếm. CMS tự chuyển sang cổng trống (5001, 5002…). Xem cổng thật ở cửa sổ Terminal hoặc dùng URL mà trình duyệt tự mở. Có thể tắt AirPlay: *System Settings → General → AirDrop & Handoff → AirPlay Receiver*. |
| Cổng 5000 đang dùng | CMS tự nhảy cổng; hoặc chỉ định: `CMS_PORT=5010 python cms/app.py` |
| Publish lỗi *Authentication failed* | Kiểm tra token trong Settings (cần `repo` + `workflow`). |
| Publish lỗi *workflow scope* | Token thiếu scope `workflow`. |
| Push bị *rejected* | Remote có commit mới hơn → bấm **Pull** rồi publish lại. |
| Preview không lên | Chạy `cms/venv/bin/pelican --version`; cài lại nếu thiếu. |
| Keychain không lưu được token | Token sẽ lưu tạm vào `.cms_config.json` (chmod 600). |

---

## 11. Tech stack

- **Backend:** FastAPI + Uvicorn (Python 3.11–3.14)
- **Template:** Jinja2
- **Frontend:** HTML + Tailwind CSS (build sẵn, chạy offline) + Alpine.js
- **Editor:** EasyMDE
- **Git:** GitPython + `git` CLI
- **Ảnh:** Pillow (thumbnail)
- **Bảo mật:** bcrypt, itsdangerous, keyring

Mọi thư viện front-end (Alpine, EasyMDE, Font Awesome) được **vendor sẵn** trong `cms/static/vendor/` để CMS hoạt động **offline** (trừ lúc publish).
