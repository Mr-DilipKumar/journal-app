/**
 * Day One-Inspired Journal Application Logic
 * Supports: Timeline, On This Day, Calendar, Insights & Moods, Photo Wall, Themes & PIN Lock
 */

const App = {
  entries: [],
  filter: { journal: "all", view: "timeline", query: "" },
  pin: localStorage.getItem("journal_pin") || null,
  isLocked: false,

  async init() {
    this.entries = await DB.getAll();
    if (!this.entries.length) await this.seed();
    this.entries = await DB.getAll();

    this.bind();
    this.applyTheme();
    this.updateStreak();
    this.render();
  },

  async seed() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 864e5 * 3).toISOString().slice(0, 10);

    await DB.put({
      id: "welcome_1",
      title: "Morning light through the window",
      content: "<h2>A quiet start to the day</h2><p>I woke up earlier than usual today. The whole house was still, and the pale morning light came softly through the curtains.</p><blockquote>Small moments of silence are where we find our grounding.</blockquote><p>Made a slow pour-over coffee, sat by the terrace, and watched the city gently wake up. Grateful for simple mornings without hurry.</p>",
      date: today,
      journal: "Personal",
      favorite: true,
      mood: { emoji: "🌿", label: "Grateful" },
      weather: { emoji: "☀️", text: "21°C · Crisp & Sunny" },
      location: "San Francisco, CA",
      photos: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"],
      tags: ["morning", "coffee", "peace"],
      createdAt: Date.now() - 3600e3,
      updatedAt: Date.now() - 3600e3
    });

    await DB.put({
      id: "welcome_2",
      title: "Ideas for the new creative season",
      content: "<p>Sketched out a few thoughts during an afternoon walk around the botanic garden:</p><p class=\"todo-item\"><input type=\"checkbox\" checked> <span>Finish drafting the design system chapter</span></p><p class=\"todo-item\"><input type=\"checkbox\"> <span>Record voice reflection on creative habits</span></p><p class=\"todo-item\"><input type=\"checkbox\"> <span>Order new stationery sketchbook</span></p><p>Energy was high and thoughts were clear. Keep moving with ease.</p>",
      date: yesterday,
      journal: "Ideas",
      favorite: false,
      mood: { emoji: "⚡", label: "Energized" },
      weather: { emoji: "🌤", text: "19°C · Partly Cloudy" },
      location: "Golden Gate Park",
      photos: ["https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop&q=80"],
      tags: ["creative", "focus"],
      createdAt: Date.now() - 864e5,
      updatedAt: Date.now() - 864e5
    });

    await DB.put({
      id: "welcome_3",
      title: "Reflections on gratitude & perspective",
      content: "<p>A meaningful conversation with an old friend reminded me how much changes in a year without us noticing. Taking time to document the little milestones.</p>",
      date: threeDaysAgo,
      journal: "Gratitude",
      favorite: true,
      mood: { emoji: "😌", label: "Calm" },
      weather: { emoji: "🌙", text: "16°C · Clear Night" },
      location: "Home",
      photos: [],
      tags: ["friendship", "growth"],
      createdAt: Date.now() - 864e5 * 3,
      updatedAt: Date.now() - 864e5 * 3
    });
  },

  bind() {
    // New entry
    document.getElementById("newEntryBtn").onclick = () => Editor.open();

    // Search
    document.getElementById("searchInput").oninput = (e) => {
      this.filter.query = e.target.value.toLowerCase();
      this.render();
    };

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("searchInput").focus();
      }
      if (e.key.toLowerCase() === "n" && document.activeElement.tagName !== "INPUT" && document.activeElement.contentEditable !== "true") {
        Editor.open();
      }
      if (e.key === "Escape") {
        Editor.close();
        this.closeLightbox();
        this.closeThemeModal();
      }
    });

    // Sidebar journal filters
    document.querySelectorAll(".nav-item[data-journal]").forEach(b => {
      b.onclick = () => {
        this.filter = { journal: b.dataset.journal, view: "timeline", query: this.filter.query };
        this.renderNav();
        this.render();
      };
    });

    // Sidebar view filters
    document.querySelectorAll(".nav-item[data-view]").forEach(b => {
      b.onclick = () => {
        this.filter = { journal: "all", view: b.dataset.view, query: this.filter.query };
        this.renderNav();
        this.render();
      };
    });

    // Today reset
    document.getElementById("todayBtn").onclick = () => {
      this.filter = { journal: "all", view: "timeline", query: "" };
      document.getElementById("searchInput").value = "";
      this.renderNav();
      this.render();
    };

    // Mobile menu toggle
    document.getElementById("menuBtn").onclick = () => {
      document.getElementById("sidebar").classList.toggle("open");
    };

    // Theme selector modal triggers
    const themeBtn = document.getElementById("themeBtn");
    const themeTopBtn = document.getElementById("themeTopBtn");
    if (themeBtn) themeBtn.onclick = () => this.openThemeModal();
    if (themeTopBtn) themeTopBtn.onclick = () => this.cycleTheme();

    document.getElementById("closeThemeModal").onclick = () => this.closeThemeModal();
    document.querySelectorAll(".theme-card").forEach(c => {
      c.onclick = () => {
        this.setTheme(c.dataset.theme);
        this.closeThemeModal();
      };
    });

    // Lightbox close
    document.getElementById("closeLightbox").onclick = () => this.closeLightbox();
    document.getElementById("lightboxOverlay").onclick = (e) => {
      if (e.target === document.getElementById("lightboxOverlay")) this.closeLightbox();
    };

    // Privacy PIN lock
    const lockBtn = document.getElementById("lockBtn");
    if (lockBtn) lockBtn.onclick = () => this.triggerPinLock();
    this.bindPinKeypad();

    // Export & Print
    document.getElementById("exportBtn").onclick = () => this.export();
  },

  async refresh() {
    this.entries = await DB.getAll();
    this.updateStreak();
    this.render();
  },

  updateStreak() {
    if (!this.entries.length) {
      document.getElementById("streakCount").textContent = "0";
      return;
    }

    const dates = [...new Set(this.entries.map(e => e.date))].sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

    let streak = 0;
    let expected = dates.includes(today) ? today : (dates.includes(yesterday) ? yesterday : null);

    if (expected) {
      for (const d of dates) {
        if (d === expected) {
          streak++;
          const prev = new Date(new Date(expected).getTime() - 864e5).toISOString().slice(0, 10);
          expected = prev;
        }
      }
    }

    const streakEl = document.getElementById("streakCount");
    if (streakEl) streakEl.textContent = Math.max(1, streak);
  },

  filtered() {
    return this.entries.filter(e => {
      const j = this.filter.journal === "all" || e.journal === this.filter.journal;
      const v = this.filter.view === "timeline" ||
                (this.filter.view === "favorites" && e.favorite) ||
                (this.filter.view === "photos" && e.photos?.length);
      const q = !this.filter.query || [
        e.title,
        e.content,
        e.journal,
        e.location || "",
        e.mood?.label || "",
        (e.tags || []).join(" ")
      ].join(" ").toLowerCase().includes(this.filter.query);

      return j && v && q;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  },

  renderNav() {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const sel = this.filter.view !== "timeline"
      ? `[data-view="${this.filter.view}"]`
      : `[data-journal="${this.filter.journal}"]`;
    document.querySelector(sel)?.classList.add("active");
  },

  render() {
    const entries = this.filtered();
    document.getElementById("allCount").textContent = this.entries.length;

    // Header title and eyebrow
    const title = this.filter.view === "onthisday" ? "On this day"
      : this.filter.view === "calendar" ? "Calendar"
      : this.filter.view === "insights" ? "Insights & Moods"
      : this.filter.view === "favorites" ? "Favorites"
      : this.filter.view === "photos" ? "Photo Gallery"
      : this.filter.journal === "all" ? "All entries"
      : this.filter.journal;

    document.getElementById("viewTitle").textContent = title;
    document.getElementById("viewEyebrow").textContent = this.filter.view !== "timeline" ? "COLLECTION" : "YOUR JOURNAL";

    const view = document.getElementById("appView");

    // Route views
    if (this.filter.view === "onthisday") {
      view.innerHTML = this.renderOnThisDay();
      this.bindCards(view);
      return;
    }
    if (this.filter.view === "calendar") {
      view.innerHTML = this.calendar();
      return;
    }
    if (this.filter.view === "insights") {
      view.innerHTML = this.renderInsights();
      return;
    }
    if (this.filter.view === "photos") {
      view.innerHTML = this.photos(entries);
      return;
    }

    // Default Timeline view
    if (!entries.length) {
      view.innerHTML = `
        <div class="empty" style="text-align:center;padding:80px 20px;">
          <div style="font-size:42px;margin-bottom:14px;">✧</div>
          <h2 style="font:400 26px var(--font-serif);margin-bottom:8px;">Nothing here yet</h2>
          <p style="font-size:13px;color:var(--muted);margin-bottom:20px;">A blank page waiting for today's thought.</p>
          <button class="primary-btn" onclick="Editor.open()">Write an entry</button>
        </div>
      `;
      return;
    }

    const groups = {};
    entries.forEach(e => (groups[e.date] ??= []).push(e));

    view.innerHTML = Object.entries(groups).map(([date, items]) => `
      <section class="day">
        <div class="day-label">
          <strong>${UI.formatDate(date, { weekday: "long" })}</strong>
          <span></span>
          <small>${UI.formatDate(date, { month: "long", day: "numeric", year: "numeric" })}</small>
        </div>
        ${items.map(e => this.card(e)).join("")}
      </section>
    `).join("");

    this.bindCards(view);
  },

  bindCards(view) {
    view.querySelectorAll(".entry-card").forEach(c => {
      c.onclick = (e) => {
        if (e.target.tagName === "IMG") {
          this.openLightbox(e.target.src);
          return;
        }
        if (e.target.tagName === "AUDIO" || e.target.closest("audio")) return;
        const entry = this.entries.find(x => x.id === c.dataset.id);
        if (entry) Editor.open(entry);
      };
    });
  },

  card(e) {
    const excerpt = UI.plain(e.content).slice(0, 260);
    const moodBadge = e.mood ? `<span class="mood-badge">${e.mood.emoji} ${UI.escape(e.mood.label)}</span>` : "";
    const weatherBadge = e.weather ? `<span class="weather-badge">${e.weather.emoji} ${UI.escape(e.weather.text)}</span>` : "";
    const locationBadge = e.location ? `<span class="weather-badge">📍 ${UI.escape(e.location)}</span>` : "";

    const photoStrip = e.photos?.length ? `
      <div class="photo-strip">
        ${e.photos.map(src => `<img src="${src}" alt="Attached memory" loading="lazy">`).join("")}
      </div>
    ` : "";

    const audioPill = e.audio ? `
      <div class="audio-card-pill">
        <span>🎙 Voice reflection attached</span>
      </div>
    ` : "";

    return `
      <article class="entry-card" data-id="${e.id}">
        <div class="card-top-meta">
          ${moodBadge}
          ${weatherBadge}
          ${locationBadge}
        </div>
        <h2>${UI.escape(e.title)}</h2>
        <p class="entry-excerpt">${UI.escape(excerpt)}${excerpt.length >= 260 ? "…" : ""}</p>
        ${photoStrip}
        ${audioPill}
        <div class="entry-footer">
          <span>${new Date(e.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          <span>·</span>
          <span class="journal-tag">${UI.escape(e.journal)}</span>
          ${e.favorite ? '<span style="margin-left:auto;color:#ef4444;">♥</span>' : ''}
          ${(e.tags || []).map(t => `<span class="tag">#${UI.escape(t)}</span>`).join("")}
        </div>
      </article>
    `;
  },

  renderOnThisDay() {
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayYear = today.getFullYear();

    const matches = this.entries.filter(e => {
      const parts = e.date.split("-");
      return `${parts[1]}-${parts[2]}` === mmdd && parseInt(parts[0]) !== todayYear;
    });

    const banner = `
      <div class="otd-banner">
        <div class="otd-icon">🕰</div>
        <div>
          <h3>Time Capsule</h3>
          <p>Looking back at words and memories you wrote on this exact day in past years.</p>
        </div>
      </div>
    `;

    if (!matches.length) {
      // Fallback: show other memorable entries from earlier months
      const older = this.entries.slice(1, 4);
      return banner + `
        <div style="margin-bottom:24px;color:var(--muted);font-size:13px;">No entries recorded from this exact day in previous years yet. Here are nostalgic entries from your timeline:</div>
        ${older.map(e => this.card(e)).join("")}
      `;
    }

    return banner + matches.map(e => this.card(e)).join("");
  },

  renderInsights() {
    const totalEntries = this.entries.length;
    const totalWords = this.entries.reduce((sum, e) => sum + UI.plain(e.content).trim().split(/\s+/).filter(Boolean).length, 0);
    const activeDays = new Set(this.entries.map(e => e.date)).size;

    // Mood counts
    const moodMap = {};
    this.entries.forEach(e => {
      if (e.mood?.label) {
        moodMap[e.mood.label] = (moodMap[e.mood.label] || 0) + 1;
      }
    });

    const moodRows = Object.entries(moodMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => {
        const pct = Math.round((count / totalEntries) * 100);
        return `
          <div class="mood-bar-row">
            <span class="mood-bar-label">${UI.escape(label)}</span>
            <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${pct}%"></div></div>
            <span class="mood-bar-count">${count}</span>
          </div>
        `;
      }).join("") || `<p style="color:var(--muted);font-size:13px;">Select moods when writing entries to see your emotional trends.</p>`;

    return `
      <div class="insights-grid">
        <div class="insight-stat-card">
          <span>Total Entries</span>
          <strong>${totalEntries}</strong>
        </div>
        <div class="insight-stat-card">
          <span>Words Written</span>
          <strong>${totalWords.toLocaleString()}</strong>
        </div>
        <div class="insight-stat-card">
          <span>Journaling Days</span>
          <strong>${activeDays}</strong>
        </div>
      </div>

      <div class="mood-chart-card">
        <h3>Emotional Landscape & Moods</h3>
        <div class="mood-bar-wrap">
          ${moodRows}
        </div>
      </div>
    `;
  },

  calendar() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();

    const map = {};
    this.entries.forEach(e => (map[e.date] ??= []).push(e));

    let cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(x => `<div class="cal-head">${x}</div>`).join("");
    for (let i = 0; i < first; i++) cells += `<div class="cal-day muted"></div>`;

    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const has = map[key]?.length;
      const moodDot = map[key]?.[0]?.mood?.emoji || "";

      cells += `
        <div class="cal-day ${has ? "has-entry" : ""}">
          <button onclick="App.openDate('${key}')">${d}</button>
          ${has ? `<div class="cal-dot" title="${has} entries">${moodDot}</div>` : ""}
        </div>
      `;
    }
    return `<div class="calendar">${cells}</div>`;
  },

  openDate(date) {
    const e = this.entries.find(x => x.date === date);
    if (e) Editor.open(e);
    else Editor.open({ date });
  },

  photos(entries) {
    const imgs = entries.flatMap(e => (e.photos || []).map(src => ({ src, e })));
    return imgs.length ? `
      <div class="photo-grid">
        ${imgs.map(x => `<img src="${x.src}" alt="Memory" onclick="App.openLightbox('${x.src}')">`).join("")}
      </div>
    ` : `
      <div class="empty" style="text-align:center;padding:70px 20px;">
        <div style="font-size:36px;margin-bottom:12px;">▧</div>
        <h2 style="font:400 24px var(--font-serif);margin-bottom:8px;">No photos yet</h2>
        <p style="font-size:13px;color:var(--muted);">Attach photos to your journal entries to build your photo wall.</p>
      </div>
    `;
  },

  // Themes
  openThemeModal() {
    document.getElementById("themeModalOverlay")?.classList.add("show");
  },

  closeThemeModal() {
    document.getElementById("themeModalOverlay")?.classList.remove("show");
  },

  setTheme(themeName) {
    if (themeName === "dark") themeName = "midnight";
    if (themeName === "light") themeName = "paper";
    if (!["paper", "midnight", "sage", "twilight"].includes(themeName)) {
      themeName = "paper";
    }
    document.body.className = `theme-${themeName}`;
    localStorage.setItem("journal-theme", themeName);
    document.querySelectorAll(".theme-card").forEach(c => {
      c.classList.toggle("active", c.dataset.theme === themeName);
    });
  },

  cycleTheme() {
    const themes = ["paper", "midnight", "sage", "twilight"];
    let current = localStorage.getItem("journal-theme") || "paper";
    if (current === "dark") current = "midnight";
    if (current === "light") current = "paper";
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    this.setTheme(next);
  },

  applyTheme() {
    let saved = localStorage.getItem("journal-theme") || "paper";
    if (saved === "dark") saved = "midnight";
    if (saved === "light") saved = "paper";
    if (!["paper", "midnight", "sage", "twilight"].includes(saved)) {
      saved = "paper";
    }
    this.setTheme(saved);
  },

  // Photo Lightbox
  openLightbox(src) {
    const overlay = document.getElementById("lightboxOverlay");
    const img = document.getElementById("lightboxImg");
    if (overlay && img) {
      img.src = src;
      overlay.classList.add("show");
    }
  },

  closeLightbox() {
    document.getElementById("lightboxOverlay")?.classList.remove("show");
  },

  // Privacy PIN Lock
  triggerPinLock() {
    const currentPin = localStorage.getItem("journal_pin");
    if (!currentPin) {
      const set = prompt("Set a 4-digit privacy PIN for your journal:");
      if (set && /^\d{4}$/.test(set)) {
        localStorage.setItem("journal_pin", set);
        this.pin = set;
        alert("Privacy PIN enabled!");
      } else if (set) {
        alert("Please enter exactly 4 digits.");
        return;
      } else {
        return;
      }
    }
    this.showPinLock();
  },

  showPinLock() {
    this.isLocked = true;
    this.currentPinInput = "";
    this.updatePinDots();
    document.getElementById("pinLockOverlay")?.classList.add("show");
  },

  hidePinLock() {
    this.isLocked = false;
    this.currentPinInput = "";
    document.getElementById("pinLockOverlay")?.classList.remove("show");
  },

  bindPinKeypad() {
    this.currentPinInput = "";
    document.querySelectorAll(".pin-key:not(.action)").forEach(k => {
      k.onclick = () => {
        if (this.currentPinInput.length < 4) {
          this.currentPinInput += k.textContent.trim();
          this.updatePinDots();
          if (this.currentPinInput.length === 4) {
            this.verifyPin();
          }
        }
      };
    });

    document.getElementById("pinClearBtn")?.addEventListener("click", () => {
      this.currentPinInput = "";
      this.updatePinDots();
    });

    document.getElementById("pinCancelBtn")?.addEventListener("click", () => {
      this.hidePinLock();
    });
  },

  updatePinDots() {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((d, i) => {
      d.classList.toggle("filled", i < this.currentPinInput.length);
    });
  },

  verifyPin() {
    const savedPin = localStorage.getItem("journal_pin");
    if (this.currentPinInput === savedPin) {
      this.hidePinLock();
    } else {
      alert("Incorrect PIN. Try again.");
      this.currentPinInput = "";
      this.updatePinDots();
    }
  },

  export() {
    const format = prompt("Export format: type 'json' for backup, or 'print' for PDF/Print view:", "print");
    if (format === "print") {
      window.print();
    } else {
      const data = JSON.stringify(this.entries, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }
};

window.App = App;
document.addEventListener("DOMContentLoaded", () => App.init());
