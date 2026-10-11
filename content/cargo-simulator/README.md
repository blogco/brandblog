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
CN1LEE/JIHOON
FD3/250/1.2
SR PER
FWB
FWD TST-000001
PRINT AWB TST-000001
LIST AWB
ET
FSU
TRK TST-000001
```

`AN` accepts the sample routes `ICN-SEL`, `ICN-FRA`, `ICN-LAX`, `HAN-SIN`, and
`SGN-ICN`. Availability is fictional. The terminal lists simulated line/class choices
with Copy buttons. `FSU` advances through fixed training milestones; `HELP` or `?`
shows syntax, `CLS` clears the transcript, and `NEW` starts a fresh shipment.

Use `FWD[AWB]`, `RT[AWB]`, `VIEW AWB [number]`, or `SHOW AWB [number]` to
retrieve an issued record; `LIST AWB` or `AWB LIST` lists all records. The
`CN1LAST/FIRST` command records the consignee. AWBs persist in browser storage and
can be synced to the public `content/data/cargo_history.json` file using a
fine-grained GitHub token with Contents: write access to `blogco/brandblog`.
Configure this in the GitHub sync panel. `SYNC` retries failed writes; offline
records remain local and retry when connectivity returns. Do not use real
shipment data or a privileged token.

Issuing or retrieving an AWB shows its printable training document.
`PRINT AWB [number]` or the document's **Print AWB** button opens the browser
print dialog. The page renders a Code 128 barcode (JsBarcode) containing the AWB
and shipment summary. Its carrier number/check digit is simulated; this is not an
official IATA document or a valid transport document.

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
