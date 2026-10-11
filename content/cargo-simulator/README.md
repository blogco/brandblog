# Cargo Terminal Simulator

A browser-based command-line workflow simulation for practicing a simplified cargo
schedule, booking, AWB, and tracking sequence. The terminal resembles a GDS console,
but it is a fictional training aid: it does not connect to Amadeus, Korean Air, another
airline, or any live inventory or tracking system.

## Try a shipment

```text
AN10NOVICNSEL
FFR
SB1G250
NM1KIM/MINJUN
FD3/250/1.2
SR PER
FWB
ET
FSU
TRK TST-000001
```

`AN` accepts the sample routes `ICN-SEL`, `ICN-FRA`, `ICN-LAX`, `HAN-SIN`, and
`SGN-ICN`. Availability is fictional. The terminal lists simulated line/class choices
with Copy buttons. `FSU` advances through fixed training milestones; `HELP` or `?`
shows syntax, `CLS` clears the transcript, and `NEW` starts a fresh shipment.

AWB identifiers such as `TST-000001` are not valid transport documents. Do not use this
simulator for real cargo operations.

## Preview

Run `make serve` from the repository root and open
<http://localhost:8000/cargo-simulator/>. The live page is
<https://blogco.github.io/brandblog/cargo-simulator/>.

Pelican emits this page from `content/cargo-simulator/index.html`. The deployment
workflow then copies the root `cargo-simulator/` directory over the same published
route, so keep both `index.html` files identical. They load the shared CSS and
JavaScript from `theme/static/`.
