# BrandBlog

A static brand blog with **Home**, **News** and **Branding** sections, built with
**Pelican** (Python) + **Jinja2**, styled with **Tailwind CSS**, and deployed to
**GitHub Pages** via **GitHub Actions**.

The public site uses a Siemens-inspired BrandBlog visual system: Petrol (`#009999`),
Deep Blue (`#000028`), Siemens Sans with system fallbacks, responsive editorial cards,
full-bleed hero banners, filterable news and a multi-column footer. The standalone
Ticket Sales Simulator keeps its own terminal design.

> This is an educational, non-commercial design demo. It is **not affiliated with or
> endorsed by Sembcorp Industries or Siemens AG**. All imagery is original SVG; no assets
> were scraped.

## ✨ Features

- **Home** — hero, stats strip, latest news, insights split, brand values, CTA band.
- **News** — hero + breadcrumb, dual filter bar (Type × Topic) that combines with AND logic,
  featured story, responsive card grid, sticky sidebar (recent / topics / subscribe).
- **Branding** — brand guidelines, colour palette (click-to-copy), typography specimen,
  10-icon line set, and a UI/UX component gallery.
- **Từ điển Cargo** — a three-language (Anh–Việt–Hàn) air-cargo glossary with instant
  fuzzy search (Fuse.js), category filters, a browser-only "add term" modal with
  `localStorage` persistence, JSON import/export and Web Speech pronunciation.
- Fully **responsive** (mobile-first), accessible (skip link, focus rings, ARIA landmarks),
  and self-contained (no runtime JS frameworks, no external image hosts).

## 🗂 Project structure

```
brandblog/
├── .github/workflows/deploy.yml   # CI: build Tailwind + Pelican, deploy to gh-pages
├── .opencode/agent/blogger.md     # Content-writing agent definition
├── content/
│   ├── pages/                     # home.md, news.md, branding.md, cargo-dictionary.md
│   ├── data/                      # cargo_dictionary.json (glossary seed data)
│   └── posts/                     # Markdown articles
├── research/                      # UI/UX analysis + design decisions
├── wireframes/                    # ASCII wireframes (home / news / branding / cargo)
├── src/input.css                  # Tailwind source
├── theme/
│   ├── static/{css,js,images}/    # compiled CSS, JS, SVG artwork
│   └── templates/                 # base.html, partials/, page templates
├── tailwind.config.js             # design tokens
├── pelicanconf.py                 # dev config
├── publishconf.py                 # production config
├── requirements.txt
├── package.json
├── Makefile
└── AGENTS.md
```

## ✅ Prerequisites

- Python 3.9+ (tested on 3.11 and 3.14)
- Node.js 18+ (for the Tailwind build)
- GNU Make (optional, for the shortcuts)

## 🚀 Local development

```bash
# 1. Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Front-end assets
npm install

# 3. Build CSS + serve with live reload
make serve          # → http://localhost:8000
```

`make` shortcuts:

| Command | What it does |
|---------|--------------|
| `make install` | Install Python + Node dependencies |
| `make css` | Compile Tailwind → `theme/static/css/style.css` |
| `make watch-css` | Rebuild CSS on change |
| `make build` | Production build into `output/` |
| `make serve` | Dev server with live reload |
| `make clean` | Remove `output/`, `cache/`, `theme/static/css/style.css` |

## ✍️ Writing a new article

Create `content/posts/<slug>.md`:

```markdown
Title: Your headline
Date: 2026-08-13 09:00
Category: Media Releases      # Media Releases | Company Announcements | Insights
Tags: Corporate, Renewables   # Corporate, Renewables, Financial Results, Innovation, Community
Slug: your-headline
Author: BrandBlog Editorial
Image: news-solar.svg         # any file in theme/static/images/
Summary: One or two sentences for cards and meta tags.

Body in Markdown. Use `##` subheadings and a `>` pull-quote.
```

The News page, filters and sidebar update automatically — no template changes needed.
See `AGENTS.md` for the full editorial guide.

## 📚 Cargo dictionary

The **Từ điển Cargo** page (`/cargo-dictionary/`) ships with seed terms in
`content/data/cargo_dictionary.json`. Each entry looks like:

```json
{
  "id": "awb",
  "english": "Air Waybill (AWB)",
  "vietnamese": "Vận đơn hàng không",
  "korean": "항공화물운송장 (AWB)",
  "definition": "Chứng từ vận chuyển hàng không…",
  "example": "The AWB number is 350-12345678.",
  "category": "Chứng từ",
  "level": "Cơ bản",
  "created_at": "2026-10-10"
}
```

Edit that file to extend the glossary (categories are listed in `pelicanconf.py` as
`CARGO_CATEGORIES`). Visitors can also add their own terms in the browser — those are
saved to `localStorage` and can be exported/imported as JSON from the page toolbar.

## 📦 Build

```bash
make css          # regenerate Tailwind (after template/class changes)
make build        # pelican content -s publishconf.py -o output  → ./output
```

## 🚢 Deployment (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` runs on every push to `main`:

1. builds Tailwind CSS,
2. builds the site with Pelican (`SITEURL` derived from the repo), and
3. publishes `output/` to the `gh-pages` branch.

**One-time setup:** in the repository, go to **Settings → Pages → Build and deployment →
Source** and select **Deploy from a branch → `gh-pages` / `root`**. The site will then be
available at `https://<owner>.github.io/<repo>/`.

## 📄 Documentation

- `research/sembcorp_ui_ux_analysis.md` — reference-site analysis
- `research/design_decisions.md` — rationale for key choices
- `wireframes/` — layout blueprints
- `AGENTS.md` — agent + editorial configuration
