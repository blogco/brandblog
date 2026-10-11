# Cargo Operations Simulator

An interactive, self-contained browser mini game that teaches the **end-to-end air cargo
workflow** — from a shipper's booking request to a signed proof of delivery.

You follow one shipment, **AWB 180-2468 1357**, from Incheon (ICN) to Frankfurt (FRA):
two pallets of temperature-controlled pharmaceutical reagents that must stay between
**+2 °C and +8 °C** and reach the consignee's production line before an 08:00 deadline.
Every phase asks you to make an operational decision, then explains *why* the answer is
what it is.

> Educational, non-commercial training demo. Airlines, flight numbers, airports and
> shipments are fictional and simplified for teaching. Not affiliated with, or endorsed
> by, any carrier.

## How to run it

No build step, no dependencies, no network requests.

1. Open `index.html` in any modern browser — **double-click it**, or drag it into a
   browser window.
2. Optional local server (not required):

   ```bash
   cd cargo-simulator
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

Everything (HTML, CSS, JavaScript, icons) lives in the single `index.html` file.

## How to play

- Work through the eight phases in order using **Next phase →**. The button stays locked
  until every task in the current phase is complete, and the hint next to it always lists
  exactly what is still outstanding (for example *"Still to do: run the 3 remaining
  acceptance checks (1 of 4 done), the chargeable weight"*).
- Some phases open with an interactive task first. Any decision that depends on it is
  shown **locked, behind a padlock note**, so you can always see what is still coming —
  click the four acceptance checks in Phase 3, release the flight in Phase 6, break down
  the ULD in Phase 7.
- Each phase contains at least one decision point. Pick an answer and press **Check
  answer** to get immediate feedback explaining the operational reasoning.
- A correct answer on the **first try** scores full points; a correct retry scores half.
  After three attempts the correct answer is revealed so you can never get stuck.
  Multi-answer questions reset their ticks on a wrong attempt so you can retry cleanly.
- You can go **backwards** at any time with **Previous phase** — solved decisions stay
  solved, and your score is kept.
- The final screen shows your score, your rank and a per-phase breakdown, with a
  **Review** link for any phase you want to revisit.

## Phase map

| # | Phase | What you decide |
|---|-------|-----------------|
| 1 | Booking Request | Which special handling code(s) apply; General vs **Express Cargo** |
| 2 | Booking Confirmation | Whether the tender beats the **Latest Acceptance Time (LAT)**; what to do when the truck arrives late |
| 3 | Cargo Acceptance | Document, weight, packaging/temperature and screening checks; accept or **reject** the shipment; chargeable weight |
| 4 | ULD Build-Up | LD3 vs **PMC pallet**; weight distribution; net and restraint |
| 5 | Loading onto Aircraft | Which hold position keeps the aircraft inside its **CG envelope**; what to verify before signing the load sheet |
| 6 | Departure & In-Flight Tracking | Which message carries the electronic AWB (**FWB**) to the destination station; how to handle an en-route delay |
| 7 | Arrival & Breakdown | Verify the shipment against the manifest and handle a **seal discrepancy** and damage |
| 8 | Customs & Delivery | Which documents Frankfurt customs needs; how to complete delivery and obtain a signed **POD** |

## Key learning objectives

By the end of the game you should be able to:

- **Read a booking correctly** — identify the handling codes a shipment needs and pick a
  service level that matches its temperature and time requirements.
- **Plan against the cut-off** — explain why the LAT exists, why it cannot be waived, and
  why a shipment that misses it is rolled rather than the flight being held.
- **Run cargo acceptance** — apply the documentation, weighing, packaging/labelling and
  security-screening checks, calculate chargeable weight, and recognise when cargo must
  be rejected and documented instead of accepted with a remark.
- **Build a ULD safely** — choose the right device, distribute load over structure,
  restrain it properly, and explain how build-up affects flight safety and efficiency.
- **Apply weight & balance discipline** — position a ULD so the centre of gravity stays
  in the envelope, and know what must be verified before a load sheet is signed.
- **Follow the information flow** — describe how FWB/FFM data moves between origin and
  destination stations and why proactive status messaging is part of the product.
- **Break down and reconcile a shipment** — compare the physical arrival with the
  manifest and handle discrepancies through the irregularity-report process.
- **Close the journey** — explain customs clearance as a separate gate from air
  transport, and describe the consignee's rights and the carrier's responsibilities at
  handover, including the role of the POD.

## Technical notes

- Single file, pure vanilla JavaScript, no external libraries, no CDN links, no API
  calls, no build command.
- Responsive down to tablet and phone widths.
- Progress and decisions are tracked in a small in-memory JavaScript state object
  (`{ phase, answers, finished }`).
- Visual tokens (colour palette and font stack) follow the shared Siemens-inspired
  BrandBlog design system.
- Keyboard accessible: focus rings, `aria-pressed` on options, live regions for feedback,
  a skip link and a screen-reader-friendly progress bar.
