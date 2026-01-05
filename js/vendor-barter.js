// js/vendor-barter.js
import { api, getVendorToken } from "./api.js";
import { storage } from "./storage.js";

// Check vendor auth
if (!getVendorToken()) {
  window.location.href = "login.html";
}

// Get prefill data from sessionStorage (set by product page)
function getPrefillData() {
  try {
    const stored = sessionStorage.getItem("barterPrefill");
    if (stored) {
      const data = JSON.parse(stored);
      sessionStorage.removeItem("barterPrefill");
      return data;
    }
  } catch (e) {}

  // Fallback to URL params
  const params = new URLSearchParams(window.location.search);
  return {
    productId: params.get("productId"),
    productName: params.get("productName"),
    vendorId: params.get("vendorId"),
    vendorName: params.get("vendorName")
  };
}

const prefillData = getPrefillData();
console.log("[Barter] Prefill data:", prefillData);

// DOM elements
const offersList = document.getElementById("offersList");
const noOffers = document.getElementById("noOffers");
const loadingOffers = document.getElementById("loadingOffers");
const newOfferModal = document.getElementById("newOfferModal");
const offerDetailModal = document.getElementById("offerDetailModal");

let currentTab = "all";
let allOffers = [];
let vendors = [];
let myProducts = [];

// Helper functions
function getStatusBadge(status) {
  const badges = {
    DRAFT: "bg-slate-100 text-slate-600",
    SENT: "bg-blue-100 text-blue-700",
    COUNTERED: "bg-purple-100 text-purple-700",
    ACCEPTED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-slate-100 text-slate-600",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    DISPUTED: "bg-red-100 text-red-700",
  };
  return `<span class="px-2 py-1 rounded-full text-xs font-medium ${badges[status] || 'bg-slate-100'}">${status}</span>`;
}

function formatCents(cents) {
  return "$" + (cents / 100).toFixed(2);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// Render offer row
function renderOffer(offer) {
  const direction = offer.isInitiator ? "Sent to" : "Received from";
  const otherVendor = offer.otherVendor?.businessName || "Unknown";

  return `
    <div class="p-4 hover:bg-slate-50 cursor-pointer offer-row" data-id="${offer.id}">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            ${getStatusBadge(offer.status)}
            <span class="text-sm text-slate-500">${direction} ${escapeHtml(otherVendor)}</span>
          </div>
          <p class="mt-1 text-sm">
            <span class="font-medium">${offer.offeredCount} products</span>
            <i class="fa-solid fa-arrow-right mx-2 text-slate-400"></i>
            <span class="font-medium">${offer.requestedCount} products</span>
            ${offer.cashGapCents > 0 ? `<span class="text-slate-500 ml-2">(+${formatCents(offer.cashGapCents)} ${offer.cashGapDirection === 'INITIATOR_PAYS' ? 'from you' : 'from them'})</span>` : ''}
          </p>
        </div>
        <div class="text-right text-xs text-slate-500">
          ${new Date(offer.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  `;
}

// Load offers
async function loadOffers() {
  loadingOffers.classList.remove("hidden");
  noOffers.classList.add("hidden");
  offersList.innerHTML = "";

  try {
    const typeParam = currentTab === "all" ? "" : `?type=${currentTab}`;
    const res = await api(`/vendor/barter/offers${typeParam}`, { auth: "vendor" });
    allOffers = res.offers || [];

    // Update stats
    document.getElementById("sentCount").textContent = allOffers.filter(o => o.isInitiator).length;
    document.getElementById("receivedCount").textContent = allOffers.filter(o => !o.isInitiator).length;
    document.getElementById("pendingCount").textContent = allOffers.filter(o => ["SENT", "COUNTERED", "ACCEPTED", "IN_PROGRESS"].includes(o.status)).length;
    document.getElementById("completedCount").textContent = allOffers.filter(o => o.status === "COMPLETED").length;

    loadingOffers.classList.add("hidden");

    if (allOffers.length === 0) {
      noOffers.classList.remove("hidden");
    } else {
      offersList.innerHTML = allOffers.map(renderOffer).join("");
    }
  } catch (err) {
    console.error("Failed to load offers:", err);
    loadingOffers.classList.add("hidden");
    noOffers.classList.remove("hidden");
  }
}

// Load vendors for dropdown
async function loadVendors() {
  try {
    const res = await api("/vendor/barter/vendors", { auth: "vendor" });
    vendors = res.vendors || [];
    const select = document.getElementById("recipientVendor");
    select.innerHTML = '<option value="">Select a vendor...</option>' +
      vendors.map(v => `<option value="${v.id}">${escapeHtml(v.businessName)} (${v.productCount} products)</option>`).join("");
  } catch (err) {
    console.error("Failed to load vendors:", err);
  }
}

// Load my products
async function loadMyProducts() {
  try {
    const res = await api("/vendor/products", { auth: "vendor" });
    myProducts = (res.products || []).filter(p => !p.isDeleted && p.isAvailable);
    renderMyProducts();
  } catch (err) {
    console.error("Failed to load my products:", err);
    document.getElementById("myProductsList").innerHTML =
      '<p class="text-sm text-red-500">Failed to load products. Please try again.</p>';
  }
}

// Render my products
function renderMyProducts() {
  const container = document.getElementById("myProductsList");
  if (myProducts.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-500">No products available</p>';
    return;
  }
  container.innerHTML = myProducts.map(p => `
    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
      <input type="checkbox" class="my-product-check" data-id="${p.id}" data-price="${p.priceUsdCents}">
      <div class="flex-1">
        <p class="text-sm font-medium">${escapeHtml(p.name)}</p>
        <p class="text-xs text-slate-500">${formatCents(p.priceUsdCents)}</p>
      </div>
      <input type="number" min="1" value="1" class="w-16 text-sm border rounded px-2 py-1 my-product-qty" data-id="${p.id}">
    </label>
  `).join("");
}

// Load other vendor's products
async function loadTheirProducts(vendorId) {
  const container = document.getElementById("theirProductsList");
  if (!vendorId) {
    container.innerHTML = '<p class="text-sm text-slate-500">Select a vendor first...</p>';
    return;
  }

  container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';

  try {
    const res = await api(`/vendor/barter/vendors/${vendorId}/products`, { auth: "vendor" });
    const products = res.products || [];

    if (products.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-500">No products available from this vendor</p>';
      return;
    }

    container.innerHTML = products.map(p => `
      <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
        <input type="checkbox" class="their-product-check" data-id="${p.id}" data-price="${p.priceUsdCents}">
        <div class="flex-1">
          <p class="text-sm font-medium">${escapeHtml(p.name)}</p>
          <p class="text-xs text-slate-500">${formatCents(p.priceUsdCents)}</p>
        </div>
        <input type="number" min="1" value="1" class="w-16 text-sm border rounded px-2 py-1 their-product-qty" data-id="${p.id}">
      </label>
    `).join("");
  } catch (err) {
    container.innerHTML = '<p class="text-sm text-red-500">Failed to load products</p>';
  }
}

// Update value summary
function updateValueSummary() {
  let offerTotal = 0;
  let requestTotal = 0;

  document.querySelectorAll(".my-product-check:checked").forEach(cb => {
    const qty = parseInt(document.querySelector(`.my-product-qty[data-id="${cb.dataset.id}"]`)?.value || 1);
    offerTotal += parseInt(cb.dataset.price) * qty;
  });

  document.querySelectorAll(".their-product-check:checked").forEach(cb => {
    const qty = parseInt(document.querySelector(`.their-product-qty[data-id="${cb.dataset.id}"]`)?.value || 1);
    requestTotal += parseInt(cb.dataset.price) * qty;
  });

  document.getElementById("offerValue").textContent = formatCents(offerTotal);
  document.getElementById("requestValue").textContent = formatCents(requestTotal);

  const diff = offerTotal - requestTotal;
  const diffEl = document.getElementById("valueDiff");
  diffEl.textContent = (diff >= 0 ? "+" : "") + formatCents(diff);
  diffEl.className = diff >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600";
}

// View offer detail
async function viewOfferDetail(offerId) {
  const content = document.getElementById("offerDetailContent");
  content.innerHTML = '<div class="text-center py-8"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';
  offerDetailModal.classList.remove("hidden");

  try {
    const res = await api(`/vendor/barter/offers/${offerId}`, { auth: "vendor" });
    const offer = res.offer;

    const isInitiator = offer.isInitiator;
    const canAccept = !isInitiator && ["SENT", "COUNTERED"].includes(offer.status);
    const canReject = !isInitiator && ["SENT", "COUNTERED"].includes(offer.status);
    const canCancel = isInitiator && ["DRAFT", "SENT"].includes(offer.status);
    const canSend = isInitiator && offer.status === "DRAFT";
    const canFulfill = ["ACCEPTED", "IN_PROGRESS"].includes(offer.status);

    content.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          ${getStatusBadge(offer.status)}
          <span class="text-sm text-slate-500">${new Date(offer.createdAt).toLocaleString()}</span>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-slate-500 uppercase">From</p>
            <p class="font-medium">${escapeHtml(offer.initiatorVendor.businessName)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 uppercase">To</p>
            <p class="font-medium">${escapeHtml(offer.recipientVendor.businessName)}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-emerald-50 rounded-xl p-4">
            <p class="text-xs text-emerald-600 uppercase font-medium mb-2">Offering (${formatCents(offer.offeredTotalCents)})</p>
            <ul class="space-y-1">
              ${offer.offeredItems.map(i => `<li class="text-sm">${i.quantity}x ${escapeHtml(i.product.name)} (${formatCents(i.totalCents)})</li>`).join("")}
            </ul>
          </div>
          <div class="bg-blue-50 rounded-xl p-4">
            <p class="text-xs text-blue-600 uppercase font-medium mb-2">Requesting (${formatCents(offer.requestedTotalCents)})</p>
            <ul class="space-y-1">
              ${offer.requestedItems.map(i => `<li class="text-sm">${i.quantity}x ${escapeHtml(i.product.name)} (${formatCents(i.totalCents)})</li>`).join("")}
            </ul>
          </div>
        </div>

        ${offer.cashGapCents > 0 ? `
          <div class="bg-amber-50 rounded-xl p-4 text-center">
            <p class="text-sm">Cash balance: <strong>${formatCents(offer.cashGapCents)}</strong>
            (${offer.cashGapDirection === "INITIATOR_PAYS" ? "Initiator pays" : "Recipient pays"})</p>
          </div>
        ` : ""}

        ${offer.message ? `
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-xs text-slate-500 uppercase mb-1">Message</p>
            <p class="text-sm">${escapeHtml(offer.message)}</p>
          </div>
        ` : ""}

        ${["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(offer.status) ? `
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-xs text-slate-500 uppercase mb-2">Fulfillment Status</p>
            <div class="flex gap-4">
              <div class="flex items-center gap-2">
                <i class="fa-solid ${offer.fulfilledByInitiator ? 'fa-check-circle text-emerald-500' : 'fa-circle text-slate-300'}"></i>
                <span class="text-sm">Initiator</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fa-solid ${offer.fulfilledByRecipient ? 'fa-check-circle text-emerald-500' : 'fa-circle text-slate-300'}"></i>
                <span class="text-sm">Recipient</span>
              </div>
            </div>
          </div>
        ` : ""}

        ${offer.disputeReason ? `
          <div class="bg-red-50 rounded-xl p-4">
            <p class="text-xs text-red-600 uppercase mb-1">Dispute Reason</p>
            <p class="text-sm text-red-700">${escapeHtml(offer.disputeReason)}</p>
          </div>
        ` : ""}

        <div class="flex flex-wrap gap-2">
          ${canSend ? `<button class="action-btn rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600" data-action="send">Send Offer</button>` : ""}
          ${canAccept ? `<button class="action-btn rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600" data-action="accept">Accept</button>` : ""}
          ${canReject ? `<button class="action-btn rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500" data-action="reject">Reject</button>` : ""}
          ${canCancel ? `<button class="action-btn rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50" data-action="cancel">Cancel</button>` : ""}
          ${canFulfill ? `<button class="action-btn rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500" data-action="fulfill">Mark Fulfilled</button>` : ""}
          ${["ACCEPTED", "IN_PROGRESS"].includes(offer.status) ? `<button class="action-btn rounded-xl bg-red-100 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-200" data-action="dispute">Raise Dispute</button>` : ""}
        </div>
      </div>
    `;

    // Action button handlers
    content.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
          if (action === "dispute") {
            const reason = prompt("Enter dispute reason:");
            if (!reason) {
              btn.disabled = false;
              btn.textContent = "Raise Dispute";
              return;
            }
            await api(`/vendor/barter/offers/${offerId}/dispute`, {
              method: "POST",
              body: { reason },
              auth: "vendor",
            });
          } else {
            await api(`/vendor/barter/offers/${offerId}/${action}`, {
              method: "POST",
              auth: "vendor",
            });
          }
          offerDetailModal.classList.add("hidden");
          loadOffers();
        } catch (err) {
          alert(err?.message || "Action failed");
          btn.disabled = false;
          btn.textContent = btn.dataset.action.charAt(0).toUpperCase() + btn.dataset.action.slice(1);
        }
      });
    });
  } catch (err) {
    content.innerHTML = `<p class="text-red-600">Failed to load offer details</p>`;
  }
}

// Submit offer
async function submitOffer(send) {
  const recipientVendorId = document.getElementById("recipientVendor").value;
  if (!recipientVendorId) {
    alert("Please select a vendor");
    return;
  }

  const items = [];

  document.querySelectorAll(".my-product-check:checked").forEach(cb => {
    const qty = parseInt(document.querySelector(`.my-product-qty[data-id="${cb.dataset.id}"]`)?.value || 1);
    items.push({ productId: cb.dataset.id, quantity: qty, isOffered: true });
  });

  document.querySelectorAll(".their-product-check:checked").forEach(cb => {
    const qty = parseInt(document.querySelector(`.their-product-qty[data-id="${cb.dataset.id}"]`)?.value || 1);
    items.push({ productId: cb.dataset.id, quantity: qty, isOffered: false });
  });

  if (items.length === 0) {
    alert("Please select at least one product");
    return;
  }

  const cashGap = parseFloat(document.getElementById("cashGap").value || 0);
  const cashGapCents = Math.round(cashGap * 100);
  const cashGapDirection = document.getElementById("cashDirection").value;
  const message = document.getElementById("offerMessage").value;

  try {
    const res = await api("/vendor/barter/offers", {
      method: "POST",
      body: {
        recipientVendorId,
        items,
        cashGapCents,
        cashGapDirection: cashGapCents > 0 ? cashGapDirection : undefined,
        message,
      },
      auth: "vendor",
    });

    if (send) {
      await api(`/vendor/barter/offers/${res.offer.id}/send`, {
        method: "POST",
        auth: "vendor",
      });
    }

    newOfferModal.classList.add("hidden");
    loadOffers();
  } catch (err) {
    alert(err?.message || "Failed to create offer");
  }
}

// Handle prefill from product page
async function handlePrefill() {
  if (!prefillData?.vendorId) return;

  console.log("[Barter] Opening modal with prefill:", prefillData);

  // Update modal header
  const header = document.getElementById("modalTitle");
  if (header && prefillData.productName) {
    header.textContent = `Barter for "${prefillData.productName}"`;
  }

  // Open modal immediately
  newOfferModal.classList.remove("hidden");

  // Load data
  await Promise.all([loadVendors(), loadMyProducts()]);

  // Pre-select vendor
  const vendorSelect = document.getElementById("recipientVendor");
  if (vendorSelect) {
    // Add vendor if not in list
    if (!Array.from(vendorSelect.options).some(o => o.value === prefillData.vendorId)) {
      const opt = document.createElement("option");
      opt.value = prefillData.vendorId;
      opt.textContent = prefillData.vendorName || "Selected Vendor";
      vendorSelect.appendChild(opt);
    }
    vendorSelect.value = prefillData.vendorId;

    // Load their products
    await loadTheirProducts(prefillData.vendorId);

    // Pre-check the product
    if (prefillData.productId) {
      setTimeout(() => {
        const cb = document.querySelector(`.their-product-check[data-id="${prefillData.productId}"]`);
        if (cb) {
          cb.checked = true;
          updateValueSummary();
        }
      }, 300);
    }
  }

  // Clear URL if present
  if (window.location.search) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

// Event listeners
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.remove("bg-slate-900", "text-white");
      b.classList.add("text-slate-600");
    });
    btn.classList.add("bg-slate-900", "text-white");
    btn.classList.remove("text-slate-600");
    currentTab = btn.dataset.tab;
    loadOffers();
  });
});

offersList.addEventListener("click", (e) => {
  const row = e.target.closest(".offer-row");
  if (row) viewOfferDetail(row.dataset.id);
});

document.getElementById("newOfferBtn").addEventListener("click", () => {
  newOfferModal.classList.remove("hidden");
  loadVendors();
  loadMyProducts();
});

document.getElementById("closeNewOfferModal").addEventListener("click", () => {
  newOfferModal.classList.add("hidden");
});

document.getElementById("closeDetailModal").addEventListener("click", () => {
  offerDetailModal.classList.add("hidden");
});

document.getElementById("recipientVendor").addEventListener("change", (e) => {
  loadTheirProducts(e.target.value);
});

document.getElementById("myProductsList").addEventListener("change", updateValueSummary);
document.getElementById("theirProductsList").addEventListener("change", updateValueSummary);

document.getElementById("newOfferForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await submitOffer(true);
});

document.getElementById("saveDraftBtn").addEventListener("click", async () => {
  await submitOffer(false);
});

// Close modals when clicking backdrop
newOfferModal.querySelector(".bg-black\\/40")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) newOfferModal.classList.add("hidden");
});

offerDetailModal.querySelector(".bg-black\\/40")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) offerDetailModal.classList.add("hidden");
});

// Initialize
handlePrefill().catch(console.error);
loadOffers().catch(console.error);
