# Wireframe — Branding

Route: `/branding/` · Template: `theme/templates/branding.html` · Content: `content/pages/branding.md`

Documents the design system: guidelines, palette, typography, iconography and components.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ HERO (deep green + coloured orbs + subtle image)                               │
│   Home / Branding                             (breadcrumb)                     │
│   BRAND SYSTEM                                (eyebrow)                        │
│   Brand guidelines & design system            (H1, white)                      │
│   The principles, palette, typography…        (lede)                           │
│   [ Colour palette ] [ Typography ] [ Icon set ]                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 01 — BRAND GUIDELINE                                                           │
│  ┌───────────────────────────┐   ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ Our brand principles      │   │  01    │ │  02    │ │  03    │             │
│  │ paragraph…                │   │ Insight│ │Integrity│ │ Integral│            │
│  │ ┌─────────────────────┐   │   └────────┘ └────────┘ └────────┘             │
│  │ │ [logo] primary mark │   │                                                │
│  │ ├─────────────────────┤   │                                                │
│  │ │ [logo] reversed     │   │                                                │
│  │ └─────────────────────┘   │                                                │
│  └───────────────────────────┘                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ 02 — COLOUR PALETTE (mist bg)                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                                     │
│  │ #006C53   │ │ #0095FF   │ │ #FF6400   │  ← swatch (click to copy hex)       │
│  │ Tropical… │ │ Azure …   │ │ Blaze …   │                                     │
│  ├───────────┤ ├───────────┤ ├───────────┤                                     │
│  │ #FFFFFF   │ │ #464646   │ │ #1A1A1A   │                                     │
│  └───────────┘ └───────────┘ └───────────┘                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ 03 — TYPOGRAPHY                                                                │
│  ┌────────────────────┐   ┌───────────────────────────────────────────────┐   │
│  │ Typeface           │   │ DISPLAY / H1   Insight that moves energy …    │   │
│  │ Frutiger → fallback│   │ HEADING / H2   Building a sustainable future  │   │
│  │ weights list       │   │ SUB-HEADING    Integrated urban solutions     │   │
│  │                    │   │ BODY           We pair evidence-led …          │   │
│  │                    │   │ EYEBROW        Driving the energy transition   │   │
│  └────────────────────┘   └───────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 04 — ICONOGRAPHY (mist bg)                                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                            │
│  │ ☀  │ │ ☴  │ │ ▣  │ │ ◈  │ │ ♻  │   ← 10 line icons, 24px grid, 2px stroke  │
│  └────┘ └────┘ └────┘ └────┘ └────┘                                            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                            │
│  │ ▤  │ │ 👥 │ │ 💡 │ │ 🌐 │ │ 🛡  │                                            │
│  └────┘ └────┘ └────┘ └────┘ └────┘                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ 05 — UI & UX                                                                   │
│  Buttons:  [Primary] [Secondary] [Tertiary]                                    │
│  Chips:    (Corporate) (Renewables) [Active filter] [Inactive filter]          │
│  Spacing:  12-column grid diagram                                              │
│  Motion:   hover / reveal / focus / filtering notes      Accessibility note    │
├──────────────────────────────────────────────────────────────────────────────┤
│ DISCLAIMER (mist bg) — educational demo, not affiliated with Sembcorp          │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Interactions
- Colour swatches copy their hex value to the clipboard (`main.js`).
- Anchor buttons (`#colours`, `#typography`, `#icons`) smooth-scroll with header offset.
