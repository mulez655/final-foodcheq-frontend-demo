// js/register-user.js
import { api, setToken } from "./api.js";
import { storage } from "./storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("userRegisterForm");
  if (!form) return;

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.disabled = true;
      btn.dataset.old = btn.innerHTML || "Create User Account";
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating...`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.old || "Create User Account";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.getElementById("firstName")?.value?.trim() || "";
    const lastName = document.getElementById("lastName")?.value?.trim() || "";
    const email = document.getElementById("email")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";

    // Backend expects: { email, password, name? }
    const name = `${firstName} ${lastName}`.trim();

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true);

    try {
      const res = await api("/auth/register", {
        method: "POST",
        body: { email, password, name },
        auth: false,
      });

      // Debug: Log the response to see what we're getting
      console.log("Registration response:", res);

      // Your backend returns: { success, message, user, accessToken, refreshToken }
      if (!res?.accessToken) {
        // Provide more details about what was returned
        console.error("Response missing accessToken:", res);
        throw new Error(res?.message || "Registration failed - no access token returned.");
      }

      storage.set("authType", "user");
      storage.set("user", res.user || {});
      storage.set("refreshToken", res.refreshToken || "");
      setToken(res.accessToken);

      // Update UI after register
      if (typeof window.__setAuthUI === "function") window.__setAuthUI();
      if (typeof window.__updateCartBadges === "function") window.__updateCartBadges();

      // Redirect to email verification page
      window.location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
    } catch (err) {
      console.error("Registration error:", err);
      alert(err?.message || "Registration failed");
    } finally {
      setLoading(btn, false);
    }
  });
});
