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

The shared site palette is Siemens-inspired and defined as `--brand-*` custom properties in
`src/input.css`; matching utility aliases remain in `tailwind.config.js` for existing
templates:

| Token | Hex | Use |
|-------|-----|-----|
| Petrol | `#009999` | Primary actions, links, accents |
| Deep Blue | `#000028` | Header, footer, dark surfaces |
| White | `#FFFFFF` | Light surfaces |
| Ink | `#1A1A1A` | Body text and headings |
| Muted | `#666666` | Secondary text |
| Line | `#DFE4E8` | Hairlines and borders |
| Surface | `#F5F7F8` | Soft neutral sections |

Cards use the shared Deep Blue shadow `0 12px 32px rgba(0,0,40,.08)`. The Petrol hover
shade is `#007F7F`; state colours remain distinct where needed to communicate success,
warning, or error.

## 4. Typography

The site-wide stack is `"Siemens Sans", Arial, sans-serif`. Siemens Sans is not redistributed
or remotely loaded; the browser uses the system fallback when unavailable. Shared CSS fixes
H1 at 30/36px bold, H2 at 20/24px semibold, H3–H6 at 18/24px semibold, and body copy at
16/20px regular. System fonts avoid network requests and layout shifts.

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

## 11. Cargo Dictionary — client-side search & persistence

**Decision:** A three-language (Anh–Việt–Hàn) cargo glossary rendered by a dedicated
template, with Fuse.js fuzzy search, category filters, a browser-only "add term" modal and
`localStorage` persistence.

**Why:**
- The brief calls for a modern dictionary UX with **no backend**. Fuse.js gives instant,
  typo-tolerant search entirely in the browser; it is **vendored** into
  `theme/static/js/vendor/fuse.min.js` (Apache-2.0) so the demo stays self-contained and
  works offline, matching the "no external hosts" rule.
- **Seed data** lives in `content/data/cargo_dictionary.json` (version-controlled) and is
  loaded by `pelicanconf.py` into `CARGO_DICTIONARY`, then embedded into the page with
  Jinja's `|tojson`. This avoids a runtime `fetch()` (which would break under `file://`
  and needs base-URL juggling) while keeping the JSON the single source of truth.
- **New terms** are stored under the `cargo_dictionary_custom_terms` key and merged with
  the seed at render time; JSON **export/import** provides backup/portability.
- Search covers a derived `search_vi` field with diacritics stripped, so accent-free
  Vietnamese ("van don") matches while display text keeps its accents.
- **Highlighting** is a deliberate substring match (diacritic-insensitive) rather than
  Fuse's match indices, because fuzzy indices produced noisy `<mark>` spans. Exact
  highlighting reads better and still pairs with fuzzy recall.
- Dictionary-specific component classes live in `src/input.css` (`@layer components`), so
  they compile with the rest of the design system and are not dependent on JS string
  scanning. The modal/card/toast state classes are defined there too.

**Trade-off:** `localStorage` is per-browser and per-origin — terms are not shared across
devices. Acceptable for a personal study tool; the design keeps the data layer behind a
small adapter so it can move to an API later.

## 12. Pastenote — post-it board

A public notice board at `/pastenote/` where pasted links, images and text become
3M Post-it style sticky notes.

- **Page-specific behavior, shared identity.** Note-board interactions and optional paper
  colors remain in `theme/static/css/pastenote.css`, while its typography, chrome, board
  surface, buttons, and cards use the shared BrandBlog tokens.
- The editable notes use the shared font stack; the page no longer loads a separate Google
  handwriting font. Optional note-paper colors remain a product feature.
- **Data & sync.** `content/data/pastenote.json` is embedded at build time into
  `PASTENOTE_NOTES`; live edits auto-save to `localStorage` (`pastenote_notes`) and can be
  committed back via the GitHub Contents API with a Personal Access Token typed at
  runtime (never committed). See `wireframes/pastenote.md`.

## 13. Branding page — Siemens-inspired visual study

- **Page scope:** `/branding/` introduced the Siemens-inspired system; its Petrol/Deep Blue
  tokens and typography now also define the shared identity across the public site. The
  standalone Amadeus Ticket Sales Simulator is intentionally excluded.
- **Palette:** Petrol `#009999`, Deep Blue `#000028`, white `#FFFFFF`, body ink `#1A1A1A`,
  muted text `#666666`, a Petrol hover shade `#007F7F`, and a soft neutral surface
  `#F5F7F8`. Hairlines and shadows use low-opacity Deep Blue for restrained contrast.
- **Typography:** The page requests `"Siemens Sans", Arial, sans-serif` and uses 30/36px
  bold H1, 20/24px semibold H2, and 16/20px regular body copy. Siemens Sans is not
  redistributed or remotely loaded; the browser uses the system fallback when unavailable.
- **Components:** A responsive editorial grid, fine borders, understated shadows, a Petrol
  primary action, and a text-only Siemens wordmark keep the treatment lightweight. The
  wordmark and “Ingenuity for life” appear only as a clearly labelled independent study.
- **Editorial source:** The Physical AI feature summarizes the Siemens press release about
  testing Humanoid’s HMND 01 wheeled Alpha at Siemens’ Erlangen electronics factory for
  autonomous logistics. It links to the source and does not imply BrandBlog affiliation.
- **Disclosure:** The page and footer explicitly state that the study is unofficial and
  not affiliated with or endorsed by Siemens AG.

## Open questions / future work

- Optional: add Pelican `sitemap` + `feed` plugins for richer SEO.
- Optional: real web font (self-hosted subset) if licensing allows.
- Optional: dark mode token set.
- Optional: sync dictionary terms to a backend (FastAPI) instead of `localStorage`.
