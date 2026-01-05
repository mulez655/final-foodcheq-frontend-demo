// js/wishlist-page.js
import { api, getToken, resolveImageUrl } from "./api.js";
import { addToCart } from "./cart.js";
import { getWishlistIds, removeFromWishlist, syncWishlistFromServer } from "./wishlist.js";
import { getCurrency, getFxRate, formatMoney } from "./currency.js";

const $ = (s) => document.querySelector(s);

let cachedFxRate = 0;

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(p) {
  const usdCents = Number(p?.priceUsdCents || 0);
  if (usdCents > 0) {
    return formatMoney(usdCents, getCurrency(), cachedFxRate);
  }
  return "—";
}

function cardHTML(item) {
  const p = item.product || {};
  const img = resolveImageUrl(p.imageUrl);
  const usdCents = Number(p.priceUsdCents || 0);

  return `
    <article class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="block">
        <div class="aspect-[4/3] bg-slate-50 overflow-hidden">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}"
               class="h-full w-full object-cover" loading="lazy" />
        </div>
      </a>

      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-semibold leading-tight">${escapeHtml(p.name || "Product")}</h3>
          <span class="shrink-0 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold">
            ${escapeHtml(formatPrice(p))}
          </span>
        </div>

        <p class="mt-2 text-sm text-slate-600 line-clamp-2">
          ${escapeHtml(p.shortDesc || "Saved item.")}
        </p>

        <div class="mt-4 flex items-center gap-2">
          <button
            class="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-sm font-semibold hover:bg-emerald-700 transition js-add"
            data-id="${escapeHtml(p.id)}"
            data-name="${escapeHtml(p.name)}"
            data-priceusdcents="${escapeHtml(String(usdCents))}"
          >
            <i class="fa-solid fa-cart-shopping mr-2"></i>
            Add to Cart
          </button>

          <button
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 js-remove"
            data-id="${escapeHtml(p.id)}"
            title="Remove"
            aria-label="Remove"
          >
            <i class="fa-solid fa-trash text-rose-600"></i>
          </button>
        </div>
      </div>
    </article>
  `;
}

async function renderFromServer() {
  const grid = $("#wishlistGrid");
  const empty = $("#wishlistEmpty");
  if (!grid || !empty) return;

  // Sync ids so navbar badge matches server
  await syncWishlistFromServer();

  const res = await api("/wishlist", { auth: "user" });
  const items = Array.isArray(res?.items) ? res.items : [];

  if (!items.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = items.map(cardHTML).join("");

  wireActions(grid);
}

async function renderFromLocalFallback() {
  // If not logged in, we can still show saved IDs by pulling /products and filtering.
  const grid = $("#wishlistGrid");
  const empty = $("#wishlistEmpty");
  if (!grid || !empty) return;

  const ids = await getWishlistIds();
  if (!ids.size) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
    return;
  }

  const res = await api("/products", { auth: false });
  const list = Array.isArray(res?.products) ? res.products : [];
  const picked = list.filter((p) => ids.has(p.id));

  if (!picked.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = picked
    .map((p) => cardHTML({ product: p }))
    .join("");

  wireActions(grid);
}

function wireActions(grid) {
  // Add to cart
  grid.querySelectorAll(".js-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = {
        id: btn.dataset.id,
        name: btn.dataset.name,
        priceUsdCents: Number(btn.dataset.priceusdcents || 0),
      };
      addToCart(product, 1);
      if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
    });
  });

  // Remove
  grid.querySelectorAll(".js-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!id) return;

      btn.disabled = true;

      try {
        await removeFromWishlist(id);

        // re-render the page
        const token = getToken?.() || "";
        if (token) await renderFromServer();
        else await renderFromLocalFallback();
      } catch (e) {
        alert(e?.message || "Failed to remove from wishlist");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function init() {
  try {
    // Load FX rate for currency conversion
    cachedFxRate = await getFxRate();

    const token = getToken?.() || "";
    if (token) {
      await renderFromServer();
    } else {
      await renderFromLocalFallback();
    }
  } catch (e) {
    console.error("Wishlist page render error:", e);
    // fallback
    await renderFromLocalFallback();
  }
}

document.addEventListener("DOMContentLoaded", init);

// Re-render when currency changes
window.addEventListener("currencyChange", async () => {
  const token = getToken?.() || "";
  if (token) {
    await renderFromServer();
  } else {
    await renderFromLocalFallback();
  }
});
