// js/currency.js
// Currency switcher utility - default is USD

import { api } from "./api.js";
import { storage } from "./storage.js";

const STORAGE_KEY = "selectedCurrency";
const DEFAULT_CURRENCY = "USD";

let fxRate = 0; // USD cents to Kobo rate

// Get current selected currency
export function getCurrency() {
  return storage.get(STORAGE_KEY) || DEFAULT_CURRENCY;
}

// Set currency and trigger update
export function setCurrency(currency) {
  storage.set(STORAGE_KEY, currency);
  // Dispatch event for components to re-render
  window.dispatchEvent(new CustomEvent("currencyChange", { detail: { currency } }));
}

// Get FX rate (cached)
export async function getFxRate() {
  if (fxRate > 0) return fxRate;
  try {
    const res = await api("/fx/usd-ngn");
    fxRate = Number(res?.rate || 0);
  } catch {
    fxRate = 0;
  }
  return fxRate;
}

// Convert USD cents to Kobo
export function usdCentsToKobo(usdCents, rate) {
  return Math.round(Number(usdCents || 0) * Number(rate || fxRate || 0));
}

// Format money based on currency
export function formatMoney(usdCents, currency = null, rate = null) {
  const curr = currency || getCurrency();
  const cents = Number(usdCents || 0);

  if (curr === "USD") {
    const amount = cents / 100;
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // NGN - convert to kobo then format
  const r = rate || fxRate;
  if (r <= 0) {
    // Fallback to USD if no rate
    const amount = cents / 100;
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const kobo = usdCentsToKobo(cents, r);
  const amount = kobo / 100;
  return `₦${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Initialize currency selector on page
export function initCurrencySelector() {
  const selector = document.getElementById("currency");
  if (!selector) return;

  // Set initial value
  selector.value = getCurrency();

  // Handle change
  selector.addEventListener("change", (e) => {
    setCurrency(e.target.value);
  });
}

// Auto-init when DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCurrencySelector);
  } else {
    initCurrencySelector();
  }
}
