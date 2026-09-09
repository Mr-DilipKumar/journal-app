/**
 * Supabase Authentication & Session Management
 * Features: Automatic login with persistent session & remembered credentials
 */

const Auth = {
  client: null,
  user: null,
  session: null,
  isConfigured: false,

  init() {
    this.setupClient();
    this.bindEvents();
  },

  getConfig() {
    const fileConfig = window.SUPABASE_CONFIG || {};
    const url = (fileConfig.url && fileConfig.url.trim()) || "";
    const anonKey = (fileConfig.anonKey && fileConfig.anonKey.trim()) || "";

    const isPlaceholder = url.includes("your-project-id") || anonKey.includes("your-anon-public-key");
    const valid = url.startsWith("https://") && anonKey.length > 20 && !isPlaceholder;

    return { url, anonKey, valid };
  },

  setupClient() {
    const { url, anonKey, valid } = this.getConfig();

    if (valid && window.supabase && typeof window.supabase.createClient === "function") {
      try {
        this.client = window.supabase.createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        });
        this.isConfigured = true;

        // Check active session or trigger auto-login
        this.client.auth.getSession().then(({ data, error }) => {
          if (!error && data?.session) {
            this.handleAuthState("SIGNED_IN", data.session);
          } else {
            this.checkAndAutoLogin();
          }
        });

        // Listen for auth state changes
        this.client.auth.onAuthStateChange((event, session) => {
          this.handleAuthState(event, session);
        });
      } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
        this.isConfigured = false;
        this.updateUI(null);
      }
    } else {
      this.isConfigured = false;
      this.updateUI(null);
    }
  },

  async checkAndAutoLogin() {
    const creds = this.getSavedCredentials();
    if (!creds.email || !creds.password || creds.remember === false) {
      this.handleAuthState("SIGNED_OUT", null);
      return;
    }

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: creds.email,
        password: creds.password
      });

      if (!error && data?.session) {
        this.handleAuthState("SIGNED_IN", data.session);
        this.showToast(`Auto signed in as ${this.getUserDisplayName()}`);
      } else {
        if (error?.message && error.message.toLowerCase().includes("invalid")) {
          this.clearSavedCredentials();
        }
        this.handleAuthState("SIGNED_OUT", null);
      }
    } catch (e) {
      this.handleAuthState("SIGNED_OUT", null);
    }
  },

  saveCredentials(email, password, remember = true) {
    if (remember) {
      try {
        localStorage.setItem("journal_auth_email", email);
        localStorage.setItem("journal_auth_pwd", btoa(encodeURIComponent(password)));
        localStorage.setItem("journal_remember_me", "true");
      } catch (e) {}
    } else {
      this.clearSavedCredentials();
    }
  },

  getSavedCredentials() {
    try {
      const email = localStorage.getItem("journal_auth_email") || "";
      const pwdRaw = localStorage.getItem("journal_auth_pwd") || "";
      const password = pwdRaw ? decodeURIComponent(atob(pwdRaw)) : "";
      const remember = localStorage.getItem("journal_remember_me") !== "false";
      return { email, password, remember };
    } catch (e) {
      return { email: "", password: "", remember: true };
    }
  },

  clearSavedCredentials() {
    try {
      localStorage.removeItem("journal_auth_email");
      localStorage.removeItem("journal_auth_pwd");
      localStorage.removeItem("journal_remember_me");
    } catch (e) {}
  },

  bindEvents() {
    // Auth trigger in topbar
    const authBtn = document.getElementById("authTriggerBtn");
    if (authBtn) {
      authBtn.onclick = () => {
        if (this.user) {
          this.toggleUserMenu();
        } else {
          this.openModal();
        }
      };
    }

    // Sidebar auth trigger
    const sidebarAuthBtn = document.getElementById("sidebarAuthBtn");
    if (sidebarAuthBtn) {
      sidebarAuthBtn.onclick = () => {
        if (this.user) {
          this.toggleUserMenu();
        } else {
          this.openModal();
        }
      };
    }

    // Modal close & overlay
    const authCloseBtn = document.getElementById("closeAuthModal");
    if (authCloseBtn) authCloseBtn.onclick = () => this.closeModal();

    const authModalOverlay = document.getElementById("authModalOverlay");
    if (authModalOverlay) {
      authModalOverlay.onclick = (e) => {
        if (e.target === authModalOverlay) this.closeModal();
      };
    }

    // Close with Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
        this.closeUserMenu();
      }
    });

    // Close user dropdown on outside click
    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("userDropdown");
      const authBtn = document.getElementById("authTriggerBtn");
      if (dropdown && dropdown.classList.contains("open")) {
        if (!dropdown.contains(e.target) && !authBtn?.contains(e.target)) {
          dropdown.classList.remove("open");
        }
      }
    });

    // Form tab switches
    const tabSignIn = document.getElementById("tabSignIn");
    const tabSignUp = document.getElementById("tabSignUp");

    if (tabSignIn) tabSignIn.onclick = () => this.switchTab("signin");
    if (tabSignUp) tabSignUp.onclick = () => this.switchTab("signup");

    // Form submissions (paneSignIn and paneSignUp)
    const formSignIn = document.getElementById("paneSignIn") || document.getElementById("formSignIn");
    if (formSignIn) {
      formSignIn.onsubmit = (e) => {
        e.preventDefault();
        this.submitSignIn();
      };
    }

    const formSignUp = document.getElementById("paneSignUp") || document.getElementById("formSignUp");
    if (formSignUp) {
      formSignUp.onsubmit = (e) => {
        e.preventDefault();
        this.submitSignUp();
      };
    }

    // Direct button clicks as backup
    const signInBtn = document.getElementById("signInSubmitBtn");
    if (signInBtn) {
      signInBtn.onclick = (e) => {
        e.preventDefault();
        this.submitSignIn();
      };
    }

    const signUpBtn = document.getElementById("signUpSubmitBtn");
    if (signUpBtn) {
      signUpBtn.onclick = (e) => {
        e.preventDefault();
        this.submitSignUp();
      };
    }

    // Logout button in dropdown
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = () => this.signOut();
    }

    // Forgot password
    const forgotBtn = document.getElementById("forgotPasswordBtn");
    if (forgotBtn) {
      forgotBtn.onclick = (e) => {
        e.preventDefault();
        this.submitForgotPassword();
      };
    }
  },

  handleAuthState(event, session) {
    this.session = session;
    this.user = session?.user || null;
    this.updateUI(this.user);

    if (event === "SIGNED_IN") {
      this.closeModal();
      this.showToast(`Welcome back, ${this.getUserDisplayName()}!`);
    } else if (event === "SIGNED_OUT") {
      this.closeUserMenu();
      this.showToast("Signed out successfully.");
    }
  },

  getUserDisplayName() {
    if (!this.user) return "";
    return this.user.user_metadata?.full_name || this.user.email?.split("@")[0] || "User";
  },

  getUserInitial() {
    const name = this.getUserDisplayName();
    return name ? name.charAt(0).toUpperCase() : "A";
  },

  updateUI(user) {
    const authBtn = document.getElementById("authTriggerBtn");
    const avatarEl = document.getElementById("userAvatar");
    const statusText = document.getElementById("authStatusText");
    const dropdownEmail = document.getElementById("dropdownUserEmail");
    const dropdownName = document.getElementById("dropdownUserName");

    if (user) {
      if (authBtn) {
        authBtn.classList.add("logged-in");
        authBtn.setAttribute("title", `Signed in as ${user.email}`);
      }
      if (avatarEl) {
        avatarEl.textContent = this.getUserInitial();
        avatarEl.classList.remove("anon");
      }
      if (statusText) statusText.textContent = this.getUserDisplayName();
      if (dropdownEmail) dropdownEmail.textContent = user.email || "";
      if (dropdownName) dropdownName.textContent = this.getUserDisplayName();
    } else {
      if (authBtn) {
        authBtn.classList.remove("logged-in");
        authBtn.setAttribute("title", "Sign in with Supabase");
      }
      if (avatarEl) {
        avatarEl.textContent = "Sign in";
        avatarEl.classList.add("anon");
      }
      if (statusText) statusText.textContent = "Sign in";
      if (dropdownEmail) dropdownEmail.textContent = "";
      if (dropdownName) dropdownName.textContent = "";
    }
  },

  openModal(tab = "signin") {
    this.switchTab(tab);

    // Pre-fill saved credentials if available
    const saved = this.getSavedCredentials();
    const emailInput = document.getElementById("signInEmail");
    const pwdInput = document.getElementById("signInPassword");
    const rememberCb = document.getElementById("rememberMeCheckbox");
    if (emailInput && !emailInput.value && saved.email) emailInput.value = saved.email;
    if (pwdInput && !pwdInput.value && saved.password) pwdInput.value = saved.password;
    if (rememberCb) rememberCb.checked = saved.remember !== false;

    const modal = document.getElementById("authModalOverlay");
    if (modal) {
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
    }
    this.clearAlert();
  },

  closeModal() {
    const modal = document.getElementById("authModalOverlay");
    if (modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }
    this.clearAlert();
  },

  toggleUserMenu() {
    const menu = document.getElementById("userDropdown");
    if (menu) {
      menu.classList.toggle("open");
    }
  },

  closeUserMenu() {
    const menu = document.getElementById("userDropdown");
    if (menu) {
      menu.classList.remove("open");
    }
  },

  switchTab(tabName) {
    this.clearAlert();
    const tabMap = {
      signin: { btn: "tabSignIn", pane: "paneSignIn" },
      signup: { btn: "tabSignUp", pane: "paneSignUp" }
    };
    const currentKey = (tabName || "signin").toLowerCase();
    Object.entries(tabMap).forEach(([key, ids]) => {
      const isActive = key === currentKey;
      const tabBtn = document.getElementById(ids.btn);
      const tabPane = document.getElementById(ids.pane);
      if (tabBtn) tabBtn.classList.toggle("active", isActive);
      if (tabPane) tabPane.classList.toggle("active", isActive);
    });
  },

  showAlert(message, type = "error") {
    const alertBox = document.getElementById("authAlert");
    if (alertBox) {
      alertBox.textContent = message;
      alertBox.className = `auth-alert ${type}`;
      alertBox.style.display = "block";
    }
  },

  clearAlert() {
    const alertBox = document.getElementById("authAlert");
    if (alertBox) {
      alertBox.textContent = "";
      alertBox.style.display = "none";
    }
  },

  setLoading(btnId, isLoading, defaultText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.dataset.defaultText = btn.textContent;
      btn.innerHTML = `<span class="spinner"></span> Processing…`;
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.defaultText || defaultText;
    }
  },

  checkConfigured() {
    if (!this.isConfigured) {
      this.showAlert("Please add your Supabase URL and Anon Key in config.js (which is protected by .gitignore).");
      return false;
    }
    return true;
  },

  async submitSignIn() {
    if (!this.checkConfigured()) return;
    const email = document.getElementById("signInEmail")?.value.trim();
    const password = document.getElementById("signInPassword")?.value;
    const remember = document.getElementById("rememberMeCheckbox")?.checked ?? true;

    if (!email || !password) {
      this.showAlert("Please enter both email and password.");
      return;
    }

    this.setLoading("signInSubmitBtn", true, "Sign in");
    this.clearAlert();

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        this.showAlert(error.message);
      } else if (data?.session) {
        this.saveCredentials(email, password, remember);
      }
    } catch (err) {
      this.showAlert(err.message || "An unexpected error occurred.");
    } finally {
      this.setLoading("signInSubmitBtn", false, "Sign in");
    }
  },

  async submitSignUp() {
    if (!this.checkConfigured()) return;
    const name = document.getElementById("signUpName")?.value.trim();
    const email = document.getElementById("signUpEmail")?.value.trim();
    const password = document.getElementById("signUpPassword")?.value;

    if (!email || !password) {
      this.showAlert("Please enter an email and password.");
      return;
    }

    if (password.length < 6) {
      this.showAlert("Password should be at least 6 characters long.");
      return;
    }

    this.setLoading("signUpSubmitBtn", true, "Create account");
    this.clearAlert();

    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || ""
          }
        }
      });

      if (error) {
        this.showAlert(error.message);
      } else {
        // Save credentials for automatic sign-in
        this.saveCredentials(email, password, true);

        if (data?.session) {
          this.showToast("Account created & signed in!");
          this.closeModal();
        } else {
          // Attempt immediate login in case user autoconfirm is enabled
          const loginAttempt = await this.client.auth.signInWithPassword({ email, password });
          if (loginAttempt.data?.session) {
            this.showToast("Account created & signed in!");
            this.closeModal();
          } else {
            this.showAlert("Account created! Please check your email inbox to confirm your account (or disable 'Confirm email' in Supabase Auth Settings for instant login without verification).", "success");
          }
        }
      }
    } catch (err) {
      this.showAlert(err.message || "An unexpected error occurred during signup.");
    } finally {
      this.setLoading("signUpSubmitBtn", false, "Create account");
    }
  },

  async submitForgotPassword() {
    if (!this.checkConfigured()) return;
    const email = document.getElementById("signInEmail")?.value.trim();
    if (!email) {
      this.showAlert("Enter your email in the box above, then click 'Forgot password?'.");
      return;
    }

    this.clearAlert();
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email);
      if (error) {
        this.showAlert(error.message);
      } else {
        this.showAlert("Password reset email sent! Check your inbox.", "success");
      }
    } catch (err) {
      this.showAlert(err.message || "Failed to send reset email.");
    }
  },

  async signOut() {
    this.clearSavedCredentials();
    if (!this.client) return;
    try {
      await this.client.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  },

  showToast(message) {
    let toast = document.getElementById("authToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "authToast";
      toast.className = "auth-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }
};

window.Auth = Auth;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Auth.init());
} else {
  Auth.init();
}
