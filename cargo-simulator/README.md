# Cargo Terminal Simulator

A browser-based command-line workflow simulation for practicing a simplified cargo
schedule, booking, AWB, and tracking sequence. The terminal resembles a GDS console,
but it is a fictional training aid: it does not connect to Amadeus, Korean Air, another
airline, or any live inventory or tracking system.

## Try a shipment

Run the commands in order in the terminal:

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
`SGN-ICN`. Availability is made up; line and class choices appear in the terminal and
have adjacent Copy buttons. `FSU` advances through a fixed sequence of fictional
milestones. Use `HELP` or `?` for command syntax, `CLS` to clear the transcript, or
`NEW` to start another shipment.

An AWB such as `TST-000001` is a test identifier, not a valid air waybill. Do not use
this simulator to book, tender, track, or transport real cargo.

## Local preview

The page shares CSS and JavaScript with the BrandBlog theme, so preview it through
Pelican rather than opening its HTML file directly:

```bash
make serve
# Open http://localhost:8000/cargo-simulator/
```

The live route is <https://blogco.github.io/brandblog/cargo-simulator/>.

## Files

- `index.html` — standalone route markup; the same page is mirrored under
  `content/cargo-simulator/` for Pelican's static-file output.
- `../theme/static/css/cargo-terminal.css` — responsive layout and terminal styling.
- `../theme/static/js/cargo-terminal.js` — in-browser command parser and simulated state.
- `../content/cargo-simulator/integration-guide.md` — publishing and source-of-truth notes.
