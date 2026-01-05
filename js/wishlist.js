// js/wishlist.js
import { api, getToken } from "./api.js";

const KEY = "wishlist_ids";

// ----- storage helpers (NO storage.js to avoid format mismatch) -----
function readIdsArray() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(parsed.map((x) => String(x || "").trim()).filter(Boolean))
      );
    }
    // if somehow stored as stringified array
    if (typeof parsed === "string") {
      const maybe = JSON.parse(parsed);
      if (Array.isArray(maybe)) return maybe.map(String);
    }
  } catch {
    // if raw is a single id
    if (raw.trim() && raw[0] !== "[") return [raw.trim()];
  }

  return [];
}

function writeIdsArray(arr) {
  const clean = Array.from(
    new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))
  );
  localStorage.setItem(KEY, JSON.stringify(clean));

  // let navbar update immediately
  if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
}

export async function getWishlistIds() {
  return new Set(readIdsArray());
}

export async function wishlistCount() {
  return readIdsArray().length;
}

// Pull from server into local KEY (only if logged in as USER)
export async function syncWishlistFromServer() {
  const token = getToken?.() || "";
  if (!token) return readIdsArray();

  try {
    // Use auth: "user" explicitly - wishlist is user-only, not vendor
    const res = await api("/wishlist/ids", { auth: "user" });
    const ids = Array.isArray(res?.productIds) ? res.productIds.map(String) : [];
    writeIdsArray(ids);
    return ids;
  } catch (e) {
    // if server fails, keep local
    return readIdsArray();
  }
}

export async function addToWishlist(productId) {
  const id = String(productId || "").trim();
  if (!id) throw new Error("Missing product id");

  // optimistic local update
  const arr = readIdsArray();
  if (!arr.includes(id)) arr.unshift(id);
  writeIdsArray(arr);

  // if logged in as USER, persist to server
  const token = getToken?.() || "";
  if (token) {
    try {
      // Use auth: "user" explicitly - wishlist is user-only, not vendor
      await api("/wishlist", { method: "POST", auth: "user", body: { productId: id } });
      // keep local as is
    } catch (e) {
      // rollback if server rejected
      const rolled = readIdsArray().filter((x) => x !== id);
      writeIdsArray(rolled);
      throw e;
    }
  }

  return { success: true, active: true, ids: new Set(readIdsArray()) };
}

export async function removeFromWishlist(productId) {
  const id = String(productId || "").trim();
  if (!id) throw new Error("Missing product id");

  // optimistic local update
  const arr = readIdsArray().filter((x) => x !== id);
  writeIdsArray(arr);

  // if logged in as USER, persist to server
  const token = getToken?.() || "";
  if (token) {
    try {
      // Use auth: "user" explicitly - wishlist is user-only, not vendor
      await api(`/wishlist/${encodeURIComponent(id)}`, { method: "DELETE", auth: "user" });
    } catch (e) {
      // rollback if server rejected
      const rolled = readIdsArray();
      rolled.unshift(id);
      writeIdsArray(rolled);
      throw e;
    }
  }

  return { success: true, active: false, ids: new Set(readIdsArray()) };
}

export async function toggleWishlist(productId, currentlyActive) {
  return currentlyActive ? removeFromWishlist(productId) : addToWishlist(productId);
}
