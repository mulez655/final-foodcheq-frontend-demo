// js/orders-page.js
import { api, clearToken } from "./api.js";
import { storage } from "./storage.js";

const $ = (s) => document.querySelector(s);

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

function moneyNGN(kobo) {
  const amount = Number(kobo || 0) / 100;
  return `₦${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function toneForOrderStatus(s) {
  if (s === "COMPLETED") return "emerald";
  if (s === "CANCELLED") return "red";
  if (s === "ACCEPTED") return "amber";
  return "slate";
}

function toneForPayStatus(s) {
  if (s === "PAID") return "emerald";
  if (s === "FAILED") return "red";
  if (s === "REFUNDED") return "amber";
  return "slate";
}

let allOrders = [];

function getTotalKobo(o) {
  return (
    Number(o.totalKobo) ||
    Number(o.totalAmountKobo) ||
    (Array.isArray(o.items)
      ? o.items.reduce((s, it) => s + Number(it.subtotalKobo || 0), 0)
      : 0)
  );
}

function applyFilters() {
  const q = ($("#ordersSearch")?.value || "").trim().toLowerCase();
  const status = ($("#ordersStatus")?.value || "").trim();
  const pay = ($("#ordersPayment")?.value || "").trim();

  let list = [...allOrders];

  if (q) list = list.filter((o) => String(o.id || "").toLowerCase().includes(q));
  if (status) list = list.filter((o) => (o.status || "") === status);
  if (pay) list = list.filter((o) => (o.paymentStatus || "") === pay);

  $("#ordersCount").textContent = `${list.length} order(s)`;
  return list;
}

function render() {
  const tbody = $("#ordersTable");
  const empty = $("#ordersEmpty");
  if (!tbody || !empty) return;

  const list = applyFilters();

  if (!list.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  tbody.innerHTML = list
    .map((o) => {
      const totalKobo = getTotalKobo(o);
      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" data-order-row="${escapeHtml(o.id)}">
          <td class="px-6 py-4">
            <div class="font-semibold">${escapeHtml(o.id)}</div>
            <div class="text-xs text-slate-500">${new Date(o.createdAt).toLocaleString()}</div>
          </td>
          <td class="py-4">${badge(o.status || "PENDING", toneForOrderStatus(o.status))}</td>
          <td class="py-4">${badge(o.paymentStatus || "PENDING", toneForPayStatus(o.paymentStatus))}</td>
          <td class="py-4 pr-6 text-right font-bold">${moneyNGN(totalKobo)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadOrders() {
  const tbody = $("#ordersTable");
  const empty = $("#ordersEmpty");

  if (tbody) {
    tbody.innerHTML = Array.from({ length: 8 }).map(() => `
  <tr class="border-b border-slate-100">
    <td class="px-6 py-4">
      <div class="h-4 w-44 bg-slate-100 rounded animate-pulse"></div>
      <div class="mt-2 h-3 w-28 bg-slate-100 rounded animate-pulse"></div>
    </td>
    <td class="py-4">
      <div class="h-4 w-32 bg-slate-100 rounded animate-pulse"></div>
      <div class="mt-2 h-3 w-40 bg-slate-100 rounded animate-pulse"></div>
    </td>
    <td class="py-4">
      <div class="h-4 w-32 bg-slate-100 rounded animate-pulse"></div>
      <div class="mt-2 h-3 w-40 bg-slate-100 rounded animate-pulse"></div>
    </td>
    <td class="py-4"><div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse"></div></td>
    <td class="py-4"><div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse"></div></td>
    <td class="py-4 pr-6 text-right"><div class="ml-auto h-4 w-24 bg-slate-100 rounded animate-pulse"></div></td>
  </tr>
`).join("");

  }
  empty?.classList.add("hidden");

  const res = await api("/orders", { auth: true });
  allOrders = Array.isArray(res?.orders) ? res.orders : [];
  render();
}

function openModal() {
  $("#orderModal")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#orderModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

async function loadOrderDetails(id) {
  $("#orderModalTitle").textContent = id;
  $("#orderModalBody").innerHTML = `
    <div class="text-slate-500 text-sm">
      <i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading...
    </div>
  `;
  openModal();

  const res = await api(`/orders/${encodeURIComponent(id)}`, { auth: true });
  const o = res?.order;

  if (!o?.id) {
    $("#orderModalBody").innerHTML = `<div class="text-red-700 text-sm">Order not found.</div>`;
    return;
  }

  const items = Array.isArray(o.items) ? o.items : [];
  const totalKobo = getTotalKobo(o);

  $("#orderModalBody").innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">Status</div>
          <div class="mt-1">${badge(o.status || "PENDING", toneForOrderStatus(o.status))}</div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">Payment</div>
          <div class="mt-1">${badge(o.paymentStatus || "PENDING", toneForPayStatus(o.paymentStatus))}</div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold">Items</div>
        <div class="divide-y divide-slate-100">
          ${
            items.length
              ? items
                  .map(
                    (it) => `
                    <div class="p-4 flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <div class="font-semibold">Product: ${escapeHtml(it.productId)}</div>
                        <div class="text-xs text-slate-500">Qty: ${Number(it.quantity || 0)}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-xs text-slate-500">Subtotal</div>
                        <div class="font-extrabold">${moneyNGN(it.subtotalKobo || 0)}</div>
                      </div>
                    </div>
                  `
                  )
                  .join("")
              : `<div class="p-4 text-sm text-slate-500">No items.</div>`
          }
        </div>
      </div>

      <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-sm font-semibold">Total</div>
        <div class="text-lg font-extrabold">${moneyNGN(totalKobo)}</div>
      </div>
    </div>
  `;
}

function initLogout() {
  const btn = document.querySelector("[data-logout]");
  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    clearToken?.();
    storage.remove("refreshToken");
    storage.remove("user");
    storage.remove("vendor");
    storage.remove("authType");
    storage.remove("vendor_token");
    window.location.href = "login.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initLogout();

  // Guard: must be logged in
  try {
    await api("/auth/me", { auth: true });
  } catch {
    window.location.href = "login.html";
    return;
  }

  // Filters
  $("#ordersSearch")?.addEventListener("input", render);
  $("#ordersStatus")?.addEventListener("change", render);
  $("#ordersPayment")?.addEventListener("change", render);

  $("#ordersClear")?.addEventListener("click", () => {
    $("#ordersSearch").value = "";
    $("#ordersStatus").value = "";
    $("#ordersPayment").value = "";
    render();
  });

  $("#btnReloadOrders")?.addEventListener("click", async () => {
    const btn = $("#btnReloadOrders");
    const old = btn?.textContent;
    if (btn) (btn.disabled = true), (btn.textContent = "Loading...");
    try {
      await loadOrders();
    } finally {
      if (btn) (btn.disabled = false), (btn.textContent = old || "Refresh");
    }
  });

  // Modal close
  $("#orderModalBackdrop")?.addEventListener("click", closeModal);
  $("#orderModalClose")?.addEventListener("click", closeModal);
  $("#orderModalClose2")?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Row click
  document.addEventListener("click", async (e) => {
    const row = e.target.closest("[data-order-row]");
    if (!row) return;
    const id = row.getAttribute("data-order-row");
    if (!id) return;
    await loadOrderDetails(id);
  });

  await loadOrders();
});
