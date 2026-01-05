// ============================
// CART + WISHLIST FUNCTIONALITY (STANDARDIZED)
// ============================

const CART_KEY = "cart";
const WISHLIST_KEY = "wishlist";

// ---------- CART ----------
function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function normalizeCartItem(item) {
  // Upgrade old shape to new shape
  const productId = item.productId || item.id || null;

  return {
    productId,
    name: item.name || "",
    price: Number(item.price) || 0,
    image: item.image || "",
    qty: Number(item.qty) || 1,
  };
}

function upgradeCartInStorage() {
  const cart = getCart().map(normalizeCartItem);

  // Optional: remove totally broken items
  const cleaned = cart.filter((i) => i.name && i.qty > 0);

  saveCart(cleaned);
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  const badgeDesktop = document.getElementById("cartCount");
  const badgeMobile = document.getElementById("cartCountMobile");

  if (badgeDesktop) badgeDesktop.textContent = String(count);
  if (badgeMobile) badgeMobile.textContent = String(count);

  // also update navbar.js badges if mounted
  if (typeof window.__updateCartBadges === "function") {
    window.__updateCartBadges();
  }
}

function addToCart(product) {
  let cart = getCart().map(normalizeCartItem);

  const normalized = normalizeCartItem(product);
  const qtyToAdd = Number(normalized.qty) || 1;

  // Prefer matching by productId; fallback to name if productId missing
  const existing = cart.find((item) =>
    normalized.productId
      ? item.productId === normalized.productId
      : item.name === normalized.name
  );

  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + qtyToAdd;
  } else {
    cart.push({
      productId: normalized.productId, // ✅ backend-safe
      name: normalized.name,
      price: normalized.price,
      image: normalized.image,
      qty: qtyToAdd,
    });
  }

  saveCart(cart);
  updateCartCount();
}

// ---------- WISHLIST ----------
function getWishlist() {
  try {
    const wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
    return Array.isArray(wishlist) ? wishlist : [];
  } catch {
    return [];
  }
}

function saveWishlist(wishlist) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
}

function updateWishlistCount() {
  const wishlist = getWishlist();
  const count = wishlist.length;

  const badgeDesktop = document.getElementById("wishlistCount");
  const badgeMobile = document.getElementById("wishlistCountMobile");

  if (badgeDesktop) badgeDesktop.textContent = String(count);
  if (badgeMobile) badgeMobile.textContent = String(count);
}

function addToWishlist(product) {
  let wishlist = getWishlist();
  const existing = wishlist.find((item) => item.name === product.name);

  if (!existing) {
    wishlist.push(product);
    saveWishlist(wishlist);
    updateWishlistCount();
    alert(product.name + " added to wishlist!");
  } else {
    alert(product.name + " is already in your wishlist!");
  }
}

// ============================
// EVENT LISTENERS
// ============================

function bindCartButtons(root = document) {
  root.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", function () {
      const qty = parseInt(this.dataset.qty, 10);

      const product = {
        // supports BOTH: data-product-id and data-id (old)
        productId: this.dataset.productId || this.dataset.id || null,
        name: this.dataset.name || "",
        price: parseFloat(this.dataset.price),
        image: this.dataset.image || "",
        qty: Number.isFinite(qty) ? qty : 1,
      };

      if (!product.name) {
        alert("This product is missing required data. Please refresh the page.");
        return;
      }

      addToCart(product);
      alert(product.name + " added to cart!");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // ✅ auto-upgrade old carts so checkout stops complaining
  upgradeCartInStorage();

  bindCartButtons(document);

  document.querySelectorAll(".add-to-wishlist").forEach((btn) => {
    btn.addEventListener("click", function () {
      const product = {
        name: this.dataset.name,
        price: parseFloat(this.dataset.price),
        image: this.dataset.image,
      };
      addToWishlist(product);
    });
  });

  updateCartCount();
  updateWishlistCount();
});

// Optional: expose for pages that render products dynamically (search, shop page)
window.bindCartButtons = bindCartButtons;
window.addToCart = addToCart;
