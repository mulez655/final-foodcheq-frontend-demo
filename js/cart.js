// js/cart.js
// Cart now stores prices in USD cents for currency flexibility
import { storage } from "./storage.js";

const CART_KEY = "foodcheq_cart_v2"; // v2 uses USD cents
const LEGACY_KEY = "cart";
const V1_KEY = "foodcheq_cart_v1";

function readLegacyCart() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Normalize any cart item to the v2 format (USD cents)
function normalizeItem(x) {
  const productId = x.productId || x.id || x.slug || x.name;
  const quantity = Math.max(1, Number(x.quantity ?? x.qty ?? 1) || 1);

  // Prefer priceUsdCents, fallback to priceKobo converted (assume 1600 rate if migrating)
  let priceUsdCents = Number(x.priceUsdCents || 0);
  if (!priceUsdCents && x.priceKobo) {
    // Migrate from kobo to USD cents (rough estimate)
    priceUsdCents = Math.round(Number(x.priceKobo) / 1600);
  }
  if (!priceUsdCents && x.price != null) {
    priceUsdCents = Math.round(Number(x.price) * 100);
  }

  return {
    productId: String(productId || ""),
    name: x.name || "Item",
    priceUsdCents: Number.isFinite(priceUsdCents) ? priceUsdCents : 0,
    quantity,
  };
}

function migrateLegacyIfNeeded() {
  const current = storage.get(CART_KEY, []);
  if (Array.isArray(current) && current.length) return;

  // Try v1 first
  const v1 = storage.get(V1_KEY, []);
  if (Array.isArray(v1) && v1.length) {
    const migrated = v1.map(normalizeItem).filter((x) => x.productId);
    storage.set(CART_KEY, migrated);
    storage.remove(V1_KEY);
    return;
  }

  // Try legacy
  const legacy = readLegacyCart();
  if (!legacy.length) return;

  const migrated = legacy
    .map(normalizeItem)
    .filter((x) => x.productId);

  storage.set(CART_KEY, migrated);
  localStorage.removeItem(LEGACY_KEY);
}

export function getCart() {
  migrateLegacyIfNeeded();

  const raw = storage.get(CART_KEY, []);
  const list = Array.isArray(raw) ? raw : [];
  // always normalize to avoid weird shapes
  return list.map(normalizeItem).filter((x) => x.productId);
}

export function setCart(items) {
  const list = Array.isArray(items) ? items : [];
  storage.set(CART_KEY, list.map(normalizeItem).filter((x) => x.productId));
}

export function clearCart() {
  storage.remove(CART_KEY);
}

export function addToCart(product, qty = 1) {
  migrateLegacyIfNeeded();

  const cart = getCart();
  const quantity = Math.max(1, Number(qty) || 1);

  const id = product.productId || product.id;
  if (!id) return;

  const i = cart.findIndex((x) => x.productId === id);

  const priceUsdCents = Number(product.priceUsdCents || 0);
  const name = product.name || "Item";

  if (i >= 0) {
    cart[i].quantity += quantity;

    // If old item had 0, update it
    if (!cart[i].priceUsdCents && priceUsdCents) cart[i].priceUsdCents = priceUsdCents;
    if (!cart[i].name && name) cart[i].name = name;
  } else {
    cart.push({
      productId: String(id),
      name,
      priceUsdCents: Number.isFinite(priceUsdCents) ? priceUsdCents : 0,
      quantity,
    });
  }

  setCart(cart);
}

export function updateQty(productId, qty) {
  const cart = getCart();
  const quantity = Math.max(1, Number(qty) || 1);

  const next = cart.map((x) =>
    x.productId === productId ? { ...x, quantity } : x
  );

  setCart(next);
}

export function removeItem(productId) {
  const cart = getCart().filter((x) => x.productId !== productId);
  setCart(cart);
}

export function cartTotalUsdCents() {
  return getCart().reduce(
    (sum, x) => sum + Number(x.priceUsdCents || 0) * Number(x.quantity || 0),
    0
  );
}

// Alias for backwards compatibility
export function cartTotalKobo() {
  // This is now deprecated - use cartTotalUsdCents instead
  return cartTotalUsdCents();
}

export function cartCount() {
  return getCart().reduce((sum, x) => sum + Number(x.quantity || 0), 0);
}
