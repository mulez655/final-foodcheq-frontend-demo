// js/admin-guard.js
import { api } from "./api.js";
import { storage } from "./storage.js";

function showCheckingScreen() {
  const el = document.createElement("div");
  el.id = "adminChecking";
  el.className =
    "fixed inset-0 z-[999] flex items-center justify-center bg-slate-50 text-slate-700";

  el.innerHTML = `
    <div class="flex flex-col items-center gap-4">
      <div class="h-12 w-12 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin"></div>
      <p class="text-sm font-semibold tracking-wide">Checking admin session…</p>
    </div>
  `;

  document.body.appendChild(el);
}

function redirectToAdminLogin() {
  window.location.replace("admin-login.html");
}

async function ensureAdminSession() {
  showCheckingScreen();

  const token =
    storage.get("token", "") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    "";

  // No token at all
  if (!token || String(token).length < 10) {
    setTimeout(redirectToAdminLogin, 250);
    return;
  }

  try {
    const res = await api("/auth/me", { auth: true });
    const role = res?.user?.role || "";

    if (role !== "ADMIN") {
      // Clean everything
      storage.remove("token");
      storage.remove("refreshToken");
      storage.remove("user");
      storage.remove("authType");

      try {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
      } catch {}

      setTimeout(redirectToAdminLogin, 250);
      return;
    }

    // ✅ Admin verified — allow page to load
    const checker = document.getElementById("adminChecking");
    checker?.remove();
  } catch (err) {
    setTimeout(redirectToAdminLogin, 250);
  }
}

ensureAdminSession();
