# Wireframe — Từ điển Cargo (Anh–Việt–Hàn)

Route: `/cargo-dictionary/` · Template: `theme/templates/cargo-dictionary.html` ·
Content: `content/pages/cargo-dictionary.md` · Data: `content/data/cargo_dictionary.json` ·
Logic: `theme/static/js/dictionary.js` (+ vendored `fuse.min.js`)

A three-language cargo glossary with instant client-side search, category filters, a
browser-only "add term" flow, and JSON import/export. No backend — the seed data is
embedded into the page at build time.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER  (same as Home — utility bar + sticky main nav; "Từ điển Cargo" active) │
├──────────────────────────────────────────────────────────────────────────────┤
│ HERO (green, image + gradient)                                                 │
│   Home / Từ điển Cargo                          (breadcrumb)                   │
│   Glossary · Anh — Việt — Hàn                    (eyebrow)                     │
│   Từ điển Cargo Anh–Việt–Hàn                    (H1, white)                    │
│   Tra cứu thuật ngữ … Air Premia Cargo           (description)                 │
│   ( 37+ thuật ngữ )  ( 3 ngôn ngữ )  ( Cập nhật 2026 )  ← glass stat pills     │
├──────────────────────────────────────────────────────────────────────────────┤
│ SEARCH + FILTERS  (sticky beneath the header, white, soft shadow)              │
│   🔍 [ Tìm kiếm thuật ngữ (Anh, Việt, Hàn)…            ]  (focus: green)      │
│   Danh mục  (Tất cả)(Cơ bản)(Chứng từ)(Vận hành)(Thanh toán)(Đặc biệt)…       │
├──────────────────────────────────────────────────────────────────────────────┤
│ RESULTS TOOLBAR                                                                │
│   Hiển thị 37 / 37 thuật ngữ        [ A–Z ▾ ]  [Export] [Import]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ CARD GRID  (1 col mobile → 2 col md → 3 col xl)                               │
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐        │
│  │ Air Waybill        🔊 🔊 ⧉     │  │ ULD            🔊 🔊 ⧉         │        │
│  │ AWB                           │  │ Unit Load Device              │        │
│  │ ───────────────────────────── │  │ ───────────────────────────── │        │
│  │ 🇬🇧 Air Waybill                │  │ 🇬🇧 ULD (Unit Load Device)     │        │
│  │ 🇻🇳 Vận đơn hàng không         │  │ 🇻🇳 Thiết bị tải đơn vị        │        │
│  │ 🇰🇷 항공화물운송장 (AWB)        │  │ 🇰🇷 단위탑재용기 (ULD)         │        │
│  │                               │  │                               │        │
│  │ Định nghĩa (clamp 3 lines) …  │  │ Định nghĩa …                  │        │
│  │ [Chứng từ][Cơ bản]   Xem thêm │  │ [Vận hành][Trung bình] …      │        │
│  └───────────────────────────────┘  └───────────────────────────────┘        │
│   hover: lift 2px, left border → green, stronger shadow                        │
│                                                                                │
│ EMPTY STATE (when no match): illustration + "Không tìm thấy…" + [Đặt lại]     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                              ┌─────┐                           │
│                                              │  +  │  FAB, fixed bottom-right │
│                                              └─────┘                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘

ADD-TERM MODAL (opened by the FAB)
┌───────────────────────────────────────────────┐
│ Thêm thuật ngữ mới                      [✕]   │
│ ───────────────────────────────────────────── │
│ 🇬🇧 Tiếng Anh *        [ … ]                   │
│ 🇻🇳 Tiếng Việt *       [ … ]                   │
│ 🇰🇷 Tiếng Hàn *        [ … ]                   │
│ 📝 Định nghĩa          [ … ]                   │
│ 🏷️ Danh mục [▾]        📊 Trình độ [▾]         │
│ 💡 Ví dụ               [ … ]                   │
│ ───────────────────────────────────────────── │
│                       [ Hủy ] [ 💾 Lưu ]       │
└───────────────────────────────────────────────┘
overlay rgba(0,0,0,.5) · panel: fade + slide-up 300ms · ESC/overlay click closes
focus trap · Enter submits

TOASTS (fixed, top-right under the header)
  [ ✅ Đã thêm thuật ngữ mới! ]   slide-in, auto-dismiss ~3.2s
```

Behaviour
- **Fuzzy search** (Fuse.js, threshold 0.3, `ignoreLocation`) across English, Vietnamese,
  Korean, category, definition and example. A derived `search_vi` field (diacritics
  stripped) makes accent-free Vietnamese queries work ("van don" → "Vận đơn").
- **Highlighting** is applied by precise substring match (diacritic-insensitive) so `<mark>`
  stays clean rather than inheriting fuzzy noise.
- **Category pills** filter the result set; the result counter and "no results" panel
  update live. Sort options: A–Z, Mới nhất, Phổ biến (basic levels first).
- **Add term** writes to `localStorage` under `cargo_dictionary_custom_terms`, re-renders
  optimistically and shows a toast. Required fields validate on blur and on submit.
- **Import/Export** merge with the seed data for a complete JSON backup.
- **Pronunciation** uses the Web Speech API (`en-US`, `ko-KR`) — progressive enhancement.
- Keyboard: `/` focuses search, `Esc` clears search or closes the modal.
- Reduced motion disables the toast/card/FAB animations.

Data
- `content/data/cargo_dictionary.json` is loaded by `pelicanconf.py` into `CARGO_DICTIONARY`
  and embedded into the page via `{{ CARGO_DICTIONARY|tojson }}` — no runtime fetch, works
  offline and under any base URL. The raw JSON is also copied to `/data/` for reference.
