/* BrandBlog — Cargo Dictionary (Anh–Việt–Hàn)
 * Instant fuzzy search (Fuse.js), category filters, add-term modal with
 * localStorage persistence, JSON import/export and Web Speech pronunciation.
 * No backend — everything runs in the browser.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "cargo_dictionary_custom_terms";
  var LEVEL_RANK = { "Cơ bản": 0, "Trung bình": 1, "Nâng cao": 2 };

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
   * State
   * ------------------------------------------------------------------ */
  var seedTerms = readSeed();
  var customTerms = readCustom();
  var terms = [];
  var fuse = null;
  var activeCategory = "all";
  var query = "";
  var sortMode = "az";

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

  function readCustom() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (t) { return t && t.english; }).map(function (t) {
        t.custom = true;
        return t;
      });
    } catch (err) {
      return [];
    }
  }

  function saveCustom() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customTerms));
    } catch (err) {
      toast("Không thể lưu vào bộ nhớ trình duyệt.", "error");
    }
  }

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
      custom: !!raw.custom,
      term: parsed.term,
      abbr: parsed.abbr,
      search_vi: stripDiacritics((raw.english || "") + " " + (raw.vietnamese || ""))
    };
  }

  function rebuildTerms() {
    var seedPrepared = seedTerms.map(function (raw) {
      var copy = extend({}, raw);
      copy.custom = false;
      return prepare(copy);
    });
    var customPrepared = customTerms.map(function (raw) {
      var copy = extend({}, raw);
      copy.custom = true;
      return prepare(copy);
    });
    terms = seedPrepared.concat(customPrepared);
    buildFuse();
  }

  function extend(target, source) {
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
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
   * Fuse handles fuzzy recall; highlighting stays clean and precise.
   * Normalisation preserves code-unit length (1 char → 1 char), so indices
   * found in the normalised string map straight back to the original.
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
    if (term.custom) show(node, "custom-badge");

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
   * Card actions (speak / copy / expand) — event delegation
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
   * Modal — add new term
   * ------------------------------------------------------------------ */
  var fab = document.getElementById("dict-fab");
  var requiredFields = ["english", "vietnamese", "korean"];

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(function () {
      modalOverlay.classList.add("is-open");
      modalPanel.classList.add("is-open");
    });
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
      addTerm({
        english: document.getElementById("term-english").value.trim(),
        vietnamese: document.getElementById("term-vietnamese").value.trim(),
        korean: document.getElementById("term-korean").value.trim(),
        definition: document.getElementById("term-definition").value.trim(),
        example: document.getElementById("term-example").value.trim(),
        category: document.getElementById("term-category").value,
        level: document.getElementById("term-level").value
      });
    });
  }

  function addTerm(data) {
    customTerms.push({
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
    saveCustom();
    rebuildTerms();
    render();
    closeModal();
    toast("✅ Đã thêm thuật ngữ mới!", "success");
  }

  if (fab) fab.addEventListener("click", openModal);
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

  /* Focus trap inside the modal. */
  if (modal) {
    modal.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusable = Array.prototype.filter.call(
        modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
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

  /* ------------------------------------------------------------------ *
   * Export / Import
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
      var all = seedTerms.concat(customTerms).map(cleanForExport);
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
    importBtn.addEventListener("click", function () { importFile.click(); });
    importFile.addEventListener("change", function () {
      var file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var added = 0;
        try {
          var data = JSON.parse(reader.result);
          if (!Array.isArray(data)) throw new Error("not-an-array");
          data.forEach(function (raw) {
            if (!raw || !raw.english) return;
            var exists = terms.some(function (t) {
              return t.english.toLowerCase() === String(raw.english).toLowerCase();
            });
            if (exists) return;
            customTerms.push({
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
        } catch (err) {
          toast("Tệp JSON không hợp lệ.", "error");
          return;
        }
        if (added) {
          saveCustom();
          rebuildTerms();
          render();
          toast("Đã nhập " + added + " thuật ngữ mới.", "success");
        } else {
          toast("Không có thuật ngữ mới để nhập.", "info");
        }
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
   * Keyboard shortcuts: "/" focus search, "Esc" clear/close
   * ------------------------------------------------------------------ */
  document.addEventListener("keydown", function (event) {
    var tag = (event.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || tag === "select" || event.target.isContentEditable;
    var modalOpen = !modal.classList.contains("hidden");

    if (event.key === "/" && !typing && !modalOpen) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key === "Escape") {
      if (modalOpen) {
        closeModal();
      } else if (searchInput.value) {
        clearSearch();
      }
    }
  });

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  rebuildTerms();
  render();
})();
