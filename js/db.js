/**
 * Database & Cloud Sync Layer
 * Features:
 * - Local persistence via IndexedDB (fast, offline ready)
 * - Automatic cloud synchronization with Supabase account
 * - Dual-strategy cloud storage: PostgreSQL 'entries' table + user_metadata fallback
 */

const DB_NAME = "quiet-journal";
const DB_VERSION = 1;
const STORE = "entries";

const DB = {
  _dbPromise: null,
  _syncTimeout: null,

  open() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("date", "date");
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this._dbPromise;
  },

  // -------------------------------------------------------------
  // Local IndexedDB Operations
  // -------------------------------------------------------------
  async getAllLocal() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async putLocal(entry) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteLocal(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  // -------------------------------------------------------------
  // Public Data API
  // -------------------------------------------------------------
  async getAll() {
    // Return local entries immediately
    const local = await this.getAllLocal();
    return local;
  },

  async put(entry) {
    // 1. Save locally to IndexedDB immediately
    await this.putLocal(entry);

    // 2. If logged into Supabase, sync to account
    if (window.Auth && Auth.user && Auth.client) {
      this.updateSyncUI("syncing");
      clearTimeout(this._syncTimeout);
      this._syncTimeout = setTimeout(async () => {
        const ok = await this.saveToCloud(entry);
        this.updateSyncUI(ok ? "synced" : "local");
      }, 500);
    } else {
      this.updateSyncUI("local");
    }
  },

  async delete(id) {
    await this.deleteLocal(id);
    if (window.Auth && Auth.user && Auth.client) {
      await this.deleteFromCloud(id);
    }
  },

  // -------------------------------------------------------------
  // Cloud Sync Logic (Supabase)
  // -------------------------------------------------------------
  async saveToCloud(entry) {
    if (!window.Auth || !Auth.client || !Auth.user) return false;

    let tableSaved = false;

    // Strategy A: Try saving to PostgreSQL 'entries' table
    try {
      const { error: tableError } = await Auth.client
        .from("entries")
        .upsert({
          id: entry.id,
          user_id: Auth.user.id,
          title: entry.title || "Untitled reflection",
          content: entry.content || "",
          date: entry.date,
          journal: entry.journal || "Personal",
          favorite: !!entry.favorite,
          mood: entry.mood || "neutral",
          weather: entry.weather || "",
          location: entry.location || "",
          tags: entry.tags || [],
          photos: entry.photos || [],
          audio: entry.audio || "",
          created_at: new Date(entry.createdAt || Date.now()).toISOString(),
          updated_at: new Date(entry.updatedAt || Date.now()).toISOString()
        });

      if (!tableError) {
        tableSaved = true;
      }
    } catch (err) {
      // Table doesn't exist or network error
    }

    // Strategy B: Fallback to saving in Supabase account user_metadata
    // (Works immediately with zero SQL setup!)
    const metaSaved = await this.syncAllToUserMetadata();
    return tableSaved || metaSaved;
  },

  async deleteFromCloud(id) {
    if (!window.Auth || !Auth.client || !Auth.user) return;

    try {
      await Auth.client.from("entries").delete().eq("id", id).eq("user_id", Auth.user.id);
    } catch (e) {}

    await this.syncAllToUserMetadata();
  },

  async syncAllToUserMetadata() {
    if (!window.Auth || !Auth.client || !Auth.user) return false;

    try {
      const allLocal = await this.getAllLocal();
      // Keep entries clean and bounded
      const cleanEntries = allLocal.map(e => ({
        id: e.id,
        title: e.title || "Untitled reflection",
        content: e.content || "",
        date: e.date,
        journal: e.journal || "Personal",
        favorite: !!e.favorite,
        mood: e.mood || "neutral",
        weather: e.weather || "",
        location: e.location || "",
        tags: e.tags || [],
        photos: (e.photos || []).slice(0, 4),
        audio: (e.audio && e.audio.length < 300000) ? e.audio : "",
        createdAt: e.createdAt || Date.now(),
        updatedAt: e.updatedAt || Date.now()
      }));

      const { data, error } = await Auth.client.auth.updateUser({
        data: {
          journal_entries: cleanEntries,
          journal_synced_at: Date.now()
        }
      });

      if (!error && data?.user) {
        Auth.user = data.user;
        return true;
      }
      return false;
    } catch (err) {
      console.warn("User metadata sync error:", err);
      return false;
    }
  },

  /**
   * Bidirectional Sync on login or manual trigger
   */
  async syncWithCloud() {
    if (!window.Auth || !Auth.client || !Auth.user) return;

    this.updateSyncUI("syncing");
    let cloudEntries = [];
    let usedTable = false;

    // 1. Try reading from PostgreSQL 'entries' table
    try {
      const { data, error } = await Auth.client
        .from("entries")
        .select("*")
        .eq("user_id", Auth.user.id);

      if (!error && Array.isArray(data) && data.length > 0) {
        cloudEntries = data.map(row => ({
          id: row.id,
          title: row.title,
          content: row.content,
          date: row.date,
          journal: row.journal,
          favorite: row.favorite,
          mood: row.mood,
          weather: row.weather,
          location: row.location,
          tags: row.tags || [],
          photos: row.photos || [],
          audio: row.audio || "",
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime()
        }));
        usedTable = true;
      }
    } catch (e) {
      // Table not available
    }

    // 2. If table was empty or not available, check user_metadata
    if (!usedTable || cloudEntries.length === 0) {
      try {
        const { data: userData } = await Auth.client.auth.getUser();
        const user = userData?.user || Auth.user;
        if (user?.user_metadata?.journal_entries && Array.isArray(user.user_metadata.journal_entries)) {
          if (cloudEntries.length === 0) {
            cloudEntries = user.user_metadata.journal_entries;
          }
        }
      } catch (e) {
        console.warn("Error reading user metadata:", e);
      }
    }

    // 3. Merge cloud entries into local storage
    const localEntries = await this.getAllLocal();
    const localMap = new Map(localEntries.map(e => [e.id, e]));
    let hasChanges = false;

    for (const ce of cloudEntries) {
      const le = localMap.get(ce.id);
      if (!le || (ce.updatedAt && ce.updatedAt > (le.updatedAt || 0))) {
        await this.putLocal(ce);
        hasChanges = true;
      }
    }

    // 4. Push any local entries missing from cloud up to cloud
    const cloudIds = new Set(cloudEntries.map(e => e.id));
    for (const le of localEntries) {
      if (!cloudIds.has(le.id)) {
        await this.saveToCloud(le);
      }
    }

    this.updateSyncUI("synced");

    if (hasChanges && window.App && typeof App.refresh === "function") {
      await App.refresh();
      if (window.Auth && Auth.showToast) {
        Auth.showToast("Cloud sync complete: Entries restored from account!");
      }
    }
  },

  updateSyncUI(state) {
    const saveStatus = document.getElementById("saveStatus");
    const saveDot = document.querySelector(".save-dot");

    if (saveStatus) {
      if (state === "syncing") {
        saveStatus.textContent = "Syncing to account…";
        if (saveDot) saveDot.style.background = "var(--accent)";
      } else if (state === "synced") {
        saveStatus.textContent = "☁ Saved to Account";
        if (saveDot) saveDot.style.background = "#10b981"; // emerald
      } else {
        saveStatus.textContent = "Saved";
        if (saveDot) saveDot.style.background = "var(--text-muted)";
      }
    }

    const cloudBadge = document.getElementById("cloudSyncBadge");
    if (cloudBadge) {
      if (state === "synced") {
        cloudBadge.textContent = "☁ Synced";
        cloudBadge.className = "cloud-badge synced";
      } else if (state === "syncing") {
        cloudBadge.textContent = "🔄 Syncing…";
        cloudBadge.className = "cloud-badge syncing";
      } else {
        cloudBadge.textContent = "📱 Local";
        cloudBadge.className = "cloud-badge local";
      }
    }
  }
};

