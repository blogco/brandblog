/* BrandBlog — Cargo Dictionary (Anh–Việt–Hàn)
 * Live glossary backed by GitHub:
 *   - VIEW (public): fuzzy search (Fuse.js), category filters, pronunciation,
 *     copy, expand, export — everything runs in the browser, no login needed.
 *   - WRITE (admin only): add / edit / delete / import require a password,
 *     which is the user's GitHub Personal Access Token, typed at runtime and
 *     kept in memory only — never stored on the page or in this repo. Writes
 *     commit the updated glossary to content/data/cargo_dictionary.json on the
 *     configured branch via the GitHub REST API; GitHub Actions then rebuilds
 *     and redeploys the site so everyone sees the change.
 */
(function () {
  "use strict";

  var LEVEL_RANK = { "Cơ bản": 0, "Trung bình": 1, "Nâng cao": 2 };
  var FILE_PATH = "content/data/cargo_dictionary.json";

  /* ------------------------------------------------------------------ *
   * Page guard — bail out when the dictionary markup is not present.
   * ------------------------------------------------------------------ */
  var grid = document.getElementById("dict-grid");
  var searchInput = document.getElementById("dict-search");
  if (!grid || !searchInput) return;

  var skeleton = document.getElementById("dict-skeleton");
  var emptyState = document.getElementById("dict-empty");
  var countEl = document.getElementById("dict-count");
  var totalEl = document.getElementById("dict-total");
  var statCountEl = document.querySelector("[data-stat-count]");
  var queryNote = document.getElementById("dict-query-note");
  var clearBtn = document.getElementById("dict-search-clear");
  var sortSelect = document.getElementById("dict-sort");
  var filtersRoot = document.getElementById("dict-filters");
  var toastRoot = document.getElementById("dict-toasts");
  var cardTemplate = document.getElementById("dict-card-template");

  var modal = document.getElementById("dict-modal");
  var modalOverlay = document.getElementById("dict-modal-overlay");
  var modalPanel = document.getElementById("dict-modal-panel");
  var modalForm = document.getElementById("dict-form");
  var lastFocused = null;

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function stripDiacritics(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(value) {
    return stripDiacritics(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "term";
  }

  function uniqueId(english) {
    return slugify(english) + "-" + Date.now().toString(36);
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function extend(target, source) {
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
  }

  /* Split "Air Waybill (AWB)" or "ULD (Unit Load Device)" into term + abbreviation. */
  function parseTerm(english) {
    var text = String(english || "").trim();
    var match = text.match(/^(.*?)\s*\((.*)\)\s*$/);
    if (!match) return { term: text, abbr: "" };
    var before = match[1].trim();
    var inside = match[2].trim();
    var looksLikeAbbr = before.length <= 6 && before === before.toUpperCase() && before.indexOf(" ") === -1;
    if (looksLikeAbbr) return { term: inside, abbr: before };
    return { term: before, abbr: inside };
  }

  function field(node, name) {
    return node.querySelector('[data-field="' + name + '"]');
  }

  function setHtml(node, name, html) {
    var el = field(node, name);
    if (el) el.innerHTML = html;
  }

  function show(node, name) {
    var el = field(node, name);
    if (el) el.classList.remove("hidden");
  }

  /* ------------------------------------------------------------------ *
   * Config + embedded seed (injected by the template at build time)
   * ------------------------------------------------------------------ */
  var config = {
    repo: "",
    branch: "main",
    rawBase: "https://raw.githubusercontent.com",
    apiBase: "https://api.github.com"
  };
  var cfgEl = document.getElementById("cargo-dictionary-config");
  if (cfgEl) {
    try { extend(config, JSON.parse(cfgEl.textContent || "{}")); } catch (err) { /* keep defaults */ }
  }

  var seedTerms = readSeed();
  var embeddedIds = {};
  seedTerms.forEach(function (raw) { embeddedIds[raw.id] = true; });

  /* serverTerms — latest glossary fetched from the repository (null until loaded). */
  var serverTerms = null;

  function readSeed() {
    var el = document.getElementById("cargo-dictionary-data");
    if (!el) return [];
    try {
      var data = JSON.parse(el.textContent || "[]");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  /* The authoritative raw list: live repo data when available, else the seed. */
  function workingBase() {
    return serverTerms || seedTerms;
  }

  function rawUrl() {
    return config.rawBase + "/" + config.repo + "/" + config.branch + "/content/data/cargo_dictionary.json";
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  var terms = [];
  var fuse = null;
  var activeCategory = "all";
  var query = "";
  var sortMode = "az";

  function prepare(raw) {
    var parsed = parseTerm(raw.english);
    return {
      id: raw.id || slugify(raw.english),
      english: raw.english || "",
      vietnamese: raw.vietnamese || "",
      korean: raw.korean || "",
      definition: raw.definition || "",
      example: raw.example || "",
      category: raw.category || "Cơ bản",
      level: raw.level || "Cơ bản",
      created_at: raw.created_at || "",
      liveAdded: !embeddedIds[raw.id],
      term: parsed.term,
      abbr: parsed.abbr,
      search_vi: stripDiacritics((raw.english || "") + " " + (raw.vietnamese || ""))
    };
  }

  function rebuildTerms() {
    terms = workingBase()
      .filter(function (raw) { return raw && raw.english; })
      .map(function (raw) { return prepare(raw); });
    buildFuse();
  }

  function buildFuse() {
    if (typeof window.Fuse !== "function") {
      fuse = null;
      return;
    }
    fuse = new window.Fuse(terms, {
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 1,
      keys: [
        { name: "english", weight: 3 },
        { name: "vietnamese", weight: 3 },
        { name: "korean", weight: 3 },
        { name: "search_vi", weight: 2 },
        { name: "category", weight: 1 },
        { name: "definition", weight: 1 },
        { name: "example", weight: 1 }
      ]
    });
  }

  /* Fallback if Fuse.js failed to load: simple diacritic-insensitive substring match. */
  function fallbackSearch(q) {
    var needle = stripDiacritics(q).toLowerCase();
    return terms.filter(function (t) {
      var haystack = stripDiacritics(
        t.english + " " + t.vietnamese + " " + t.korean + " " + t.category
      ).toLowerCase();
      return haystack.indexOf(needle) !== -1;
    });
  }

  /* ------------------------------------------------------------------ *
   * Search + sort
   * ------------------------------------------------------------------ */
  function getResults() {
    var items;

    if (!query) {
      items = terms.slice();
    } else if (fuse) {
      items = fuse.search(query).map(function (result) { return result.item; });
    } else {
      items = fallbackSearch(query);
    }

    if (activeCategory !== "all") {
      items = items.filter(function (t) { return t.category === activeCategory; });
    }

    sortTerms(items);
    return items;
  }

  function sortTerms(items) {
    if (sortMode === "new") {
      items.sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at)) ||
          a.english.localeCompare(b.english, "vi");
      });
    } else if (sortMode === "popular") {
      items.sort(function (a, b) {
        var ra = LEVEL_RANK[a.level] == null ? 9 : LEVEL_RANK[a.level];
        var rb = LEVEL_RANK[b.level] == null ? 9 : LEVEL_RANK[b.level];
        return ra - rb || a.english.localeCompare(b.english, "vi");
      });
    } else {
      items.sort(function (a, b) {
        return a.english.localeCompare(b.english, "vi");
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Highlighting — exact substring match, diacritic-insensitive.
   * ------------------------------------------------------------------ */
  function findRanges(text, queryText) {
    var needle = stripDiacritics(queryText).toLowerCase();
    if (!needle) return [];
    var haystack = stripDiacritics(text).toLowerCase();
    var ranges = [];
    var index = haystack.indexOf(needle);
    while (index !== -1) {
      ranges.push([index, index + needle.length - 1]);
      index = haystack.indexOf(needle, index + needle.length);
    }
    return ranges;
  }

  function highlight(text, queryText) {
    var value = String(text == null ? "" : text);
    var ranges = findRanges(value, queryText);
    if (!ranges.length) return escapeHtml(value);
    var html = "";
    var cursor = 0;
    ranges.forEach(function (range) {
      html += escapeHtml(value.slice(cursor, range[0]));
      html += '<mark class="dict-mark">' + escapeHtml(value.slice(range[0], range[1] + 1)) + "</mark>";
      cursor = range[1] + 1;
    });
    html += escapeHtml(value.slice(cursor));
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function render() {
    var items = getResults();
    var fragment = document.createDocumentFragment();

    items.forEach(function (term) {
      fragment.appendChild(buildCard(term));
    });

    grid.innerHTML = "";
    grid.appendChild(fragment);
    grid.setAttribute("aria-busy", "false");

    if (skeleton) skeleton.classList.add("hidden");

    var isEmpty = items.length === 0;
    if (emptyState) emptyState.classList.toggle("hidden", !isEmpty);
    if (grid) grid.classList.toggle("hidden", isEmpty);

    setAdminVisuals();
    updateCount(items.length);
  }

  function buildCard(term) {
    var node = cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = term.id;

    setHtml(node, "term", escapeHtml(term.term));
    if (term.abbr) {
      setHtml(node, "abbr", escapeHtml(term.abbr));
      show(node, "abbr-wrap");
    }

    setHtml(node, "english", highlight(term.english, query));
    setHtml(node, "vietnamese", highlight(term.vietnamese, query));
    setHtml(node, "korean", highlight(term.korean, query));

    setHtml(node, "definition", highlight(term.definition || "—", query));
    if (term.example) {
      setHtml(node, "example", highlight(term.example, query));
    }

    setHtml(node, "category", escapeHtml(term.category));
    setHtml(node, "level", escapeHtml(term.level));
    if (term.liveAdded) show(node, "live-badge");

    var toggle = field(node, "toggle");
    if (toggle) {
      if (!term.definition && !term.example) {
        toggle.remove();
      } else {
        toggle.setAttribute("aria-expanded", "false");
      }
    }

    node.classList.add("dict-card-enter");
    return node;
  }

  function updateCount(shown) {
    if (countEl) countEl.textContent = shown;
    if (totalEl) totalEl.textContent = terms.length;
    if (statCountEl) statCountEl.textContent = terms.length;
    if (queryNote) {
      if (query) {
        queryNote.textContent = '· kết quả cho "' + query + '"';
        queryNote.classList.remove("hidden");
      } else {
        queryNote.classList.add("hidden");
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Live sync — pull the latest glossary from the repository (view only).
   * ------------------------------------------------------------------ */
  function syncFromRepo(silent) {
    var quiet = !!silent;
    var url = rawUrl();
    return window.fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("raw-fetch-" + res.status);
        return res.json();
      })
      .then(function (data) {
        var list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.terms) ? data.terms : null);
        if (!list) throw new Error("unexpected-json");
        serverTerms = list.filter(function (t) { return t && t.english; });
        rebuildTerms();
        render();
        var changed = serverTerms.length !== seedTerms.length ||
          serverTerms.some(function (t) { return !embeddedIds[t.id]; });
        if (!quiet && changed) toast("Đã đồng bộ dữ liệu mới nhất từ repository.", "success");
      })
      .catch(function () {
        if (!quiet) toast("Không thể đồng bộ từ GitHub — đang dùng dữ liệu cũ.", "info");
      });
  }

  /* ------------------------------------------------------------------ *
   * Search input
   * ------------------------------------------------------------------ */
  var debounceTimer = null;
  searchInput.addEventListener("input", function () {
    var value = searchInput.value;
    if (clearBtn) clearBtn.classList.toggle("hidden", !value);
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(function () {
      query = value.trim();
      render();
    }, 300);
  });

  function clearSearch() {
    searchInput.value = "";
    query = "";
    if (clearBtn) clearBtn.classList.add("hidden");
    render();
    searchInput.focus();
  }

  if (clearBtn) clearBtn.addEventListener("click", clearSearch);

  /* ------------------------------------------------------------------ *
   * Category filters + sort
   * ------------------------------------------------------------------ */
  if (filtersRoot) {
    filtersRoot.addEventListener("click", function (event) {
      var btn = event.target.closest(".dict-pill");
      if (!btn) return;
      activeCategory = btn.getAttribute("data-category") || "all";
      Array.prototype.forEach.call(filtersRoot.querySelectorAll(".dict-pill"), function (pill) {
        pill.classList.toggle("is-active", pill === btn);
      });
      render();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      sortMode = sortSelect.value;
      render();
    });
  }

  var emptyReset = document.getElementById("dict-empty-reset");
  if (emptyReset) {
    emptyReset.addEventListener("click", function () {
      activeCategory = "all";
      sortMode = "az";
      query = "";
      searchInput.value = "";
      if (sortSelect) sortSelect.value = "az";
      if (clearBtn) clearBtn.classList.add("hidden");
      if (filtersRoot) {
        Array.prototype.forEach.call(filtersRoot.querySelectorAll(".dict-pill"), function (pill) {
          pill.classList.toggle("is-active", pill.getAttribute("data-category") === "all");
        });
      }
      render();
    });
  }

  /* ------------------------------------------------------------------ *
   * Admin — unlock with a GitHub token (kept in memory only, never stored)
   * ------------------------------------------------------------------ */
  var adminToken = null;
  var isAdmin = false;
  var pendingAdminAction = null;

  var authModal = document.getElementById("dict-auth-modal");
  var authOverlay = document.getElementById("dict-auth-overlay");
  var authPanel = document.getElementById("dict-auth-panel");
  var authForm = document.getElementById("dict-auth-form");
  var authInput = document.getElementById("auth-token");
  var adminToggle = document.getElementById("dict-admin-toggle");
  var adminLabel = document.getElementById("dict-admin-label");
  var adminStateChip = document.getElementById("dict-admin-state");
  var syncBtn = document.getElementById("dict-sync");

  function authHeaders(token) {
    return {
      Authorization: "token " + token,
      Accept: "application/vnd.github+json"
    };
  }

  function verifyToken(token) {
    return window.fetch(config.apiBase + "/repos/" + encodeURIComponent(config.repo), {
      headers: authHeaders(token)
    }).then(function (res) {
      if (res.status === 401) {
        var err401 = new Error("invalid-token");
        err401.status = 401;
        throw err401;
      }
      if (!res.ok) throw new Error("verify-" + res.status);
      return true;
    });
  }

  function openAuthModal(onDone) {
    pendingAdminAction = onDone || null;
    if (!authModal || !authInput) return;
    if (authForm) {
      authForm.reset();
      var errEl = authForm.querySelector('[data-error-for="auth-token"]');
      if (errEl) { errEl.textContent = ""; errEl.classList.remove("is-visible"); }
      if (authInput) authInput.classList.remove("is-invalid");
    }
    showModalShell(authModal, authOverlay, authPanel, authInput);
  }

  function closeAuthModal() {
    hideModalShell(authModal, authOverlay, authPanel);
    pendingAdminAction = null;
  }

  function grantAdmin(token) {
    adminToken = token;
    isAdmin = true;
    setAdminVisuals();
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    toast("🔓 Đã mở quyền quản trị — giờ bạn có thể thêm / sửa / xoá thuật ngữ.", "success");
    var action = pendingAdminAction;
    pendingAdminAction = null;
    if (typeof action === "function") action();
  }

  function logoutAdmin() {
    adminToken = null;
    isAdmin = false;
    pendingAdminAction = null;
    setAdminVisuals();
    toast("🔒 Đã thoát quyền quản trị.", "info");
  }

  function requireAdmin(onGranted) {
    if (isAdmin) {
      if (typeof onGranted === "function") onGranted();
      return;
    }
    openAuthModal(onGranted);
  }

  function setAdminVisuals() {
    Array.prototype.forEach.call(document.querySelectorAll(".admin-only"), function (el) {
      el.classList.toggle("hidden", !isAdmin);
    });
    if (adminStateChip) adminStateChip.classList.toggle("hidden", !isAdmin);
    if (adminLabel) adminLabel.textContent = isAdmin ? "Thoát" : "Quản trị";
    if (adminToggle) {
      adminToggle.title = isAdmin
        ? "Đăng xuất quản trị"
        : "Đăng nhập quản trị để thêm / sửa / xoá thuật ngữ";
      adminToggle.setAttribute("aria-expanded", isAdmin ? "false" : "false");
    }
  }

  function authError(message) {
    var errEl = authForm ? authForm.querySelector('[data-error-for="auth-token"]') : null;
    if (authInput) authInput.classList.add("is-invalid");
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.add("is-visible");
    }
  }

  if (authForm) {
    authForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var token = authInput ? authInput.value.trim() : "";
      if (!token) {
        authError("Vui lòng nhập mật khẩu (token).");
        return;
      }
      var submitBtn = authForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      verifyToken(token)
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
          closeAuthModal();
          grantAdmin(token);
        })
        .catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          if (err.status === 401) {
            authError("Mật khẩu (token) không hợp lệ hoặc đã hết hạn.");
          } else {
            authError("Không xác thực được với GitHub — kiểm tra kết nối và thử lại.");
          }
        });
    });
  }

  if (adminToggle) {
    adminToggle.addEventListener("click", function () {
      if (isAdmin) {
        if (window.confirm("Thoát quyền quản trị?")) logoutAdmin();
      } else {
        openAuthModal(null);
      }
    });
  }

  var authCloseBtn = document.getElementById("dict-auth-close");
  var authCancelBtn = document.getElementById("dict-auth-cancel");
  if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthModal);
  if (authCancelBtn) authCancelBtn.addEventListener("click", closeAuthModal);
  if (authOverlay) authOverlay.addEventListener("click", closeAuthModal);
  var authContent = document.getElementById("dict-auth-content");
  if (authContent) {
    authContent.addEventListener("click", function (event) {
      if (event.target === authContent) closeAuthModal();
    });
  }

  /* ------------------------------------------------------------------ *
   * GitHub API writes — add / edit / delete / import commit the updated
   * glossary to the repository. The token is used in-memory only.
   * ------------------------------------------------------------------ */
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

  function resolveMessage(value) {
    return typeof value === "function" ? value() : value;
  }

  function httpError(label, res) {
    var err = new Error(label + " (" + res.status + ")");
    err.status = res.status;
    return err;
  }

  function handleWriteError(err) {
    if (!err) return;
    if (err.status === 401) {
      logoutAdmin();
      toast("Mật khẩu (token) không hợp lệ — vui lòng đăng nhập lại.", "error");
    } else if (err.status === 403) {
      toast("Token không có quyền ghi (cần quyền contents:write trên repository).", "error");
    } else if (err.status === 404) {
      toast("Không tìm thấy file dữ liệu trên repository.", "error");
    } else {
      toast("Không thể lưu lên GitHub. Kiểm tra kết nối và thử lại (" + err.message + ").", "error");
    }
  }

  function fileApiUrl() {
    return config.apiBase + "/repos/" + encodeURIComponent(config.repo) + "/contents/" + FILE_PATH;
  }

  function applyMutation(mutator, message, successText) {
    var token = adminToken;
    var url = fileApiUrl();
    return window.fetch(url, { headers: authHeaders(token) })
      .then(function (res) {
        if (!res.ok) throw httpError("Không đọc được dữ liệu trên GitHub", res);
        return res.json();
      })
      .then(function (meta) {
        var current = JSON.parse(decodeUTF8(meta.content));
        var next = mutator(current);
        if (next === null) return false; // aborted inside the mutator (already toasted)
        var payload = JSON.stringify({
          message: resolveMessage(message),
          content: encodeUTF8(JSON.stringify(next, null, 2) + "\n"),
          sha: meta.sha,
          branch: config.branch
        });
        return window.fetch(url, {
          method: "PUT",
          headers: authHeaders(token),
          body: payload
        }).then(function (res) {
          if (!res.ok) throw httpError("Không lưu được lên GitHub", res);
          serverTerms = next;
          rebuildTerms();
          render();
          toast(resolveMessage(successText), "success");
          return true;
        });
      })
      .catch(function (err) {
        handleWriteError(err);
        return false;
      });
  }

  /* ------------------------------------------------------------------ *
   * Modal — add / edit term
   * ------------------------------------------------------------------ */
  var fab = document.getElementById("dict-fab");
  var requiredFields = ["english", "vietnamese", "korean"];
  var editingId = null;

  function openModal(mode) {
    lastFocused = document.activeElement;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(function () {
      modalOverlay.classList.add("is-open");
      modalPanel.classList.add("is-open");
    });
    var titleEl = document.getElementById("dict-modal-title");
    var saveBtn = document.getElementById("dict-form-save");
    var subtitle = modal.querySelector("p.text-xs");
    if (mode === "edit") {
      if (titleEl) titleEl.textContent = "Sửa thuật ngữ";
      if (saveBtn) saveBtn.textContent = "💾 Lưu thay đổi";
      if (subtitle) subtitle.textContent = "Thay đổi sẽ được lưu vào từ điển live trên GitHub.";
    } else {
      if (titleEl) titleEl.textContent = "Thêm thuật ngữ mới";
      if (saveBtn) saveBtn.textContent = "💾 Lưu thuật ngữ";
      if (subtitle) subtitle.textContent = "Thay đổi sẽ được lưu vào từ điển live trên GitHub.";
    }
    var firstField = document.getElementById("term-english");
    if (firstField) window.setTimeout(function () { firstField.focus(); }, 60);
  }

  function closeModal() {
    modalOverlay.classList.remove("is-open");
    modalPanel.classList.remove("is-open");
    document.body.style.overflow = "";
    window.setTimeout(function () {
      modal.classList.add("hidden");
      resetForm();
    }, 300);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function resetForm() {
    if (!modalForm) return;
    modalForm.reset();
    editingId = null;
    requiredFields.forEach(function (name) {
      var input = document.getElementById("term-" + name);
      if (!input) return;
      input.classList.remove("is-invalid");
      var err = modalForm.querySelector('[data-error-for="term-' + name + '"]');
      if (err) { err.textContent = ""; err.classList.remove("is-visible"); }
    });
  }

  function validateField(input) {
    if (!input) return true;
    var err = modalForm.querySelector('[data-error-for="' + input.id + '"]');
    var ok = input.value.trim().length > 0;
    input.classList.toggle("is-invalid", !ok);
    if (err) {
      err.textContent = ok ? "" : "Trường này là bắt buộc.";
      err.classList.toggle("is-visible", !ok);
    }
    return ok;
  }

  requiredFields.forEach(function (name) {
    var input = document.getElementById("term-" + name);
    if (!input) return;
    input.addEventListener("blur", function () { validateField(input); });
    input.addEventListener("input", function () {
      if (input.classList.contains("is-invalid")) validateField(input);
    });
  });

  function collectFormData() {
    return {
      english: document.getElementById("term-english").value.trim(),
      vietnamese: document.getElementById("term-vietnamese").value.trim(),
      korean: document.getElementById("term-korean").value.trim(),
      definition: document.getElementById("term-definition").value.trim(),
      example: document.getElementById("term-example").value.trim(),
      category: document.getElementById("term-category").value,
      level: document.getElementById("term-level").value
    };
  }

  if (modalForm) {
    modalForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var valid = true;
      requiredFields.forEach(function (name) {
        if (!validateField(document.getElementById("term-" + name))) valid = false;
      });
      if (!valid) {
        toast("Vui lòng điền đủ các trường bắt buộc (*).", "error");
        return;
      }
      var data = collectFormData();
      var editing = editingId;
      closeModal();
      saveTerm(data, editing);
    });
  }

  function saveTerm(data, editing) {
    if (editing) {
      applyMutation(function (base) {
        var found = false;
        var next = base.map(function (t) {
          if (t.id !== editing) return t;
          found = true;
          return {
            id: t.id,
            english: data.english,
            vietnamese: data.vietnamese,
            korean: data.korean,
            definition: data.definition,
            example: data.example,
            category: data.category,
            level: data.level,
            created_at: t.created_at || todayISO()
          };
        });
        if (!found) toast("Không tìm thấy thuật ngữ cần sửa.", "error");
        return found ? next : null;
      }, "✏️ Cập nhật thuật ngữ: " + data.english, "✅ Đã cập nhật thuật ngữ.");
    } else {
      applyMutation(function (base) {
        var dup = base.some(function (t) {
          return String(t.english).toLowerCase() === data.english.toLowerCase();
        });
        if (dup) {
          toast("Thuật ngữ tiếng Anh này đã tồn tại.", "error");
          return null;
        }
        var next = base.slice();
        next.push({
          id: uniqueId(data.english),
          english: data.english,
          vietnamese: data.vietnamese,
          korean: data.korean,
          definition: data.definition,
          example: data.example,
          category: data.category,
          level: data.level,
          created_at: todayISO()
        });
        return next;
      }, "➕ Thêm thuật ngữ mới: " + data.english, "✅ Đã thêm thuật ngữ mới!");
    }
  }

  if (fab) {
    fab.addEventListener("click", function () {
      requireAdmin(function () { openModal("add"); });
    });
  }

  var modalClose = document.getElementById("dict-modal-close");
  var modalCancel = document.getElementById("dict-form-cancel");
  var modalContent = document.getElementById("dict-modal-content");
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalCancel) modalCancel.addEventListener("click", closeModal);
  if (modalOverlay) modalOverlay.addEventListener("click", closeModal);
  if (modalContent) {
    modalContent.addEventListener("click", function (event) {
      if (event.target === modalContent) closeModal();
    });
  }

  function openEditModal(term) {
    editingId = term.id;
    ["english", "vietnamese", "korean", "definition", "example"].forEach(function (name) {
      var input = document.getElementById("term-" + name);
      if (input) input.value = term[name] || "";
    });
    var category = document.getElementById("term-category");
    if (category) category.value = term.category || "Cơ bản";
    var level = document.getElementById("term-level");
    if (level) level.value = term.level || "Cơ bản";
    openModal("edit");
  }

  function deleteTerm(term) {
    var ok = window.confirm(
      'Xóa thuật ngữ "' + term.english + '"?\nThao tác này sẽ ghi lên từ điển live trên GitHub.'
    );
    if (!ok) return;
    applyMutation(function (base) {
      return base.filter(function (t) { return t.id !== term.id; });
    }, "🗑 Xóa thuật ngữ: " + term.english, "🗑 Đã xóa thuật ngữ.");
  }

  /* Focus trap shared by both modals. */
  function attachFocusTrap(rootEl) {
    if (!rootEl) return;
    rootEl.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusable = Array.prototype.filter.call(
        rootEl.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
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
  attachFocusTrap(modal);
  attachFocusTrap(authModal);

  /* ------------------------------------------------------------------ *
   * Card actions — speak / copy / expand / edit / delete
   * ------------------------------------------------------------------ */
  grid.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-action]");
    if (!btn) return;
    var card = btn.closest("[data-term-card]");
    if (!card) return;
    var term = terms.filter(function (t) { return t.id === card.dataset.id; })[0];
    if (!term) return;

    var action = btn.getAttribute("data-action");

    if (action === "speak") {
      speak(btn.getAttribute("data-lang") === "ko-KR" ? term.korean : term.english, btn.getAttribute("data-lang"));
    } else if (action === "copy") {
      copyText(term.english);
    } else if (action === "toggle-def") {
      toggleDefinition(card, btn);
    } else if (action === "edit") {
      requireAdmin(function () { openEditModal(term); });
    } else if (action === "delete") {
      requireAdmin(function () { deleteTerm(term); });
    }
  });

  function toggleDefinition(card, btn) {
    var defWrap = field(card, "definition-wrap");
    var exampleWrap = field(card, "example-wrap");
    var expanded = btn.getAttribute("aria-expanded") === "true";
    if (expanded) {
      if (defWrap) defWrap.classList.add("line-clamp-3");
      if (exampleWrap) exampleWrap.classList.add("hidden");
      btn.textContent = "Xem thêm";
      btn.setAttribute("aria-expanded", "false");
    } else {
      if (defWrap) defWrap.classList.remove("line-clamp-3");
      if (exampleWrap) exampleWrap.classList.remove("hidden");
      btn.textContent = "Thu gọn";
      btn.setAttribute("aria-expanded", "true");
    }
  }

  function speak(text, lang) {
    if (!text || !("speechSynthesis" in window)) {
      toast("Trình duyệt không hỗ trợ phát âm.", "info");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang || "en-US";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      /* Silently ignore — speech is a progressive enhancement. */
    }
  }

  function copyText(text) {
    var done = function () { toast("Đã sao chép: " + text, "success"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
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
   * Export (public) / Import (admin only)
   * ------------------------------------------------------------------ */
  var exportBtn = document.getElementById("dict-export");
  var importBtn = document.getElementById("dict-import");
  var importFile = document.getElementById("dict-import-file");

  function cleanForExport(term) {
    return {
      id: term.id,
      english: term.english,
      vietnamese: term.vietnamese,
      korean: term.korean,
      definition: term.definition,
      example: term.example,
      category: term.category,
      level: term.level,
      created_at: term.created_at
    };
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      var all = workingBase().filter(function (t) { return t && t.english; }).map(cleanForExport);
      var blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "cargo_dictionary_" + todayISO() + ".json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast("Đã xuất " + all.length + " thuật ngữ ra tệp JSON.", "success");
    });
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", function () {
      requireAdmin(function () { importFile.click(); });
    });
    importFile.addEventListener("change", function () {
      var file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var data;
        try {
          data = JSON.parse(reader.result);
          if (!Array.isArray(data)) throw new Error("not-an-array");
        } catch (err) {
          toast("Tệp JSON không hợp lệ.", "error");
          return;
        }
        var addedCount = 0;
        applyMutation(function (base) {
          var added = 0;
          var next = base.slice();
          data.forEach(function (raw) {
            if (!raw || !raw.english) return;
            var exists = next.some(function (t) {
              return String(t.english).toLowerCase() === String(raw.english).toLowerCase();
            });
            if (exists) return;
            next.push({
              id: raw.id || uniqueId(raw.english),
              english: String(raw.english),
              vietnamese: String(raw.vietnamese || ""),
              korean: String(raw.korean || ""),
              definition: String(raw.definition || ""),
              example: String(raw.example || ""),
              category: String(raw.category || "Cơ bản"),
              level: String(raw.level || "Cơ bản"),
              created_at: String(raw.created_at || todayISO())
            });
            added += 1;
          });
          addedCount = added;
          if (!added) toast("Không có thuật ngữ mới để nhập.", "info");
          return added ? next : null;
        }, function () { return "📥 Nhập " + addedCount + " thuật ngữ từ tệp JSON"; },
        function () { return "✅ Đã nhập " + addedCount + " thuật ngữ mới."; });
      };
      reader.readAsText(file);
    });
  }

  /* ------------------------------------------------------------------ *
   * Toasts
   * ------------------------------------------------------------------ */
  function toast(message, type) {
    if (!toastRoot) return;
    var el = document.createElement("div");
    el.className = "dict-toast";
    var icon = type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✅";
    el.innerHTML = '<span aria-hidden="true">' + icon + '</span><span>' + escapeHtml(message) + "</span>";
    toastRoot.appendChild(el);
    window.setTimeout(function () {
      el.classList.add("is-leaving");
      window.setTimeout(function () { el.remove(); }, 240);
    }, 3200);
  }

  /* ------------------------------------------------------------------ *
   * Keyboard shortcuts: "/" focus search, "Esc" close modals / clear
   * ------------------------------------------------------------------ */
  document.addEventListener("keydown", function (event) {
    var tag = (event.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || tag === "select" || event.target.isContentEditable;
    var addOpen = !modal.classList.contains("hidden");
    var authOpen = authModal ? !authModal.classList.contains("hidden") : false;

    if (event.key === "/" && !typing && !addOpen && !authOpen) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key === "Escape") {
      if (authOpen) {
        closeAuthModal();
      } else if (addOpen) {
        closeModal();
      } else if (searchInput.value) {
        clearSearch();
      }
    }
  });

  /* ------------------------------------------------------------------ *
   * Init — render embedded seed immediately, then pull live data.
   * ------------------------------------------------------------------ */
  if (syncBtn) {
    syncBtn.addEventListener("click", function () {
      var original = syncBtn.innerHTML;
      syncBtn.disabled = true;
      syncBtn.innerHTML = "Đang đồng bộ…";
      syncFromRepo(false).then(function () {
        syncBtn.disabled = false;
        syncBtn.innerHTML = original;
      });
    });
  }

  rebuildTerms();
  render();
  syncFromRepo(true);
})();