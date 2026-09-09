/**
 * Day One-Style Rich Editor with Moods, Audio Memos, Zen Mode & Prompts
 */

const PROMPTS = [
  "What is one quiet moment from today that you want to remember?",
  "What made you smile or laugh unexpectedly today?",
  "Describe the weather and the atmosphere around you right now.",
  "What is something you are currently letting go of?",
  "Who was someone kind to you recently, and what did they do?",
  "What would make tomorrow feel deeply fulfilling?",
  "Write about a song, scent, or place that felt nostalgic today.",
  "What is something challenging that you handled better than you used to?",
  "What are three small details of your day that brought you peace?",
  "If today was a chapter in a book, what would its title be?",
  "What is a thought or feeling that has been lingering in your mind?",
  "What is something you love about your current routine?",
  "Write a letter to yourself one year from today.",
  "What is a truth you realized recently that surprised you?",
  "What does your ideal peaceful evening look like right now?"
];

const Editor = {
  panel: document.getElementById("editorPanel"),
  title: document.getElementById("titleInput"),
  body: document.getElementById("editor"),
  date: document.getElementById("editorDate"),
  status: document.getElementById("saveStatus"),
  saveIndicator: document.querySelector(".save-indicator"),
  journal: document.getElementById("journalName"),
  favoriteBtn: document.getElementById("favoriteEditor"),
  
  // State
  currentId: null,
  currentJournal: "Personal",
  currentDate: null,
  currentMood: { emoji: "🌿", label: "Grateful" },
  currentWeather: { emoji: "☀️", text: "22°C · Sunny" },
  currentLocation: "San Francisco",
  photos: [],
  tags: [],
  audioData: null,
  isZen: false,
  autoSaveTimer: null,

  // MediaRecorder state
  mediaRecorder: null,
  audioChunks: [],
  recordingInterval: null,
  recordingSeconds: 0,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Toolbar standard commands
    document.querySelectorAll(".toolbar button[data-cmd]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
        this.body.focus();
        this.updateStats();
        this.triggerAutoSave();
      });
    });

    // Checklist button
    const todoBtn = document.getElementById("todoBtn");
    if (todoBtn) {
      todoBtn.onclick = () => {
        const item = `<p class="todo-item"><input type="checkbox" onclick="this.setAttribute('checked', this.checked ? 'checked' : '')"> <span>To-do item…</span></p>`;
        document.execCommand("insertHTML", false, item);
        this.body.focus();
        this.updateStats();
      };
    }

    // Highlighters
    const hlBtn = document.getElementById("highlighterBtn");
    const hlMenu = document.getElementById("highlighterMenu");
    if (hlBtn && hlMenu) {
      hlBtn.onclick = (e) => {
        e.stopPropagation();
        hlMenu.classList.toggle("show");
      };
      document.querySelectorAll(".hl-btn").forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          const colorClass = b.classList.contains("hl-green") ? "hl-green" : b.classList.contains("hl-pink") ? "hl-pink" : "hl-yellow";
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            const mark = `<mark class="${colorClass}">${selection.toString()}</mark>`;
            document.execCommand("insertHTML", false, mark);
          }
          hlMenu.classList.remove("show");
          this.body.focus();
        };
      });
    }

    // Close highlighter menu on outside click
    document.addEventListener("click", () => hlMenu?.classList.remove("show"));

    // Zen Mode Toggle
    const zenBtn = document.getElementById("zenToggleBtn");
    if (zenBtn) {
      zenBtn.onclick = () => this.toggleZen();
    }

    // Mood picker popover
    const moodBtn = document.getElementById("moodPickerBtn");
    const moodPopover = document.getElementById("moodPopover");
    if (moodBtn && moodPopover) {
      moodBtn.onclick = (e) => {
        e.stopPropagation();
        moodPopover.classList.toggle("show");
      };
      document.querySelectorAll(".mood-opt").forEach(opt => {
        opt.onclick = () => {
          this.setMood(opt.dataset.emoji, opt.dataset.label);
          moodPopover.classList.remove("show");
          this.triggerAutoSave();
        };
      });
    }
    document.addEventListener("click", () => moodPopover?.classList.remove("show"));

    // Weather & Location click to edit
    const wlBtn = document.getElementById("weatherLocationBtn");
    if (wlBtn) {
      wlBtn.onclick = () => {
        const loc = prompt("Enter location for this entry:", this.currentLocation);
        if (loc !== null && loc.trim()) {
          this.currentLocation = loc.trim();
          document.getElementById("locationText").textContent = this.currentLocation;
          this.triggerAutoSave();
        }
      };
    }

    // Prompt generator buttons
    const promptBtn = document.getElementById("editorPromptBtn");
    if (promptBtn) promptBtn.onclick = () => this.insertRandomPrompt();

    const topbarPrompt = document.getElementById("topbarPromptBtn");
    if (topbarPrompt) {
      topbarPrompt.onclick = () => {
        this.open();
        setTimeout(() => this.insertRandomPrompt(), 300);
      };
    }

    // Photo input
    const photoBtn = document.getElementById("photoBtn");
    const photoInput = document.getElementById("photoInput");
    if (photoBtn && photoInput) {
      photoBtn.onclick = () => photoInput.click();
      photoInput.onchange = (e) => this.addPhotos(e.target.files);
    }

    // Voice recording
    const voiceBtn = document.getElementById("voiceRecordBtn");
    if (voiceBtn) voiceBtn.onclick = () => this.startVoiceRecording();

    const voiceStopBtn = document.getElementById("voiceStopBtn");
    if (voiceStopBtn) voiceStopBtn.onclick = () => this.stopVoiceRecording();

    const voiceDeleteBtn = document.getElementById("voiceDeleteBtn");
    if (voiceDeleteBtn) voiceDeleteBtn.onclick = () => this.deleteVoiceRecording();

    // Tags
    const tagBtn = document.getElementById("tagBtn");
    if (tagBtn) {
      tagBtn.onclick = () => {
        const t = prompt("Add a tag (e.g. mindfulness, ideas, coffee):");
        if (t && t.trim()) {
          const clean = t.trim().toLowerCase().replace(/^#/, "");
          if (!this.tags.includes(clean)) {
            this.tags.push(clean);
            this.renderTags();
            this.triggerAutoSave();
          }
        }
      };
    }

    // Journal selector
    const journalPicker = document.getElementById("journalPicker");
    if (journalPicker) {
      journalPicker.onclick = () => {
        const list = ["Personal", "Work", "Travel", "Gratitude", "Ideas"];
        const next = list[(list.indexOf(this.currentJournal) + 1) % list.length];
        this.currentJournal = next;
        this.journal.textContent = next;
        this.triggerAutoSave();
      };
    }

    // Date click to edit
    if (this.date) {
      this.date.onclick = () => {
        const newDate = prompt("Change entry date (YYYY-MM-DD):", this.currentDate);
        if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
          this.currentDate = newDate;
          this.date.textContent = UI.formatLong(newDate);
          this.triggerAutoSave();
        }
      };
    }

    // Actions & typing inputs
    document.getElementById("closeEditor").onclick = () => this.close();
    document.getElementById("overlay").onclick = () => this.close();
    document.getElementById("saveEntryBtn").onclick = () => this.save();
    this.favoriteBtn.onclick = () => {
      this.favoriteBtn.textContent = this.favoriteBtn.textContent === "♥" ? "♡" : "♥";
      this.triggerAutoSave();
    };

    this.title.addEventListener("input", () => {
      this.updateStats();
      this.triggerAutoSave();
    });

    this.body.addEventListener("input", () => {
      this.updateStats();
      this.triggerAutoSave();
    });
  },

  open(entry = null) {
    this.currentId = entry?.id || null;
    this.currentJournal = entry?.journal || "Personal";
    this.photos = entry?.photos ? [...entry.photos] : [];
    this.tags = entry?.tags ? [...entry.tags] : [];
    this.currentDate = entry?.date || new Date().toISOString().slice(0, 10);
    this.currentMood = entry?.mood || { emoji: "🌿", label: "Grateful" };
    this.currentWeather = entry?.weather || { emoji: "☀️", text: "22°C · Sunny" };
    this.currentLocation = entry?.location || "San Francisco";
    this.audioData = entry?.audio || null;

    // Set fields
    this.date.textContent = UI.formatLong(this.currentDate);
    this.title.value = entry?.title || "";
    this.body.innerHTML = entry?.content || "";
    this.journal.textContent = this.currentJournal;
    this.favoriteBtn.textContent = entry?.favorite ? "♥" : "♡";

    // Metadata controls
    this.setMood(this.currentMood.emoji, this.currentMood.label);
    document.getElementById("weatherEmoji").textContent = this.currentWeather.emoji;
    document.getElementById("weatherText").textContent = this.currentWeather.text;
    document.getElementById("locationText").textContent = this.currentLocation;

    this.renderPhotos();
    this.renderTags();
    this.renderVoiceWidget();
    this.updateStats();

    this.status.textContent = "Saved";
    this.saveIndicator?.classList.remove("saving");

    this.panel.classList.add("open");
    this.panel.setAttribute("aria-hidden", "false");
    document.getElementById("overlay").classList.add("show");

    setTimeout(() => {
      if (!this.title.value) this.title.focus();
      else this.body.focus();
    }, 250);
  },

  close() {
    this.panel.classList.remove("open");
    this.panel.classList.remove("zen");
    this.isZen = false;
    this.panel.setAttribute("aria-hidden", "true");
    document.getElementById("overlay").classList.remove("show");
  },

  toggleZen() {
    this.isZen = !this.isZen;
    this.panel.classList.toggle("zen", this.isZen);
    const btn = document.getElementById("zenToggleBtn");
    if (btn) btn.textContent = this.isZen ? "✕ Exit Zen" : "⛶ Zen";
  },

  setMood(emoji, label) {
    this.currentMood = { emoji, label };
    const eEl = document.getElementById("currentMoodEmoji");
    const lEl = document.getElementById("currentMoodLabel");
    if (eEl) eEl.textContent = emoji;
    if (lEl) lEl.textContent = label;

    document.querySelectorAll(".mood-opt").forEach(opt => {
      opt.classList.toggle("active", opt.dataset.label === label);
    });
  },

  insertRandomPrompt() {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const quoteHtml = `<blockquote><strong>Prompt:</strong> ${prompt}</blockquote><p><br></p>`;
    this.body.focus();
    document.execCommand("insertHTML", false, quoteHtml);
    this.updateStats();
    this.triggerAutoSave();
  },

  triggerAutoSave() {
    this.status.textContent = "Saving…";
    this.saveIndicator?.classList.add("saving");
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.save(true), 1500);
  },

  async save(isSilent = false) {
    const existing = (await DB.getAll()).find(e => e.id === this.currentId);
    const now = Date.now();
    const entry = {
      id: this.currentId || "entry_" + now,
      title: this.title.value.trim() || "Untitled reflection",
      content: this.body.innerHTML.trim(),
      date: this.currentDate || new Date().toISOString().slice(0, 10),
      journal: this.currentJournal,
      favorite: this.favoriteBtn.textContent === "♥",
      mood: this.currentMood,
      weather: this.currentWeather,
      location: this.currentLocation,
      photos: this.photos,
      tags: this.tags,
      audio: this.audioData,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await DB.put(entry);
    this.currentId = entry.id;
    this.saveIndicator?.classList.remove("saving");

    if (!isSilent) {
      if (window.Auth && Auth.showToast) {
        Auth.showToast(window.Auth.user ? "☁ Entry saved to your account!" : "Entry saved to device.");
      }
    }
    await App.refresh();
  },

  renderTags() {
    const wrap = document.getElementById("entryTagsList");
    if (!wrap) return;
    wrap.innerHTML = this.tags.map((t, i) => `
      <span class="tag">${UI.escape(t)} <b onclick="Editor.removeTag(${i})" style="cursor:pointer;margin-left:4px">×</b></span>
    `).join("");
  },

  removeTag(idx) {
    this.tags.splice(idx, 1);
    this.renderTags();
    this.triggerAutoSave();
  },

  renderPhotos() {
    const wrap = document.getElementById("photoPreview");
    if (!wrap) return;
    wrap.innerHTML = this.photos.map((src, i) => `
      <div style="position:relative;display:inline-block;">
        <img src="${src}" alt="Attached photo" onclick="App.openLightbox('${src}')" style="cursor:zoom-in;">
        <button onclick="Editor.removePhoto(${i})" style="position:absolute;right:6px;top:6px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;font-size:13px;">×</button>
      </div>
    `).join("");
  },

  removePhoto(i) {
    this.photos.splice(i, 1);
    this.renderPhotos();
    this.triggerAutoSave();
  },

  addPhotos(files) {
    [...files].forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        this.photos.push(e.target.result);
        this.renderPhotos();
        this.triggerAutoSave();
      };
      reader.readAsDataURL(file);
    });
  },

  // Voice recording logic
  async startVoiceRecording() {
    const widget = document.getElementById("voiceWidget");
    const stopBtn = document.getElementById("voiceStopBtn");
    const player = document.getElementById("voicePlayer");
    const delBtn = document.getElementById("voiceDeleteBtn");
    const timer = document.getElementById("voiceTimer");
    const stateLabel = document.getElementById("voiceStateLabel");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone recording is not supported on this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          this.audioData = reader.target.result;
          this.renderVoiceWidget();
          this.triggerAutoSave();
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      this.mediaRecorder.start();
      widget.style.display = "flex";
      stopBtn.style.display = "inline-block";
      player.style.display = "none";
      delBtn.style.display = "none";
      stateLabel.textContent = "Recording voice memo…";

      this.recordingSeconds = 0;
      clearInterval(this.recordingInterval);
      this.recordingInterval = setInterval(() => {
        this.recordingSeconds++;
        const mins = Math.floor(this.recordingSeconds / 60);
        const secs = String(this.recordingSeconds % 60).padStart(2, "0");
        timer.textContent = `${mins}:${secs}`;
      }, 1000);
    } catch (err) {
      alert("Could not access microphone: " + err.message);
    }
  },

  stopVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
      clearInterval(this.recordingInterval);
    }
  },

  deleteVoiceRecording() {
    this.audioData = null;
    this.renderVoiceWidget();
    this.triggerAutoSave();
  },

  renderVoiceWidget() {
    const widget = document.getElementById("voiceWidget");
    const stopBtn = document.getElementById("voiceStopBtn");
    const player = document.getElementById("voicePlayer");
    const delBtn = document.getElementById("voiceDeleteBtn");
    const stateLabel = document.getElementById("voiceStateLabel");
    const dot = document.getElementById("voiceDot");

    if (this.audioData) {
      widget.style.display = "flex";
      stopBtn.style.display = "none";
      player.style.display = "inline-block";
      delBtn.style.display = "inline-block";
      player.src = this.audioData;
      stateLabel.textContent = "Voice reflection";
      if (dot) dot.style.display = "none";
    } else {
      widget.style.display = "none";
      if (dot) dot.style.display = "inline-block";
    }
  },

  updateStats() {
    const text = UI.plain(this.body.innerHTML).trim();
    const words = text ? text.split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    const label = `${words} ${words === 1 ? "word" : "words"} · ${readingTime} min read`;
    const wcEl = document.getElementById("wordCount");
    if (wcEl) wcEl.textContent = label;
  }
};

window.Editor = Editor;
document.addEventListener("DOMContentLoaded", () => Editor.init());
