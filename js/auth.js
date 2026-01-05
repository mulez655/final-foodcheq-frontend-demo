// js/auth.js (module)
import { storage } from "./storage.js";

async function mountComponent(selector, path) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  el.innerHTML = await res.text();
}

function isLoggedIn() {
  // ✅ treat both user + vendor as logged-in
  const userToken = storage.get("token", "");
  const vendorToken = storage.get("vendor_token", "");

  return (
    (typeof userToken === "string" && userToken.length > 10) ||
    (typeof vendorToken === "string" && vendorToken.length > 10)
  );
}

function isVendor() {
  const vendorToken = storage.get("vendor_token", "");
  const authType = storage.get("authType", "user");
  return authType === "vendor" && typeof vendorToken === "string" && vendorToken.length > 10;
}

function logoutEverywhere() {
  // user tokens
  storage.remove("token");
  storage.remove("refreshToken");

  // vendor tokens
  storage.remove("vendor_token");
  storage.remove("vendor_refreshToken");

  // profiles
  storage.remove("user");
  storage.remove("vendor");
  storage.remove("authType");

  window.location.href = "login.html";
}

function wireAuthUI() {
  const loggedIn = isLoggedIn();

  document.querySelectorAll("[data-guest]").forEach((el) => {
    el.classList.toggle("hidden", loggedIn);
  });

  document.querySelectorAll("[data-user]").forEach((el) => {
    el.classList.toggle("hidden", !loggedIn);
  });

  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      logoutEverywhere();
    };
  }
}

(async function initLayout() {
  try {
    const loggedIn = isLoggedIn();
    const vendor = isVendor();

    // ✅ Pick the right navbar depending on auth state
    let navbarPath = "./components/navbar-public.html";
    if (loggedIn) {
      navbarPath = vendor
        ? "./components/navbar-vendor.html"
        : "./components/navbar.html";
    }

    await mountComponent("#navbarMount", navbarPath);
    await mountComponent("#footerMount", "./components/footer.html");

    // ✅ wire visibility + logout
    wireAuthUI();

    // ✅ IMPORTANT: init drawer + badges after navbar HTML is mounted
    window.initNavbar?.();
  } catch (err) {
    console.error(err);
  }
})();
