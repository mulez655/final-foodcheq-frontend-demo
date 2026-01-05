import { storage } from "./storage.js";
import { initNavbar } from "./navbar.js";


async function mountComponent(selector, path) {
  const el = document.querySelector(selector);
  if (!el) return;
  const res = await fetch(path);
  el.innerHTML = await res.text();
}

function isLoggedIn() {
  const token = storage.get("token", "");
  return typeof token === "string" && token.length > 10;
}

function wireAuthUI() {
  const loggedIn = isLoggedIn();

  document.querySelectorAll("[data-guest]").forEach(el => {
    el.classList.toggle("hidden", loggedIn);
  });
  document.querySelectorAll("[data-user]").forEach(el => {
    el.classList.toggle("hidden", !loggedIn);
  });

  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      storage.remove("token");
      storage.remove("user");
      window.location.href = "login.html";
    });
  }
}

(async function initLayout() {
  await mountComponent("#navbarMount", "./components/navbar.html");
  await mountComponent("#footerMount", "./components/footer.html");
  wireAuthUI();
  initNavbar();

})();
