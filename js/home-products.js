// js/home-products.js
import { api, SERVER_BASE } from "./api.js";
import { addToCart } from "./cart.js";
import { getWishlistIds, toggleWishlist } from "./wishlist.js";
import { getCurrency, getFxRate, formatMoney, usdCentsToKobo } from "./currency.js";

(function () {
  const grid = document.getElementById("homeProductsGrid");
  const empty = document.getElementById("homeProductsEmpty");

  if (!grid) return;

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function badgeText(p) {
    if (p?.status === "PUBLISHED") return "Featured";
    if (p?.category) return String(p.category).slice(0, 16);
    return "Popular";
  }

  // ✅ FIX: resolve relative /uploads paths to full backend URL
  function resolveImageUrl(url) {
    if (!url) return "images/placeholder.jpg";

    // already absolute
    if (url.startsWith("http")) return url;

    // backend static uploads (served at /uploads, not /api/uploads)
    return `${SERVER_BASE}${url}`;
  }


  function renderSkeletons() {
    grid.innerHTML = Array.from({ length: 3 })
      .map(
        () => `
        <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div class="h-56 bg-slate-100 animate-pulse"></div>
          <div class="p-5 space-y-3">
            <div class="h-4 w-2/3 bg-slate-100 rounded animate-pulse"></div>
            <div class="h-6 w-1/2 bg-slate-100 rounded animate-pulse"></div>
            <div class="h-10 w-full bg-slate-100 rounded-xl animate-pulse"></div>
          </div>
        </div>
      `
      )
      .join("");
  }

  function cardHTML(p, wishlistIds, fxRate) {
    const active = wishlistIds?.has?.(p.id);
    const usdCents = Number(p.priceUsdCents || 0);
    const currency = getCurrency();
    const priceDisplay = usdCents > 0 ? formatMoney(usdCents, currency, fxRate) : "—";

    // For cart, always store in USD cents
    const imgUrl = resolveImageUrl(p.imageUrl);

    return `
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition">
        <div class="relative">
          <a href="product.html?id=${encodeURIComponent(p.id)}" class="block">
            <img
              src="${escapeHtml(imgUrl)}"
              alt="${escapeHtml(p.name || "Product")}"
              class="h-56 w-full object-cover"
              loading="lazy"
            />
          </a>

          <span class="absolute left-3 top-3 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            ${escapeHtml(badgeText(p))}
          </span>
        </div>

        <div class="p-5 space-y-3">
          <a href="product.html?id=${encodeURIComponent(p.id)}" class="block font-semibold text-slate-900">
            ${escapeHtml(p.name || "Product")}
          </a>

          <div class="flex items-center justify-between">
            <span class="text-lg font-bold text-emerald-700">
              ${priceDisplay}
            </span>
            <span class="text-sm text-slate-500">
              ${p.isAvailable === false ? "Out of stock" : "In stock"}
            </span>
          </div>

          <button
            class="add-to-cart w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            data-id="${escapeHtml(p.id)}"
            data-name="${escapeHtml(p.name)}"
            data-priceusdcents="${escapeHtml(String(usdCents))}"
            type="button"
          >
            <i class="fas fa-shopping-cart"></i>
            Add to Cart
          </button>
        </div>
      </div>
    `;
  }

  function wireAddToCart() {
    grid.querySelectorAll(".add-to-cart").forEach((btn) => {
      btn.addEventListener("click", () => {
        const product = {
          id: btn.dataset.id,
          name: btn.dataset.name,
          priceUsdCents: Number(btn.dataset.priceusdcents || 0),
        };

        addToCart(product, 1);

        if (typeof window.__updateNavBadges === "function") {
          window.__updateNavBadges();
        } else if (typeof window.__updateCartBadges === "function") {
          window.__updateCartBadges();
        }
      });
    });
  }

  function wireWishlist() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("#homeProductsGrid [data-wishlist]");
      if (!btn) return;

      const id = btn.dataset.id;
      const icon = btn.querySelector("i");
      const isActiveNow = btn.classList.contains("bg-rose-50");
      const nextActive = !isActiveNow;

      // optimistic UI
      btn.classList.toggle("border-rose-200", nextActive);
      btn.classList.toggle("bg-rose-50", nextActive);
      if (icon) {
        icon.className = nextActive
          ? "fa-solid fa-heart text-rose-600"
          : "fa-regular fa-heart text-slate-700";
      }

      try {
        btn.disabled = true;
        const res = await toggleWishlist(id, isActiveNow);

        btn.classList.toggle("border-rose-200", res.active);
        btn.classList.toggle("bg-rose-50", res.active);
        if (icon) {
          icon.className = res.active
            ? "fa-solid fa-heart text-rose-600"
            : "fa-regular fa-heart text-slate-700";
        }
      } catch (err) {
        // rollback
        btn.classList.toggle("border-rose-200", isActiveNow);
        btn.classList.toggle("bg-rose-50", isActiveNow);
        if (icon) {
          icon.className = isActiveNow
            ? "fa-solid fa-heart text-rose-600"
            : "fa-regular fa-heart text-slate-700";
        }
        alert(err?.message || "Wishlist failed");
      } finally {
        btn.disabled = false;
        if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
      }
    });
  }

  let cachedProducts = [];
  let cachedWishlistIds = new Set();
  let cachedFxRate = 0;

  async function renderProducts() {
    if (!cachedProducts.length) {
      grid.innerHTML = "";
      empty?.classList.remove("hidden");
      return;
    }

    empty?.classList.add("hidden");
    grid.innerHTML = cachedProducts.map((p) => cardHTML(p, cachedWishlistIds, cachedFxRate)).join("");

    wireAddToCart();
  }

  async function init() {
    try {
      renderSkeletons();

      // 1) Load products
      const res = await api("/products");
      const list = Array.isArray(res?.products) ? res.products : [];
      cachedProducts = list.slice(0, 3);

      if (!cachedProducts.length) {
        grid.innerHTML = "";
        empty?.classList.remove("hidden");
        return;
      }

      // 2) Get FX rate for NGN conversion
      cachedFxRate = await getFxRate();

      // 3) Get wishlist
      cachedWishlistIds = await getWishlistIds();

      // 4) Render products
      await renderProducts();

      wireWishlist();

      if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
    } catch (err) {
      console.error("Home products error:", err);
      grid.innerHTML = "";
      empty?.classList.remove("hidden");
    }
  }

  // Re-render when currency changes
  window.addEventListener("currencyChange", () => {
    renderProducts();
  });

  document.addEventListener("DOMContentLoaded", init);
})();
