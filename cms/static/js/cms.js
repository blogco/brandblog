/* BrandBlog CMS — front-end logic (Alpine.js + EasyMDE).
   Served by FastAPI at /static/js/cms.js. */
(function () {
  "use strict";

  const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || "";

  // ------------------------------------------------------------------ //
  // Shared helpers
  // ------------------------------------------------------------------ //
  const CMS = {
    csrf,
    async api(url, options = {}) {
      const opts = { method: options.method || "GET", headers: { Accept: "application/json", "X-CSRF-Token": csrf } };
      if (options.form) {
        opts.body = options.form;
      } else if (options.body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(options.body);
      }
      const res = await fetch(url, opts);
      let data = null;
      try { data = await res.json(); } catch (e) { /* no body */ }
      if (!res.ok) {
        let msg = (data && (data.error || data.detail)) || res.statusText;
        if (msg && typeof msg === "object") msg = msg.message || JSON.stringify(msg);
        const err = new Error(msg || "Request failed");
        err.data = data;
        err.status = res.status;
        throw err;
      }
      return data;
    },
    toast(message, type = "success", timeout = 4000) {
      window.dispatchEvent(new CustomEvent("cms-toast", { detail: { message, type, timeout } }));
    },
    async uploadFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return [];
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await CMS.api("/api/media/upload", { method: "POST", form });
      if (res.errors && res.errors.length) CMS.toast(res.errors.join("; "), "warn", 6000);
      return res.saved || [];
    },
    async deletePost(slug) {
      if (!confirm("Delete this post? It will be moved to .trash/, not permanently removed.")) return;
      try {
        await CMS.api("/api/posts/" + encodeURIComponent(slug), { method: "DELETE" });
        CMS.toast("Post moved to trash");
        setTimeout(() => window.location.reload(), 500);
      } catch (e) { CMS.toast(e.message, "error"); }
    },
    async publishAll(btn) {
      const original = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Publishing...'; }
      try {
        const res = await CMS.api("/api/git/publish", { method: "POST", body: { message: "Update from BrandBlog CMS" } });
        CMS.toast("Published (" + (res.commit || "") + "). Live in ~1 min.");
      } catch (e) {
        CMS.toast("Publish failed: " + e.message, "error", 7000);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
      }
    },
  };
  window.CMS = CMS;

  // ------------------------------------------------------------------ //
  // 1. App shell (sidebar + logout)
  // ------------------------------------------------------------------ //
  document.addEventListener("alpine:init", () => {
    const Alpine = window.Alpine;

    Alpine.data("appShell", () => ({
      sidebarOpen: false,
      async logout() {
        try { await CMS.api("/api/logout", { method: "POST" }); } catch (e) { /* ignore */ }
        window.location.href = "/login";
      },
    }));

    // ---- Toasts ----
    Alpine.data("toastCenter", () => ({
      toasts: [],
      push(detail) {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, message: detail.message, type: detail.type || "success" });
        const ttl = detail.timeout === undefined ? 4000 : detail.timeout;
        if (ttl > 0) setTimeout(() => this.dismiss(id), ttl);
      },
      dismiss(id) { this.toasts = this.toasts.filter((t) => t.id !== id); },
    }));

    // ---- Login ----
    Alpine.data("loginForm", () => ({
      username: "admin",
      password: "",
      show: false,
      loading: false,
      error: "",
      async submit() {
        this.loading = true;
        this.error = "";
        try {
          await CMS.api("/api/login", { method: "POST", body: { username: this.username, password: this.password } });
          window.location.href = "/";
        } catch (e) {
          this.error = e.message;
        } finally {
          this.loading = false;
        }
      },
    }));

    // ---- Post list ----
    Alpine.data("postList", () => ({
      posts: window.__POSTS__ || [],
      q: "",
      status: "all",
      category: "",
      sort: "newest",
      tabs: [
        { value: "all", label: "All" },
        { value: "published", label: "Published" },
        { value: "draft", label: "Drafts" },
      ],
      get filtered() {
        const q = this.q.trim().toLowerCase();
        let list = this.posts.filter((p) => {
          if (this.status !== "all" && p.status !== this.status) return false;
          if (this.category && p.category !== this.category) return false;
          if (q) {
            const hay = (p.title + " " + (p.summary || "") + " " + (p.tags || []).join(" ")).toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        if (this.sort === "oldest") list.sort((a, b) => (a.date > b.date ? 1 : -1));
        else if (this.sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
        else list.sort((a, b) => (a.date < b.date ? 1 : -1));
        return list;
      },
      async remove(post) {
        if (!confirm("Delete \u201c" + post.title + "\u201d?")) return;
        try {
          await CMS.api("/api/posts/" + encodeURIComponent(post.slug), { method: "DELETE" });
          this.posts = this.posts.filter((p) => p.slug !== post.slug);
          CMS.toast("Post moved to trash");
        } catch (e) { CMS.toast(e.message, "error"); }
      },
      async duplicate(post) {
        try {
          const res = await CMS.api("/api/posts/" + encodeURIComponent(post.slug) + "/duplicate", { method: "POST" });
          CMS.toast("Duplicated as draft");
          setTimeout(() => (window.location.href = "/posts/" + res.post.slug + "/edit"), 500);
        } catch (e) { CMS.toast(e.message, "error"); }
      },
    }));

    // ---- Editor ----
    Alpine.data("editorPage", () => ({
      post: Object.assign({ tags: [], status: "draft", is_new: true }, window.__POST__ || {}),
      media: window.__MEDIA__ || [],
      easymde: null,
      words: 0,
      readingTime: 1,
      dirty: false,
      saving: false,
      publishing: false,
      publishError: false,
      showMedia: false,
      autosaveTimer: null,
      slugTouched: false,

      init() {
        const self = this;
        this.easymde = new EasyMDE({
          element: this.$refs.content,
          spellChecker: false,
          status: false,
          autoDownloadFontAwesome: false,
          minHeight: "420px",
          placeholder: "Write your article in Markdown…",
          toolbar: [
            "bold", "italic", "heading", "|",
            "quote", "unordered-list", "ordered-list", "|",
            "link", "image", "code", "table", "|",
            "preview", "side-by-side", "fullscreen", "|", "guide",
          ],
          uploadImage: true,
          imageUploadFunction(file, onSuccess, onError) {
            CMS.uploadFiles([file]).then((saved) => {
              if (saved && saved[0]) onSuccess(saved[0].url);
              else onError("Upload failed");
            }).catch((e) => onError(e.message));
          },
        });
        this.easymde.value(this.post.content || "");
        this.easymde.codemirror.on("change", () => {
          this.dirty = true;
          this.recount();
        });
        this.recount();

        if (window.__AUTOSAVE__) {
          this.autosaveTimer = setInterval(() => {
            if (this.dirty && !this.saving && !this.publishing) this.save(true);
          }, Math.max(5, window.__AUTOSAVE_INTERVAL__ || 30) * 1000);
        }

        window.addEventListener("beforeunload", (e) => {
          if (this.dirty) { e.preventDefault(); e.returnValue = ""; }
        });
        window.addEventListener("keydown", (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            this.save();
          }
        });
      },

      recount() {
        const text = this.easymde ? this.easymde.value() : (this.post.content || "");
        const words = (text.match(/\b[\w'-]+\b/g) || []).length;
        this.words = words;
        this.readingTime = Math.max(1, Math.round(words / 200));
      },

      maybeSlug() {
        if (this.post.is_new && !this.slugTouched && !this.post.slug) {
          this.post.slug = (this.post.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
        }
      },

      addTag(tag) {
        tag = (tag || "").trim();
        if (tag && !this.post.tags.includes(tag)) { this.post.tags.push(tag); this.dirty = true; }
      },
      removeTag(tag) {
        this.post.tags = this.post.tags.filter((t) => t !== tag);
        this.dirty = true;
      },

      imagePreview() {
        const img = (this.post.image || "").trim();
        if (!img) return "";
        if (/^https?:\/\//.test(img) || img.startsWith("/")) return img;
        if (img.includes("/")) {
          const name = img.split("/").pop();
          const found = this.media.find((m) => m.name === name);
          return found ? found.preview : "/media/file/uploads/" + name;
        }
        const found = this.media.find((m) => m.name === img);
        return found ? found.preview : "/media/file/theme/" + img;
      },

      payload() {
        const p = Object.assign({}, this.post);
        p.content = this.easymde ? this.easymde.value() : this.post.content;
        p.original_slug = this.post.is_new ? "" : (window.__POST__ && window.__POST__.slug) || this.post.slug;
        return p;
      },

      async save(silent, force) {
        if (this.saving || (this.publishing && !force)) return false;
        if (!this.post.title.trim()) {
          if (!silent) CMS.toast("Title is required", "error");
          return false;
        }
        this.saving = true;
        try {
          const res = await CMS.api("/api/posts", { method: "POST", body: this.payload() });
          const wasNew = this.post.is_new;
          this.post = Object.assign({}, res.post, { tags: res.post.tags || [], is_new: false });
          if (this.easymde) this.easymde.value(this.post.content || "");
          this.dirty = false;
          window.__POST__ = this.post;
          if (wasNew || window.location.pathname !== "/posts/" + this.post.slug + "/edit") {
            window.history.replaceState({}, "", "/posts/" + this.post.slug + "/edit");
          }
          if (!silent) CMS.toast("Saved", "success", 2000);
          return true;
        } catch (e) {
          CMS.toast(e.message, "error");
          return false;
        } finally {
          this.saving = false;
        }
      },

      async publish() {
        if (this.publishing) return;
        this.publishing = true;
        this.publishError = false;
        try {
          const ok = await this.save(true, true);
          if (!ok) throw new Error("Could not save before publishing");
          const res = await CMS.api("/api/posts/" + encodeURIComponent(this.post.slug) + "/publish", { method: "POST" });
          this.post.status = "published";
          this.dirty = false;
          CMS.toast("Published (" + (res.commit || "") + ")! Live in ~1 min.");
        } catch (e) {
          this.publishError = true;
          CMS.toast("Publish failed: " + e.message, "error", 8000);
        } finally {
          this.publishing = false;
        }
      },

      pick(item) {
        this.post.image = item.value;
        this.dirty = true;
        this.showMedia = false;
      },
      insertMarkdown(item) {
        if (this.easymde) this.easymde.value(this.easymde.value() + "\n![" + item.name + "](" + item.url + ")\n");
        this.showMedia = false;
      },
      async uploadFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return [];
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        try {
          const res = await CMS.api("/api/media/upload", { method: "POST", form });
          if (res.saved && res.saved.length) {
            const items = res.saved.map((s) => ({ name: s.name, source: "uploads", url: s.url, preview: "/media/file/uploads/" + s.name, value: "images/" + s.name }));
            this.media = items.concat(this.media);
            CMS.toast("Uploaded " + res.saved.length + " file(s)");
          }
          if (res.errors && res.errors.length) CMS.toast(res.errors.join("; "), "warn", 6000);
          return res.saved || [];
        } catch (e) {
          CMS.toast(e.message, "error");
          return [];
        }
      },
      uploadDrop(event) {
        const files = event.dataTransfer ? event.dataTransfer.files : null;
        if (files && files.length) this.uploadFiles(files);
      },
    }));

    // ---- Media library ----
    Alpine.data("mediaLibrary", () => ({
      uploading: false,
      progress: 0,
      dragging: false,
      async uploadFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        this.uploading = true;
        this.progress = 10;
        const tick = setInterval(() => { this.progress = Math.min(90, this.progress + 12); }, 250);
        try {
          const res = await CMS.api("/api/media/upload", { method: "POST", form });
          this.progress = 100;
          if (res.saved && res.saved.length) CMS.toast("Uploaded " + res.saved.length + " file(s)");
          if (res.errors && res.errors.length) CMS.toast(res.errors.join("; "), "warn", 6000);
          setTimeout(() => window.location.reload(), 600);
        } catch (e) {
          CMS.toast(e.message, "error");
        } finally {
          clearInterval(tick);
          setTimeout(() => { this.uploading = false; this.progress = 0; }, 800);
        }
      },
      async remove(source, name) {
        if (!confirm("Delete " + name + "?")) return;
        try {
          await CMS.api("/api/media?source=" + encodeURIComponent(source) + "&name=" + encodeURIComponent(name), { method: "DELETE" });
          CMS.toast("File moved to trash");
          setTimeout(() => window.location.reload(), 400);
        } catch (e) {
          if (e.status === 409 && e.data && e.data.usages) {
            const list = e.data.usages.map((u) => u.title).join(", ");
            if (confirm("This image is used in: " + list + ".\n\nDelete anyway?")) {
              try {
                await CMS.api("/api/media?source=" + encodeURIComponent(source) + "&name=" + encodeURIComponent(name) + "&force=true", { method: "DELETE" });
                setTimeout(() => window.location.reload(), 400);
              } catch (e2) { CMS.toast(e2.message, "error"); }
            }
          } else {
            CMS.toast(e.message, "error");
          }
        }
      },
      copy(url) {
        navigator.clipboard.writeText(url).then(
          () => CMS.toast("Copied: " + url),
          () => CMS.toast("Copy failed", "error")
        );
      },
    }));

    // ---- Settings ----
    Alpine.data("settingsPage", () => ({
      cfg: Object.assign({}, window.__CFG__ || {}),
      token: "",
      showToken: false,
      hasToken: window.__HAS_TOKEN__ || false,
      tokenSource: window.__TOKEN_SOURCE__ || "none",
      saving: false,
      testing: false,
      changing: false,
      pwd: { current: "", new: "" },
      async save() {
        this.saving = true;
        try {
          if (this.token.trim()) {
            const tok = await CMS.api("/api/settings/token", { method: "POST", body: { token: this.token.trim() } });
            this.hasToken = tok.has_token;
            this.tokenSource = tok.source;
            this.token = "";
          }
          await CMS.api("/api/settings", { method: "POST", body: this.cfg });
          CMS.toast("Settings saved");
        } catch (e) { CMS.toast(e.message, "error"); }
        finally { this.saving = false; }
      },
      async testGithub() {
        this.testing = true;
        try {
          const res = await CMS.api("/api/settings/test-github", { method: "POST" });
          CMS.toast("Connected to " + res.remote + " (" + res.branch + ")");
        } catch (e) { CMS.toast("Connection failed: " + e.message, "error", 8000); }
        finally { this.testing = false; }
      },
      async testPelican() {
        try {
          const res = await CMS.api("/api/settings/test-pelican", { method: "POST" });
          CMS.toast(res.version);
        } catch (e) { CMS.toast(e.message, "error"); }
      },
      async changePassword() {
        if (this.pwd.new.length < 4) { CMS.toast("New password is too short", "error"); return; }
        this.changing = true;
        try {
          await CMS.api("/api/password", { method: "POST", body: this.pwd });
          this.pwd = { current: "", new: "" };
          CMS.toast("Password changed");
        } catch (e) { CMS.toast("Failed: " + e.message, "error"); }
        finally { this.changing = false; }
      },
    }));
  });
})();
