// js/layout.js
import { wireNavbarAuth } from "./nav-auth.js";
import { cartCount } from "./cart.js";
import { wishlistCount } from "./wishlist.js";
import { storage } from "./storage.js";

async function inject(selector, url) {
  const mount = document.querySelector(selector);
  if (!mount) return;

  const res = await fetch(url);
  if (!res.ok) return;

  mount.innerHTML = await res.text();
}

function setBadge(el, count) {
  if (!el) return;
  const n = Number(count || 0);
  el.textContent = String(n);
  if (n > 0) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

async function updateAllBadges() {
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

// Auth detection helpers
function getAuthInfo() {
  // Check both storage module format and raw localStorage
  const userToken = storage.get("token", "") || localStorage.getItem("token") || "";
  const vendorToken = storage.get("vendor_token", "") || localStorage.getItem("vendor_token") || "";
  const authType = storage.get("authType", "") || localStorage.getItem("authType") || "";

  const isLoggedIn = (userToken && userToken.length > 10) || (vendorToken && vendorToken.length > 10);
  const isVendor = isLoggedIn && authType === "vendor" && vendorToken && vendorToken.length > 10;

  // Get profile info
  let profileName = "";
  let isPartner = false;
  if (isVendor) {
    const vendor = storage.get("vendor", null);
    profileName = vendor?.businessName || vendor?.name || "Vendor";
  } else if (isLoggedIn) {
    const user = storage.get("user", null);
    profileName = user?.name || user?.firstName || "User";
    isPartner = user?.isPartner === true;
  }

  return { isLoggedIn, isVendor, profileName, userToken, vendorToken, isPartner };
}

function updateProfileDisplay(profileName, isPartner = false) {
  const profileEl = document.getElementById("profileName");
  if (profileEl && profileName) {
    profileEl.textContent = profileName;
  }

  // Show/hide partner badge
  const partnerBadge = document.getElementById("partnerBadge");
  if (partnerBadge) {
    if (isPartner) {
      partnerBadge.classList.remove("hidden");
    } else {
      partnerBadge.classList.add("hidden");
    }
  }
}

// Expose globally for other scripts to trigger updates
window.__updateCartBadges = updateAllBadges;
window.__updateWishlistBadges = updateAllBadges;
window.__updateNavBadges = updateAllBadges;
window.__getAuthInfo = getAuthInfo;

document.addEventListener("DOMContentLoaded", async () => {
  const { isLoggedIn, isVendor, profileName, isPartner } = getAuthInfo();

  // Pick the right navbar based on auth state
  let navbarPath = "components/navbar-public.html";
  if (isLoggedIn) {
    navbarPath = isVendor ? "components/navbar-vendor.html" : "components/navbar.html";
  }

  // Inject shared layout
  await inject("#navbarMount", navbarPath);
  await inject("#footerMount", "components/footer.html");

  // Wire auth + logout AFTER navbar exists
  wireNavbarAuth();

  // Update profile name display and partner badge
  updateProfileDisplay(profileName, isPartner);

  // Initialize navbar (drawer etc) if available
  if (typeof window.initNavbar === "function") {
    window.initNavbar();
  }

  // Update badges after navbar is injected
  await updateAllBadges();

  // Listen for storage changes (cross-tab updates)
  window.addEventListener("storage", (e) => {
    if (e.key === "foodcheq_cart_v2" || e.key === "foodcheq_cart_v1" || e.key === "wishlist_ids") {
      updateAllBadges();
    }
  });
});
