(() => {
  "use strict";

  const transcript = document.getElementById("terminalLog");
  const form = document.getElementById("terminalForm");
  const input = document.getElementById("commandInput");
  const quickCommands = document.getElementById("quickCommands");
  const copyNotice = document.getElementById("copyNotice");

  if (!transcript || !form || !input || !quickCommands || !copyNotice) {
    throw new Error("Cargo terminal markup is incomplete.");
  }

  const routes = new Set(["ICNSEL", "ICNFRA", "ICNLAX", "HANSIN", "SGNICN"]);
  const specialHandlingCodes = new Set(["PER", "AVI", "DG", "COL", "EAP", "HUM", "ICE", "VAL"]);
  const trackingMilestones = [
    { code: "RCF", label: "RECEIVED" },
    { code: "MAN", label: "MANIFESTED" },
    { code: "DEP", label: "IN TRANSIT" },
    { code: "ARR", label: "ARRIVED" },
    { code: "DLV", label: "DELIVERED" }
  ];

  const state = {
    route: "",
    date: "",
    flights: [],
    selectedFlight: null,
    shipper: "",
    cargo: null,
    handling: new Set(),
    awb: "",
    status: "NOT BOOKED",
    trackingIndex: -1,
    finalized: false,
    awbSequence: 1
  };

  function addLine(text, type = "normal", copyValue = "") {
    const line = document.createElement("div");
    line.className = `terminal-line${type === "normal" ? "" : ` terminal-line--${type}`}`;

    const output = document.createElement("span");
    output.className = "terminal-line__text";
    output.textContent = text;
    line.append(output);

    if (copyValue) {
      const copyButton = document.createElement("button");
      copyButton.className = "terminal__copy";
      copyButton.type = "button";
      copyButton.textContent = "COPY";
      copyButton.dataset.copy = copyValue;
      copyButton.setAttribute("aria-label", `Copy ${copyValue}`);
      line.append(copyButton);
    }

    transcript.append(line);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function updateField(id, value) {
    const field = document.getElementById(id);
    if (!field) {
      throw new Error(`Cargo status field #${id} is missing.`);
    }
    field.textContent = value || "—";
    field.classList.toggle("is-empty", !value);
  }

  function refreshStatus() {
    const status = document.getElementById("shipmentStatus");
    if (!status) {
      throw new Error("Cargo shipment status element is missing.");
    }
    status.textContent = state.status;
    status.dataset.state = state.status;
    updateField("statusRoute", state.route ? `${state.route.slice(0, 3)} → ${state.route.slice(3)}` : "");
    updateField("statusDate", state.date);
    updateField(
      "statusFlight",
      state.selectedFlight ? `LINE ${state.selectedFlight.line} · ${state.selectedFlight.flight}` : ""
    );
    updateField("statusShipper", state.shipper);
    updateField(
      "statusCargo",
      state.cargo ? `${state.cargo.pieces} PCS · ${state.cargo.weight} KG · ${state.cargo.volume} M³` : ""
    );
    updateField("statusHandling", [...state.handling].join(", "));
    updateField("statusAwb", state.awb);
    updateField("statusTransaction", state.finalized ? "ENDED" : state.awb ? "AWAITING ET / RF" : "");
    renderQuickCommands();
  }

  function setNextStatus(status) {
    state.status = status;
    refreshStatus();
  }

  function renderQuickCommands() {
    const commands = [
      ["Availability", "AN10NOVICNSEL"],
      ["Space request", "FFR"],
      ["Book line 1 · 250 kg", "SB1G250"],
      ["Add shipper", "NM1KIM/MINJUN"],
      ["Cargo details", "FD3/250/1.2"],
      ["Special handling", "SR PER"],
      ["Issue simulated AWB", "FWB"],
      ["Tracking lookup", state.awb ? `TRK ${state.awb}` : "TRK TST-000001"],
      ["Update status", "FSU"],
      ["End transaction", "ET"],
      ["Start fresh shipment", "NEW"],
      ["Help", "HELP"]
    ];

    quickCommands.replaceChildren();
    for (const [label, command] of commands) {
      const row = document.createElement("div");
      row.className = "quick-command";
      const code = document.createElement("code");
      code.textContent = `${label}: ${command}`;
      const button = document.createElement("button");
      button.className = "quick-command__copy";
      button.type = "button";
      button.textContent = "COPY";
      button.dataset.copy = command;
      button.setAttribute("aria-label", `Copy ${command}`);
      row.append(code, button);
      quickCommands.append(row);
    }
  }

  function isValidDateToken(token) {
    const match = token.match(/^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/);
    if (!match) {
      return false;
    }
    const monthDays = {
      JAN: 31, FEB: 29, MAR: 31, APR: 30, MAY: 31, JUN: 30,
      JUL: 31, AUG: 31, SEP: 30, OCT: 31, NOV: 30, DEC: 31
    };
    const day = Number(match[1]);
    return day >= 1 && day <= monthDays[match[2]];
  }

  function showHelp() {
    addLine("AVAILABLE TRAINING COMMANDS", "success");
    addLine("AN[DDMMM][ORIGIN][DESTINATION]  e.g. AN10NOVICNSEL");
    addLine("FFR                            request space on listed availability");
    addLine("SB[LINE][CLASS][WEIGHT_KG]     e.g. SB1G250");
    addLine("NM1[LAST]/[FIRST MIDDLE]       e.g. NM1KIM/MINJUN");
    addLine("FD[PIECES]/[WEIGHT_KG]/[VOLUME_M3] e.g. FD3/250/1.2");
    addLine("SR [PER|AVI|DG|COL|EAP|HUM|ICE|VAL]");
    addLine("FWB                            create a simulated AWB after booking details");
    addLine("ET or RF                       end the simulated transaction");
    addLine("TRK [AWB]                      look up this shipment after FWB");
    addLine("FSU                            advance one simulated status after ET / RF");
    addLine("HELP or ?                      show this help · CLS clears transcript · NEW starts a fresh shipment");
    addLine("Training simulation only; no live airline inventory, GDS, or valid transport document.", "warning");
  }

  function handleAvailability(command) {
    const match = command.match(/^AN(\d{2}[A-Z]{3})([A-Z]{3})([A-Z]{3})$/);
    if (!match) {
      addLine("FORMAT: AN10NOVICNSEL", "error");
      return;
    }
    if (!isValidDateToken(match[1])) {
      addLine("INVALID DATE. Use a real day and month, for example 10NOV.", "error");
      return;
    }
    const route = `${match[2]}${match[3]}`;
    if (match[2] === match[3]) {
      addLine("ORIGIN AND DESTINATION MUST DIFFER.", "error");
      return;
    }
    if (!routes.has(route)) {
      addLine(`NO TRAINING ROUTE FOR ${match[2]}-${match[3]}. Try ICNSEL, ICNFRA, ICNLAX, HANSIN, or SGNICN.`, "warning");
      return;
    }
    if (state.selectedFlight) {
      addLine("A SPACE BOOKING ALREADY EXISTS. Start a new simulation to change its itinerary.", "warning");
      return;
    }

    state.route = route;
    state.date = match[1];
    state.flights = [
      { line: 1, flight: "SIM-C101", classes: ["G", "P"], remainingKg: 1000 },
      { line: 2, flight: "SIM-C204", classes: ["G", "D"], remainingKg: 750 }
    ];
    state.status = "NOT BOOKED";
    addLine(`SIMULATED AVAILABILITY · ${match[1]} · ${match[2]}-${match[3]}`, "success");
    for (const flight of state.flights) {
      addLine(
        `${flight.line} ${flight.flight}  CLASSES ${flight.classes.join("/")}  ${flight.remainingKg} KG AVAILABLE`,
        "normal",
        `SB${flight.line}${flight.classes[0]}250`
      );
    }
    addLine("Use FFR to request space, then SB[line][class][weight] to confirm a simulated booking.", "muted");
    refreshStatus();
  }

  function handleSpaceRequest() {
    if (!state.flights.length) {
      addLine("CHECK AVAILABILITY FIRST WITH AN[DDMMM][ORIGIN][DESTINATION].", "error");
      return;
    }
    if (state.selectedFlight) {
      addLine("SPACE IS ALREADY BOOKED ON THIS SIMULATION.", "warning");
      return;
    }
    state.status = "SPACE REQUESTED";
    addLine("SIMULATED SPACE REQUEST RECORDED. Confirm a line and weight with SB1G250.", "success", "SB1G250");
    refreshStatus();
  }

  function handleSell(command) {
    const match = command.match(/^SB\s*\/?\s*(\d+)\s*\/?\s*([A-Z])\s*\/?\s*(\d+(?:\.\d+)?)$/);
    if (!match) {
      addLine("FORMAT: SB1G250 (line 1, class G, 250 kg).", "error");
      return;
    }
    if (!state.flights.length) {
      addLine("CHECK AVAILABILITY FIRST WITH AN[DDMMM][ORIGIN][DESTINATION].", "error");
      return;
    }
    if (state.selectedFlight) {
      addLine("A SPACE BOOKING ALREADY EXISTS FOR THIS SIMULATION.", "warning");
      return;
    }
    const lineNumber = Number(match[1]);
    const classCode = match[2];
    const weight = Number(match[3]);
    const flight = state.flights.find((candidate) => candidate.line === lineNumber);
    if (!flight || !flight.classes.includes(classCode)) {
      addLine(`LINE / CLASS NOT AVAILABLE. Choose a listed line and class (${state.flights.map((f) => `${f.line}:${f.classes.join("/")}`).join(", ")}).`, "error");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > flight.remainingKg) {
      addLine(`WEIGHT MUST BE BETWEEN 1 AND ${flight.remainingKg} KG FOR LINE ${lineNumber}.`, "error");
      return;
    }

    state.selectedFlight = { ...flight, classCode, weight };
    state.status = "BOOKED";
    addLine(`SIMULATED BOOKING CONFIRMED · LINE ${lineNumber} · ${classCode} · ${weight} KG`, "success");
    refreshStatus();
  }

  function handleName(command) {
    const match = command.match(/^NM1\s*([^/]+)\/(.+)$/);
    if (!match || !match[1].trim() || !match[2].trim()) {
      addLine("FORMAT: NM1LAST/FIRST MIDDLE  e.g. NM1KIM/MINJUN", "error");
      return;
    }
    const last = match[1].trim();
    const first = match[2].trim();
    if (`${last}/${first}`.length > 80) {
      addLine("SHIPPER NAME IS TOO LONG (MAXIMUM 80 CHARACTERS).", "error");
      return;
    }
    if (state.awb) {
      addLine("SHIPPER DETAILS ARE LOCKED AFTER FWB.", "warning");
      return;
    }
    state.shipper = `${last.toUpperCase()} / ${first.toUpperCase()}`;
    addLine(`SHIPPER ADDED · ${state.shipper}`, "success");
    refreshStatus();
  }

  function handleCargo(command) {
    const match = command.match(/^FD\s*(\d+)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:KG)?\s*\/\s*(\d+(?:\.\d+)?)\s*(?:M3)?$/i);
    if (!match) {
      addLine("FORMAT: FD[PIECES]/[WEIGHT_KG]/[VOLUME_M3]  e.g. FD3/250/1.2", "error");
      return;
    }
    const pieces = Number(match[1]);
    const weight = Number(match[2]);
    const volume = Number(match[3]);
    if (pieces < 1 || pieces > 1000 || weight <= 0 || volume <= 0 || !Number.isFinite(weight + volume)) {
      addLine("PIECES, WEIGHT, AND VOLUME MUST BE POSITIVE; MAXIMUM 1000 PIECES.", "error");
      return;
    }
    if (state.awb) {
      addLine("CARGO DETAILS ARE LOCKED AFTER FWB.", "warning");
      return;
    }
    state.cargo = { pieces, weight, volume };
    const volumetricWeight = volume * 167;
    const chargeableWeight = Math.max(weight, volumetricWeight);
    addLine(`CARGO RECORDED · ${pieces} PCS · ${weight} KG · ${volume} M3 · SIM. CHARGEABLE ${chargeableWeight.toFixed(1)} KG`, "success");
    refreshStatus();
  }

  function handleSpecialHandling(command) {
    const match = command.match(/^SR\s*\/?\s*([A-Z]{2,4})$/);
    if (!match) {
      addLine("FORMAT: SR [CODE]  e.g. SR PER, SR AVI, SR DG.", "error");
      return;
    }
    if (!specialHandlingCodes.has(match[1])) {
      addLine(`UNSUPPORTED TRAINING CODE ${match[1]}. Use PER, AVI, DG, COL, EAP, HUM, ICE, or VAL.`, "error");
      return;
    }
    if (state.awb) {
      addLine("SPECIAL HANDLING IS LOCKED AFTER FWB.", "warning");
      return;
    }
    state.handling.add(match[1]);
    addLine(`SPECIAL HANDLING ADDED · ${match[1]}`, "success");
    refreshStatus();
  }

  function handleAwb() {
    if (!state.selectedFlight) {
      addLine("BOOK SPACE FIRST WITH AN, THEN SB[line][class][weight].", "error");
      return;
    }
    if (!state.shipper) {
      addLine("ADD A SHIPPER FIRST WITH NM1LAST/FIRST.", "error");
      return;
    }
    if (!state.cargo) {
      addLine("ADD CARGO DETAILS FIRST WITH FD[PIECES]/[WEIGHT_KG]/[VOLUME_M3].", "error");
      return;
    }
    if (state.cargo.weight > state.selectedFlight.weight) {
      addLine(`CARGO WEIGHT EXCEEDS THE BOOKED ${state.selectedFlight.weight} KG. Correct the booking or cargo details before FWB.`, "error");
      return;
    }
    if (state.awb) {
      addLine(`SIMULATED AWB ALREADY ISSUED · ${state.awb}`, "warning", state.awb);
      return;
    }

    state.awb = `TST-${String(state.awbSequence).padStart(6, "0")}`;
    state.awbSequence += 1;
    state.status = "AWB ISSUED";
    addLine(`SIMULATED AWB ISSUED · ${state.awb}`, "success", state.awb);
    addLine("Next: end this simulated transaction with ET or RF.", "muted", "ET");
    refreshStatus();
  }

  function handleEndTransaction(command) {
    if (!state.awb) {
      addLine("ISSUE A SIMULATED AWB WITH FWB BEFORE ET OR RF.", "error");
      return;
    }
    if (state.finalized) {
      addLine("TRANSACTION IS ALREADY ENDED.", "warning");
      return;
    }
    state.finalized = true;
    addLine(`${command} · SIMULATED TRANSACTION ENDED · ${state.awb}`, "success");
    addLine("You can now use FSU to advance a simulated shipment status.", "muted", "FSU");
    refreshStatus();
  }

  function handleTracking(command) {
    if (!state.awb) {
      addLine("NO SIMULATED AWB YET. Complete booking details and enter FWB first.", "error");
      return;
    }
    const requestedAwb = command.replace(/^TRK\s*/i, "").trim();
    if (requestedAwb && requestedAwb.toUpperCase() !== state.awb) {
      addLine(`AWB NOT FOUND IN THIS SIMULATION. Current test AWB: ${state.awb}.`, "error");
      return;
    }
    addLine(`TRACKING · ${state.awb} · ${state.status}`, "success", `TRK ${state.awb}`);
    if (!state.finalized) {
      addLine("End the transaction with ET or RF before advancing shipment milestones.", "warning", "ET");
    }
  }

  function handleStatusUpdate(command) {
    if (!state.awb) {
      addLine("ISSUE A SIMULATED AWB WITH FWB BEFORE FSU.", "error");
      return;
    }
    if (!state.finalized) {
      addLine("END THE TRANSACTION WITH ET OR RF BEFORE FSU.", "error");
      return;
    }
    const requestedCode = command.match(/^FSU\s+([A-Z]{3})$/)?.[1];
    const nextIndex = state.trackingIndex + 1;
    if (nextIndex >= trackingMilestones.length) {
      addLine(`SHIPMENT ALREADY AT FINAL SIMULATED STATUS · ${state.status}`, "warning");
      return;
    }
    const milestone = trackingMilestones[nextIndex];
    if (requestedCode && requestedCode !== milestone.code) {
      addLine(`NEXT EXPECTED STATUS IS ${milestone.code} (${milestone.label}).`, "error");
      return;
    }
    state.trackingIndex = nextIndex;
    setNextStatus(milestone.label);
    addLine(`FSU ${milestone.code} · ${state.awb} · STATUS ${milestone.label}`, "success");
  }

  function startNewShipment() {
    state.route = "";
    state.date = "";
    state.flights = [];
    state.selectedFlight = null;
    state.shipper = "";
    state.cargo = null;
    state.handling.clear();
    state.awb = "";
    state.status = "NOT BOOKED";
    state.trackingIndex = -1;
    state.finalized = false;
    addLine("NEW SIMULATED SHIPMENT STARTED.", "success");
    refreshStatus();
  }

  function execute(rawCommand) {
    const command = rawCommand.trim().toUpperCase();
    if (!command) {
      return;
    }
    addLine(`> ${command}`, "command", command);

    if (command === "HELP" || command === "?") {
      showHelp();
    } else if (command === "NEW") {
      startNewShipment();
    } else if (command === "CLS") {
      transcript.replaceChildren();
      addLine("TRANSCRIPT CLEARED. SHIPMENT STATE IS UNCHANGED.", "muted");
    } else if (command.startsWith("AN")) {
      handleAvailability(command);
    } else if (command === "FFR") {
      handleSpaceRequest();
    } else if (command.startsWith("SB")) {
      handleSell(command);
    } else if (command.startsWith("NM1")) {
      handleName(command);
    } else if (command.startsWith("FD")) {
      handleCargo(command);
    } else if (command.startsWith("SR")) {
      handleSpecialHandling(command);
    } else if (command === "FWB") {
      handleAwb();
    } else if (command === "ET" || command === "RF") {
      handleEndTransaction(command);
    } else if (/^TRK(?:\s|$)/.test(command)) {
      handleTracking(command);
    } else if (/^FSU(?:\s|$)/.test(command)) {
      handleStatusUpdate(command);
    } else {
      addLine(`UNKNOWN COMMAND "${command}". Enter HELP or ? for supported syntax.`, "error");
    }
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      copyNotice.textContent = `Copied: ${value}`;
      const originalText = button.textContent;
      button.textContent = "COPIED";
      window.setTimeout(() => {
        if (button.isConnected) {
          button.textContent = originalText;
        }
      }, 1400);
    } catch (error) {
      copyNotice.textContent = "Copy failed. Select and copy the command manually.";
      addLine(`COPY FAILED: ${error instanceof Error ? error.message : "clipboard access unavailable"}`, "error");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    execute(input.value);
    input.value = "";
    input.focus();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-copy]");
    if (!button) {
      return;
    }
    copyText(button.dataset.copy, button);
  });

  const clearButton = document.getElementById("clearTerminal");
  if (!clearButton) {
    throw new Error("Cargo terminal clear button is missing.");
  }
  clearButton.addEventListener("click", () => {
    transcript.replaceChildren();
    addLine("TRANSCRIPT CLEARED. SHIPMENT STATE IS UNCHANGED.", "muted");
    input.focus();
  });

  addLine("AMADEUS CARGO TRAINING TERMINAL · SESSION READY", "success");
  addLine("SIMULATED DATA ONLY — THIS IS NOT CONNECTED TO ANY AIRLINE OR GDS.", "warning");
  addLine("Type HELP or ? to see command syntax. Start with AN10NOVICNSEL.", "muted", "AN10NOVICNSEL");
  refreshStatus();
})();
