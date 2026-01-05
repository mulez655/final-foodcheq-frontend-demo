// js/admin-login.js
import { api, setToken } from "./api.js";
import { storage } from "./storage.js";

const $ = (s) => document.querySelector(s);

function showMsg(type, text) {
  const el = $("#adminLoginMsg");
  if (!el) return;
  el.classList.remove("hidden");
  el.textContent = text;

  el.className =
    "mt-5 rounded-2xl border px-4 py-3 text-sm " +
    (type === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800");
}

async function alreadyAdmin() {
  try {
    const res = await api("/auth/me", { auth: true });
    if (res?.user?.role === "ADMIN") {
      window.location.href = "admin.html";
      return true;
    }
  } catch {}
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  // If already logged in as admin, skip login page
  await alreadyAdmin();

  const form = $("#adminLoginForm");
  const btn = $("#btnAdminLogin");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("#email")?.value?.trim();
    const password = $("#password")?.value;

    if (!email || !password) return;

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Signing in...";

    try {
      const res = await api("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });

      const token = res?.accessToken;
      const user = res?.user;

      if (!token) throw new Error("No access token returned.");
      setToken(token);
      storage.set("refreshToken", res?.refreshToken || "");
      storage.set("user", user || null);
      storage.set("authType", "user");

      // Must be admin
      if ((user?.role || "") !== "ADMIN") {
        // kick them out of admin flow
        setToken("");
        storage.remove("refreshToken");
        storage.remove("user");
        storage.remove("authType");
        throw new Error("This account is not an admin.");
      }

      showMsg("ok", "Welcome admin ✅ Redirecting...");
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 350);
    } catch (err) {
      showMsg("err", err?.message || "Login failed.");
    } finally {
      btn.disabled = false;
      btn.textContent = old || "Sign in";
    }
  });
});
