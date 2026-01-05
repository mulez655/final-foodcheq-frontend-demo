// js/checkout-summary.js
import { getCart, cartTotalUsdCents } from "./cart.js";
import { getCurrency, getFxRate, formatMoney, usdCentsToKobo } from "./currency.js";

let cachedFxRate = 0;

// Escape HTML to prevent XSS
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Shipping fees in USD cents
const SHIPPING_FEES_USD_CENTS = {
  standard: 500,   // $5.00
  express: 1500,   // $15.00
};

// Get current payment method (determines currency)
function getPaymentMethod() {
  const selected = document.querySelector('input[name="paymentMethod"]:checked');
  return selected?.value || "paypal";
}

// Get current shipping type
function getShippingType() {
  const selected = document.querySelector('input[name="shippingType"]:checked');
  return selected?.value || "standard";
}

// Get currency based on payment method
function getCurrencyForPayment(paymentMethod) {
  return paymentMethod === "paypal" ? "USD" : "NGN";
}

// Format amount based on payment method
function formatForPayment(usdCents, paymentMethod) {
  const currency = getCurrencyForPayment(paymentMethod);
  return formatMoney(usdCents, currency, cachedFxRate);
}

// Update shipping price displays in the selection UI
function updateShippingPrices(paymentMethod) {
  const standardEl = document.getElementById("shippingPriceStandard");
  const expressEl = document.getElementById("shippingPriceExpress");

  if (standardEl) {
    standardEl.textContent = formatForPayment(SHIPPING_FEES_USD_CENTS.standard, paymentMethod);
  }
  if (expressEl) {
    expressEl.textContent = formatForPayment(SHIPPING_FEES_USD_CENTS.express, paymentMethod);
  }
}

async function renderOrderSummary() {
  const list = document.getElementById("orderSummaryList");
  const subtotalEl = document.getElementById("orderSubtotal");
  const shippingEl = document.getElementById("orderShipping");
  const totalEl = document.getElementById("orderSummaryTotal");

  if (!list) return;

  const cart = getCart();
  const paymentMethod = getPaymentMethod();
  const shippingType = getShippingType();

  // Update shipping prices in the selection UI
  updateShippingPrices(paymentMethod);

  // Clear list
  list.innerHTML = "";

  if (!cart.length) {
    const empty = document.createElement("li");
    empty.className = "px-4 py-3 text-sm text-slate-600";
    empty.textContent = "Your cart is empty.";
    list.appendChild(empty);

    if (subtotalEl) subtotalEl.textContent = formatForPayment(0, paymentMethod);
    if (shippingEl) shippingEl.textContent = formatForPayment(SHIPPING_FEES_USD_CENTS[shippingType] || SHIPPING_FEES_USD_CENTS.standard, paymentMethod);
    if (totalEl) totalEl.textContent = formatForPayment(SHIPPING_FEES_USD_CENTS[shippingType] || SHIPPING_FEES_USD_CENTS.standard, paymentMethod);
    return;
  }

  let subtotalCents = 0;

  cart.forEach((item) => {
    const qty = Number(item.quantity || 1);
    const priceUsdCents = Number(item.priceUsdCents || 0);
    const lineCents = qty * priceUsdCents;
    subtotalCents += lineCents;

    const li = document.createElement("li");
    li.className = "flex items-center justify-between px-4 py-3 text-sm";
    li.innerHTML = `
      <div class="flex flex-col">
        <strong>${escapeHtml(item.name || "Item")}</strong>
        <small class="text-slate-500">Qty: ${qty}</small>
      </div>
      <span class="font-semibold">${formatForPayment(lineCents, paymentMethod)}</span>
    `;
    list.appendChild(li);
  });

  // Calculate shipping fee
  const shippingFeeCents = SHIPPING_FEES_USD_CENTS[shippingType] || SHIPPING_FEES_USD_CENTS.standard;

  // Calculate total
  const totalCents = subtotalCents + shippingFeeCents;

  // Update display
  if (subtotalEl) subtotalEl.textContent = formatForPayment(subtotalCents, paymentMethod);
  if (shippingEl) shippingEl.textContent = formatForPayment(shippingFeeCents, paymentMethod);
  if (totalEl) totalEl.textContent = formatForPayment(totalCents, paymentMethod);
}

async function init() {
  cachedFxRate = await getFxRate();
  renderOrderSummary();
}

document.addEventListener("DOMContentLoaded", init);

// Listen for cart changes (cross-tab)
window.addEventListener("storage", (e) => {
  if (e.key === "foodcheq_cart_v2") renderOrderSummary();
});

// Listen for currency selector changes (legacy support)
window.addEventListener("currencyChange", () => {
  renderOrderSummary();
});

// Listen for payment method changes
window.addEventListener("paymentMethodChange", () => {
  renderOrderSummary();
});

// Listen for shipping type changes
window.addEventListener("shippingTypeChange", () => {
  renderOrderSummary();
});
