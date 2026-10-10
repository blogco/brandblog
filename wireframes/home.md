# Wireframe — Home

Route: `/` · Template: `theme/templates/home.html` · Content: `content/pages/home.md`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ UTILITY BAR  (deep green)                                            [bg #004E3E]│
│ "A publication inspired by the energy transition"   News & Insights · Contact  │
├──────────────────────────────────────────────────────────────────────────────┤
│ MAIN NAV  (white, sticky)                                                       │
│ [◉ logo] BrandBlog                        Home   News   Branding   [Subscribe] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   ██████████  HERO (full-bleed image + green scrim)  ███████████████████████   │
│                                                                                │
│     DRIVING THE ENERGY TRANSITION              (eyebrow, white)                │
│     Building a more sustainable future,        (H1, 48–60px, white)            │
│     one insight at a time                                                      │
│     Audience-facing description line ...       (lede)                          │
│     [ Explore the newsroom ]  [ View brand system ]                            │
│                                                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ STATS STRIP (mist bg #F5F6F5)                                                  │
│   2,000+   │   1H2026   │   4   │   100%                                       │
│   Solar …  │  Results…  │ Pillars│ Purpose-led …                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ NEWSROOM                                                            View all → │
│ Latest news                                                                    │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐                                 │
│  │ [ image ] │   │ [ image ] │   │ [ image ] │   ← 3 latest article cards      │
│  │ [chip]    │   │ [chip]    │   │ [chip]    │                                 │
│  │ date      │   │ date      │   │ date      │                                 │
│  │ Title     │   │ Title     │   │ Title     │                                 │
│  │ summary…  │   │ summary…  │   │ summary…  │                                 │
│  │ Read more │   │ Read more │   │ Read more │                                 │
│  └───────────┘   └───────────┘   └───────────┘                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ INSIGHTS (mist bg)                                                             │
│  ┌──────────────────────────┐      ┌─────────────────────────────┐            │
│  │ INSIGHTS & STORIES       │      │                             │            │
│  │ The thinking behind …    │      │      [ feature image ]      │            │
│  │ • bullet                 │      │                             │            │
│  │ • bullet                 │      │                             │            │
│  │ • bullet                 │      │                             │            │
│  │ [ Read the insights ]    │      │                             │            │
│  └──────────────────────────┘      └─────────────────────────────┘            │
├──────────────────────────────────────────────────────────────────────────────┤
│ WHAT GUIDES US                                                                 │
│ Insight. Integrity. Integral.                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                                       │
│  │ (1)     │   │ (2)     │   │ (3)     │                                       │
│  │ Insight │   │Integrity│   │Integral │                                       │
│  └─────────┘   └─────────┘   └─────────┘                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ CTA BAND (solid green #006C53)                                                 │
│ Explore the complete brand system          [ Go to Branding ]                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER (deep green #004E3E)                                                    │
│ [◉] BrandBlog      Explore │ Topics │ Resources │ Legal                        │
│ Follow us on  (in)(x)(▶)                                                       │
│ ─────────────────────────────────────────────────────────────────────────────  │
│ © 2026 BrandBlog. All rights reserved.   · not affiliated with Sembcorp        │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes
- Mobile: nav collapses to a hamburger drawer; grids become single column; stats 2-up.
- The hero image is a brand-coloured SVG (`hero-home.svg`) to keep the repo self-contained.
