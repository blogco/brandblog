# ICHM Cargo Door-to-Door Simulator

An interactive, browser-based mini game that teaches the **end-to-end air cargo process**
as defined by the **IATA Cargo Handling Manual (ICHM) Master Operating Plan (MOP)**.

You follow a single shipment — **12 cartons of lithium-ion batteries (UN3480, Class 9)**
moving **HAN → ICN → LAX** — from an origin-forwarder booking request to a signed
**Proof of Delivery** in Los Angeles. Ten phases map to the five ICHM activity groups.

> Educational, non-commercial learning aid. Simplified for teaching. It is **not
> affiliated with IATA, any airline, or Sembcorp Industries**. Always follow your
> carrier's current regulations and applicable national law.

---

## Run it locally

It is a single, self-contained file — no build step, no dependencies, no network calls.

```bash
# Option A — open it directly
open content/cargo-simulator/index.html

# Option B — serve it (so relative URLs behave like production)
python3 -m http.server 8000
# then visit http://localhost:8000/content/cargo-simulator/
```

Or, from the BrandBlog Pelican build, run `make serve` and open
`http://localhost:8000/cargo-simulator/`.

---

## How it plays

- **Start screen** — introduces the shipment and the five activity groups.
- **10 phases** — each presents a realistic operational situation with one or more
  decision points (single choice, select-all-that-apply, or a sequencing task).
- **Immediate feedback** — after every decision you get the *reasoning*: why an answer
  is right, why another is a real-world risk, and the ICHM reference behind it.
- **Progress** — a phase rail plus a progress bar ("Phase X of 10"), with
  **Previous / Next** navigation. Next unlocks only when the phase is complete.
- **Scoring** — each decision is worth 10 points; a wrong attempt costs 3 (a decision
  never scores below 2). The results screen grades you and reviews every phase.
- **Bilingual glosses** — key terms carry an English–Vietnamese subtitle
  (e.g. *AWB — Vận đơn hàng không*, *POD — Biên bản giao hàng*).

State is held in a single JavaScript object (`state`); there are no external APIs,
CDNs, cookies or `localStorage` writes.

---

## The 10 phases & learning objectives

| # | Phase | Activity group | Learning objective |
|---|-------|----------------|--------------------|
| 1 | Booking & Planning | Origin Forwarder | Choose the right service level and handle dangerous-goods booking/notification lead time. |
| 2 | Pick-up & Receiving | Origin Forwarder | Control the custody handover; verify cargo readiness and catch discrepancies at the dock. |
| 3 | Export Preparation | Origin Forwarder | Assemble a complete, mutually consistent export document set (AWB, SLI, DGD, customs, security). |
| 4 | Transfer & Acceptance | Origin Carrier | Apply ICHM acceptance standards: reconcile AWB vs. cargo, weigh/measure, screen, inspect. |
| 5 | ULD Build-Up | Origin Carrier | Select ULD vs. loose loading; build up safely (heaviest at the base, secured, weighed, recorded). |
| 6 | Flight Loading & Departure | Transport Carrier | Respect weight & balance, the LIR/loadsheet, LAT, and the dangerous-goods NOTOC. |
| 7 | Arrival & Unload | Destination Carrier | Break down the ULD and record count and condition discrepancies at the point of discovery. |
| 8 | Check-in & Warehouse | Destination Carrier | Store DG correctly and never release cargo before customs clearance. |
| 9 | Transfer to Destination Forwarder | Destination Forwarder | Accept the handover with any known exception documented. |
| 10 | Delivery & POD | Destination Forwarder | Produce a valid Proof of Delivery and handle a consignee damage refusal correctly. |

---

## Tech

- One file: `index.html` with inlined `<style>` and `<script>`.
- **Vanilla JavaScript** (ES5-compatible syntax), no frameworks, no build tools.
- Responsive for desktop and tablet; accessible focus states and ARIA live regions.
- Uses the BrandBlog palette so it feels native to the blog, but ships its **own
  scoped styles**, so it does not depend on or interfere with the blog's Tailwind CSS.

## File map

```
cargo-simulator/
├── index.html            # the entire game (HTML + CSS + JS)
├── README.md             # this file
└── integration-guide.md  # how it is wired into the BrandBlog site
```

## Blog integration

The game is published at **https://blogco.github.io/brandblog/cargo-simulator/**.
See [`integration-guide.md`](integration-guide.md) for exactly how it is included in the
Pelican build and linked from the navigation, footer and home page.
