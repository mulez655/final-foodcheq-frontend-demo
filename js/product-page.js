// js/product-page.js
(function () {
  const DATA = window.PRODUCTS_DATA || {};
  const bySlug = DATA.bySlug || {};
  const products = Array.isArray(DATA.products) ? DATA.products : [];

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || "";
  }

  function money(n) {
    const num = Number(n || 0);
    return `$${num.toFixed(2)}`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html ?? "";
  }

  function renderStars(rating) {
    const r = Number(rating || 0);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html +=
        i <= r
          ? '<i class="fa-solid fa-star"></i>'
          : '<i class="fa-regular fa-star"></i>';
    }
    return html;
  }

  function fallbackAddToCart(item) {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const existing = cart.find((x) => x.name === item.name);
    if (existing) existing.qty += item.qty || 1;
    else cart.push(item);
    localStorage.setItem("cart", JSON.stringify(cart));
  }

  function fallbackAddToWishlist(item) {
    const wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
    const exists = wishlist.some((x) => x.name === item.name);
    if (!exists) wishlist.push(item);
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  }

  function init() {
    const slug = getSlug();
    const product = bySlug[slug];

    if (!product) {
      document.title = "Product not found | FoodCheQ";
      document.querySelector("main").innerHTML = `
        <section class="mx-auto max-w-2xl bg-white border rounded-2xl p-6 shadow-soft">
          <h1 class="text-xl font-bold">Product not found</h1>
          <p class="mt-2 text-slate-600">That product link is invalid or the item was removed.</p>
          <a href="product-category.html" class="mt-4 inline-flex rounded-xl bg-brand-green px-5 py-3 text-white font-semibold hover:opacity-90">
            Back to Shop
          </a>
        </section>
      `;
      return;
    }

    // Title
    document.title = `${product.name} | FoodCheQ`;

    // Fill core UI
    const img = document.getElementById("productImage");
    if (img) {
      img.src = product.image || "";
      img.alt = product.name || "Product";
    }

    setText("productName", product.name || "Product");

    const priceInline = product.price != null ? ` — ${money(product.price)}` : "";
    setText("productPriceInline", priceInline);

    setText("productShortDesc", product.short || "");
    setText("productPrice", money(product.price || 0));
    setText("productLongDesc", product.description || "");

    // Benefits
    const benefits = Array.isArray(product.benefits) ? product.benefits : [];
    setHTML(
      "productBenefits",
      benefits.length
        ? benefits
            .map(
              (b) =>
                `<li class="flex gap-2"><span class="text-emerald-600">✔</span><span>${b}</span></li>`
            )
            .join("")
        : `<li class="text-slate-600">No benefits listed yet.</li>`
    );

    // Buttons data attrs
    const cartBtn = document.getElementById("addToCartBtn");
    const wishBtn = document.getElementById("addToWishlistBtn");

    if (cartBtn) {
      cartBtn.dataset.name = product.name || "";
      cartBtn.dataset.price = String(product.price || 0);
      cartBtn.dataset.image = product.image || "";
    }

    if (wishBtn) {
      wishBtn.dataset.name = product.name || "";
      wishBtn.dataset.price = String(product.price || 0);
      wishBtn.dataset.image = product.image || "";
    }

    // Add to cart
    cartBtn?.addEventListener("click", function () {
      const item = {
        name: product.name,
        price: Number(product.price || 0),
        image: product.image,
        qty: 1,
      };

      if (typeof window.addToCart === "function") window.addToCart(item);
      else fallbackAddToCart(item);

      if (typeof window.updateCartCount === "function") window.updateCartCount();
      alert(`${product.name} added to cart!`);
    });

    // Add to wishlist
    wishBtn?.addEventListener("click", function () {
      const item = {
        name: product.name,
        price: Number(product.price || 0),
        image: product.image,
      };

      if (typeof window.addToWishlist === "function") window.addToWishlist(item);
      else fallbackAddToWishlist(item);

      if (typeof window.updateWishlistCount === "function") window.updateWishlistCount();
      alert(`${product.name} saved to wishlist!`);
    });

    // Related
    const relatedWrap = document.getElementById("relatedItems");
    const relatedSlugs = Array.isArray(product.related) ? product.related : [];

    if (relatedWrap) {
      if (!relatedSlugs.length) {
        relatedWrap.innerHTML = `<p class="text-slate-600 col-span-full">No related items yet.</p>`;
      } else {
        relatedWrap.innerHTML = relatedSlugs
          .map((s) => bySlug[s])
          .filter(Boolean)
          .map((p) => {
            return `
              <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-soft hover:shadow-md transition">
                <a href="product.html?slug=${encodeURIComponent(p.slug)}" class="block">
                  <div class="aspect-[4/3] bg-slate-50 overflow-hidden">
                    <img src="${p.image}" alt="${p.name}" class="h-full w-full object-cover hover:scale-[1.03] transition" loading="lazy" />
                  </div>
                  <div class="p-3">
                    <h3 class="text-sm font-semibold leading-tight">${p.name}</h3>
                    <p class="mt-1 text-xs text-slate-600">${money(p.price)}${p.unit ? ` / ${p.unit}` : ""}</p>
                  </div>
                </a>
                <div class="p-3 pt-0">
                  <button
                    class="w-full rounded-xl bg-brand-green px-3 py-2 text-white text-xs font-semibold hover:opacity-90 js-related-cart"
                    data-slug="${p.slug}"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            `;
          })
          .join("");

        relatedWrap.querySelectorAll(".js-related-cart").forEach((btn) => {
          btn.addEventListener("click", function () {
            const s = this.dataset.slug;
            const p = bySlug[s];
            if (!p) return;

            const item = { name: p.name, price: Number(p.price || 0), image: p.image, qty: 1 };
            if (typeof window.addToCart === "function") window.addToCart(item);
            else fallbackAddToCart(item);

            if (typeof window.updateCartCount === "function") window.updateCartCount();
            alert(`${p.name} added to cart!`);
          });
        });
      }
    }

    // Reviews (saved per product slug)
    const reviewsKey = `reviews:${product.slug}`;
    const reviewsList = document.getElementById("reviewsList");
    const reviewForm = document.getElementById("reviewForm");
    const starWrap = document.getElementById("starRating");
    const ratingValue = document.getElementById("ratingValue");

    function appendReview(r) {
      if (!reviewsList) return;
      const card = document.createElement("div");
      card.className =
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-soft";
      card.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-semibold text-brand-green">${r.name}</p>
            <p class="text-xs text-slate-500">Verified Buyer</p>
          </div>
          <div class="text-amber-500 text-sm">${renderStars(r.rating)}</div>
        </div>
        <p class="mt-3 text-sm text-slate-700">"${r.comment}"</p>
      `;
      reviewsList.appendChild(card);
    }

    // Load existing
    const saved = JSON.parse(localStorage.getItem(reviewsKey)) || [];
    if (reviewsList) reviewsList.innerHTML = "";
    saved.forEach(appendReview);

    // Stars click
    if (starWrap && ratingValue) {
      const stars = starWrap.querySelectorAll("i");
      stars.forEach((star) => {
        star.addEventListener("click", function () {
          const v = this.getAttribute("data-value");
          ratingValue.value = v;

          stars.forEach((s) => {
            s.classList.remove("fa-solid");
            s.classList.add("fa-regular");
          });

          for (let i = 0; i < Number(v); i++) {
            stars[i].classList.remove("fa-regular");
            stars[i].classList.add("fa-solid");
          }
        });
      });
    }

    // Submit review
    reviewForm?.addEventListener("submit", function (e) {
      e.preventDefault();

      const nameEl = document.getElementById("reviewName");
      const commentEl = document.getElementById("reviewComment");
      const rating = Number((ratingValue && ratingValue.value) || 0);

      const nameVal = nameEl ? nameEl.value.trim() : "";
      const commentVal = commentEl ? commentEl.value.trim() : "";

      if (!nameVal || !commentVal) return alert("Please fill your name and comment.");
      if (!rating) return alert("Please select a star rating.");

      const newReview = { name: nameVal, comment: commentVal, rating };

      // Save
      const next = JSON.parse(localStorage.getItem(reviewsKey)) || [];
      next.push(newReview);
      localStorage.setItem(reviewsKey, JSON.stringify(next));

      // Render
      appendReview(newReview);

      // Reset UI
      this.reset();
      if (ratingValue) ratingValue.value = "0";
      if (starWrap) {
        starWrap.querySelectorAll("i").forEach((s) => {
          s.classList.remove("fa-solid");
          s.classList.add("fa-regular");
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
