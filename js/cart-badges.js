// js/cart-badges.js
import { cartCount } from "./cart.js";
import { wishlistCount } from "./wishlist.js";

function setBadge(el, count) {
  if (!el) return;
  const n = Number(count || 0);

  el.textContent = String(n);
  if (n > 0) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

async function updateBadges() {
  // Update cart badges
  const cCount = cartCount();
  setBadge(document.getElementById("cartCount"), cCount);
  setBadge(document.getElementById("cartCountMobile"), cCount);
  document.querySelectorAll('[data-badge="cart"]').forEach((el) => setBadge(el, cCount));

  // Update wishlist badges
  const wCount = await wishlistCount();
  setBadge(document.getElementById("wishlistCount"), wCount);
  document.querySelectorAll('[data-badge="wishlist"]').forEach((el) => setBadge(el, wCount));
}

// expose globally so layout.js and other scripts can call it
window.__updateCartBadges = updateBadges;
window.__updateWishlistBadges = updateBadges;
window.__updateNavBadges = updateBadges;

document.addEventListener("DOMContentLoaded", () => {
  updateBadges();

  // Update if cart/wishlist changes (same tab updates won't fire storage event,
  // so we also rely on pages calling __updateNavBadges after add/remove)
  window.addEventListener("storage", (e) => {
    if (e.key === "foodcheq_cart_v2" || e.key === "foodcheq_cart_v1" || e.key === "wishlist_ids") {
      updateBadges();
    }
  });
});
