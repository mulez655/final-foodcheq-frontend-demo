// js/nav-auth.js
// Works with injected navbar (event delegation + simple auth UI toggles)

export function wireNavbarAuth() {
  // 1) Logout handler (event delegation so it works even after navbar is injected)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-logout]");
    if (!btn) return;

    e.preventDefault();

    // Clear everything we've used across user/vendor sessions
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authType");
    localStorage.removeItem("user");
    localStorage.removeItem("vendor");
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_refreshToken");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("authType");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("vendor");
    sessionStorage.removeItem("vendor_token");
    sessionStorage.removeItem("vendor_refreshToken");

    // Optional: clear cart/wishlist if you want “fresh session”
    // localStorage.removeItem("cart");
    // localStorage.removeItem("wishlist");

    // Send user back to login (or home)
    window.location.href = "login.html";
  });

  // 2) Toggle navbar items based on auth state
  updateNavbarAuthUI();
}

export function updateNavbarAuthUI() {
  // Parse tokens properly (storage module uses JSON.stringify)
  let token = "";
  try {
    const storedToken = localStorage.getItem("token");
    token = storedToken ? JSON.parse(storedToken) : "";
  } catch {
    token = localStorage.getItem("token") || "";
  }

  // Also check vendor token
  let vendorToken = "";
  try {
    const storedVendor = localStorage.getItem("vendor_token");
    vendorToken = storedVendor ? JSON.parse(storedVendor) : "";
  } catch {
    vendorToken = localStorage.getItem("vendor_token") || "";
  }

  // Get authType (also stored as JSON)
  let authType = "";
  try {
    const storedAuthType = localStorage.getItem("authType");
    authType = storedAuthType ? JSON.parse(storedAuthType) : "";
  } catch {
    authType = localStorage.getItem("authType") || "";
  }

  // Elements tagged for guest/user visibility
  const guestEls = document.querySelectorAll("[data-guest]");
  const userEls = document.querySelectorAll("[data-user]");
  const vendorEls = document.querySelectorAll("[data-vendor]");

  // Check if user or vendor is logged in
  const hasUserToken = typeof token === "string" && token.length > 10;
  const hasVendorToken = typeof vendorToken === "string" && vendorToken.length > 10;
  const isAuthed = hasUserToken || hasVendorToken;
  const isUser = isAuthed && authType === "user" && hasUserToken;
  const isVendor = isAuthed && authType === "vendor" && hasVendorToken;

  guestEls.forEach((el) => el.classList.toggle("hidden", isAuthed));
  userEls.forEach((el) => el.classList.toggle("hidden", !isUser));
  vendorEls.forEach((el) => el.classList.toggle("hidden", !isVendor));
}
