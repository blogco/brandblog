# Wireframe — News & Insights

Route: `/news/` · Template: `theme/templates/news.html` · Content: `content/pages/news.md`

Modelled on the reference Sembcorp "News and Insights" hub: hero banner + breadcrumb,
tabbed/filtered listings, a featured story, a responsive card grid and a sidebar.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER  (same as Home — utility bar + sticky main nav)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ HERO BANNER (full-bleed image + dark green overlay)                            │
│   Home / News & Insights                        (breadcrumb)                   │
│   News & Insights                               (H1, white)                    │
│   Explore how the energy transition is unfolding… (description)                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌────────────────────────────────────────────┐   ┌──────────────────────────┐│
│  │ NEWSROOM                       6 articles   │   │ ASIDE (sticky)           ││
│  │ Latest news & insights                      │   │ ┌──────────────────────┐ ││
│  │                                             │   │ │ Most recent          │ ││
│  │ ── Filter bar ─────────────────────────────│   │ │ [thumb] date + title │ ││
│  │  Type   [All][Media Releases][Company …]   │   │ │ [thumb] date + title │ ││
│  │  Topic  [All][Corporate][Renewables]…      │   │ │ …                    │ ││
│  │ ───────────────────────────────────────────│   │ └──────────────────────┘ ││
│  │                                             │   │ ┌──────────────────────┐ ││
│  │ ┌─────────────────────────────────────────┐│   │ │ Topics               │ ││
│  │ │ FEATURED   [ image ]  │ [chip] date      ││   │ │ (Corporate)(Renew…)  │ ││
│  │ │                       │ Title (H2)       ││   │ └──────────────────────┘ ││
│  │ │                       │ summary…         ││   │ ┌──────────────────────┐ ││
│  │ │                       │ Read the story → ││   │ │ Stay in the loop     │ ││
│  │ └─────────────────────────────────────────┘│   │ │ [ email ] [Subscribe]│ ││
│  │                                             │   │ └──────────────────────┘ ││
│  │ ┌───────────┐   ┌───────────┐               │   └──────────────────────────┘│
│  │ │ [ image ] │   │ [ image ] │               │                               │
│  │ │ date      │   │ date      │               │                               │
│  │ │ Title     │   │ Title     │               │                               │
│  │ │ summary…  │   │ summary…  │               │                               │
│  │ └───────────┘   └───────────┘               │                               │
│  │ ┌───────────┐   ┌───────────┐               │                               │
│  │ │ [ image ] │   │ [ image ] │  … 2-col grid │                               │
│  │ └───────────┘   └───────────┘               │                               │
│  │                                             │                               │
│  │            [ View all ]   [ Sign up ]       │                               │
│  └────────────────────────────────────────────┘                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Behaviour
- **Type filter** (Category) and **Topic filter** (Tags) are independent and combine with
  AND logic, entirely client-side (`theme/static/js/main.js`).
- Card visibility is driven by `data-category` and `data-tags`; the result counter and the
  "no results" panel update live. Sidebar topic chips drive the Topic group too.
- Grid: 1 column mobile → 2 columns ≥ sm inside the main column; sidebar moves below on
  smaller screens and becomes sticky at `lg`.

Card anatomy
```
┌───────────────┐
│   thumbnail   │  aspect 16:10, hover zoom 1.05
│      chip     │  category chip, top-left
├───────────────┤
│ DATE (green)  │
│ Title         │  bold, ink, hover → green
│ summary …     │  3 lines, clamped
│ Read more →   │
└───────────────┘
```
