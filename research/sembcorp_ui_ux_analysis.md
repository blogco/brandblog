# Sembcorp UI/UX Analysis

> Reference page: `https://www.sembcorp.com/news-and-insights/news/2026/sembcorp-industries-1h2026-results/`
> Hub page: `https://www.sembcorp.com/news-and-insights/`
> Analysis date: 2026-10-10

## 1. Research method

The target URL is protected by Cloudflare bot mitigation and returns `403 Forbidden`
to programmatic crawlers (verified with `curl` + browser UA and via a reader proxy).
The hub page (`/news-and-insights/`) was retrievable and provided the authoritative
information architecture, section ordering, labels, and footer structure. Colour and
typography data were confirmed from public brand data (Brandfetch) and cross-checked
against the hex values supplied in the project brief.

## 2. Brand colour palette

| Token | Hex | Name | Role |
|-------|-----|------|------|
| Sembcorp Green | `#006C53` | Tropical Rain Forest | Primary brand / accent, nav, buttons |
| Azure Radiance | `#0095FF` | Blue | Secondary brand accent, links, highlights |
| Blaze Orange | `#FF6400` | Orange | Tertiary accent, energy/highlight tags |
| White | `#FFFFFF` | White | Backgrounds, reversed text |
| Tundora | `#464646` | Grey | Body text (per brief) |
| Black | `#000000` | Black | Headings, high-contrast text |

Derived shades used in the build:

- Green tints: `#0E846D` `#20937C` `#E6F1EE` (light wash) `#006C53` (base)
- Green shades: `#005B48` `#004E3E` (hover / footer)
- Neutrals: `#F5F6F5` (section alt background), `#E5E7E6` (borders), `#6B7280` (muted)

## 3. Typography

- **Primary brand typeface:** Frutiger (licensed/custom — cannot be redistributed).
- **Web fallback stack used in this build:** `Frutiger, "Helvetica Neue", Helvetica, Arial, sans-serif`
  (consistent with the brief's guidance to fall back to Helvetica Neue / Arial).
- **Scale (desktop):** H1 48–56px / 1.1, H2 36px / 1.15, H3 24px / 1.25, H4 20px,
  body 16–18px / 1.6, small/label 13–14px with letterspacing on eyebrows.
- **Weights:** 400 body, 600 sub-heading, 700 headings. Headings are set tight;
  body copy is airy with generous line-height.

## 4. Layout & grid

- Max content width ~1200–1280px, centred, with 16–24px gutters (mobile-first).
- Full-bleed **hero banner**: wide photograph, dark green scrim/overlay, white heading
  and supporting paragraph overlaid bottom-left; breadcrumb sits above the hero title.
- **Section rhythm:** eyebrow label (uppercase, green) → H2 heading → content.
- **Cards:** news items are compact — date (muted, small) above a bold headline,
  separated by hairline rules or subtle elevation. Insight items are image cards
  arranged in a 3-column grid on desktop, 2 on tablet, 1 on mobile.
- **Sticky primary navigation** with a slim utility bar above it.

## 5. Page anatomy (mirrored from `/news-and-insights/`)

### Header / navigation
1. Utility bar: News and Insights, Careers, Contact Us, All Sites, Search.
2. Primary bar: logo (left) + mega-menu items: Driving Energy Transition,
   Creating Shareholder Value, About Us, News and Insights, Careers, Contact Us.
3. Sticky on scroll; transparent-over-hero variant is common.

### News & Insights hub
1. **Hero banner** — image + page title + one-line description.
2. **Breadcrumb** — `Home / News and Insights`.
3. **Latest News** — filter tabs (`Media Releases`, `Company Announcements`);
   list of items = date + headline; then `View all` + `Sign up for alerts`; contact line.
4. **Insights and Stories** — filter tabs (`Supporting Energy Transition and
   Sustainable Development`, `Our People, Partners and Communities`,
   `Our Technology and Innovation`); 3-column grid of image cards; `View all`.

### Footer (5 zones)
- Social: "Follow Us On" → LinkedIn, WeChat (+ QR).
- Company Information · Our Businesses · Useful Resources · Quick Links (4 link columns).
- Bottom bar: `Copyright © <year> … All rights reserved.` + legal links
  (Cookie Policy, Privacy, Terms of Use, Sitemap).

## 6. Iconography

- Line-style, 1.5–2px stroke, rounded caps, minimal, single-colour (green on light).
- Themes: energy, renewables (wind/solar/battery), water, finance/growth,
  community/people, innovation/technology.
- Icon set chosen for the build: inline SVG (no runtime dependency) rendered in a
  consistent 24px grid; also documented on the Branding page.

## 7. Interaction & motion

- Hover: card image zoom (scale 1.03–1.05), headline underline, button darken.
- Buttons: solid green (primary), outline (secondary), with subtle 150–200ms ease.
- Filter tabs: underline/pill active state, instant client-side content switch.
- Generous whitespace; content-first, minimal chrome.

## 8. Accessibility notes borrowed from the reference

- Green `#006C53` achieves WCAG AA against white (≈5.7:1) for large/bold text;
  body text uses near-black to stay safely compliant.
- Visible focus rings, semantic landmarks (`header`, `nav`, `main`, `footer`),
  `aria-expanded` on the mobile menu, `aria-current` on the active nav item.

## 9. Content tone

Professional, forward-looking, insight-led. Sembcorp's stated purpose —
*"to do good and play its part in building a sustainable future"* — and the
values **Insight, Integrity, Integral** set the editorial tone reproduced here
(see `AGENTS.md` -> Brand Voice).
