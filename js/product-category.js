// js/product-category.js
import { api, SERVER_BASE } from "./api.js";
import { addToCart } from "./cart.js";
import { getWishlistIds, toggleWishlist, syncWishlistFromServer } from "./wishlist.js";
import { getCurrency, getFxRate, formatMoney } from "./currency.js";

(function () {
  const grid = document.getElementById("productGrid");
  const loading = document.getElementById("shopLoading"); // optional element
  const empty = document.getElementById("shopEmpty");
  const searchInput = document.getElementById("shopSearch");
  const sortSelect = document.getElementById("sortProducts");

  const state = {
    q: "",
    sort: "az",
    list: [],
    fxRate: 0,
  };

  // ✅ backend origin (for /uploads/* paths) - imported from api.js
  const BACKEND_ORIGIN = SERVER_BASE;

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ Fix relative image paths coming from backend
  function imgSrc(url) {
    const u = String(url || "").trim();
    if (!u) return "images/placeholder.jpg";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/uploads/")) return `${BACKEND_ORIGIN}${u}`;
    if (u.startsWith("/")) return `${BACKEND_ORIGIN}${u}`;
    return u;
  }

  // Get USD cents for sorting
  function getProductPriceUsdCents(p) {
    return Number(p?.priceUsdCents || 0);
  }

  // ----------------- SKELETONS -----------------
  function skeletonCardHTML() {
    return `
      <article class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div class="aspect-[4/3] bg-slate-100 animate-pulse"></div>
        <div class="p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="h-4 w-2/3 bg-slate-100 rounded animate-pulse"></div>
            <div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse"></div>
          </div>
          <div class="h-3 w-full bg-slate-100 rounded animate-pulse"></div>
          <div class="h-3 w-5/6 bg-slate-100 rounded animate-pulse"></div>
        </div>
        <div class="px-4 pb-4">
          <div class="h-10 w-full bg-slate-100 rounded-xl animate-pulse"></div>
          <div class="mt-3 h-8 w-28 bg-slate-100 rounded-xl animate-pulse"></div>
        </div>
      </article>
    `;
  }

  function renderSkeletons(count = 12) {
    if (!grid) return;
    empty?.classList.add("hidden");
    grid.classList.remove("hidden");
    grid.innerHTML = Array.from({ length: count }).map(skeletonCardHTML).join("");
  }
  // --------------------------------------------

  function applyFilters() {
    const q = state.q.trim().toLowerCase();

    let filtered = state.list.filter((p) => {
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });

    const s = state.sort;
    filtered.sort((a, b) => {
      if (s === "az") return (a.name || "").localeCompare(b.name || "");
      if (s === "za") return (b.name || "").localeCompare(a.name || "");
      if (s === "low-high") return getProductPriceUsdCents(a) - getProductPriceUsdCents(b);
      if (s === "high-low") return getProductPriceUsdCents(b) - getProductPriceUsdCents(a);
      return 0;
    });

    return filtered;
  }

  function cardHTML(p, wishlistIds) {
    const active = wishlistIds?.has?.(p.id);
    const usdCents = getProductPriceUsdCents(p);
    const priceDisplay = usdCents > 0 ? formatMoney(usdCents, getCurrency(), state.fxRate) : "—";

    return `
      <article class="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition">
        <!-- Wishlist -->
        <button
          class="absolute top-3 right-3 z-40 h-10 w-10 grid place-items-center rounded-full border border-slate-200 bg-white/95 backdrop-blur hover:bg-slate-50 transition
            ${active ? "border-rose-200 bg-rose-50" : ""}"
          data-wishlist
          data-id="${escapeHtml(p.id)}"
          aria-label="Add to wishlist"
          title="Wishlist"
        >
          <i class="${active ? "fa-solid fa-heart text-rose-600" : "fa-regular fa-heart text-slate-700"}"></i>
        </button>

        <a href="product.html?id=${encodeURIComponent(p.id)}" class="block">
          <div class="aspect-[4/3] bg-slate-50 overflow-hidden">
            <img
              src="${escapeHtml(imgSrc(p.imageUrl))}"
              alt="${escapeHtml(p.name)}"
              class="h-full w-full object-cover group-hover:scale-[1.03] transition"
              loading="lazy"
            />
          </div>

          <div class="p-4">
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-semibold leading-tight">${escapeHtml(p.name)}</h3>
              <span class="shrink-0 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold">
                ${priceDisplay}
              </span>
            </div>

            <p class="mt-2 text-sm text-slate-600 line-clamp-2">
              ${escapeHtml(p.shortDesc || "Premium product — natural and effective.")}
            </p>
          </div>
        </a>

        <div class="px-4 pb-4">
          <button
            class="js-add-to-cart w-full rounded-xl bg-emerald-600 text-white py-2 text-sm font-semibold hover:bg-emerald-700 transition"
            data-id="${escapeHtml(p.id)}"
            data-name="${escapeHtml(p.name)}"
            data-priceusdcents="${escapeHtml(String(usdCents))}"
          >
            <i class="fa-solid fa-cart-shopping mr-2"></i>
            Add to Cart
          </button>
        </div>
      </article>
    `;
  }

  function attachCartActions() {
    if (!grid) return;

    grid.querySelectorAll(".js-add-to-cart").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;

        const originalHTML = btn.innerHTML;

        btn.disabled = true;
        btn.classList.add("opacity-70", "cursor-not-allowed");
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Adding…`;

        try {
          const product = {
            id: btn.dataset.id,
            name: btn.dataset.name,
            priceUsdCents: Number(btn.dataset.priceusdcents || 0),
          };

          addToCart(product, 1);

          if (typeof window.__updateNavBadges === "function") {
            window.__updateNavBadges();
          }
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove("opacity-70", "cursor-not-allowed");
            btn.innerHTML = originalHTML;
          }, 350);
        }
      });
    });
  }

  // ---------------------- Wishlist ----------------------
  function setHeartUI(btn, active) {
    btn.classList.toggle("border-rose-200", active);
    btn.classList.toggle("bg-rose-50", active);

    const icon = btn.querySelector("i");
    if (icon) {
      icon.className = active
        ? "fa-solid fa-heart text-rose-600"
        : "fa-regular fa-heart text-slate-700";
    }
  }

  function wireWishlistClicks() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-wishlist]");
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      const isActiveNow = btn.classList.contains("bg-rose-50");
      const nextActive = !isActiveNow;

      // optimistic
      setHeartUI(btn, nextActive);

      try {
        btn.disabled = true;
        const res = await toggleWishlist(id, isActiveNow);
        setHeartUI(btn, !!res.active);
      } catch (err) {
        setHeartUI(btn, isActiveNow);
        alert(err?.message || "Wishlist action failed");
      } finally {
        btn.disabled = false;
        if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
      }
    });
  }

  async function render() {
    loading?.classList.add("hidden");

    const list = applyFilters();

    if (!list.length) {
      grid?.classList.add("hidden");
      empty?.classList.remove("hidden");
      return;
    }

    empty?.classList.add("hidden");
    grid?.classList.remove("hidden");

    const wishlistIds = await getWishlistIds();
    grid.innerHTML = list.map((p) => cardHTML(p, wishlistIds)).join("");

    attachCartActions();

    if (typeof window.__updateNavBadges === "function") {
      window.__updateNavBadges();
    }
  }

  async function init() {
    try {
      loading?.classList.remove("hidden");
      renderSkeletons(12);

      // Load FX rate for NGN conversion
      state.fxRate = await getFxRate();

      // Sync wishlist from server (if logged in)
      await syncWishlistFromServer();

      // Load products
      const res = await api("/products");
      state.list = Array.isArray(res.products) ? res.products : [];

      await render();

      searchInput?.addEventListener("input", (e) => {
        state.q = e.target.value || "";
        render();
      });

      sortSelect?.addEventListener("change", (e) => {
        state.sort = e.target.value || "az";
        render();
      });

      wireWishlistClicks();
    } catch (err) {
      console.error("Failed to load products:", err);
      loading?.classList.add("hidden");
      grid?.classList.add("hidden");
      empty?.classList.remove("hidden");
    }
  }

  // Re-render when currency changes
  window.addEventListener("currencyChange", () => {
    render();
  });

  init();
})();
