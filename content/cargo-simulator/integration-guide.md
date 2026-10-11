# Cargo Terminal Simulator integration

The Cargo Terminal Simulator is published at
<https://blogco.github.io/brandblog/cargo-simulator/> and uses shared files from
`theme/static/`.

## Source files

| File | Purpose |
|------|---------|
| `cargo-simulator/index.html` | Root simulator source copied by the deployment workflow. |
| `content/cargo-simulator/index.html` | Pelican static source for local and production builds. |
| `theme/static/css/cargo-terminal.css` | Responsive page and terminal styles. |
| `theme/static/js/cargo-terminal.js` | Command parser, simulated workflow, and copy controls. |
| `content/data/cargo_history.json` | Public AWB history read on page load and updated through the GitHub Contents API. |
| JsBarcode 3.11.6 CDN | Renders a Code 128 barcode with the AWB number and key shipment fields on the printable document. |

Pelican first copies `content/cargo-simulator/index.html` to the output. The deployment
workflow then copies root `*-simulator/` directories into that output, overwriting the
same route. Keep the two HTML files in sync. The CSS and JavaScript are emitted by the
theme as `/static/css/cargo-terminal.css` and `/static/js/cargo-terminal.js`.

## Preview and deployment

Use `make serve` for local preview at <http://localhost:8000/cargo-simulator/>. The
GitHub Actions workflow builds Pelican, copies the root simulator directories, then
publishes the result to GitHub Pages.

## Simulation boundaries

This is not official Amadeus or airline software. Availability, flight lines, capacity,
AWB identifiers, and tracking milestones are fictional. AWB records save to browser
storage; optional GitHub sync reads and writes the public
`content/data/cargo_history.json` file using a user-supplied, fine-grained token. This
file is public and must contain no real shipment data. Tokens are never included in
repository files. Without a token or network access, records remain local and queued
changes can be retried with `SYNC` or when connectivity returns. The command syntax is
simplified for training and must not be used to create real bookings or transport
documents. Printing an AWB produces a clearly marked simulated document, with a
fictional carrier number and check digit; it is not an official IATA form.
