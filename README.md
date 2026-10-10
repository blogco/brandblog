# BrandBlog

A static brand blog with **Home**, **News** and **Branding** sections, built with
**Pelican** (Python) + **Jinja2**, styled with **Tailwind CSS**, and deployed to
**GitHub Pages** via **GitHub Actions**.

The visual language is inspired by [Sembcorp](https://www.sembcorp.com/news-and-insights/)'s
news experience: a deep-green brand palette (`#006C53`), a slim utility bar, a sticky
primary nav, full-bleed hero banners with breadcrumbs, filterable news cards, and a
multi-column footer.

> This is an educational, non-commercial design demo. It is **not affiliated with or
> endorsed by Sembcorp Industries**. All imagery is original SVG; no assets were scraped.

## ✨ Features

- **Home** — hero, stats strip, latest news, insights split, brand values, CTA band.
- **News** — hero + breadcrumb, dual filter bar (Type × Topic) that combines with AND logic,
  featured story, responsive card grid, sticky sidebar (recent / topics / subscribe).
- **Branding** — brand guidelines, colour palette (click-to-copy), typography specimen,
  10-icon line set, and a UI/UX component gallery.
- Fully **responsive** (mobile-first), accessible (skip link, focus rings, ARIA landmarks),
  and self-contained (no runtime JS frameworks, no external image hosts).

## 🗂 Project structure

```
brandblog/
├── .github/workflows/deploy.yml   # CI: build Tailwind + Pelican, deploy to gh-pages
├── .opencode/agent/blogger.md     # Content-writing agent definition
├── content/
│   ├── pages/                     # home.md, news.md, branding.md
│   └── posts/                     # Markdown articles
├── research/                      # UI/UX analysis + design decisions
├── wireframes/                    # ASCII wireframes (home / news / branding)
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
