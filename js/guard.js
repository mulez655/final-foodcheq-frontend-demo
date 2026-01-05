// js/guard.js
import { getToken, clearToken } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  const page = (location.pathname.split("/").pop() || "").toLowerCase();

  // if logged in, don't open auth pages
  if (token && (page === "login.html" || page === "register.html")) {
    location.replace("index.html");
    return;
  }

  // if not logged in, protect checkout
// if not logged in, protect checkout + orders
if (!token && (page === "checkout.html" || page === "orders.html")) {
  location.replace("login.html");
  return;
}


  // logout anywhere
  document.querySelectorAll('[data-logout="true"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      clearToken();
      location.href = "login.html";
    });
  });
});
