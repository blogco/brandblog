# BrandBlog Agent Configuration

> Instructions for AI agents (OpenCode and others) working in this repository.
> Read this before editing content, templates, styles, or the build pipeline.

## Role

Static blog generator agent for a Siemens-inspired BrandBlog visual system. The site is built with
**Pelican** (Python) + **Jinja2** templates, styled with **Tailwind CSS**, and deployed to
**GitHub Pages** via GitHub Actions.

## Repository map

| Path | Purpose |
|------|---------|
| `content/pages/` | Home / News / Branding / Cargo Dictionary pages (custom templates) |
| `content/data/` | `cargo_dictionary.json` — glossary seed data |
| `content/posts/` | News articles (Markdown) |
| `theme/templates/` | Jinja2 templates (`base.html` + partials + page templates) |
| `theme/static/` | CSS output, JS, SVG images |
| `src/input.css` | Tailwind source (edit styles here) |
| `tailwind.config.js` | Design tokens: colours, fonts, shadows |
| `pelicanconf.py` | Dev configuration |
| `publishconf.py` | Production configuration |
| `research/`, `wireframes/` | Design documentation — keep in sync with the build |

## Brand Voice

- Professional, insightful, and forward-looking.
- Clear, concise language; explain technical concepts simply.
- Avoid jargon and hype. Prefer evidence-led statements.
- Editorial themes follow the values **Insight, Integrity, Integral**.
- Always keep the demo disclaimer in mind: this is an educational, non-commercial site
  and is **not affiliated with Siemens AG or Sembcorp Industries**.

## UI/UX Rules

- Follow the wireframes in `wireframes/`.
- Shared colour palette (see `src/input.css` and `tailwind.config.js`):
  - Petrol `#009999`, Deep Blue `#000028`, White `#FFFFFF`
  - Ink `#1A1A1A`, Muted `#666666`, Line `#DFE4E8`, Surface `#F5F7F8`
- Font stack: `"Siemens Sans", Arial, sans-serif`; H1 30/36px, H2 20/24px,
  H3–H6 18/24px, and body 16/20px.
- Layout: grid-based, responsive, mobile-first, with card components.
- Motion: subtle only (hover ~150–300ms, hero fade-up ~600ms). Respect focus states.
- Never introduce a new colour or font without documenting it in `research/design_decisions.md`.

## Content Structure

- **Home:** full-bleed hero, stats strip, latest posts, insights split, brand values, CTA.
- **News:** hero banner + breadcrumb, dual filter bar (Type × Topic), featured article,
  responsive card grid, sidebar (recent / topics / subscribe).
- **Branding:** Brand Guideline, Colour Palette, Typography, Icon Sets, UI/UX components.
- **Cargo Dictionary:** three-language (Anh–Việt–Hàn) glossary with client-side search,
  category filters, browser-only add-term flow (localStorage) and JSON import/export.
  Seed terms live in `content/data/cargo_dictionary.json`; see `wireframes/cargo-dictionary.md`.

## Adding a new article

Create `content/posts/<slug>.md` with this front matter:

```markdown
Title: A clear, headline-style title
Date: 2026-08-13 09:00
Category: Media Releases      # Media Releases | Company Announcements | Insights
Tags: Corporate, Renewables   # Corporate, Renewables, Financial Results, Innovation, Community
Slug: a-clear-headline-style-title
Author: BrandBlog Editorial
Image: news-results.svg       # any file in theme/static/images/
Summary: One or two sentences used on cards and in meta tags.
```

Then write the body in Markdown. Use `##` subheadings and `>` pull-quotes for emphasis.
Run `npm run build:css` (if templates/classes changed) and `pelican content -s pelicanconf.py -l -r`
to preview. The News page and filters update automatically — no template edits required.

## Build & Deploy

- Dev preview: `make serve` (or `pelican content -s pelicanconf.py -l -r`)
- Production: `pelican content -s publishconf.py -o output`
- Assets: `npm run build:css` (Tailwind → `theme/static/css/style.css`)
- Auto-deploy: GitHub Actions on push to `main` → publishes `output/` to `gh-pages`.

## Golden rules

1. Keep changes consistent with the surrounding code and naming.
2. Prefer editing `src/input.css` + `tailwind.config.js` over ad-hoc inline styles.
3. After template or class changes, regenerate the CSS before committing.
4. Keep the standalone `ticket-sales-simulator/` page and assets outside shared theme edits.
5. Run the internal link check after structural changes.
6. Never commit secrets, tokens, or the `output/` directory (git-ignored).
