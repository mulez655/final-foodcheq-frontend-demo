// js/product.js
import { api, SERVER_BASE } from "./api.js";
import { addToCart } from "./cart.js";
import { getCurrency, getFxRate, formatMoney } from "./currency.js";
import { getWishlistIds, toggleWishlist } from "./wishlist.js";
import { storage } from "./storage.js";

const $ = (sel) => document.querySelector(sel);

// ✅ backend origin (for /uploads/* paths) - imported from api.js
const BACKEND_ORIGIN = SERVER_BASE;

// ✅ Fix relative image paths coming from backend
function imgSrc(url) {
  const u = String(url || "").trim();
  if (!u) return "images/placeholder.jpg";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/uploads/")) return `${BACKEND_ORIGIN}${u}`;
  if (u.startsWith("/")) return `${BACKEND_ORIGIN}${u}`;
  return u;
}

function getProductIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------- Reviews (LocalStorage for now) ----------------
function reviewKey(productId) {
  return `foodcheq_reviews_${productId}`;
}
function getReviews(productId) {
  try {
    return JSON.parse(localStorage.getItem(reviewKey(productId))) || [];
  } catch {
    return [];
  }
}
function saveReviews(productId, reviews) {
  localStorage.setItem(reviewKey(productId), JSON.stringify(reviews));
}
function renderStars(rating) {
  const r = Number(rating) || 0;
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += i <= r ? `<i class="fa-solid fa-star"></i>` : `<i class="fa-regular fa-star"></i>`;
  }
  return html;
}
function renderReviews(productId) {
  const list = $("#reviewsList");
  if (!list) return;

  const reviews = getReviews(productId);

  if (!reviews.length) {
    list.innerHTML = `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      No reviews yet. Be the first!
    </div>`;
    return;
  }

  list.innerHTML = reviews
    .slice()
    .reverse()
    .map(
      (r) => `
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-bold text-emerald-700 truncate">${escapeHtml(r.name)}</p>
            <p class="text-[11px] text-slate-500">Verified Buyer</p>
          </div>
          <div class="text-amber-500 text-xs">${renderStars(r.rating)}</div>
        </div>
        <p class="mt-2 text-sm text-slate-600">"${escapeHtml(r.comment)}"</p>
      </div>
    `
    )
    .join("");
}
function setupReviewForm(productId) {
  const form = $("#reviewForm");
  if (!form) return;

  const stars = document.querySelectorAll("#starRating .star");
  const ratingValue = $("#ratingValue");

  stars.forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.value || 0);
      ratingValue.value = String(v);

      stars.forEach((b) => (b.innerHTML = `<i class="fa-regular fa-star"></i>`));
      for (let i = 0; i < v; i++) stars[i].innerHTML = `<i class="fa-solid fa-star"></i>`;
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#reviewName")?.value?.trim();
    const comment = $("#reviewComment")?.value?.trim();
    const rating = Number($("#ratingValue")?.value || 0);

    if (!name || !comment) return;
    if (!rating) {
      alert("Please select a rating.");
      return;
    }

    const reviews = getReviews(productId);
    reviews.push({ name, comment, rating, createdAt: Date.now() });
    saveReviews(productId, reviews);

    form.reset();
    $("#ratingValue").value = "0";
    stars.forEach((b) => (b.innerHTML = `<i class="fa-regular fa-star"></i>`));

    renderReviews(productId);
  });
}

// ---------------- Related ----------------
function renderRelated(related, fxRate) {
  const grid = $("#relatedGrid");
  if (!grid) return;

  if (!Array.isArray(related) || !related.length) {
    grid.innerHTML = `<div class="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      No related items yet.
    </div>`;
    return;
  }

  const currency = getCurrency();

  grid.innerHTML = related
    .slice(0, 12)
    .map((p) => {
      const usdCents = Number(p.priceUsdCents || 0);
      const priceDisplay = usdCents > 0 ? formatMoney(usdCents, currency, fxRate) : "—";

      return `
        <article class="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-sm transition">
          <a href="product.html?id=${encodeURIComponent(p.id)}" class="block">
            <div class="aspect-[4/3] bg-slate-50">
              <img src="${escapeHtml(imgSrc(p.imageUrl))}" alt="${escapeHtml(p.name)}" class="h-full w-full object-cover" loading="lazy" />
            </div>
            <div class="p-3">
              <p class="text-sm font-semibold line-clamp-2">${escapeHtml(p.name)}</p>
              <p class="mt-1 text-xs font-bold text-emerald-700">${priceDisplay}</p>
            </div>
          </a>
        </article>
      `;
    })
    .join("");
}

// ---------------- Main ----------------
let currentProduct = null;
let cachedFxRate = 0;

async function renderProductPage() {
  const priceEl = $("#productPrice");
  if (!priceEl || !currentProduct) return;

  const usdCents = Number(currentProduct.priceUsdCents || 0);
  const currency = getCurrency();
  priceEl.textContent = usdCents > 0 ? formatMoney(usdCents, currency, cachedFxRate) : "—";
}

document.addEventListener("DOMContentLoaded", async () => {
  const id = getProductIdFromURL();

  const loading = $("#productLoading");
  const notFound = $("#productNotFound");
  const wrap = $("#productWrap");

  if (!id) {
    loading?.classList.add("hidden");
    notFound?.classList.remove("hidden");
    return;
  }

  try {
    loading?.classList.remove("hidden");
    notFound?.classList.add("hidden");
    wrap?.classList.add("hidden");

    cachedFxRate = await getFxRate();

    const res = await api(`/products/${encodeURIComponent(id)}`);
    const product = res?.product;
    const related = res?.related || [];

    if (!product?.id) throw new Error("Product not found");

    currentProduct = product;
    const usdCents = Number(product.priceUsdCents || 0);
    const currency = getCurrency();

    // Core
    const img = $("#productImage");
    if (img) {
      img.src = imgSrc(product.imageUrl);
      img.alt = product.name || "Product image";
    }

    $("#productName").textContent = product.name || "Product";
    $("#productCategory").textContent = product.category || "Shop";
    $("#productShort").textContent =
      product.shortDesc || "Premium herbal product — natural and effective.";
    $("#productPrice").textContent = usdCents > 0 ? formatMoney(usdCents, currency, cachedFxRate) : "—";
    $("#productVendor").textContent = product.vendor?.businessName
      ? `Sold by: ${product.vendor.businessName}`
      : "";

    $("#productDescription").textContent =
      product.description || "No description provided yet.";

    // Benefits
    const benefitsWrap = $("#benefitsWrap");
    const benefitsList = $("#benefitsList");
    const benefits = Array.isArray(product.benefits) ? product.benefits : [];

    if (!benefits.length) {
      benefitsWrap?.classList.add("hidden");
    } else {
      benefitsWrap?.classList.remove("hidden");
      benefitsList.innerHTML = benefits
        .map(
          (b) =>
            `<li class="flex gap-2"><span class="text-emerald-700 font-bold">✔</span><span>${escapeHtml(
              b
            )}</span></li>`
        )
        .join("");
    }

    // Related
    renderRelated(related, cachedFxRate);

    // Reviews
    renderReviews(product.id);
    setupReviewForm(product.id);

    // Add to cart (stores USD cents)
    const btn = $("#btnAddToCart");
    btn?.addEventListener("click", () => {
      if (btn.disabled) return;

      const old = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add("opacity-70", "cursor-not-allowed");
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Adding…`;

      try {
        addToCart(
          {
            id: product.id,
            name: product.name,
            priceUsdCents: usdCents,
          },
          1
        );

        if (typeof window.__updateCartBadges === "function") window.__updateCartBadges();
        if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.classList.remove("opacity-70", "cursor-not-allowed");
          btn.innerHTML = old;
        }, 350);
      }
    });

    // Wishlist button
    const wishBtn = $("#btnWishlist");
    if (wishBtn) {
      // Check if already in wishlist
      const wishlistIds = await getWishlistIds();
      let isInWishlist = wishlistIds.has(product.id);

      // Set initial state
      function updateWishlistButtonUI(active) {
        if (active) {
          wishBtn.classList.remove("border-emerald-200", "text-emerald-700", "hover:bg-emerald-50");
          wishBtn.classList.add("border-rose-200", "bg-rose-50", "text-rose-700", "hover:bg-rose-100");
          wishBtn.innerHTML = `<i class="fa-solid fa-heart mr-2"></i> In Wishlist`;
        } else {
          wishBtn.classList.remove("border-rose-200", "bg-rose-50", "text-rose-700", "hover:bg-rose-100");
          wishBtn.classList.add("border-emerald-200", "text-emerald-700", "hover:bg-emerald-50");
          wishBtn.innerHTML = `<i class="fa-regular fa-heart mr-2"></i> Wishlist`;
        }
      }

      updateWishlistButtonUI(isInWishlist);

      wishBtn.addEventListener("click", async () => {
        if (wishBtn.disabled) return;

        wishBtn.disabled = true;
        const oldHTML = wishBtn.innerHTML;
        wishBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ...`;

        try {
          const result = await toggleWishlist(product.id, isInWishlist);
          isInWishlist = result.active;
          updateWishlistButtonUI(isInWishlist);

          if (typeof window.__updateNavBadges === "function") window.__updateNavBadges();
        } catch (err) {
          alert(err?.message || "Wishlist action failed");
          wishBtn.innerHTML = oldHTML;
        } finally {
          wishBtn.disabled = false;
        }
      });
    }

    // Barter button (for vendors only)
    const barterWrap = $("#barterOfferWrap");
    const barterBtn = $("#btnBarterOffer");

    if (barterWrap && barterBtn) {
      // Check if current user is a vendor - try multiple ways to detect
      let vendorToken = storage.get("vendor_token", "");
      // If storage.get returned nothing, try raw localStorage (may not be JSON encoded)
      if (!vendorToken) {
        const rawToken = localStorage.getItem("vendor_token");
        if (rawToken) {
          try {
            vendorToken = JSON.parse(rawToken);
          } catch {
            vendorToken = rawToken; // Use raw value if not JSON
          }
        }
      }

      let authType = storage.get("authType", "");
      if (!authType) {
        const rawAuthType = localStorage.getItem("authType");
        if (rawAuthType) {
          try {
            authType = JSON.parse(rawAuthType);
          } catch {
            authType = rawAuthType;
          }
        }
      }

      const isVendor = vendorToken && String(vendorToken).length > 10 && authType === "vendor";

      // Get current vendor's ID
      const currentVendor = storage.get("vendor", null);
      const currentVendorId = currentVendor?.id;

      // Get product vendor ID
      const productVendorId = product.vendor?.id || product.vendorId;

      // Show barter button if:
      // 1. Current user is a vendor
      // 2. Either product has no vendor (show anyway) OR product vendor is different from current vendor
      const canBarter = isVendor && (!productVendorId || productVendorId !== currentVendorId);

      console.log("[Barter Debug]", { isVendor, authType, vendorToken: !!vendorToken, currentVendorId, productVendorId, canBarter });

      if (canBarter) {
        barterWrap.classList.remove("hidden");

        barterBtn.addEventListener("click", () => {
          // Store barter prefill data in sessionStorage for reliability
          const barterData = {
            productId: product.id,
            productName: product.name || "",
            vendorId: productVendorId || "",
            vendorName: product.vendor?.businessName || ""
          };
          sessionStorage.setItem("barterPrefill", JSON.stringify(barterData));
          console.log("[Product] Navigating to barter with:", barterData);
          window.location.href = "vendor-barter.html";
        });
      }
    }

    // Show
    loading?.classList.add("hidden");
    wrap?.classList.remove("hidden");

    if (typeof window.__updateCartBadges === "function") window.__updateCartBadges();
  } catch (e) {
    console.error("Product load failed:", e);
    loading?.classList.add("hidden");
    notFound?.classList.remove("hidden");
  }
});

// Re-render when currency changes
window.addEventListener("currencyChange", () => {
  renderProductPage();
});
