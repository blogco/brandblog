# Design Decisions

A running log of the key choices behind the BrandBlog build, and why. Keep this updated
when changing tokens, layout, or tooling.

## 1. Static site generator — Pelican

**Decision:** Pelican 4.x with `markdown` + Jinja2.

**Why:** The brief requires Python for the generator. Pelican is mature, has first-class
Jinja2 theming (needed to recreate a bespoke UI), supports arbitrary front-matter metadata,
and builds to flat HTML that GitHub Pages serves directly. MkDocs is docs-oriented and a
poorer fit for an article/card layout.

## 2. Styling — Tailwind CSS (compiled, not CDN)

**Decision:** Tailwind CSS v3 compiled from `src/input.css` to
`theme/static/css/style.css`, with design tokens centralised in `tailwind.config.js`.

**Why:**
- The brief prefers Tailwind for speed of UI reproduction.
- v3 uses the classic `module.exports` config the brief references.
- Compiling (rather than the Play CDN) produces a small, static stylesheet, works offline,
  and has no runtime JavaScript dependency.
- The built CSS is **committed** so `pelican` works locally without Node; CI also rebuilds
  it so template class changes are always reflected.

**Trade-off:** Commit churn on `style.css`. Acceptable for the robustness it buys.

## 3. Colours

Centralised in `tailwind.config.js` as a `sembcorp-*` scale:

| Token | Hex | Use |
|-------|-----|-----|
| `sembcorp-green` | `#006C53` | Primary actions, links, accents |
| `sembcorp-green-dark/darker` | `#005B48` / `#004E3E` | Hover, footer, overlays |
| `sembcorp-green-wash` | `#E6F1EE` | Light surfaces, chips |
| `sembcorp-blue` | `#0095FF` | Secondary accent (sparingly) |
| `sembcorp-orange` | `#FF6400` | Tertiary accent (sparingly) |
| `sembcorp-ink` | `#1A1A1A` | Headings |
| `sembcorp-gray` | `#464646` | Body text |
| `sembcorp-mist` | `#F5F6F5` | Section backgrounds |
| `sembcorp-line` | `#E5E7E6` | Hairlines, borders |

Green `#006C53` on white ≈ 5.7:1 contrast (WCAG AA). Body text uses the darker ink/gray to
stay comfortably compliant.

## 4. Typography

The brand typeface is **Frutiger**, which is licensed and cannot be redistributed. The web
stack is therefore `Frutiger, "Helvetica Neue", Helvetica, Arial, sans-serif` — matching the
brief's guidance. System fonts avoid a network request and layout shift (no web-font FOUT).

## 5. Artwork

All imagery is original **inline SVG** in the brand palette (`theme/static/images/`), not
downloaded from the reference site. This avoids copyright issues, keeps the repo small and
self-contained, and guarantees the demo works offline. Placement is abstract (gradients,
topographic arcs, energy motifs) so it reads as editorial photography without misleading.

## 6. Home routing

`content/pages/home.md` is a page configured with `URL: /` and `Save_as: index.html`, and
`INDEX_SAVE_AS = ""` disables Pelican's auto article-index. Result: the site root is a fully
art-directed Home page, while keeping the requested `content/pages/home.md` in the structure.

## 7. Filtering — client-side, two groups

The News page has two independent filter groups: **Type** (Category) and **Topic** (Tags).
They combine with AND logic, run entirely in vanilla JS, read `data-category` / `data-tags`
off each card, and update a live result counter. No plugin, no pagination, no server.

Filter option lists are derived from the articles themselves (rather than Pelican's
`categories`/`tags` context), because those context values are `(name, [articles])` tuples
in this version — deriving them keeps the template version-independent.

## 8. Navigation & active state

A single `nav.html` partial computes the active item from `page.url` / `article.url`, so
`aria-current="page"` is correct on every route (articles highlight **News**). The header is
sticky with a slim utility bar, echoing the reference site.

## 9. Deployment

GitHub Actions builds Tailwind (Node 20) then Pelican (Python 3.11) and publishes `output/`
to the `gh-pages` branch via `peaceiris/actions-gh-pages`. `SITEURL` is computed from the
repository (`https://<owner>.github.io/<repo>`) so the project-page subpath resolves
correctly. `publishconf.py` keeps `RELATIVE_URLS = False` and full absolute URLs for OG tags.

## 10. Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `footer`) and skip link.
- Visible focus rings via `focus-visible` utility classes.
- `aria-expanded` on the mobile toggle, `aria-current` on active nav.
- Colour contrast checked against WCAG AA.

## Open questions / future work

- Optional: add Pelican `sitemap` + `feed` plugins for richer SEO.
- Optional: real web font (self-hosted subset) if licensing allows.
- Optional: dark mode token set.
