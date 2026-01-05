// js/fx.js
import { api } from "./api.js";

const KEY = "foodcheq_fx_usd_ngn_rate";
const KEY_TIME = "foodcheq_fx_usd_ngn_rate_time";
const TTL_MS = 1000 * 60 * 30; // 30 mins cache
const FALLBACK_RATE = 1600;

// ✅ Existing function (kept)
export async function getUsdNgnRate() {
  try {
    const last = Number(localStorage.getItem(KEY_TIME) || 0);
    const cached = Number(localStorage.getItem(KEY) || 0);

    if (cached > 0 && Date.now() - last < TTL_MS) return cached;

    const res = await api("/fx/usd-ngn", { auth: false });
    const rate = Number(res?.rate || 0);

    if (rate > 0) {
      localStorage.setItem(KEY, String(rate));
      localStorage.setItem(KEY_TIME, String(Date.now()));
      return rate;
    }

    return cached > 0 ? cached : FALLBACK_RATE;
  } catch {
    const cached = Number(localStorage.getItem(KEY) || 0);
    return cached > 0 ? cached : FALLBACK_RATE;
  }
}

// ✅ Alias (so other files can call the name we used)
export async function getUsdToNgnRate() {
  return getUsdNgnRate();
}

// usdCents -> kobo (IMPORTANT FORMULA)
// kobo = usdCents * rate (because: cents/100 * rate * 100)
export function usdCentsToKobo(usdCents, rateNgnPerUsd) {
  return Math.round(Number(usdCents || 0) * Number(rateNgnPerUsd || 0));
}

// ✅ Alias name used by cart-page.js
export function usdCentsToNgnKobo(usdCents, rateNgnPerUsd) {
  return usdCentsToKobo(usdCents, rateNgnPerUsd);
}

export function formatNairaFromKobo(kobo) {
  const amount = Number(kobo || 0) / 100;
  return `₦${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatUsdFromCents(usdCents) {
  const amount = Number(usdCents || 0) / 100;
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
