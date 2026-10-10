# Integration guide — ICHM Cargo Simulator → BrandBlog

This document explains how the game is wired into the existing BrandBlog site so it is
live at **https://blogco.github.io/brandblog/cargo-simulator/** after the next deploy.

The blog is built with **Pelican** and deployed to **GitHub Pages** by
`.github/workflows/deploy.yml`. Because the game is a self-contained HTML file, it only
needs to be **copied verbatim into the Pelican output** and **linked** from the theme.

---

## 1. Where the files live

| File | Purpose |
|------|---------|
| `content/cargo-simulator/index.html` | The self-contained game (HTML + CSS + JS). |
| `content/cargo-simulator/README.md` | Game documentation (not published). |
| `content/cargo-simulator/integration-guide.md` | This guide (not published). |

Pelican serves everything under the `content/` directory. The game is listed as a
**single static file**, so only `index.html` is copied to the site — the two Markdown
docs stay in the repo and are not published.

## 2. Make Pelican publish the game

In `pelicanconf.py`, add the game file to `STATIC_PATHS`:

```python
STATIC_PATHS = ["images", "data", "cargo-simulator/index.html"]
```

Pelican preserves the path, so this produces:

```
output/cargo-simulator/index.html      →  /brandblog/cargo-simulator/
```

`publishconf.py` imports everything from `pelicanconf.py`, so the production build picks
this up automatically — no workflow changes are needed. The existing GitHub Actions job
(`pelican content -s publishconf.py -o output` → `peaceiris/actions-gh-pages`) deploys it.

> Prefer to publish the docs too? Use `STATIC_PATHS = [..., "cargo-simulator"]`
> (folder instead of file). The README and this guide would then also be served.

## 3. Link it from the navigation and footer

Both menus are data-driven from `pelicanconf.py` — no template edits required.

**Primary nav** (`MENUITEMS`):

```python
MENUITEMS = [
    ("Home", ""),
    ("News", "news/"),
    ("Branding", "branding/"),
    ("Từ điển Cargo", "cargo-dictionary/"),
    ("Cargo Simulator", "cargo-simulator/"),
    ("Pastenote", "pastenote/"),
]
```

**Footer** (`FOOTER_COLUMNS`, "Explore" column):

```python
("Cargo Simulator", "cargo-simulator/"),
```

## 4. Feature it on the home page

`theme/templates/home.html` includes a dedicated band with a **Launch the simulator**
button that points to `{{ SITEURL }}/cargo-simulator/`. Because it lives in the theme's
templates, Tailwind will pick up any new utility classes when the CSS is rebuilt.

## 5. Rebuild

After any change to templates or Tailwind classes, regenerate the CSS, then build:

```bash
npm run build:css                      # Tailwind → theme/static/css/style.css
make build                             # pelican content -s publishconf.py -o output
make linkcheck                         # optional: verify internal links resolve
```

The game itself needs **no build step** — it is copied as-is.

## 6. Deploy

Commit and push to `main`. The GitHub Actions workflow builds and publishes `output/` to
the `gh-pages` branch. When it finishes, the game is live at:

```
https://blogco.github.io/brandblog/cargo-simulator/
```

## 7. Optional: embed with an iframe

To show the game *inside* a page instead of linking out to it, use an iframe. The game is
fully self-contained, so it will not inherit or leak blog styles:

```html
<iframe
  src="{{ SITEURL }}/cargo-simulator/"
  title="ICHM Cargo Door-to-Door Simulator"
  style="width:100%;height:80vh;border:1px solid #E5E7E6;border-radius:8px"
  loading="lazy"></iframe>
```

If you prefer a clean, full-screen experience, keep the plain link instead — the game's
top bar and footer navigation are designed for a full page.

---

## Troubleshooting

- **404 on `/cargo-simulator/`** — confirm `cargo-simulator/index.html` is present in
  `STATIC_PATHS` and that the file exists at `content/cargo-simulator/index.html`.
- **Game appears but links look wrong locally** — open it via a local server
  (`make serve`), not `file://`, so root-relative URLs resolve.
- **Nav label doesn't show** — the nav renders from `MENUITEMS`; restart the dev server
  after editing `pelicanconf.py`.
- **Styles look unstyled** — the game styles are inlined in `index.html`; a mis-copied
  or truncated file is the usual cause. Re-copy the file from the repo.
