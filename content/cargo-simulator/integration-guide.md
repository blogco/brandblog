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

Pelican first copies `content/cargo-simulator/index.html` to the output. The deployment
workflow then copies root `*-simulator/` directories into that output, overwriting the
same route. Keep the two HTML files in sync. The CSS and JavaScript are emitted by the
theme as `/static/css/cargo-terminal.css` and `/static/js/cargo-terminal.js`.

## Preview and deployment

Use `make serve` for local preview at <http://localhost:8000/cargo-simulator/>. The
GitHub Actions workflow builds Pelican, copies the root simulator directories, then
publishes the result to GitHub Pages.

## Simulation boundaries

This is not official Amadeus or airline software, and makes no network requests. Its
availability, flight lines, capacity, AWB identifiers, and tracking milestones are
fictional. The command syntax is simplified for training and must not be used to create
real bookings or transport documents.
