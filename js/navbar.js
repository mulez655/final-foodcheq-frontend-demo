// js/navbar.js
(function () {
  function safeParseJSON(raw, fallback) {
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getCartCount() {
    // Check v2 first (current format with USD cents)
    const rawV2 = localStorage.getItem("foodcheq_cart_v2");
    if (rawV2) {
      const arr = safeParseJSON(rawV2, []);
      if (Array.isArray(arr)) return arr.reduce((s, x) => s + Number(x?.quantity || 0), 0);
    }

    // Fallback to v1 (old format)
    const rawV1 = localStorage.getItem("foodcheq_cart_v1");
    if (rawV1) {
      const arr = safeParseJSON(rawV1, []);
      if (Array.isArray(arr)) return arr.reduce((s, x) => s + Number(x?.quantity || 0), 0);
    }

    // Legacy fallback
    const rawLegacy = localStorage.getItem("cart");
    if (rawLegacy) {
      const arr = safeParseJSON(rawLegacy, []);
      if (Array.isArray(arr)) return arr.reduce((s, x) => s + Number(x?.qty || x?.quantity || 0), 0);
    }

    return 0;
  }

  function getWishlistCount() {
    const raw = localStorage.getItem("wishlist_ids");
    if (!raw) return 0;

    const parsed = safeParseJSON(raw, null);

    if (Array.isArray(parsed)) {
      const clean = Array.from(new Set(parsed.map((x) => String(x || "").trim()).filter(Boolean)));
      return clean.length;
    }

    if (typeof parsed === "string") {
      const maybeArr = safeParseJSON(parsed, []);
      if (Array.isArray(maybeArr)) return maybeArr.length;
      if (parsed.trim()) return 1;
    }

    if (raw.trim() && raw[0] !== "[") return 1;
    return 0;
  }

  function setBadge(el, count) {
    if (!el) return;
    const n = Number(count || 0);
    el.textContent = String(n);
    if (n > 0) el.classList.remove("hidden");
    else el.classList.add("hidden");
  }

  function updateBadges() {
    const cartCount = getCartCount();
    const wishCount = getWishlistCount();

    setBadge(document.getElementById("cartCount"), cartCount);
    setBadge(document.getElementById("wishlistCount"), wishCount);

    document.querySelectorAll('[data-badge="cart"]').forEach((el) => setBadge(el, cartCount));
    document.querySelectorAll('[data-badge="wishlist"]').forEach((el) => setBadge(el, wishCount));
  }

  window.__updateCartBadges = updateBadges;
  window.__updateWishlistBadges = updateBadges;
  window.__updateNavBadges = updateBadges;

  function initDrawer() {
    const menuBtn = document.getElementById("menuBtn");
    const drawer = document.getElementById("mobileDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    const closeBtn = document.getElementById("closeDrawer");
    const panel = document.getElementById("drawerPanel");

    if (!menuBtn || !drawer || !panel) return;

    function open() {
      drawer.classList.remove("hidden");
      drawer.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        panel.classList.remove("-translate-x-full");
      });
      document.body.style.overflow = "hidden";
    }

    function close() {
      panel.classList.add("-translate-x-full");
      setTimeout(() => {
        drawer.classList.add("hidden");
        drawer.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }, 200);
    }

    menuBtn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    backdrop?.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !drawer.classList.contains("hidden")) close();
    });
  }

  window.initNavbar = function initNavbar() {
    initDrawer();
    updateBadges();

    window.addEventListener("storage", (e) => {
      if (e.key === "foodcheq_cart_v2" || e.key === "foodcheq_cart_v1" || e.key === "cart" || e.key === "wishlist_ids") {
        updateBadges();
      }
    });
  };
})();
