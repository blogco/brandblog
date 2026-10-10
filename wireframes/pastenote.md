# Wireframe — Pastenote (3M Post-it board)

Route: `/pastenote/` · Template: `theme/templates/pastenote.html` ·
Content: `content/pages/pastenote.md` · Styles: `theme/static/css/pastenote.css` ·
Logic: `theme/static/js/pastenote.js` · Data: `content/data/pastenote.json`

A public notice board where pasted links, images and text become 3M Post-it style sticky
notes. Everything is auto-saved to the browser; an admin can sync the board to GitHub.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER  (same as Home — utility bar + sticky main nav; "Pastenote" active)     │
├──────────────────────────────────────────────────────────────────────────────┤
│ HERO (deep Sembcorp-green gradient)                                            │
│   Home / Pastenote                              (breadcrumb)                   │
│   Post-it board · dán là xong                   (eyebrow)                      │
│   Pastenote                                     (H1, white)                    │
│   Dán mọi thứ khẩn cấp — link, ảnh hoặc text …   (description)                 │
│   ( 0 ghi chú )  ( Tự động lưu )  ( Sync GitHub )  ← glass stat pills          │
├──────────────────────────────────────────────────────────────────────────────┤
│ PASTE ZONE                                                                     │
│   ┌──────────────────────────────────────────────────────────────────────┐    │
│   │ 📋  [ Dán link, ảnh, hoặc text vào đây…  (Cmd/⌃+V)            ]      │    │
│   │ ──────────────────────────────────────────────────────────────────── │    │
│   │ (●)(●)(●)(●)(●)(●)                    [ ＋ Thêm note mới ] [ 📋 Dán ] │    │
│   └──────────────────────────────────────────────────────────────────────┘    │
│   dashed 2px border, radius 12px · focus → solid green ring                    │
│   Hỗ trợ Cmd/⌃+V, kéo-thả ảnh · URL→link · Ảnh→thumbnail · Text→note           │
├──────────────────────────────────────────────────────────────────────────────┤
│ NOTES BOARD  (grid auto-fill, minmax(240px, 1fr), dotted paper background)     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 📌           │  │ 📌           │  │ 📌           │  │ 📌           │        │
│  │ example.com  │  │ [ ảnh ]      │  │ Nhớ gọi khách│  │ Ghi chú màu  │        │
│  │ /news/…      │  │              │  │ lúc 3h chiều │  │ tím          │        │
│  │ ──────────── │  │ ──────────── │  │ ──────────── │  │ ──────────── │        │
│  │ 2m ago  ⧉ 🗑 │  │ 5m ago  ⧉ 🗑 │  │ 1h ago  ⧉ 🗑 │  │ 3h ago  ⧉ 🗑 │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
│  Canary yellow #FFE066 default · radius 2px 2px 8px 8px · shadow 0 2px 8px      │
│  tilt −1° / +1° alternating · hover scale(1.02) + stronger shadow              │
│  font Caveat 19px #2D2A26 · actions appear on hover / focus                    │
│                                                                                │
│ EMPTY STATE: 📝 "Chưa có ghi chú nào" + paste hint                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                                        ┌──────────────────────────────────────┐
                                        │ ● Đã sync N ghi chú   [Sync ngay] ⚙ │  sticky
                                        └──────────────────────────────────────┘  bottom-right

TOKEN MODAL (opened by Sync when no token, or the ⚙ gear)
┌───────────────────────────────────────────────┐
│ Đồng bộ lên GitHub                      [✕]   │
│ ───────────────────────────────────────────── │
│ 🔑 GitHub Personal Access Token [ … ]          │
│ ☑ Lưu token trên thiết bị này (localStorage)   │
│ ⚠ token dùng trực tiếp từ trình duyệt …         │
│ ───────────────────────────────────────────── │
│        [ Xoá token ] [ Hủy ] [ Lưu & kết nối ] │
└───────────────────────────────────────────────┘
overlay rgba(0,0,0,.5) · panel fade + slide-up · ESC/overlay click closes · focus trap

TOASTS (fixed, top-right under the header)
  [ ✅ Đã thêm link card. ]   slide-in, auto-dismiss ~3.2s
```

Behaviour
- **Paste-first:** a `paste` listener catches Cmd/⌃+V on the compose box and anywhere outside
  form fields / note editing. Clipboard images (e.g. macOS screenshots) become image notes.
- **Detection:** a single line with no spaces that parses as an `http(s)` URL → **link card**
  (favicon from the site origin, host + path; gracefully drops the favicon on 404); an image
  extension or `data:image/*` (or an image file/URL) → **image note** (files are downscaled to
  ≤1200 px JPEG); anything else → **text note**.
- **Compose:** a URL/text typed into the box and submitted with Enter becomes a note; the six
  colour dots choose the paper colour for the next note (default Canary yellow, remembered);
  *＋ Thêm note mới* creates an empty editable sticky; *📋 Dán* uses the async Clipboard API
  where permitted, otherwise focuses the box and prompts for Cmd/⌃+V.
- **Editing:** text notes are `contenteditable` inline; edits update `updated_at` and save.
- **Actions:** each note has **copy** (link URL / text / image) and **delete** (revealed on
  hover, focus or touch). Delete writes a tombstone.
- **Persistence:** all notes are written to `localStorage` key `pastenote_notes` (debounced
  500 ms). Timestamps show relative time ("2m ago") and refresh every minute.
- **Sync (admin):** *Sync ngay* reads the live file (fresh `sha`), merges by `id` (newest
  `updated_at` wins, tombstones preserved) and commits the result to
  `content/data/pastenote.json` with the GitHub Contents API. Requires a Personal Access
  Token (`contents:write`) entered in the modal. Public viewing never needs a token.
- **Security:** the token is used only from the user's browser and stored in `localStorage`
  (opt-out); it is never committed to this repository or embedded in the page.
- **Motion:** note fade + scale on add; hover lift; modal fade/slide. Reduced motion is
  respected (`prefers-reduced-motion`).

Data
- `content/data/pastenote.json` is loaded by `pelicanconf.py` into `PASTENOTE_NOTES` and
  embedded into the page via `{{ PASTENOTE_NOTES|tojson }}` — instant first paint and an
  offline fallback. The same file is served at `/data/pastenote.json`.
- `PASTENOTE_GITHUB_REPO` / `PASTENOTE_GITHUB_BRANCH` / `PASTENOTE_FILE_PATH` (embedded in the
  `pastenote-config` script tag) point the page at the raw read URL, the baked copy and the
  GitHub contents API for writes.
- Note record: `{ id, type: "text"|"link"|"image", text, url, image, color,
  created_at, updated_at, deleted }` (timestamps are epoch ms).
