// js/login-page.js
import { api, setToken, setVendorToken } from "./api.js";
import { storage } from "./storage.js";

console.log("login-page.js loaded");

// Mark that module loaded successfully (for fallback detection)
window.__loginModuleLoaded = true;

(function () {
  console.log("Login script initializing...");

  const tabsRoot = document.querySelector("[data-role-tabs]");
  const roleInput = document.getElementById("loginRole");
  const form = document.getElementById("loginForm");
  const unverifiedBanner = document.getElementById("unverifiedBanner");
  const resendBtn = document.getElementById("resendVerification");

  console.log("Form found:", !!form);

  let lastLoginEmail = "";

  if (tabsRoot && roleInput) {
    tabsRoot.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-role]");
      if (!btn) return;

      const role = btn.getAttribute("data-role");
      roleInput.value = role;

      tabsRoot.querySelectorAll("button[data-role]").forEach((b) => {
        b.classList.remove("bg-white", "shadow-sm");
        b.classList.add("text-slate-700");
      });

      btn.classList.add("bg-white", "shadow-sm");
      btn.classList.remove("text-slate-700");

      // Hide unverified banner when switching roles
      if (unverifiedBanner) unverifiedBanner.classList.add("hidden");
    });
  }

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.disabled = true;
      btn.dataset.old = btn.textContent || "Login";
      btn.textContent = "Logging in...";
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.old || "Login";
    }
  }

  // Resend verification email
  if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
      if (!lastLoginEmail) return;

      resendBtn.disabled = true;
      resendBtn.textContent = "Sending...";

      try {
        await api("/auth/resend-verification", {
          method: "POST",
          body: { email: lastLoginEmail },
          auth: false,
        });
        alert("Verification email sent! Please check your inbox.");
      } catch (err) {
        alert(err?.message || "Failed to resend verification email");
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend verification email";
      }
    });
  }

  if (form) {
    console.log("Attaching submit handler to form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Form submitted! Processing login...");

      const role = (roleInput?.value || "user").toLowerCase();
      console.log("Login role:", role);
      const email = document.getElementById("email")?.value?.trim();
      const password = document.getElementById("password")?.value;

      lastLoginEmail = email;

      // Hide unverified banner
      if (unverifiedBanner) unverifiedBanner.classList.add("hidden");

      const btn = form.querySelector('button[type="submit"]');
      setLoading(btn, true);

      try {
        if (role === "vendor") {
          const res = await api("/vendor/auth/login", {
            method: "POST",
            body: { email, password },
            auth: false,
          });

          console.log("Vendor login response:", res);

          if (!res.accessToken) {
            throw new Error("Login failed - no access token received");
          }

          // store vendor session
          try {
            storage.set("authType", "vendor");
            storage.set("vendor", res.vendor);
            setVendorToken(res.accessToken);
          } catch (storageErr) {
            console.error("Storage error, using localStorage directly:", storageErr);
            localStorage.setItem("authType", JSON.stringify("vendor"));
            localStorage.setItem("vendor", JSON.stringify(res.vendor));
            localStorage.setItem("vendor_token", JSON.stringify(res.accessToken));
          }

          console.log("Vendor token saved:", localStorage.getItem("vendor_token") ? "YES" : "NO");

          window.location.href = "vendor-dashboard.html";
          return;
        }

        // user login
        const res = await api("/auth/login", {
          method: "POST",
          body: { email, password },
          auth: false,
        });

        console.log("Login response:", res);

        if (!res.accessToken) {
          throw new Error("Login failed - no access token received");
        }

        // Store auth data - use localStorage directly as backup
        try {
          storage.set("authType", "user");
          storage.set("user", res.user);
          setToken(res.accessToken);
        } catch (storageErr) {
          console.error("Storage module error, using localStorage directly:", storageErr);
          localStorage.setItem("authType", JSON.stringify("user"));
          localStorage.setItem("user", JSON.stringify(res.user));
          localStorage.setItem("token", JSON.stringify(res.accessToken));
        }

        // Verify storage worked
        const savedToken = localStorage.getItem("token");
        console.log("Token saved:", savedToken ? "YES" : "NO");

        // Check if email is verified
        if (res.user && res.user.emailVerified === false) {
          // Show unverified banner but still allow login
          if (unverifiedBanner) unverifiedBanner.classList.remove("hidden");
          // Still redirect - user can browse but some actions may be restricted
        }

        window.location.href = "index.html";
      } catch (err) {
        alert(err?.message || "Login failed");
        console.error(err);
      } finally {
        setLoading(btn, false);
      }
    });
  }
})();
