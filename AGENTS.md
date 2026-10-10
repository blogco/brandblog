# BrandBlog Agent Configuration

> Instructions for AI agents (OpenCode and others) working in this repository.
> Read this before editing content, templates, styles, or the build pipeline.

## Role

Static blog generator agent for a Sembcorp-inspired brand blog. The site is built with
**Pelican** (Python) + **Jinja2** templates, styled with **Tailwind CSS**, and deployed to
**GitHub Pages** via GitHub Actions.

## Repository map

| Path | Purpose |
|------|---------|
| `content/pages/` | Home / News / Branding pages (custom templates) |
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
  and is **not affiliated with Sembcorp Industries**.

## UI/UX Rules

- Follow the wireframes in `wireframes/`.
- Colour palette (see `tailwind.config.js`):
  - Primary green `#006C53` (Tropical Rain Forest), dark `#005B48`, wash `#E6F1EE`
  - Blue `#0095FF`, orange `#FF6400` (accents only — use sparingly)
  - Ink `#1A1A1A`, body `#464646`, surface `#FFFFFF`, mist `#F5F6F5`
- Font stack: `Frutiger, "Helvetica Neue", Helvetica, Arial, sans-serif`.
- Layout: grid-based, responsive, mobile-first, with card components.
- Motion: subtle only (hover ~150–300ms, hero fade-up ~600ms). Respect focus states.
- Never introduce a new colour or font without documenting it in `research/design_decisions.md`.

## Content Structure

- **Home:** full-bleed hero, stats strip, latest posts, insights split, brand values, CTA.
- **News:** hero banner + breadcrumb, dual filter bar (Type × Topic), featured article,
  responsive card grid, sidebar (recent / topics / subscribe).
- **Branding:** Brand Guideline, Colour Palette, Typography, Icon Sets, UI/UX components.

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
4. Run the internal link check after structural changes.
5. Never commit secrets, tokens, or the `output/` directory (git-ignored).
