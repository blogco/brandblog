(() => {
  "use strict";

  const transcript = document.getElementById("terminalLog");
  const form = document.getElementById("terminalForm");
  const input = document.getElementById("commandInput");
  const quickCommands = document.getElementById("quickCommands");
  const copyNotice = document.getElementById("copyNotice");
  const awbDocumentArea = document.getElementById("awbDocumentArea");
  const printAwbButton = document.getElementById("printAwbButton");
  const githubSyncStatus = document.getElementById("githubSyncStatus");
  const githubSettings = document.getElementById("githubSettings");
  const githubDialog = document.getElementById("githubDialog");
  const githubTokenForm = document.getElementById("githubTokenForm");
  const githubTokenInput = document.getElementById("githubToken");
  const githubTokenRemember = document.getElementById("githubTokenRemember");
  const githubTokenError = document.getElementById("githubTokenError");
  const clearGithubToken = document.getElementById("clearGithubToken");
  const githubDialogCancel = document.getElementById("githubDialogCancel");

  if (!transcript || !form || !input || !quickCommands || !copyNotice ||
      !awbDocumentArea || !printAwbButton ||
      !githubSyncStatus || !githubSettings || !githubDialog || !githubTokenForm ||
      !githubTokenInput || !githubTokenRemember || !githubTokenError || !clearGithubToken || !githubDialogCancel) {
    throw new Error("Cargo terminal markup is incomplete.");
  }

  const HISTORY_KEY = "cargo_simulator_awbs";
  const PENDING_SYNC_KEY = "cargo_simulator_history_pending";
  const TOKEN_KEY = "cargo_simulator_github_token";
  const GITHUB_REPO = "blogco/brandblog";
  const GITHUB_BRANCH = "main";
  const GITHUB_PATH = "content/data/cargo_history.json";
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_PATH}`;

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
    consignee: "",
    cargo: null,
    handling: new Set(),
    awb: "",
    status: "NOT BOOKED",
    trackingIndex: -1,
    finalized: false,
    awbSequence: 1
  };
  let issuedAwbs = [];
  let syncInProgress = false;
  let sessionGithubToken = "";
  let historyReady = false;
  let historyRevision = 0;
  let displayedAwb = null;

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

  function setSyncStatus(text, stateName = "idle") {
    githubSyncStatus.textContent = text;
    githubSyncStatus.dataset.state = stateName;
  }

  function normalizeAwb(raw) {
    if (!raw || typeof raw !== "object" || !/^TST-\d{6}$/.test(String(raw.awb || ""))) {
      return null;
    }
    const issuedAt = String(raw.issuedAt || raw.issueDateTime || "");
    const handling = Array.isArray(raw.specialHandling) ? raw.specialHandling : [];
    return {
      awb: String(raw.awb),
      recordId: String(raw.recordId || ""),
      shipper: String(raw.shipper || ""),
      consignee: String(raw.consignee || ""),
      origin: String(raw.origin || ""),
      destination: String(raw.destination || ""),
      date: String(raw.date || ""),
      flight: String(raw.flight || ""),
      pieces: Number(raw.pieces) || 0,
      weight: Number(raw.weight) || 0,
      volume: Number(raw.volume) || 0,
      specialHandling: handling.map(String),
      status: String(raw.status || "AWB ISSUED"),
      issuedAt,
      updatedAt: String(raw.updatedAt || issuedAt)
    };
  }

  function mergeAwbs(...lists) {
    const records = new Map();
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        const record = normalizeAwb(raw);
        if (!record) continue;
        const previous = records.get(record.awb);
        if (!previous || record.updatedAt >= previous.updatedAt) {
          records.set(record.awb, record);
        }
      }
    }
    return [...records.values()].sort((a, b) => a.awb.localeCompare(b.awb));
  }

  function persistAwbs() {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(issuedAwbs));
    } catch (error) {
      addLine(`LOCAL AWB HISTORY SAVE FAILED: ${error instanceof Error ? error.message : "browser storage unavailable"}`, "error");
    }
  }

  function setSyncPending(pending) {
    try {
      if (pending) window.localStorage.setItem(PENDING_SYNC_KEY, "true");
      else window.localStorage.removeItem(PENDING_SYNC_KEY);
    } catch (error) {
      addLine(`SYNC QUEUE SAVE FAILED: ${error instanceof Error ? error.message : "browser storage unavailable"}`, "error");
    }
  }

  function isSyncPending() {
    try {
      return window.localStorage.getItem(PENDING_SYNC_KEY) === "true";
    } catch (error) {
      setSyncStatus("Browser storage unavailable · GitHub sync state unknown", "error");
      return false;
    }
  }

  function getGithubToken() {
    try {
      return window.localStorage.getItem(TOKEN_KEY) || sessionGithubToken;
    } catch (error) {
      return sessionGithubToken;
    }
  }

  function saveCurrentAwb() {
    if (!state.awb || !state.cargo || !state.selectedFlight) return;
    const now = new Date().toISOString();
    const existing = issuedAwbs.find((record) => record.awb === state.awb);
    const record = normalizeAwb({
      awb: state.awb,
      recordId: existing ? existing.recordId : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      shipper: state.shipper,
      consignee: state.consignee,
      origin: state.route.slice(0, 3),
      destination: state.route.slice(3),
      date: state.date,
      flight: state.selectedFlight.flight,
      pieces: state.cargo.pieces,
      weight: state.cargo.weight,
      volume: state.cargo.volume,
      specialHandling: [...state.handling],
      status: state.status,
      issuedAt: existing ? existing.issuedAt : now,
      updatedAt: now
    });
    issuedAwbs = mergeAwbs(issuedAwbs, [record]);
    historyRevision += 1;
    persistAwbs();
    setSyncPending(true);
  }

  function updateSequence() {
    const highest = issuedAwbs.reduce((value, record) => {
      const number = Number(record.awb.slice(4));
      return Number.isFinite(number) ? Math.max(value, number) : value;
    }, 0);
    state.awbSequence = Math.max(state.awbSequence, highest + 1);
  }

  function sameAwbIssue(left, right) {
    if (left.recordId && right.recordId) return left.recordId === right.recordId;
    return left.issuedAt === right.issuedAt &&
      left.shipper === right.shipper &&
      left.consignee === right.consignee &&
      left.origin === right.origin &&
      left.destination === right.destination &&
      left.date === right.date &&
      left.flight === right.flight &&
      left.pieces === right.pieces &&
      left.weight === right.weight &&
      left.volume === right.volume &&
      left.specialHandling.join(",") === right.specialHandling.join(",");
  }

  function repairAwbCollisions(remoteAwbs) {
    const remoteByAwb = new Map(remoteAwbs.map((record) => [record.awb, record]));
    const occupied = new Set([...remoteAwbs, ...issuedAwbs].map((record) => record.awb));
    const maxSequence = [...occupied].reduce((value, awb) => Math.max(value, Number(awb.slice(4)) || 0), 0);
    state.awbSequence = Math.max(state.awbSequence, maxSequence + 1);
    let repaired = false;

    issuedAwbs = issuedAwbs.map((record) => {
      const remoteRecord = remoteByAwb.get(record.awb);
      if (!remoteRecord || sameAwbIssue(record, remoteRecord)) return record;
      const previousAwb = record.awb;
      let nextAwb = `TST-${String(state.awbSequence).padStart(6, "0")}`;
      while (occupied.has(nextAwb)) {
        state.awbSequence += 1;
        nextAwb = `TST-${String(state.awbSequence).padStart(6, "0")}`;
      }
      occupied.add(nextAwb);
      state.awbSequence += 1;
      repaired = true;
      if (state.awb === previousAwb) state.awb = nextAwb;
      addLine(`AWB NUMBER COLLISION · ${previousAwb} already exists with different shipment details; this record was reassigned to ${nextAwb}.`, "warning");
      return { ...record, awb: nextAwb, updatedAt: new Date().toISOString() };
    });

    if (repaired) {
      historyRevision += 1;
      persistAwbs();
      setSyncPending(true);
      refreshStatus();
    }
  }

  function displayAwb(record) {
    const issued = record.issuedAt ? new Date(record.issuedAt) : null;
    const issueDateTime = issued && !Number.isNaN(issued.getTime()) ? issued.toLocaleString() : (record.issuedAt || "—");
    const route = [record.origin || "—", record.destination || "—"].join(" → ");
    const details = [
      `AWB NUMBER     ${record.awb}`,
      `SHIPPER        ${record.shipper || "NOT PROVIDED"}`,
      `CONSIGNEE      ${record.consignee || "NOT PROVIDED"}`,
      `ORIGIN/DEST.   ${route}`,
      `FLIGHT         ${record.flight || "NOT PROVIDED"}`,
      `PIECES         ${record.pieces || "—"}`,
      `WEIGHT         ${record.weight ? `${record.weight} KG` : "—"}`,
      `VOLUME         ${record.volume ? `${record.volume} M3` : "—"}`,
      `SPECIAL HAND.  ${record.specialHandling.length ? record.specialHandling.join(", ") : "NONE"}`,
      `STATUS         ${record.status}`,
      `ISSUED         ${issueDateTime}`
    ];
    addLine(`AWB DETAILS · ${record.awb}`, "success");
    for (const detail of details) addLine(detail);
    renderAwbDocument(record);
  }

  function awbDocumentNumber(record) {
    const digits = record.awb.match(/(\d+)$/)?.[1] || "0";
    const serial = digits.padStart(7, "0").slice(-7);
    const checkDigit = Number(serial) % 7;
    return `999-${serial}-${checkDigit}`;
  }

  function renderAwbDocument(record) {
    displayedAwb = record;
    const barcodePayload = [
      `AWB:${record.awb}`,
      `NO:${awbDocumentNumber(record)}`,
      `ROUTE:${record.origin}-${record.destination}`,
      `FLT:${record.flight}`,
      `PCS:${record.pieces}`,
      `WT:${record.weight}KG`,
      `VOL:${record.volume}M3`,
      `SR:${record.specialHandling.join(",") || "NONE"}`
    ].join("|");
    const values = {
      formattedNumber: awbDocumentNumber(record),
      shipper: record.shipper || "NOT PROVIDED",
      consignee: record.consignee || "NOT PROVIDED",
      origin: record.origin || "—",
      destination: record.destination || "—",
      flight: `${record.flight || "—"} / ${record.date || "DATE NOT PROVIDED"}`,
      handling: record.specialHandling.length ? record.specialHandling.join(" · ") : "NONE",
      pieces: record.pieces ? `${record.pieces}` : "—",
      weight: record.weight ? `${record.weight} KG` : "—",
      volume: record.volume ? `${record.volume} M3` : "—",
      status: record.status,
      issued: record.issuedAt ? new Date(record.issuedAt).toLocaleString() : "—",
      barcodeText: barcodePayload
    };

    for (const field of awbDocumentArea.querySelectorAll("[data-awb-field]")) {
      field.textContent = values[field.dataset.awbField] || "—";
    }
    awbDocumentArea.hidden = false;
    try {
      if (typeof window.JsBarcode !== "function") {
        throw new Error("Barcode library is unavailable.");
      }
      window.JsBarcode(document.getElementById("awbBarcode"), barcodePayload, {
        format: "CODE128",
        displayValue: false,
        height: 48,
        width: 1.35,
        margin: 2,
        lineColor: "#000000",
        background: "#ffffff"
      });
    } catch (error) {
      addLine(`AWB BARCODE UNAVAILABLE: ${error instanceof Error ? error.message : "barcode could not be generated"}. The AWB number and details are still printable.`, "warning");
    }
    awbDocumentArea.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function printAwb(number) {
    const record = issuedAwbs.find((entry) => entry.awb === number.toUpperCase());
    if (!record) {
      addLine(`AWB NOT FOUND · ${number.toUpperCase()}. Use LIST AWB to see issued AWBs.`, "error");
      return;
    }
    displayAwb(record);
    window.print();
  }

  function viewAwb(number) {
    const record = issuedAwbs.find((entry) => entry.awb === number.toUpperCase());
    if (!record) {
      addLine(`AWB NOT FOUND · ${number.toUpperCase()}. Use LIST AWB to see issued AWBs.`, "error");
      return;
    }
    displayAwb(record);
  }

  function listAwbs() {
    if (!issuedAwbs.length) {
      addLine("NO ISSUED AWBS. Complete a shipment with FWB first.", "warning");
      return;
    }
    addLine(`ISSUED AWBS · ${issuedAwbs.length}`, "success");
    for (const record of issuedAwbs.slice().sort((a, b) => b.awb.localeCompare(a.awb))) {
      addLine(`${record.awb} · ${record.origin || "---"}-${record.destination || "---"} · ${record.status}`, "normal", `VIEW AWB ${record.awb}`);
    }
  }

  function decodeBase64Json(content) {
    const binary = atob(content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(data) ? data : data.awbs;
  }

  function encodeBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  async function loadGithubAwbs() {
    const response = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`GitHub history load failed (HTTP ${response.status}).`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.awbs;
  }

  async function getGithubFile(token) {
    const response = await fetch(`${GITHUB_API_URL}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      },
      cache: "no-store"
    });
    if (response.status === 404) return { awbs: [], sha: null };
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `GitHub read failed (HTTP ${response.status}).`);
    }
    if (!result.content) throw new Error("GitHub history file has no readable content.");
    return { awbs: decodeBase64Json(result.content), sha: result.sha };
  }

  async function syncHistory(report = false) {
    const token = getGithubToken();
    if (!token) {
      setSyncStatus(isSyncPending() ? "Local history saved · GitHub token not configured" : "GitHub token not configured", "pending");
      if (report) addLine("GITHUB SYNC UNAVAILABLE · configure GitHub sync to store history in the repository.", "warning");
      return false;
    }
    if (!navigator.onLine) {
      setSyncStatus("Offline · GitHub sync queued", "pending");
      if (report) addLine("GITHUB SYNC QUEUED · offline; it will retry when connectivity returns.", "warning");
      return false;
    }
    if (syncInProgress) return false;

    syncInProgress = true;
    setSyncStatus("Syncing AWB history to GitHub…", "syncing");
    try {
      let conflicts = 0;
      while (true) {
        const remote = await getGithubFile(token);
        const remoteAwbs = mergeAwbs(remote.awbs);
        repairAwbCollisions(remoteAwbs);
        const merged = mergeAwbs(remoteAwbs, issuedAwbs);
        const revision = historyRevision;
        const body = {
          message: `Update cargo AWB history (${merged.length} records)`,
          content: encodeBase64(`${JSON.stringify({ awbs: merged }, null, 2)}\n`),
          branch: GITHUB_BRANCH
        };
        if (remote.sha) body.sha = remote.sha;
        const response = await fetch(GITHUB_API_URL, {
          method: "PUT",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28"
          },
          body: JSON.stringify(body)
        });
        if (response.ok) {
          issuedAwbs = mergeAwbs(issuedAwbs, merged);
          persistAwbs();
          if (historyRevision !== revision) continue;
          setSyncPending(false);
          setSyncStatus(`Synced ${issuedAwbs.length} AWB${issuedAwbs.length === 1 ? "" : "s"} to GitHub`, "synced");
          if (report) addLine(`GITHUB SYNC COMPLETE · ${issuedAwbs.length} AWB RECORDS STORED.`, "success");
          return true;
        }
        const result = await response.json();
        if ((response.status === 409 || response.status === 422) && conflicts < 2) {
          conflicts += 1;
          continue;
        }
        throw new Error(result.message || `GitHub write failed (HTTP ${response.status}).`);
      }
    } catch (error) {
      setSyncPending(true);
      setSyncStatus("Sync failed · AWB history remains saved locally", "error");
      addLine(`GITHUB SYNC FAILED: ${error instanceof Error ? error.message : "network or API error"}. History is queued for retry.`, "warning");
      return false;
    } finally {
      syncInProgress = false;
    }
  }

  async function loadAwbHistory() {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      issuedAwbs = mergeAwbs(raw ? JSON.parse(raw) : []);
    } catch (error) {
      addLine(`LOCAL AWB HISTORY COULD NOT BE READ: ${error instanceof Error ? error.message : "invalid stored data"}`, "warning");
    }
    updateSequence();
    if (issuedAwbs.length) addLine(`LOCAL AWB HISTORY LOADED · ${issuedAwbs.length} RECORDS.`, "muted");
    try {
      issuedAwbs = mergeAwbs(issuedAwbs, await loadGithubAwbs());
      persistAwbs();
      updateSequence();
      if (issuedAwbs.length) addLine(`HISTORY READY · ${issuedAwbs.length} ISSUED AWB${issuedAwbs.length === 1 ? "" : "S"} AVAILABLE.`, "success");
    } catch (error) {
      addLine(`GITHUB HISTORY UNAVAILABLE: ${error instanceof Error ? error.message : "network error"}. Using local history.`, "warning");
    }
    historyReady = true;
    setSyncStatus(isSyncPending() ? "Local history saved · GitHub sync pending" : "Local history ready · GitHub sync not configured", isSyncPending() ? "pending" : "idle");
    updateSequence();
    if (isSyncPending() && getGithubToken()) syncHistory();
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
    updateField("statusConsignee", state.consignee);
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
      ["Add consignee", "CN1LEE/JIHOON"],
      ["Cargo details", "FD3/250/1.2"],
      ["Special handling", "SR PER"],
      ["Issue simulated AWB", "FWB"],
      ["View AWB details", state.awb ? `FWD${state.awb}` : "LIST AWB"],
      ["Print AWB", state.awb ? `PRINT AWB ${state.awb}` : "PRINT AWB TST-000001"],
      ["List issued AWBs", "AWB LIST"],
      ["Tracking lookup", state.awb ? `TRK ${state.awb}` : "TRK TST-000001"],
      ["Update status", "FSU"],
      ["Sync AWB history", "SYNC"],
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
    addLine("CN1[LAST]/[FIRST MIDDLE]       add the consignee, e.g. CN1LEE/JIHOON");
    addLine("FD[PIECES]/[WEIGHT_KG]/[VOLUME_M3] e.g. FD3/250/1.2");
    addLine("SR [PER|AVI|DG|COL|EAP|HUM|ICE|VAL]");
    addLine("FWB                            create a simulated AWB after booking details");
    addLine("FWD[AWB] or RT[AWB]            retrieve full AWB details, e.g. FWD TST-000001");
    addLine("VIEW AWB [number] / SHOW AWB [number]  display an issued AWB");
    addLine("PRINT AWB [number]             display and print the simulated AWB document");
    addLine("LIST AWB / AWB LIST             list all issued AWBs");
    addLine("ET or RF                       end the simulated transaction");
    addLine("TRK [AWB]                      look up this shipment after FWB");
    addLine("FSU                            advance one simulated status after ET / RF");
    addLine("SYNC                           retry saving AWB history to GitHub");
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

  function handleConsignee(command) {
    const match = command.match(/^CN1\s*([^/]+)\/(.+)$/);
    if (!match || !match[1].trim() || !match[2].trim()) {
      addLine("FORMAT: CN1LAST/FIRST MIDDLE  e.g. CN1LEE/JIHOON", "error");
      return;
    }
    const last = match[1].trim();
    const first = match[2].trim();
    if (`${last}/${first}`.length > 80) {
      addLine("CONSIGNEE NAME IS TOO LONG (MAXIMUM 80 CHARACTERS).", "error");
      return;
    }
    if (state.awb) {
      addLine("CONSIGNEE DETAILS ARE LOCKED AFTER FWB.", "warning");
      return;
    }
    state.consignee = `${last.toUpperCase()} / ${first.toUpperCase()}`;
    addLine(`CONSIGNEE ADDED · ${state.consignee}`, "success");
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
    if (!historyReady) {
      addLine("AWB HISTORY IS STILL LOADING. Wait for the history message, then retry FWB.", "warning");
      return;
    }
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
    saveCurrentAwb();
    addLine(`SIMULATED AWB ISSUED · ${state.awb}`, "success", state.awb);
    addLine("Next: end this simulated transaction with ET or RF.", "muted", "ET");
    if (getGithubToken()) {
      syncHistory(true);
    } else {
      setSyncStatus("Local history saved · GitHub token not configured", "pending");
      addLine("AWB SAVED LOCALLY. Configure GitHub sync to persist it to the repository.", "warning");
    }
    const issuedRecord = issuedAwbs.find((record) => record.awb === state.awb);
    if (issuedRecord) displayAwb(issuedRecord);
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
    const requestedAwb = command.replace(/^TRK\s*/i, "").trim().toUpperCase();
    const record = requestedAwb
      ? issuedAwbs.find((entry) => entry.awb === requestedAwb)
      : issuedAwbs.find((entry) => entry.awb === state.awb);
    if (!record) {
      addLine("NO SIMULATED AWB YET. Complete booking details and enter FWB first.", "error");
      return;
    }
    addLine(`TRACKING · ${record.awb} · ${record.status}`, "success", `TRK ${record.awb}`);
    if (record.awb === state.awb && !state.finalized) {
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
    saveCurrentAwb();
    addLine(`FSU ${milestone.code} · ${state.awb} · STATUS ${milestone.label}`, "success");
    if (getGithubToken()) syncHistory();
  }

  function startNewShipment() {
    state.route = "";
    state.date = "";
    state.flights = [];
    state.selectedFlight = null;
    state.shipper = "";
    state.consignee = "";
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
    } else if (command.startsWith("CN1")) {
      handleConsignee(command);
    } else if (command.startsWith("FD")) {
      handleCargo(command);
    } else if (command.startsWith("SR")) {
      handleSpecialHandling(command);
    } else if (command === "FWB") {
      handleAwb();
    } else if (/^(?:FWD|RT)\s+[A-Z0-9-]+$/.test(command) || /^(?:FWD|RT)[A-Z0-9-]+$/.test(command)) {
      viewAwb(command.replace(/^(?:FWD|RT)\s*/, ""));
    } else if (/^(?:FWD|RT)(?:\s|$)/.test(command)) {
      addLine("FORMAT: FWD[AWB NUMBER] or RT[AWB NUMBER]  e.g. FWD TST-000001.", "error");
    } else if (/^(?:VIEW|SHOW)\s+AWB(?:\s+|$)/.test(command)) {
      const match = command.match(/^(?:VIEW|SHOW)\s+AWB\s+([A-Z0-9-]+)$/);
      if (match) viewAwb(match[1]);
      else addLine("FORMAT: VIEW AWB [NUMBER] or SHOW AWB [NUMBER].", "error");
    } else if (/^PRINT\s+AWB(?:\s+|$)/.test(command)) {
      const match = command.match(/^PRINT\s+AWB\s+([A-Z0-9-]+)$/);
      if (match) printAwb(match[1]);
      else addLine("FORMAT: PRINT AWB [NUMBER].", "error");
    } else if (command === "LIST AWB" || command === "AWB LIST") {
      listAwbs();
    } else if (command === "SYNC") {
      syncHistory(true);
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

  githubSettings.addEventListener("click", () => {
    githubTokenError.textContent = "";
    githubTokenInput.value = "";
    githubTokenRemember.checked = Boolean(getGithubToken());
    clearGithubToken.hidden = !getGithubToken();
    githubDialog.showModal();
  });

  printAwbButton.addEventListener("click", () => {
    if (displayedAwb) window.print();
  });

  githubTokenForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = githubTokenInput.value.trim();
    if (!token) {
      githubTokenError.textContent = "Enter a GitHub personal access token.";
      return;
    }
    try {
      if (githubTokenRemember.checked) window.localStorage.setItem(TOKEN_KEY, token);
      else {
        window.localStorage.removeItem(TOKEN_KEY);
        sessionGithubToken = token;
      }
    } catch (error) {
      githubTokenError.textContent = `Could not save token: ${error instanceof Error ? error.message : "browser storage unavailable"}`;
      return;
    }
    githubDialog.close();
    githubTokenInput.value = "";
    await syncHistory(true);
  });

  clearGithubToken.addEventListener("click", () => {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      sessionGithubToken = "";
      githubDialog.close();
      setSyncStatus("GitHub token removed · history remains local", "pending");
      addLine("GITHUB TOKEN REMOVED. Existing AWB history remains saved locally.", "muted");
    } catch (error) {
      githubTokenError.textContent = `Could not remove token: ${error instanceof Error ? error.message : "browser storage unavailable"}`;
    }
  });

  githubDialog.addEventListener("click", (event) => {
    if (event.target === githubDialog) githubDialog.close();
  });
  githubDialogCancel.addEventListener("click", () => githubDialog.close());

  window.addEventListener("online", () => {
    if (isSyncPending()) syncHistory(true);
  });

  addLine("AMADEUS CARGO TRAINING TERMINAL · SESSION READY", "success");
  addLine("SIMULATED DATA ONLY — THIS IS NOT CONNECTED TO ANY AIRLINE OR GDS.", "warning");
  addLine("Type HELP or ? to see command syntax. Start with AN10NOVICNSEL.", "muted", "AN10NOVICNSEL");
  refreshStatus();
  loadAwbHistory();
})();
