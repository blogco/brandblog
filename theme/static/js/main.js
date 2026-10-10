/* BrandBlog — lightweight interactions (no dependencies). */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Mobile navigation drawer
   * ------------------------------------------------------------------ */
  var toggle = document.getElementById("menu-toggle");
  var menu = document.getElementById("mobile-menu");
  var iconOpen = document.getElementById("menu-icon-open");
  var iconClose = document.getElementById("menu-icon-close");

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      menu.classList.toggle("hidden", expanded);
      if (iconOpen && iconClose) {
        iconOpen.classList.toggle("hidden", !expanded);
        iconClose.classList.toggle("hidden", expanded);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Article filtering (two independent groups combined with AND)
   * ------------------------------------------------------------------ */
  var root = document.querySelector("[data-filter-root]");
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-article-card]"));
  var countEl = document.getElementById("result-count");
  var noResults = document.getElementById("no-results");
  var groupEls = root ? Array.prototype.slice.call(root.querySelectorAll("[data-filter-group]")) : [];
  var active = {};

  function groupValueOf(card, group) {
    if (group === "type") return (card.getAttribute("data-category") || "").toLowerCase();
    if (group === "topic") return (card.getAttribute("data-tags") || "").toLowerCase();
    return "";
  }

  function cardMatches(card) {
    return Object.keys(active).every(function (group) {
      var value = active[group];
      if (!value || value === "all") return true;
      var haystack = groupValueOf(card, group);
      if (group === "topic") {
        return haystack.split(/\s+/).indexOf(value) !== -1;
      }
      return haystack === value;
    });
  }

  function applyFilters() {
    var visible = 0;
    cards.forEach(function (card) {
      var show = cardMatches(card);
      card.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });
    if (countEl) countEl.textContent = String(visible);
    if (noResults) noResults.classList.toggle("hidden", visible !== 0);
  }

  function setActive(group, value) {
    active[group] = value;
    var groupEl = groupEls.filter(function (el) {
      return el.getAttribute("data-filter-group") === group;
    })[0];
    if (!groupEl) return;
    Array.prototype.forEach.call(groupEl.querySelectorAll(".filter-btn"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-filter-value") === value);
    });
  }

  groupEls.forEach(function (groupEl) {
    var group = groupEl.getAttribute("data-filter-group");
    active[group] = "all";
    groupEl.addEventListener("click", function (event) {
      var btn = event.target.closest(".filter-btn");
      if (!btn) return;
      setActive(group, btn.getAttribute("data-filter-value"));
      applyFilters();
    });
  });

  /* Sidebar topic shortcuts drive the topic filter group. */
  var sidebarTopics = Array.prototype.slice.call(document.querySelectorAll("[data-sidebar-topic]"));
  sidebarTopics.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setActive("topic", btn.getAttribute("data-sidebar-topic"));
      applyFilters();
      if (root) root.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (cards.length) applyFilters();

  /* ------------------------------------------------------------------ *
   * Branding: copy colour hex to clipboard
   * ------------------------------------------------------------------ */
  var swatches = Array.prototype.slice.call(document.querySelectorAll(".brand-swatch"));
  swatches.forEach(function (swatch) {
    swatch.addEventListener("click", function () {
      var hex = swatch.getAttribute("data-hex");
      if (!hex) return;
      var done = function () {
        swatch.setAttribute("data-copied", "true");
        setTimeout(function () {
          swatch.removeAttribute("data-copied");
        }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hex).then(done).catch(function () {});
      } else {
        var input = document.createElement("input");
        input.value = hex;
        document.body.appendChild(input);
        input.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(input);
        done();
      }
    });
  });

  /* ------------------------------------------------------------------ *
   * Smooth in-page anchors offset for the sticky header
   * ------------------------------------------------------------------ */
  document.addEventListener("click", function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute("href").slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    var top = target.getBoundingClientRect().top + window.pageYOffset - 96;
    window.scrollTo({ top: top, behavior: "smooth" });
  });
})();
