/* BrandBlog — Pastenote
 * A 3M Post-it style notice board.
 *
 *   - Paste (Cmd/⌃+V) a link, an image or plain text → it becomes a sticky note.
 *   - Drag & drop images onto the paste zone → image note.
 *   - Every change is auto-saved to localStorage (key `pastenote_notes`, debounced).
 *   - VIEWING is public: anyone sees the board.
 *   - SYNC writes the merged set to content/data/pastenote.json on the repository
 *     via the GitHub Contents API, using a token the admin types in the browser.
 *     The token is stored only on the user's device (localStorage) — never in
 *     this repository. On load the page also reads the live file from
 *     raw.githubusercontent.com, so synced changes appear immediately.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Constants + page guard
   * ------------------------------------------------------------------ */
  var STORAGE_KEY = "pastenote_notes";
  var TOKEN_KEY = "pastenote_token";
  var COLOR_KEY = "pastenote_color";
  var COLORS = ["yellow", "blue", "pink", "green", "orange", "purple"];

  var board = document.getElementById("pn-board");
  var pasteInput = document.getElementById("pn-paste-input");
  if (!board || !pasteInput) return;

  var pasteZone = document.getElementById("pn-compose");
  var colorsRoot = document.getElementById("pn-colors");
  var noteTemplate = document.getElementById("pn-note-template");
  var emptyState = document.getElementById("pn-empty");
  var countEl = document.getElementById("pn-count");
  var toastRoot = document.getElementById("pn-toasts");
  var syncEl = document.getElementById("pn-sync");
  var syncText = document.getElementById("pn-sync-text");
  var syncNowBtn = document.getElementById("pn-sync-now");
  var syncGear = document.getElementById("pn-sync-settings");
  var heroCount = document.querySelector("[data-pn-count]");

  var authModal = document.getElementById("pn-auth-modal");
  var authForm = document.getElementById("pn-auth-form");
  var authTokenInput = document.getElementById("pn-auth-token");
  var authRemember = document.getElementById("pn-auth-remember");
  var authError = document.getElementById("pn-auth-error");
  var authClearBtn = document.getElementById("pn-auth-clear");
  var authTitle = document.getElementById("pn-auth-title");
  var lastFocused = null;

  /* ------------------------------------------------------------------ *
   * Config + embedded seed (injected by the template at build time)
   * ------------------------------------------------------------------ */
  var config = {
    repo: "",
    branch: "main",
    path: "content/data/pastenote.json",
    siteBase: "",
    rawBase: "https://raw.githubusercontent.com",
    apiBase: "https://api.github.com"
  };
  var cfgEl = document.getElementById("pastenote-config");
  if (cfgEl) {
    try { extend(config, JSON.parse(cfgEl.textContent || "{}")); } catch (err) { /* defaults */ }
  }

  var seedNotes = readEmbedded("#pastenote-seed");

  function readEmbedded(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try {
      var data = JSON.parse(el.textContent || "[]");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function extend(target, source) {
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
  }

  function newId() {
    return "pn_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function now() {
    return Date.now();
  }

  function isImageUrl(value) {
    return /^data:image\//i.test(value) ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(value);
  }

  /* "https://example.com/a/b" → { href, host, path, origin } */
  function parseUrl(raw) {
    var value = String(raw || "").trim();
    if (!value) return null;
    var withScheme = value;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^data:/i.test(value)) {
      withScheme = "https://" + value.replace(/^\/+/, "");
    }
    try {
      var url = new URL(withScheme);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return {
        href: url.href,
        host: url.host.replace(/^www\./, ""),
        path: (url.pathname + url.search).replace(/^\/$/, "/"),
        origin: url.origin
      };
    } catch (err) {
      return null;
    }
  }

  /* Decide what a pasted string is: image, link or plain text. */
  function detectKind(text) {
    var value = String(text || "").trim();
    if (!value) return "text";
    if (isImageUrl(value)) return "image";
    if (value.indexOf("\n") === -1 && value.indexOf(" ") === -1) {
      if (parseUrl(value)) return "link";
    }
    return "text";
  }

  function relativeTime(ts) {
    var value = Number(ts) || 0;
    if (!value) return "";
    var diff = Date.now() - value;
    if (diff < 0) diff = 0;
    var min = Math.floor(diff / 60000);
    if (min < 1) return "vừa xong";
    if (min < 60) return min + " phút trước";
    var hours = Math.floor(min / 60);
    if (hours < 24) return hours + " giờ trước";
    var days = Math.floor(hours / 24);
    if (days < 30) return days + " ngày trước";
    var d = new Date(value);
    return String(d.getDate()).padStart(2, "0") + "/" +
      String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }

  function field(node, name) {
    return node.querySelector('[data-field="' + name + '"]');
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  var notes = [];
  var selectedColor = "yellow";
  try {
    var storedColor = window.localStorage.getItem(COLOR_KEY);
    if (storedColor && COLORS.indexOf(storedColor) !== -1) selectedColor = storedColor;
  } catch (err) { /* storage unavailable — keep default */ }

  /* Normalise a raw record into a safe note object (null when unusable). */
  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = String(raw.id || "").trim();
    if (!id) return null;
    var type = raw.type === "link" || raw.type === "image" ? raw.type : "text";
    var created = Number(raw.created_at) || now();
    return {
      id: id,
      type: type,
      text: String(raw.text || ""),
      url: String(raw.url || ""),
      image: String(raw.image || ""),
      color: COLORS.indexOf(raw.color) !== -1 ? raw.color : "yellow",
      created_at: created,
      updated_at: Number(raw.updated_at) || created,
      deleted: raw.deleted === true
    };
  }

  /* Merge note lists by id — the newest updated_at wins. Later lists win ties. */
  function mergeNotes() {
    var map = {};
    for (var i = 0; i < arguments.length; i++) {
      var list = arguments[i] || [];
      for (var j = 0; j < list.length; j++) {
        var note = normalize(list[j]);
        if (!note) continue;
        var existing = map[note.id];
        if (!existing || note.updated_at >= existing.updated_at) map[note.id] = note;
      }
    }
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function visibleNotes() {
    return notes
      .filter(function (note) { return !note.deleted; })
      .sort(function (a, b) { return b.created_at - a.created_at; });
  }

  function findNote(id) {
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].id === id) return notes[i];
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Persistence (debounced localStorage write)
   * ------------------------------------------------------------------ */
  var saveTimer = null;

  function scheduleSave() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 500);
  }

  function saveNow() {
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = null; }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      toast("Không lưu được vào trình duyệt (bộ nhớ đã đầy).", "error");
    }
  }

  function readLocal() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function render() {
    var visible = visibleNotes();
    var fragment = document.createDocumentFragment();

    visible.forEach(function (note, index) {
      fragment.appendChild(buildCard(note, index));
    });

    board.innerHTML = "";
    board.appendChild(fragment);

    if (emptyState) emptyState.classList.toggle("hidden", visible.length !== 0);
    board.classList.toggle("hidden", visible.length === 0);
    updateCount(visible.length);
  }

  function buildCard(note, index) {
    var node = noteTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.noteId = note.id;
    node.classList.add("pn-note--" + note.color);
    node.classList.add(index % 2 === 0 ? "pn-tilt-l" : "pn-tilt-r");

    var body = field(node, "body");
    buildBody(body, note);

    var time = field(node, "time");
    if (time) {
      time.textContent = relativeTime(note.created_at);
      if (note.updated_at - note.created_at > 60000) {
        time.textContent += " · đã sửa";
      }
    }

    node.classList.add("is-enter");
    return node;
  }

  function buildBody(body, note) {
    if (!body) return;
    body.innerHTML = "";
    body.contentEditable = "false";
    body.removeAttribute("contenteditable");

    if (note.type === "link") {
      body.appendChild(buildLink(note));
    } else if (note.type === "image") {
      body.appendChild(buildImage(note));
    } else {
      body.contentEditable = "true";
      body.setAttribute("contenteditable", "true");
      body.setAttribute("role", "textbox");
      body.setAttribute("aria-label", "Nội dung ghi chú");
      body.textContent = note.text;
    }
  }

  function buildLink(note) {
    var parsed = parseUrl(note.url) || { href: note.url, host: note.url, path: "", origin: "" };
    var link = document.createElement("a");
    link.className = "pn-link";
    link.href = parsed.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    if (parsed.origin) {
      var favicon = document.createElement("img");
      favicon.className = "pn-link-favicon";
      favicon.alt = "";
      favicon.loading = "lazy";
      favicon.width = 26;
      favicon.height = 26;
      favicon.src = parsed.origin + "/favicon.ico";
      favicon.addEventListener("error", function () { favicon.remove(); });
      link.appendChild(favicon);
    }

    var meta = document.createElement("span");
    meta.className = "pn-link-meta";

    var host = document.createElement("span");
    host.className = "pn-link-host";
    host.textContent = parsed.host;
    meta.appendChild(host);

    if (parsed.path && parsed.path !== "/") {
      var path = document.createElement("span");
      path.className = "pn-link-path";
      path.textContent = parsed.path;
      meta.appendChild(path);
    }

    link.appendChild(meta);

    var wrap = document.createElement("div");
    wrap.appendChild(link);

    if (note.text) {
      var caption = document.createElement("p");
      caption.className = "pn-link-caption";
      caption.textContent = note.text;
      wrap.appendChild(caption);
    }
    return wrap;
  }

  function buildImage(note) {
    var link = document.createElement("a");
    link.className = "pn-image";
    link.href = note.image;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    var img = document.createElement("img");
    img.src = note.image;
    img.alt = note.text || "Ảnh đã dán";
    img.loading = "lazy";
    link.appendChild(img);

    var wrap = document.createElement("div");
    wrap.appendChild(link);

    if (note.text) {
      var caption = document.createElement("p");
      caption.className = "pn-image-caption";
      caption.textContent = note.text;
      wrap.appendChild(caption);
    }
    return wrap;
  }

  function updateCount(count) {
    if (countEl) countEl.textContent = String(count);
    if (heroCount) heroCount.textContent = String(count);
  }

  /* Light refresh of the "x minutes ago" labels without re-rendering. */
  function refreshTimes() {
    var cards = board.querySelectorAll("[data-note-id]");
    Array.prototype.forEach.call(cards, function (card) {
      var note = findNote(card.getAttribute("data-note-id"));
      var time = field(card, "time");
      if (!note || !time) return;
      time.textContent = relativeTime(note.created_at);
      if (note.updated_at - note.created_at > 60000) time.textContent += " · đã sửa";
    });
  }

  /* ------------------------------------------------------------------ *
   * Creating notes
   * ------------------------------------------------------------------ */
  function pushNote(note) {
    notes.push(note);
    saveNow();
    render();
    return note;
  }

  function addTextNote(text) {
    return pushNote({
      id: newId(),
      type: "text",
      text: String(text || ""),
      color: selectedColor,
      created_at: now(),
      updated_at: now(),
      deleted: false
    });
  }

  function addLinkNote(rawUrl) {
    var parsed = parseUrl(rawUrl);
    if (!parsed) return addTextNote(rawUrl);
    return pushNote({
      id: newId(),
      type: "link",
      text: "",
      url: parsed.href,
      color: selectedColor,
      created_at: now(),
      updated_at: now(),
      deleted: false
    });
  }

  function addImageNote(image, caption) {
    if (!image) return null;
    return pushNote({
      id: newId(),
      type: "image",
      text: String(caption || ""),
      image: image,
      color: selectedColor,
      created_at: now(),
      updated_at: now(),
      deleted: false
    });
  }

  function addFromText(text) {
    var value = String(text || "").trim();
    if (!value) return null;
    var kind = detectKind(value);
    var note;
    if (kind === "image") {
      note = addImageNote(value, "");
      toast("📷 Đã thêm ghi chú ảnh.", "success");
    } else if (kind === "link") {
      note = addLinkNote(value);
      toast("🔗 Đã thêm link card.", "success");
    } else {
      note = addTextNote(value);
      toast("📝 Đã thêm ghi chú.", "success");
    }
    return note;
  }

  /* ------------------------------------------------------------------ *
   * Image handling (drop / paste / clipboard)
   * ------------------------------------------------------------------ */
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result;
        var img = new Image();
        img.onload = function () {
          var max = 1200;
          var w = img.width;
          var h = img.height;
          if (!w || !h) { resolve(result); return; }
          if (w > max || h > max) {
            var scale = Math.min(max / w, max / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          try {
            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          } catch (err) {
            resolve(result);
          }
        };
        img.onerror = function () { resolve(result); };
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    var images = list.filter(function (file) {
      return file && /^image\//.test(file.type);
    });
    if (!images.length) return false;
    images.forEach(function (file) {
      resizeImage(file).then(function (dataUrl) {
        addImageNote(dataUrl, "");
        toast("📷 Đã thêm ảnh vào bảng.", "success");
      }).catch(function () {
        toast("Không đọc được ảnh.", "error");
      });
    });
    return true;
  }

  function handleClipboard(data) {
    if (!data) return false;
    if (handleFiles(data.files)) return true;
    var text = data.getData ? data.getData("text/plain") : "";
    if (text) {
      addFromText(text);
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Paste zone events
   * ------------------------------------------------------------------ */
  pasteInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      var value = pasteInput.value.trim();
      if (!value) return;
      addFromText(value);
      pasteInput.value = "";
    }
  });

  document.addEventListener("paste", function (event) {
    var target = event.target;
    var tag = (target.tagName || "").toLowerCase();

    /* Let people paste normally into inputs and into note editing. */
    if (target.isContentEditable) return;
    if ((tag === "input" || tag === "textarea") && target !== pasteInput) return;

    if (target === pasteInput) {
      event.preventDefault();
      if (handleClipboard(event.clipboardData)) pasteInput.value = "";
      return;
    }
    handleClipboard(event.clipboardData);
  });

  /* Drag & drop onto the compose zone. */
  if (pasteZone) {
    ["dragenter", "dragover"].forEach(function (name) {
      pasteZone.addEventListener(name, function (event) {
        event.preventDefault();
        pasteZone.classList.add("is-dragover");
      });
    });
    ["dragleave", "dragend"].forEach(function (name) {
      pasteZone.addEventListener(name, function () {
        pasteZone.classList.remove("is-dragover");
      });
    });
    pasteZone.addEventListener("drop", function (event) {
      event.preventDefault();
      pasteZone.classList.remove("is-dragover");
      var dt = event.dataTransfer;
      if (!dt) return;
      if (handleFiles(dt.files)) return;
      var text = dt.getData("text/plain") || dt.getData("text/uri-list");
      if (text) addFromText(text);
    });
  }

  /* "Dán" button — try the async Clipboard API, else guide the user. */
  function guideToKeyboardPaste() {
    pasteInput.focus();
    toast("Nhấn Cmd/⌃+V để dán nội dung.", "info");
  }

  var pasteBtn = document.getElementById("pn-paste-btn");
  if (pasteBtn) {
    pasteBtn.addEventListener("click", function () {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        guideToKeyboardPaste();
        return;
      }
      navigator.clipboard.read().then(function (items) {
        var imageItem = null;
        var textItem = null;
        items.forEach(function (item) {
          if (!imageItem && item.types.some(function (t) { return /^image\//.test(t); })) {
            imageItem = item;
          } else if (!textItem && item.types.indexOf("text/plain") !== -1) {
            textItem = item;
          }
        });

        if (imageItem) {
          var type = imageItem.types.filter(function (t) { return /^image\//.test(t); })[0];
          return imageItem.getType(type).then(function (blob) {
            handleFiles([new File([blob], "pasted.png", { type: type })]);
          });
        }
        if (textItem) {
          return textItem.getType("text/plain").then(function (blob) {
            return blob.text();
          }).then(function (text) {
            if (text) addFromText(text);
          });
        }
        guideToKeyboardPaste();
      }).catch(guideToKeyboardPaste);
    });
  }

  /* "+ Thêm note mới" — create an empty sticky and focus it. */
  var addBtn = document.getElementById("pn-add");
  if (addBtn) {
    addBtn.addEventListener("click", function () {
      var note = addTextNote("");
      var card = board.querySelector('[data-note-id="' + note.id + '"] [data-field="body"]');
      if (card) card.focus();
    });
  }

  /* Colour picker */
  function syncColorPicker() {
    if (!colorsRoot) return;
    Array.prototype.forEach.call(colorsRoot.querySelectorAll(".pn-color-dot"), function (dot) {
      dot.setAttribute("aria-pressed", String(dot.getAttribute("data-color") === selectedColor));
    });
  }

  if (colorsRoot) {
    colorsRoot.addEventListener("click", function (event) {
      var dot = event.target.closest(".pn-color-dot");
      if (!dot) return;
      selectedColor = dot.getAttribute("data-color") || "yellow";
      try { window.localStorage.setItem(COLOR_KEY, selectedColor); } catch (err) { /* noop */ }
      syncColorPicker();
    });
  }

  /* ------------------------------------------------------------------ *
   * Board events — inline edit, copy, delete
   * ------------------------------------------------------------------ */
  board.addEventListener("input", function (event) {
    var body = event.target.closest('[data-field="body"][contenteditable="true"]');
    if (!body) return;
    var card = body.closest("[data-note-id]");
    if (!card) return;
    var note = findNote(card.getAttribute("data-note-id"));
    if (!note) return;
    note.text = body.innerText.replace(/\n{3,}/g, "\n\n");
    note.updated_at = now();
    scheduleSave();
  });

  board.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-action]");
    if (!btn) return;
    var card = btn.closest("[data-note-id]");
    if (!card) return;
    var note = findNote(card.getAttribute("data-note-id"));
    if (!note) return;
    var action = btn.getAttribute("data-action");

    if (action === "copy") {
      var text = note.url || note.text || note.image;
      copyText(text);
    } else if (action === "delete") {
      removeNote(note);
    }
  });

  function removeNote(note) {
    note.deleted = true;
    note.updated_at = now();
    saveNow();
    render();
    toast("🗑 Đã xoá ghi chú.", "info");
  }

  function copyText(text) {
    var value = String(text || "");
    var done = function () { toast("Đã sao chép nội dung.", "success"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(function () { fallbackCopy(value, done); });
    } else {
      fallbackCopy(value, done);
    }
  }

  function fallbackCopy(text, done) {
    var input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    try { document.execCommand("copy"); done(); } catch (err) { /* noop */ }
    document.body.removeChild(input);
  }

  /* ------------------------------------------------------------------ *
   * GitHub sync
   * ------------------------------------------------------------------ */
  var token = "";
  try { token = window.localStorage.getItem(TOKEN_KEY) || ""; } catch (err) { token = ""; }
  var pendingAction = null;
  var lastSyncAt = 0;

  function rawUrl() {
    return config.rawBase + "/" + config.repo + "/" + config.branch + "/" + config.path;
  }

  function bakedUrl() {
    return (config.siteBase || "") + "/data/pastenote.json";
  }

  function apiContentsUrl() {
    return config.apiBase + "/repos/" + config.repo + "/contents/" + config.path;
  }

  function authHeaders() {
    return {
      Authorization: "token " + token,
      Accept: "application/vnd.github+json"
    };
  }

  function fetchJson(url) {
    return window.fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("fetch-" + res.status);
      return res.json();
    });
  }

  /* Newest first: the raw file, then the copy baked into the site at build time. */
  function loadRemoteNotes() {
    return fetchJson(rawUrl()).catch(function () {
      return fetchJson(bakedUrl());
    });
  }

  function encodeUTF8(str) {
    if (typeof TextEncoder !== "undefined") {
      var bytes = new TextEncoder().encode(str);
      var binary = "";
      var chunk = 0x8000;
      for (var i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return window.btoa(binary);
    }
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  function decodeUTF8(b64) {
    if (typeof TextDecoder !== "undefined") {
      var binary = window.atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(escape(window.atob(b64)));
  }

  function setSyncState(state, message) {
    if (syncEl) syncEl.setAttribute("data-state", state);
    if (syncNowBtn) syncNowBtn.disabled = state === "syncing";
    if (syncText) {
      if (message) {
        syncText.textContent = message;
      } else {
        var n = visibleNotes().length;
        syncText.textContent = "Đã sync " + n + " ghi chú";
      }
    }
  }

  function syncStatusText() {
    if (!syncText) return;
    var n = visibleNotes().length;
    if (lastSyncAt) {
      syncText.textContent = "Đã sync " + n + " ghi chú · " + relativeTime(lastSyncAt);
    } else {
      syncText.textContent = n + " ghi chú · chưa sync";
    }
  }

  function verifyToken(value) {
    return window.fetch(config.apiBase + "/repos/" + config.repo, {
      headers: { Authorization: "token " + value, Accept: "application/vnd.github+json" }
    }).then(function (res) {
      if (res.status === 401) {
        var err = new Error("invalid-token");
        err.status = 401;
        throw err;
      }
      if (!res.ok) throw new Error("verify-" + res.status);
      return true;
    });
  }

  function httpError(label, res) {
    var err = new Error(label + " (" + res.status + ")");
    err.status = res.status;
    return err;
  }

  function syncNow() {
    if (!token) {
      openAuth("Sync", syncNow);
      return;
    }
    setSyncState("syncing", "Đang đồng bộ…");
    var url = apiContentsUrl();

    window.fetch(url, { headers: authHeaders() })
      .then(function (res) {
        if (res.status === 404) return { exists: false, sha: null, content: null };
        if (!res.ok) throw httpError("Không đọc được tệp trên GitHub", res);
        return res.json();
      })
      .then(function (meta) {
        var remote = [];
        if (meta.exists && meta.content) {
          try { remote = JSON.parse(decodeUTF8(meta.content)); } catch (err) { remote = []; }
        }
        var merged = mergeNotes(remote, notes);
        var payload = {
          message: "📌 Cập nhật Pastenote (" + merged.filter(function (n) { return !n.deleted; }).length + " ghi chú)",
          content: encodeUTF8(JSON.stringify(merged, null, 2) + "\n"),
          branch: config.branch
        };
        if (meta.sha) payload.sha = meta.sha;
        return window.fetch(url, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw httpError("Không lưu được lên GitHub", res);
          notes = merged;
          saveNow();
          render();
          lastSyncAt = now();
          setSyncState("idle");
          syncStatusText();
          toast("☁️ Đã sync " + visibleNotes().length + " ghi chú lên GitHub.", "success");
        });
      })
      .catch(function (err) {
        handleSyncError(err);
      });
  }

  function handleSyncError(err) {
    setSyncState("error", "Lỗi đồng bộ — thử lại");
    if (err && err.status === 401) {
      clearToken();
      toast("Token không hợp lệ hoặc đã hết hạn — vui lòng nhập lại.", "error");
    } else if (err && err.status === 403) {
      toast("Token không có quyền ghi (cần contents:write).", "error");
    } else if (err && err.status === 404) {
      toast("Không tìm thấy tệp pastenote.json trên repository.", "error");
    } else {
      toast("Không thể đồng bộ lên GitHub. Kiểm tra kết nối và thử lại.", "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Auth (GitHub token) modal
   * ------------------------------------------------------------------ */
  function openAuth(title, onDone) {
    if (!authModal) return;
    pendingAction = onDone || null;
    if (authTitle && title) authTitle.textContent = title;
    if (authForm) authForm.reset();
    if (authTokenInput) {
      authTokenInput.value = token || "";
      authTokenInput.classList.remove("is-invalid");
    }
    if (authError) authError.textContent = "";
    if (authClearBtn) authClearBtn.classList.toggle("hidden", !token);
    lastFocused = document.activeElement;
    authModal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      if (authTokenInput) authTokenInput.focus();
    }, 60);
  }

  function closeAuth() {
    if (!authModal) return;
    authModal.classList.remove("is-open");
    document.body.style.overflow = "";
    pendingAction = null;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function grantToken(value) {
    token = value;
    var remember = !authRemember || authRemember.checked;
    try {
      if (remember) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch (err) { /* storage unavailable — keep in memory */ }
    toast("🔓 Đã kết nối GitHub — giờ bạn có thể sync.", "success");
  }

  function clearToken() {
    token = "";
    try { window.localStorage.removeItem(TOKEN_KEY); } catch (err) { /* noop */ }
    if (authClearBtn) authClearBtn.classList.add("hidden");
    if (authTokenInput) authTokenInput.value = "";
    syncStatusText();
  }

  if (authForm) {
    authForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = authTokenInput ? authTokenInput.value.trim() : "";
      if (!value) {
        if (authError) authError.textContent = "Vui lòng nhập GitHub Personal Access Token.";
        if (authTokenInput) authTokenInput.classList.add("is-invalid");
        return;
      }
      var submitBtn = authForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      verifyToken(value).then(function () {
        if (submitBtn) submitBtn.disabled = false;
        grantToken(value);
        var queued = pendingAction;
        closeAuth();
        if (typeof queued === "function") queued();
      }).catch(function (err) {
        if (submitBtn) submitBtn.disabled = false;
        if (authTokenInput) authTokenInput.classList.add("is-invalid");
        if (authError) {
          authError.textContent = err.status === 401
            ? "Token không hợp lệ hoặc đã hết hạn."
            : "Không xác thực được với GitHub — kiểm tra kết nối.";
        }
      });
    });
  }

  var authCloseBtn = document.getElementById("pn-auth-close");
  var authCancelBtn = document.getElementById("pn-auth-cancel");
  var authOverlay = document.getElementById("pn-auth-overlay");
  var authContent = document.getElementById("pn-auth-content");
  if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuth);
  if (authCancelBtn) authCancelBtn.addEventListener("click", closeAuth);
  if (authOverlay) authOverlay.addEventListener("click", closeAuth);
  if (authContent) {
    authContent.addEventListener("click", function (event) {
      if (event.target === authContent) closeAuth();
    });
  }
  if (authClearBtn) {
    authClearBtn.addEventListener("click", function () {
      clearToken();
      toast("Đã xoá token khỏi thiết bị này.", "info");
    });
  }

  if (syncNowBtn) syncNowBtn.addEventListener("click", syncNow);
  if (syncGear) {
    syncGear.addEventListener("click", function () { openAuth("Cài đặt đồng bộ", null); });
  }

  /* Focus trap for the modal. */
  if (authModal) {
    authModal.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusable = Array.prototype.filter.call(
        authModal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null; }
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && authModal && authModal.classList.contains("is-open")) {
      closeAuth();
    }
  });

  /* ------------------------------------------------------------------ *
   * Toasts
   * ------------------------------------------------------------------ */
  function toast(message, type) {
    if (!toastRoot) return;
    var el = document.createElement("div");
    el.className = "pn-toast" + (type === "error" ? " is-error" : "");
    var icon = type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✅";
    var ico = document.createElement("span");
    ico.setAttribute("aria-hidden", "true");
    ico.textContent = icon;
    var text = document.createElement("span");
    text.textContent = message;
    el.appendChild(ico);
    el.appendChild(text);
    toastRoot.appendChild(el);
    window.setTimeout(function () {
      el.classList.add("is-leaving");
      window.setTimeout(function () { el.remove(); }, 220);
    }, 3200);
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  notes = mergeNotes(seedNotes, readLocal());
  syncColorPicker();
  render();
  setSyncState("idle");
  syncStatusText();

  loadRemoteNotes().then(function (remote) {
    notes = mergeNotes(notes, remote);
    saveNow();
    render();
    syncStatusText();
  }).catch(function () {
    /* Offline or first run — the embedded seed + localStorage are enough. */
  });

  window.setInterval(function () {
    if (document.activeElement && document.activeElement.isContentEditable) return;
    refreshTimes();
  }, 60000);
})();
