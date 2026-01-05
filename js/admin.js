// js/admin.js
import { api, clearToken } from "./api.js";
import { storage } from "./storage.js";

/**
 * Admin Panel (Premium)
 * - Drawer toggle (mobile)
 * - Admin guard (must be ADMIN)
 * - Tabs: Vendors, Users, Orders, Products, FX
 * - Filters + counts (client-side filtering)
 * - Order details modal (row click)
 * - Product details modal (row click)
 *
 * Backend assumptions:
 * - GET  /api/auth/me
 * - Vendors: GET /api/admin/vendors, PATCH /api/admin/vendors/:id/approve, PATCH /api/admin/vendors/:id/status
 * - Users:   GET /api/admin/users,   PATCH /api/admin/users/:id/role
 * - Orders:  GET /api/admin/orders,  GET /api/admin/orders/:id
 * - FX:      GET /api/fx/usd-ngn,     PATCH /api/admin/fx/usd-ngn
 *
 * Products (admin):
 * - BEST: GET /api/admin/products (you may already have it; if not, add later)
 * - FALLBACK: GET /api/products?includeDeleted=... (if you implement query later)
 *
 * Product pricing:
 * - Your source of truth is priceUsdCents (USD cents).
 */

const $ = (sel) => document.querySelector(sel);

function lockBodyScroll() {
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  document.body.style.overflow = "";
}


function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badge(text, tone = "slate") {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  const cls = tones[tone] || tones.slate;
  return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}">${escapeHtml(
    text
  )}</span>`;
}

function showToast(msg) {
  const el = document.createElement("div");
  el.className =
    "fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm shadow-lg";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function setAdminMsg(type, message) {
  const box = $("#adminMsg");
  if (!box) return;

  if (!message) {
    box.classList.add("hidden");
    box.textContent = "";
    box.className = "hidden mb-5 rounded-2xl border px-4 py-3 text-sm";
    return;
  }

  box.classList.remove("hidden");
  if (type === "error") {
    box.className =
      "mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800";
  } else if (type === "success") {
    box.className =
      "mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800";
  } else {
    box.className =
      "mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800";
  }

  box.textContent = message;
}

function fmtUsd(usdCents) {
  const v = Number(usdCents || 0) / 100;
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------- Admin Guard ----------------------
async function requireAdminGuardOrRedirect() {
  try {
    const res = await api("/auth/me", { auth: true });
    const u = res?.user || res?.data?.user || res?.me;
    const role = u?.role || res?.role;

    if (role !== "ADMIN") {
      window.location.href = "admin-login.html";
      return false;
    }

    // Fill sidebar profile
    const name = u?.name || "Admin";
    const email = u?.email || "—";
    const adminName = $("#adminName");
    const adminEmail = $("#adminEmail");
    if (adminName) adminName.textContent = name;
    if (adminEmail) adminEmail.textContent = email;

    return true;
  } catch (e) {
    window.location.href = "admin-login.html";
    return false;
  }
}

// ---------------------- Drawer ----------------------
function initDrawer() {
  const sidebar = $("#adminSidebar");
  const backdrop = $("#adminBackdrop");
  const btnOpen = $("#adminOpenDrawer");
  const btnClose = $("#adminCloseDrawer");

  const open = () => {
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove("-translate-x-full");
    sidebar.setAttribute("aria-hidden", "false");
    backdrop.classList.remove("hidden");
  };

  const close = () => {
    if (!sidebar || !backdrop) return;
    sidebar.classList.add("-translate-x-full");
    sidebar.setAttribute("aria-hidden", "true");
    backdrop.classList.add("hidden");
  };

  btnOpen?.addEventListener("click", open);
  btnClose?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  // keep sidebar open on desktop
  const mq = window.matchMedia("(min-width: 1024px)");
  const sync = () => {
    if (!sidebar || !backdrop) return;
    if (mq.matches) {
      sidebar.classList.remove("-translate-x-full");
      sidebar.setAttribute("aria-hidden", "false");
      backdrop.classList.add("hidden");
    } else {
      sidebar.classList.add("-translate-x-full");
      sidebar.setAttribute("aria-hidden", "true");
      backdrop.classList.add("hidden");
    }
  };
  mq.addEventListener?.("change", sync);
  sync();
}

// ---------------------- Tabs ----------------------
function getActiveTabFromHash() {
  const h = (window.location.hash || "").replace("#", "").trim();
  return h || "vendors";
}

function setHash(tab) {
  window.location.hash = `#${tab}`;
}

function initTabs() {
  const tabButtons = document.querySelectorAll("button[data-tab]");
  const sections = {
    vendors: $("#tab-vendors"),
    users: $("#tab-users"),
    orders: $("#tab-orders"),
    products: $("#tab-products"),
    fx: $("#tab-fx"),
    partnerships: $("#tab-partnerships"),
    investments: $("#tab-investments"),
    barter: $("#tab-barter"),
  };

  function activate(tab) {
    tabButtons.forEach((b) => {
      const t = b.getAttribute("data-tab");
      const active = t === tab;

      // sidebar button active style
      b.classList.toggle("border-emerald-600", active);
      b.classList.toggle("text-emerald-700", active);
      b.classList.toggle("border-b-2", false); // not used in this layout
      b.classList.toggle("text-slate-500", !active);
      b.classList.toggle("hover:text-slate-900", !active);

      if (active) {
        b.classList.add("ring-1", "ring-emerald-200", "bg-emerald-50/60");
      } else {
        b.classList.remove("ring-1", "ring-emerald-200", "bg-emerald-50/60");
      }
    });

    Object.entries(sections).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== tab);
    });

    setAdminMsg("", "");
    if (tab === "vendors") loadVendors();
    if (tab === "users") loadUsers();
    if (tab === "orders") loadOrders();
    if (tab === "products") loadProducts();
    if (tab === "fx") loadFxRate();

    // Trigger new features tab activation
    if (window.__adminActivateTab) {
      window.__adminActivateTab(tab);
    }
  }

  tabButtons.forEach((b) => {
    b.addEventListener("click", () => {
      const tab = b.getAttribute("data-tab");
      if (!tab) return;
      setHash(tab);
      activate(tab);
    });
  });

  window.addEventListener("hashchange", () => activate(getActiveTabFromHash()));
  activate(getActiveTabFromHash());
}

// ---------------------- Vendors ----------------------
let vendorsCache = [];
let vendorsFiltered = [];

function vendorsApplyFilters() {
  const q = ($("#vendorsSearch")?.value || "").trim().toLowerCase();
  const status = ($("#vendorsStatus")?.value || "").trim();
  const active = ($("#vendorsActive")?.value || "").trim(); // "", "true", "false"

  const next = vendorsCache.filter((v) => {
    const hay =
      `${v.businessName || ""} ${v.email || ""} ${v.contactName || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (status && String(v.status || "") !== status) return false;
    if (active === "true" && !v.isActive) return false;
    if (active === "false" && v.isActive) return false;
    return true;
  });

  vendorsFiltered = next;

  const countEl = $("#vendorsCount");
  if (countEl) countEl.textContent = `${next.length} vendor(s)`;

  renderVendors(next);
}

function renderVendors(list) {
  const tbody = $("#adminVendorsTable");
  if (!tbody) return;

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-6 text-slate-500 text-sm" colspan="5">No vendors found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((v) => {
      const statusTone = v.status === "APPROVED" ? "emerald" : "amber";
      const activeTone = v.isActive ? "emerald" : "red";

      return `
        <tr class="border-b border-slate-100">
          <td class="px-6 py-4">
            <div class="font-semibold">${escapeHtml(v.businessName || "—")}</div>
            <div class="text-xs text-slate-500">${escapeHtml(v.contactName || "")}</div>
          </td>
          <td class="py-4">${escapeHtml(v.email || "—")}</td>
          <td class="py-4">${badge(v.status || "PENDING", statusTone)}</td>
          <td class="py-4">${badge(v.isActive ? "Yes" : "No", activeTone)}</td>
          <td class="py-4 pr-6 text-right">
            <div class="inline-flex flex-wrap justify-end gap-2">
              <button
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                data-v-approve="${escapeHtml(v.id)}"
                ${v.status === "APPROVED" ? "disabled" : ""}
              >
                Approve
              </button>

              <button
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                data-v-toggle="${escapeHtml(v.id)}"
              >
                ${v.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadVendors() {
  const tbody = $("#adminVendorsTable");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-5 text-slate-500 text-sm" colspan="5">
          <i class="fa-solid fa-spinner fa-spin mr-2"></i>
          Loading vendors...
        </td>
      </tr>
    `;
  }

  try {
    const res = await api("/admin/vendors", { auth: true });
    vendorsCache = Array.isArray(res?.vendors) ? res.vendors : [];
    vendorsApplyFilters();
  } catch (e) {
    console.error("loadVendors error:", e);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td class="px-6 py-6 text-red-700 text-sm" colspan="5">
            Failed to load vendors: ${escapeHtml(e?.message || "Unknown error")}
          </td>
        </tr>
      `;
    }
  }
}

function initVendorsFilters() {
  $("#vendorsSearch")?.addEventListener("input", vendorsApplyFilters);
  $("#vendorsStatus")?.addEventListener("change", vendorsApplyFilters);
  $("#vendorsActive")?.addEventListener("change", vendorsApplyFilters);

  $("#vendorsClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    const a = $("#vendorsSearch");
    const b = $("#vendorsStatus");
    const c = $("#vendorsActive");
    if (a) a.value = "";
    if (b) b.value = "";
    if (c) c.value = "";
    vendorsApplyFilters();
  });

  $("#btnReloadVendors")?.addEventListener("click", loadVendors);
}

// Vendor actions (approve/toggle)
document.addEventListener("click", async (e) => {
  const approveBtn = e.target.closest("[data-v-approve]");
  if (approveBtn) {
    const id = approveBtn.getAttribute("data-v-approve");
    if (!id) return;

    approveBtn.disabled = true;
    const old = approveBtn.textContent;
    approveBtn.textContent = "Approving...";

    try {
      await api(`/admin/vendors/${encodeURIComponent(id)}/approve`, {
        method: "PATCH",
        auth: true,
        body: {},
      });
      showToast("Vendor approved ✅");
      await loadVendors();
    } catch (err) {
      alert(err?.message || "Failed to approve vendor");
      console.error(err);
    } finally {
      approveBtn.textContent = old || "Approve";
      approveBtn.disabled = false;
    }
    return;
  }

  const toggleBtn = e.target.closest("[data-v-toggle]");
  if (toggleBtn) {
    const id = toggleBtn.getAttribute("data-v-toggle");
    if (!id) return;

    const vendor = vendorsCache.find((x) => x.id === id);
    const nextActive = vendor ? !vendor.isActive : true;

    toggleBtn.disabled = true;
    const old = toggleBtn.textContent;
    toggleBtn.textContent = "Saving...";

    try {
      await api(`/admin/vendors/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        auth: true,
        body: {
          status: vendor?.status || "PENDING",
          isActive: nextActive,
        },
      });
      showToast("Vendor updated ✅");
      await loadVendors();
    } catch (err) {
      alert(err?.message || "Failed to update vendor");
      console.error(err);
    } finally {
      toggleBtn.textContent = old || "Toggle";
      toggleBtn.disabled = false;
    }
  }
});

// ---------------------- Users ----------------------
let usersCache = [];
let usersFiltered = [];

function usersApplyFilters() {
  const q = ($("#usersSearch")?.value || "").trim().toLowerCase();
  const role = ($("#usersRole")?.value || "").trim();

  const next = usersCache.filter((u) => {
    const hay = `${u.name || ""} ${u.email || ""} ${u.id || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (role && String(u.role || "") !== role) return false;
    return true;
  });

  usersFiltered = next;

  const countEl = $("#usersCount");
  if (countEl) countEl.textContent = `${next.length} user(s)`;

  renderUsers(next);
}

function renderUsers(list) {
  const tbody = $("#adminUsersTable");
  if (!tbody) return;

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-6 text-slate-500 text-sm" colspan="4">No users found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((u) => {
      const tone = u.role === "ADMIN" ? "emerald" : "slate";
      return `
        <tr class="border-b border-slate-100">
          <td class="px-6 py-4">
            <div class="font-semibold">${escapeHtml(u.name || "—")}</div>
            <div class="text-xs text-slate-500">${escapeHtml(u.id)}</div>
          </td>
          <td class="py-4">${escapeHtml(u.email || "—")}</td>
          <td class="py-4">${badge(u.role || "USER", tone)}</td>
          <td class="py-4 pr-6 text-right">
            <button
              class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              data-u-toggle-role="${escapeHtml(u.id)}"
            >
              Make ${u.role === "ADMIN" ? "User" : "Admin"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadUsers() {
  const tbody = $("#adminUsersTable");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-5 text-slate-500 text-sm" colspan="4">
          <i class="fa-solid fa-spinner fa-spin mr-2"></i>
          Loading users...
        </td>
      </tr>
    `;
  }

  try {
    const res = await api("/admin/users", { auth: true });
    usersCache = Array.isArray(res?.users) ? res.users : [];
    usersApplyFilters();
  } catch (e) {
    console.error("loadUsers error:", e);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td class="px-6 py-6 text-red-700 text-sm" colspan="4">
            Failed to load users: ${escapeHtml(e?.message || "Unknown error")}
          </td>
        </tr>
      `;
    }
  }
}

function initUsersFilters() {
  $("#usersSearch")?.addEventListener("input", usersApplyFilters);
  $("#usersRole")?.addEventListener("change", usersApplyFilters);

  $("#usersClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    const a = $("#usersSearch");
    const b = $("#usersRole");
    if (a) a.value = "";
    if (b) b.value = "";
    usersApplyFilters();
  });

  $("#btnReloadUsers")?.addEventListener("click", loadUsers);
}

// User role toggle
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-u-toggle-role]");
  if (!btn) return;

  const id = btn.getAttribute("data-u-toggle-role");
  if (!id) return;

  const user = usersCache.find((x) => x.id === id);
  const nextRole = user?.role === "ADMIN" ? "USER" : "ADMIN";

  if (!confirm(`Change role to ${nextRole}?`)) return;

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Saving...";

  try {
    await api(`/admin/users/${encodeURIComponent(id)}/role`, {
      method: "PATCH",
      auth: true,
      body: { role: nextRole },
    });
    showToast("Role updated ✅");
    await loadUsers();
  } catch (err) {
    alert(err?.message || "Failed to update role");
    console.error(err);
  } finally {
    btn.textContent = old || "Update Role";
    btn.disabled = false;
  }
});

// ---------------------- Orders + Modal ----------------------
let ordersCache = [];
let ordersFiltered = [];

function moneyNGNFromRate(kobo) {
  const amount = Number(kobo || 0) / 100;
  return `₦${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ordersApplyFilters() {
  const q = ($("#ordersSearch")?.value || "").trim().toLowerCase();
  const status = ($("#ordersStatus")?.value || "").trim();
  const pay = ($("#ordersPayment")?.value || "").trim();
  const vendorOrUser = ($("#ordersVendorOrUser")?.value || "").trim().toLowerCase();

  const next = ordersCache.filter((o) => {
    const id = String(o.id || "").toLowerCase();
    if (q && !id.includes(q)) return false;
    if (status && String(o.status || "") !== status) return false;
    if (pay && String(o.paymentStatus || "") !== pay) return false;

    if (vendorOrUser) {
      const v = String(o.vendorId || o.vendor?.id || "").toLowerCase();
      const u = String(o.userId || o.user?.id || "").toLowerCase();
      if (!v.includes(vendorOrUser) && !u.includes(vendorOrUser)) return false;
    }
    return true;
  });

  ordersFiltered = next;

  const countEl = $("#ordersCount");
  if (countEl) countEl.textContent = `${next.length} order(s)`;

  renderOrders(next);
}

function renderOrders(list) {
  const tbody = $("#adminOrdersTable");
  if (!tbody) return;

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-6 text-slate-500 text-sm" colspan="6">No orders found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((o) => {
      const statusTone =
        o.status === "COMPLETED"
          ? "emerald"
          : o.status === "CANCELLED"
          ? "red"
          : o.status === "ACCEPTED"
          ? "amber"
          : "slate";

      const payTone =
        o.paymentStatus === "PAID"
          ? "emerald"
          : o.paymentStatus === "FAILED"
          ? "red"
          : o.paymentStatus === "REFUNDED"
          ? "amber"
          : "slate";

      const totalKobo =
        Number(o.totalKobo) ||
        Number(o.totalAmountKobo) ||
        (Array.isArray(o.items)
          ? o.items.reduce((s, it) => s + Number(it.subtotalKobo || 0), 0)
          : 0);

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" data-order-row="${escapeHtml(
          o.id
        )}">
          <td class="px-6 py-4">
            <div class="font-semibold">${escapeHtml(o.id)}</div>
            <div class="text-xs text-slate-500">${new Date(o.createdAt).toLocaleString()}</div>
          </td>
          <td class="py-4">
            <div class="font-semibold">${escapeHtml(o.user?.name || "—")}</div>
            <div class="text-xs text-slate-500">${escapeHtml(o.user?.email || "")}</div>
          </td>
          <td class="py-4">
            <div class="font-semibold">${escapeHtml(o.vendor?.businessName || "—")}</div>
            <div class="text-xs text-slate-500">${escapeHtml(o.vendor?.email || "")}</div>
          </td>
          <td class="py-4">${badge(o.status || "PENDING", statusTone)}</td>
          <td class="py-4">${badge(o.paymentStatus || "PENDING", payTone)}</td>
          <td class="py-4 pr-6 text-right font-bold">${moneyNGNFromRate(totalKobo)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadOrders() {
  const tbody = $("#adminOrdersTable");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-5 text-slate-500 text-sm" colspan="6">
          <i class="fa-solid fa-spinner fa-spin mr-2"></i>
          Loading orders...
        </td>
      </tr>
    `;
  }

  try {
    const res = await api("/admin/orders", { auth: true });
    ordersCache = Array.isArray(res?.orders) ? res.orders : [];
    ordersApplyFilters();
  } catch (e) {
    console.error("loadOrders error:", e);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td class="px-6 py-6 text-red-700 text-sm" colspan="6">
            Failed to load orders: ${escapeHtml(e?.message || "Unknown error")}
          </td>
        </tr>
      `;
    }
  }
}

function initOrdersFilters() {
  $("#ordersSearch")?.addEventListener("input", ordersApplyFilters);
  $("#ordersStatus")?.addEventListener("change", ordersApplyFilters);
  $("#ordersPayment")?.addEventListener("change", ordersApplyFilters);
  $("#ordersVendorOrUser")?.addEventListener("input", ordersApplyFilters);

  $("#ordersClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    const a = $("#ordersSearch");
    const b = $("#ordersStatus");
    const c = $("#ordersPayment");
    const d = $("#ordersVendorOrUser");
    if (a) a.value = "";
    if (b) b.value = "";
    if (c) c.value = "";
    if (d) d.value = "";
    ordersApplyFilters();
  });

  $("#btnReloadOrders")?.addEventListener("click", loadOrders);
}

// Order modal
function openOrderModal() {
  $("#orderModal")?.classList.remove("hidden");
  lockBodyScroll();

}
function closeOrderModal() {
  $("#orderModal")?.classList.add("hidden");
  unlockBodyScroll();

}
function initOrderModal() {
  $("#orderModalBackdrop")?.addEventListener("click", closeOrderModal);
  $("#orderModalClose")?.addEventListener("click", closeOrderModal);
  $("#orderModalClose2")?.addEventListener("click", closeOrderModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOrderModal();
  });
}

async function showOrderDetails(orderId) {
  const title = $("#orderModalTitle");
  const body = $("#orderModalBody");

  if (title) title.textContent = orderId;
  if (body) {
    body.innerHTML = `
      <div class="text-slate-500 text-sm">
        <i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading...
      </div>
    `;
  }
  openOrderModal();

  try {
    const res = await api(`/admin/orders/${encodeURIComponent(orderId)}`, { auth: true });
    const o = res?.order;
    if (!o?.id) throw new Error("Order not found");

    const items = Array.isArray(o.items) ? o.items : [];
    const totalKobo =
      Number(o.totalKobo) ||
      Number(o.totalAmountKobo) ||
      items.reduce((s, it) => s + Number(it.subtotalKobo || 0), 0);

    const userLine = `${o.user?.name || "—"} • ${o.user?.email || ""}`;
    const vendorLine = `${o.vendor?.businessName || "—"} • ${o.vendor?.email || ""}`;

    const itemsHtml = items.length
      ? `
        <div class="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-600 font-semibold">
            Items (${items.length})
          </div>
          <div class="divide-y divide-slate-200">
            ${items
              .map((it) => {
                const qty = Number(it.quantity || 0);
                const unit = Number(it.unitPriceKobo || 0);
                const sub = Number(it.subtotalKobo || unit * qty);
                return `
                  <div class="px-4 py-3 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-slate-900">Product: ${escapeHtml(
                        it.productId
                      )}</div>
                      <div class="text-xs text-slate-500">Qty: ${qty}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-xs text-slate-500">Unit</div>
                      <div class="font-bold">${moneyNGNFromRate(unit)}</div>
                      <div class="text-xs text-slate-500 mt-1">Subtotal</div>
                      <div class="font-bold">${moneyNGNFromRate(sub)}</div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `
      : `<div class="mt-4 text-slate-500 text-sm">No items recorded.</div>`;

    const deliveryHtml = o.delivery
      ? `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
          <div class="text-xs text-slate-500 font-semibold mb-2">Delivery</div>
          <div class="text-sm text-slate-800">
            ${escapeHtml(o.delivery.address || "—")}
          </div>
        </div>
      `
      : "";

    if (body) {
      body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="text-xs text-slate-500 font-semibold">Customer</div>
            <div class="mt-1 font-bold">${escapeHtml(userLine)}</div>
            <div class="mt-3 text-xs text-slate-500 font-semibold">Vendor</div>
            <div class="mt-1 font-bold">${escapeHtml(vendorLine)}</div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs text-slate-500 font-semibold">Status</div>
                <div class="mt-1">${badge(o.status || "PENDING", "slate")}</div>
              </div>
              <div>
                <div class="text-xs text-slate-500 font-semibold">Payment</div>
                <div class="mt-1">${badge(o.paymentStatus || "PENDING", "slate")}</div>
              </div>
            </div>

            <div class="mt-4">
              <div class="text-xs text-slate-500 font-semibold">Total</div>
              <div class="mt-1 text-xl font-extrabold">${moneyNGNFromRate(totalKobo)}</div>
            </div>

            <div class="mt-4 text-xs text-slate-500">
              Created: ${new Date(o.createdAt).toLocaleString()}
            </div>
          </div>
        </div>

        ${itemsHtml}
        ${deliveryHtml}
      `;
    }
  } catch (e) {
    console.error("showOrderDetails error:", e);
    if (body) {
      body.innerHTML = `
        <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load order: ${escapeHtml(e?.message || "Unknown error")}
        </div>
      `;
    }
  }
}

// click row -> open modal
document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-order-row]");
  if (!row) return;
  const id = row.getAttribute("data-order-row");
  if (!id) return;
  showOrderDetails(id);
});

// ---------------------- Products + Modal ----------------------
let productsCache = [];
let productsFiltered = [];

function productsApplyFilters() {
  const q = ($("#productsSearch")?.value || "").trim().toLowerCase();
  const status = ($("#productsStatus")?.value || "").trim();
  const available = ($("#productsAvailable")?.value || "").trim(); // "", "true", "false"
  const includeDeleted = !!$("#productsIncludeDeleted")?.checked;

  const next = productsCache.filter((p) => {
    const vendorName = p.vendor?.businessName || p.vendorBusinessName || "";
    const hay = `${p.name || ""} ${p.category || ""} ${vendorName} ${p.vendorId || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (status && String(p.status || "") !== status) return false;
    if (available === "true" && !p.isAvailable) return false;
    if (available === "false" && p.isAvailable) return false;
    if (!includeDeleted && p.isDeleted) return false;
    return true;
  });

  productsFiltered = next;
  const countEl = $("#productsCount");
  if (countEl) countEl.textContent = `${next.length} product(s)`;

  renderProducts(next);
}

function renderProducts(list) {
  const tbody = $("#adminProductsTable");
  if (!tbody) return;

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-6 text-slate-500 text-sm" colspan="7">No products found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((p) => {
      const statusTone =
        p.status === "PUBLISHED"
          ? "emerald"
          : p.status === "ARCHIVED"
          ? "amber"
          : "slate";

      const delTone = p.isDeleted ? "red" : "slate";
      const availTone = p.isAvailable ? "emerald" : "red";

      const vendorName = p.vendor?.businessName || p.vendorBusinessName || "—";

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" data-product-row="${escapeHtml(
          p.id
        )}">
          <td class="px-6 py-4">
            <div class="font-semibold">${escapeHtml(p.name || "—")}</div>
            <div class="text-xs text-slate-500">${escapeHtml(p.category || "—")}</div>
          </td>
          <td class="py-4">
            <div class="font-semibold">${escapeHtml(vendorName)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(p.vendorId || "")}</div>
          </td>
          <td class="py-4 font-bold">${fmtUsd(p.priceUsdCents)}</td>
          <td class="py-4">${badge(p.status || "DRAFT", statusTone)}</td>
          <td class="py-4">${badge(p.isAvailable ? "Yes" : "No", availTone)}</td>
          <td class="py-4">${badge(p.isDeleted ? "Yes" : "No", delTone)}</td>
          <td class="py-4 pr-6 text-right">
            <button
              class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              data-product-open="${escapeHtml(p.id)}"
              type="button"
            >
              View
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadProducts() {
  const tbody = $("#adminProductsTable");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-5 text-slate-500 text-sm" colspan="7">
          <i class="fa-solid fa-spinner fa-spin mr-2"></i>
          Loading products...
        </td>
      </tr>
    `;
  }

  try {
    // Prefer admin endpoint if you have it:
    // If it doesn't exist, we fallback to public products (may be limited).
    let res;
    try {
      res = await api("/admin/products", { auth: true });
    } catch {
      res = await api("/products", { auth: false });
    }

    // normalize expected list keys
    const list = Array.isArray(res?.products)
      ? res.products
      : Array.isArray(res?.data?.products)
      ? res.data.products
      : Array.isArray(res?.items)
      ? res.items
      : [];

    productsCache = list;
    productsApplyFilters();
  } catch (e) {
    console.error("loadProducts error:", e);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td class="px-6 py-6 text-red-700 text-sm" colspan="7">
            Failed to load products: ${escapeHtml(e?.message || "Unknown error")}
          </td>
        </tr>
      `;
    }
  }
}

function initProductsFilters() {
  $("#productsSearch")?.addEventListener("input", productsApplyFilters);
  $("#productsStatus")?.addEventListener("change", productsApplyFilters);
  $("#productsAvailable")?.addEventListener("change", productsApplyFilters);
  $("#productsIncludeDeleted")?.addEventListener("change", productsApplyFilters);

  $("#productsClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    const a = $("#productsSearch");
    const b = $("#productsStatus");
    const c = $("#productsAvailable");
    const d = $("#productsIncludeDeleted");
    if (a) a.value = "";
    if (b) b.value = "";
    if (c) c.value = "";
    if (d) d.checked = false;
    productsApplyFilters();
  });

  $("#btnReloadProducts")?.addEventListener("click", loadProducts);
}

function openProductModal() {
  $("#productModal")?.classList.remove("hidden");
  lockBodyScroll();

}
function closeProductModal() {
  $("#productModal")?.classList.add("hidden");
  unlockBodyScroll();

}
function initProductModal() {
  $("#productModalBackdrop")?.addEventListener("click", closeProductModal);
  $("#productModalClose")?.addEventListener("click", closeProductModal);
  $("#productModalClose2")?.addEventListener("click", closeProductModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProductModal();
  });
}

async function showProductDetails(productId) {
  const title = $("#productModalTitle");
  const body = $("#productModalBody");

  if (title) title.textContent = productId;
  if (body) {
    body.innerHTML = `
      <div class="text-slate-500 text-sm">
        <i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading...
      </div>
    `;
  }
  openProductModal();

  try {
    // Prefer admin product detail endpoint if you have it; else use public
    let res;
    try {
      res = await api(`/admin/products/${encodeURIComponent(productId)}`, { auth: true });
    } catch {
      res = await api(`/products/${encodeURIComponent(productId)}`, { auth: false });
    }

    const p = res?.product || res?.data?.product || res;
    if (!p?.id) throw new Error("Product not found");

    const vendorName = p.vendor?.businessName || p.vendorBusinessName || "—";

    const img = p.imageUrl
      ? `<img src="${escapeHtml(p.imageUrl)}" class="h-24 w-24 rounded-2xl object-cover border border-slate-200" alt="" />`
      : `<div class="h-24 w-24 rounded-2xl bg-slate-100 border border-slate-200 grid place-items-center text-xs text-slate-500">No image</div>`;

    const benefits = Array.isArray(p.benefits) ? p.benefits : [];
    const related = Array.isArray(p.relatedIds) ? p.relatedIds : [];

    if (body) {
      body.innerHTML = `
        <div class="flex items-start gap-4">
          ${img}
          <div class="min-w-0">
            <div class="text-xs text-slate-500">Name</div>
            <div class="text-xl font-extrabold">${escapeHtml(p.name || "—")}</div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              ${badge(p.status || "DRAFT", p.status === "PUBLISHED" ? "emerald" : "slate")}
              ${badge(p.isAvailable ? "Available" : "Unavailable", p.isAvailable ? "emerald" : "red")}
              ${badge(p.isDeleted ? "Deleted" : "Not deleted", p.isDeleted ? "red" : "slate")}
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="text-xs text-slate-500 font-semibold">Vendor</div>
            <div class="mt-1 font-bold">${escapeHtml(vendorName)}</div>
            <div class="text-xs text-slate-500 mt-1">${escapeHtml(p.vendorId || "")}</div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="text-xs text-slate-500 font-semibold">Price (USD)</div>
            <div class="mt-1 text-xl font-extrabold">${fmtUsd(p.priceUsdCents)}</div>
            <div class="text-xs text-slate-500 mt-1">priceUsdCents: ${escapeHtml(
              String(p.priceUsdCents ?? "—")
            )}</div>
          </div>
        </div>

        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
          <div class="text-xs text-slate-500 font-semibold">Category</div>
          <div class="mt-1 font-bold">${escapeHtml(p.category || "—")}</div>

          <div class="mt-4 text-xs text-slate-500 font-semibold">Short Description</div>
          <div class="mt-1 text-sm text-slate-700">${escapeHtml(p.shortDesc || "—")}</div>

          <div class="mt-4 text-xs text-slate-500 font-semibold">Description</div>
          <div class="mt-1 text-sm text-slate-700">${escapeHtml(p.description || "—")}</div>
        </div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="text-xs text-slate-500 font-semibold">Benefits</div>
            ${
              benefits.length
                ? `<ul class="mt-2 space-y-2 text-sm text-slate-700">${benefits
                    .slice(0, 12)
                    .map((b) => `<li class="flex gap-2"><span class="text-emerald-700 font-bold">✔</span><span>${escapeHtml(
                      b
                    )}</span></li>`)
                    .join("")}</ul>`
                : `<div class="mt-2 text-sm text-slate-500">No benefits</div>`
            }
          </div>

          <div class="rounded-2xl border border-slate-200 p-4">
            <div class="text-xs text-slate-500 font-semibold">Related IDs</div>
            ${
              related.length
                ? `<div class="mt-2 text-sm text-slate-700 space-y-1">${related
                    .slice(0, 15)
                    .map((id) => `<div class="font-mono text-[12px]">${escapeHtml(id)}</div>`)
                    .join("")}</div>`
                : `<div class="mt-2 text-sm text-slate-500">No related items</div>`
            }
          </div>
        </div>

        <div class="mt-4 text-xs text-slate-500">
          Created: ${p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"} • Updated:
          ${p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
        </div>
      `;
    }
  } catch (e) {
    console.error("showProductDetails error:", e);
    if (body) {
      body.innerHTML = `
        <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load product: ${escapeHtml(e?.message || "Unknown error")}
        </div>
      `;
    }
  }
}

// click row or view button -> modal
document.addEventListener("click", (e) => {
  const openBtn = e.target.closest("[data-product-open]");
  if (openBtn) {
    const id = openBtn.getAttribute("data-product-open");
    if (!id) return;
    showProductDetails(id);
    return;
  }

  const row = e.target.closest("[data-product-row]");
  if (!row) return;
  const id = row.getAttribute("data-product-row");
  if (!id) return;
  showProductDetails(id);
});

// ---------------------- FX ----------------------
async function loadFxRate() {
  const input = $("#fxRate");
  if (!input) return;

  input.disabled = true;

  try {
    const res = await api("/fx/usd-ngn", { auth: false });
    const rate = Number(res?.rate || 0);
    input.value = rate > 0 ? String(rate) : "";
  } catch (e) {
    console.error("loadFxRate error:", e);
  } finally {
    input.disabled = false;
  }
}

function initFxForm() {
  const form = $("#fxForm");
  const input = $("#fxRate");
  const reload = $("#btnReloadFx");
  if (!form || !input) return;

  reload?.addEventListener("click", (e) => {
    e.preventDefault();
    loadFxRate();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rate = Number(input.value || 0);
    if (!rate || rate <= 0) {
      alert("Enter a valid rate (e.g. 1700).");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const old = btn?.textContent;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }

    try {
      await api("/admin/fx/usd-ngn", {
        method: "PATCH",
        auth: true,
        body: { rate },
      });
      showToast("FX rate updated ✅");
    } catch (err) {
      alert(err?.message || "Failed to update FX rate.");
      console.error(err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || "Save Rate";
      }
    }
  });
}

// ---------------------- Logout wiring ----------------------
function initLogout() {
  const btn = document.querySelector("[data-logout]");
  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      clearToken?.();
    } catch {}
    storage.remove("refreshToken");
    storage.remove("user");
    storage.remove("vendor");
    storage.remove("authType");
    storage.remove("vendor_token");
    window.location.href = "admin-login.html";
  });
}

// ---------------------- Boot ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  initDrawer();
  initLogout();
  initFxForm();

  initVendorsFilters();
  initUsersFilters();
  initOrdersFilters();
  initProductsFilters();

  initOrderModal();
  initProductModal();

  const ok = await requireAdminGuardOrRedirect();
  if (!ok) return;

  initTabs();
});
