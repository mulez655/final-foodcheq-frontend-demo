// js/cart-page.js
import { getCart, updateQty, removeItem, cartTotalUsdCents } from "./cart.js";
import { getToken } from "./api.js";
import { getCurrency, getFxRate, formatMoney } from "./currency.js";

const $ = (sel) => document.querySelector(sel);

let cachedFxRate = 0;

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  const cart = getCart();
  const currency = getCurrency();

  const empty = $("#emptyCart");
  const section = $("#cartSection");
  const list = $("#cartList");
  const subtotalEl = $("#cartSubtotal");
  const totalEl = $("#cartTotal");

  if (!empty || !section || !list || !subtotalEl || !totalEl) return;

  if (!cart.length) {
    empty.classList.remove("hidden");
    section.classList.add("hidden");
    subtotalEl.textContent = formatMoney(0, currency, cachedFxRate);
    totalEl.textContent = formatMoney(0, currency, cachedFxRate);
    if (typeof window.__updateCartBadges === "function") window.__updateCartBadges();
    return;
  }

  empty.classList.add("hidden");
  section.classList.remove("hidden");

  const totalCents = cartTotalUsdCents();
  subtotalEl.textContent = formatMoney(totalCents, currency, cachedFxRate);
  totalEl.textContent = formatMoney(totalCents, currency, cachedFxRate);

  list.innerHTML = cart
    .map((item) => {
      const qty = Number(item.quantity || 1);
      const priceUsdCents = Number(item.priceUsdCents || 0);
      const lineCents = priceUsdCents * qty;

      return `
        <div class="p-5 flex gap-4 border-b border-slate-200" data-row="${escapeHtml(item.productId)}">
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold text-slate-900 truncate">${escapeHtml(item.name)}</p>
                <p class="mt-1 text-sm text-slate-600">${formatMoney(priceUsdCents, currency, cachedFxRate)}</p>
                ${
                  priceUsdCents <= 0
                    ? `<p class="mt-1 text-xs text-amber-700">Price missing. Re-add this item from the shop.</p>`
                    : ""
                }
              </div>

              <button
                type="button"
                class="text-sm font-semibold text-red-600 hover:text-red-700"
                data-remove="${escapeHtml(item.productId)}"
              >
                Remove
              </button>
            </div>

            <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div class="inline-flex items-center gap-2">
                <button
                  type="button"
                  class="h-9 w-9 rounded-xl border border-slate-200 hover:bg-slate-50"
                  data-minus="${escapeHtml(item.productId)}"
                >−</button>

                <span class="min-w-[44px] text-center font-semibold">${qty}</span>

                <button
                  type="button"
                  class="h-9 w-9 rounded-xl border border-slate-200 hover:bg-slate-50"
                  data-plus="${escapeHtml(item.productId)}"
                >+</button>
              </div>

              <div class="text-sm">
                <span class="text-slate-600">Line total:</span>
                <span class="font-bold text-slate-900">${formatMoney(lineCents, currency, cachedFxRate)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Events
  list.querySelectorAll("[data-minus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-minus");
      const cart = getCart();
      const item = cart.find((x) => x.productId === id);
      if (!item) return;
      updateQty(id, Math.max(1, Number(item.quantity || 1) - 1));
      render();
    });
  });

  list.querySelectorAll("[data-plus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-plus");
      const cart = getCart();
      const item = cart.find((x) => x.productId === id);
      if (!item) return;
      updateQty(id, Number(item.quantity || 1) + 1);
      render();
    });
  });

  list.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove");
      removeItem(id);
      render();
    });
  });

  if (typeof window.__updateCartBadges === "function") window.__updateCartBadges();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Load FX rate for currency conversion
  cachedFxRate = await getFxRate();

  render();

  const checkoutBtn = document.querySelector("[data-checkout-btn]");
  checkoutBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      window.location.href = "login.html";
      return;
    }
    window.location.href = "checkout.html";
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "foodcheq_cart_v2") render();
  });
});

// Re-render when currency changes
window.addEventListener("currencyChange", () => {
  render();
});
