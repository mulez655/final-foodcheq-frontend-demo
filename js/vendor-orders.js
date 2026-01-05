// js/vendor-orders.js
import { api } from "./api.js";
import { storage } from "./storage.js";

(async function () {
  // Guard: vendor-only
  const authType = storage.get("authType", "");
  if (authType !== "vendor") {
    window.location.href = "login.html";
    return;
  }

  const ordersTbody = document.getElementById("ordersTbody");
  const ordersEmpty = document.getElementById("ordersEmpty");
  const ordersWrap = document.getElementById("ordersWrap");
  const ordersMsg = document.getElementById("ordersMsg");

  const btnRefresh = document.getElementById("btnRefreshOrders");
  const btnLogout = document.getElementById("btnLogoutVendor");

  const statusFilter = document.getElementById("statusFilter");
  const searchInput = document.getElementById("searchInput");

  // Delivery modal elements
  const deliveryModal = document.getElementById("deliveryModal");
  const deliveryForm = document.getElementById("deliveryForm");
  const deliveryOrderId = document.getElementById("deliveryOrderId");
  const deliveryOrderDisplay = document.getElementById("deliveryOrderDisplay");
  const pickupLocation = document.getElementById("pickupLocation");
  const dropoffLocation = document.getElementById("dropoffLocation");
  const riderName = document.getElementById("riderName");
  const riderPhone = document.getElementById("riderPhone");
  const deliveryNotes = document.getElementById("deliveryNotes");
  const btnSubmitDelivery = document.getElementById("btnSubmitDelivery");

  let allOrders = [];
  let existingDeliveries = new Set(); // Track orders that already have deliveries

  function showMsg(text = "", type = "info") {
    if (!text) {
      ordersMsg?.classList.add("hidden");
      if (ordersMsg) ordersMsg.textContent = "";
      if (ordersMsg) {
        ordersMsg.className =
          "mt-6 hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm";
      }
      return;
    }

    ordersMsg?.classList.remove("hidden");
    if (ordersMsg) ordersMsg.textContent = text;

    const base = "mt-6 rounded-2xl p-4 text-sm border ";
    const styles =
      type === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : type === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

    if (ordersMsg) ordersMsg.className = base + styles;
  }

  function fmtDate(d) {
    try {
      return new Date(d).toLocaleString("en-NG", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  function badge(status) {
    const s = String(status || "").toUpperCase();
    const map = {
      PENDING: "bg-amber-50 text-amber-700 border-amber-200",
      ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
      PREPARING: "bg-blue-50 text-blue-700 border-blue-200",
      READY: "bg-indigo-50 text-indigo-700 border-indigo-200",
      COMPLETED: "bg-slate-900 text-white border-slate-900",
      REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
      CANCELLED: "bg-slate-50 text-slate-700 border-slate-200",
    };

    return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
      map[s] || map.CANCELLED
    }">${s || "-"}</span>`;
  }

  function paymentBadge(paymentStatus) {
    const p = String(paymentStatus || "").toUpperCase();
    const map = {
      PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
      PENDING: "bg-amber-50 text-amber-700 border-amber-200",
      FAILED: "bg-rose-50 text-rose-700 border-rose-200",
      REFUNDED: "bg-slate-50 text-slate-700 border-slate-200",
    };
    const label = p || "PENDING";
    const cls = map[label] || map.PENDING;

    return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}">${label}</span>`;
  }

  function isPaid(o) {
    return String(o?.paymentStatus || "").toUpperCase() === "PAID";
  }

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- Lifecycle helpers ---
  const FLOW = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

  function statusOf(order) {
    return String(order?.status || "").toUpperCase();
  }

  function isTerminal(order) {
    const s = statusOf(order);
    return s === "CANCELLED" || s === "REJECTED" || s === "COMPLETED";
  }

  function canAccept(order) {
    if (!isPaid(order)) return false;
    const s = statusOf(order);
    return s === "PENDING"; // keep simple & strict
  }

  function canReject(order) {
    if (!isPaid(order)) return false;
    const s = statusOf(order);
    return s === "PENDING" || s === "ACCEPTED";
  }

  function canMoveTo(order, nextStatus) {
    if (!isPaid(order)) return false;
    if (isTerminal(order)) return false;

    const current = statusOf(order);
    const next = String(nextStatus || "").toUpperCase();

    // only these are allowed via /status
    if (!["PREPARING", "READY", "COMPLETED"].includes(next)) return false;

    const idxCurrent = FLOW.indexOf(current);
    const idxNext = FLOW.indexOf(next);

    // must be in the flow and must move forward
    if (idxCurrent === -1 || idxNext === -1) return false;
    if (idxNext <= idxCurrent) return false;

    // enforce step-by-step:
    // ACCEPTED -> PREPARING -> READY -> COMPLETED
    const expectedNext = FLOW[idxCurrent + 1];
    return next === expectedNext;
  }

  // --- Delivery helpers ---
  function canCreateDelivery(order) {
    if (!isPaid(order)) return false;
    if (existingDeliveries.has(order.id)) return false;
    const s = statusOf(order);
    // Can create delivery once order is accepted or further along
    return ["ACCEPTED", "PREPARING", "READY"].includes(s);
  }

  function hasDelivery(order) {
    return existingDeliveries.has(order.id);
  }

  function openDeliveryModal(order) {
    if (!deliveryModal) return;

    // Pre-fill with order info
    if (deliveryOrderId) deliveryOrderId.value = order.id;
    if (deliveryOrderDisplay) deliveryOrderDisplay.textContent = order.id;

    // Try to pre-fill dropoff with customer info if available
    if (dropoffLocation && order.user?.address) {
      dropoffLocation.value = order.user.address;
    }

    // Clear other fields
    if (pickupLocation) pickupLocation.value = "";
    if (riderName) riderName.value = "";
    if (riderPhone) riderPhone.value = "";
    if (deliveryNotes) deliveryNotes.value = "";

    deliveryModal.classList.remove("hidden");
  }

  function closeDeliveryModal() {
    if (deliveryModal) deliveryModal.classList.add("hidden");
  }

  async function fetchDeliveries() {
    try {
      const res = await api("/vendor/deliveries", { auth: "vendor" });
      existingDeliveries.clear();
      if (res.deliveries && Array.isArray(res.deliveries)) {
        res.deliveries.forEach(d => {
          if (d.orderId) existingDeliveries.add(d.orderId);
        });
      }
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
    }
  }

  async function createDelivery(orderId, data) {
    const res = await api("/vendor/deliveries", {
      method: "POST",
      auth: "vendor",
      body: {
        orderId,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        riderName: data.riderName || undefined,
        riderPhone: data.riderPhone || undefined,
        notes: data.notes || undefined,
      },
    });
    return res;
  }

  function actionBtn({ label, action, id, disabled, title = "" }) {
    const cls = disabled
      ? "opacity-50 cursor-not-allowed"
      : "hover:bg-slate-50";
    return `
      <button
        type="button"
        class="rounded-xl px-4 py-2 text-xs font-semibold border ${cls}"
        data-action="${esc(action)}"
        data-id="${esc(id)}"
        ${title ? `title="${esc(title)}"` : ""}
        ${disabled ? "disabled" : ""}
      >
        ${esc(label)}
      </button>
    `;
  }

  function applyFilters() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const st = (statusFilter?.value || "").trim().toUpperCase();

    let filtered = [...allOrders];

    // (Paid-only is already applied at fetch time)
    if (st) {
      filtered = filtered.filter(
        (o) => String(o.status || "").toUpperCase() === st
      );
    }

    if (q) {
      filtered = filtered.filter((o) => {
        const orderId = String(o.id || "").toLowerCase();
        const email = String(o.user?.email || "").toLowerCase();
        return orderId.includes(q) || email.includes(q);
      });
    }

    render(filtered);
  }

  function render(list) {
    if (!list.length) {
      ordersEmpty?.classList.remove("hidden");
      ordersWrap?.classList.add("hidden");
      if (ordersTbody) ordersTbody.innerHTML = "";
      return;
    }

    ordersEmpty?.classList.add("hidden");
    ordersWrap?.classList.remove("hidden");

    if (!ordersTbody) return;

    ordersTbody.innerHTML = list
      .map((o) => {
        const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
        const customer = o.user?.email || o.user?.name || "-";

        const payHtml = paymentBadge(o.paymentStatus);

        const acceptDisabled = !canAccept(o);
        const rejectDisabled = !canReject(o);

        const preparingDisabled = !canMoveTo(o, "PREPARING");
        const readyDisabled = !canMoveTo(o, "READY");
        const completedDisabled = !canMoveTo(o, "COMPLETED");

        return `
          <tr class="border-t border-slate-100">
            <td class="py-3 pr-4">
              <p class="font-semibold">${esc(o.id)}</p>
              <p class="text-xs text-slate-500">Vendor order</p>
              <p class="mt-1 text-xs text-slate-600">Payment: ${payHtml}</p>
            </td>

            <td class="py-3 pr-4 text-slate-700">
              <p class="font-medium">${esc(customer)}</p>
              <p class="text-xs text-slate-500">${esc(o.user?.name || "")}</p>
            </td>

            <td class="py-3 pr-4 text-slate-700">${itemsCount}</td>

            <td class="py-3 pr-4">${badge(o.status)}</td>

            <td class="py-3 pr-4 text-slate-700">${fmtDate(o.createdAt)}</td>

            <td class="py-3">
              <div class="flex flex-wrap items-center gap-2">
                ${actionBtn({
                  label: "Accept",
                  action: "accept",
                  id: o.id,
                  disabled: acceptDisabled,
                  title: acceptDisabled
                    ? "Accept disabled: must be PAID and PENDING"
                    : "Accept order",
                })}

                ${actionBtn({
                  label: "Preparing",
                  action: "preparing",
                  id: o.id,
                  disabled: preparingDisabled,
                  title: preparingDisabled
                    ? "Requires: PAID + ACCEPTED"
                    : "Mark as PREPARING",
                })}

                ${actionBtn({
                  label: "Ready",
                  action: "ready",
                  id: o.id,
                  disabled: readyDisabled,
                  title: readyDisabled
                    ? "Requires: PAID + PREPARING"
                    : "Mark as READY",
                })}

                ${actionBtn({
                  label: "Completed",
                  action: "completed",
                  id: o.id,
                  disabled: completedDisabled,
                  title: completedDisabled
                    ? "Requires: PAID + READY"
                    : "Mark as COMPLETED",
                })}

                ${actionBtn({
                  label: "Reject",
                  action: "reject",
                  id: o.id,
                  disabled: rejectDisabled,
                  title: rejectDisabled
                    ? "Reject disabled for this status"
                    : "Reject order",
                })}

                ${hasDelivery(o)
                  ? `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <i class="fa-solid fa-truck mr-1"></i> Delivery Created
                    </span>`
                  : actionBtn({
                      label: "📦 Delivery",
                      action: "delivery",
                      id: o.id,
                      disabled: !canCreateDelivery(o),
                      title: !canCreateDelivery(o)
                        ? "Requires: PAID + ACCEPTED/PREPARING/READY"
                        : "Create delivery for this order",
                    })
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function fetchOrders() {
    showMsg("Loading PAID orders...");
    const res = await api("/vendor/orders", { auth: true });

    // ✅ PAID ONLY
    const raw = res.orders || [];
    allOrders = raw.filter(isPaid);

    showMsg("");
    applyFilters();
  }

  async function updateOrder(orderId, action) {
    const a = String(action || "").toLowerCase();

    if (a === "accept") {
      showMsg("Accepting order...");
      const res = await api(`/vendor/orders/${orderId}/accept`, {
        method: "PATCH",
        auth: true,
      });
      showMsg(res.message || "Accepted", "success");
      return;
    }

    if (a === "reject") {
      showMsg("Rejecting order...");
      const res = await api(`/vendor/orders/${orderId}/reject`, {
        method: "PATCH",
        auth: true,
      });
      showMsg(res.message || "Rejected", "success");
      return;
    }

    // lifecycle endpoint
    const map = {
      preparing: "PREPARING",
      ready: "READY",
      completed: "COMPLETED",
    };

    const next = map[a];
    if (!next) throw new Error("Unknown action");

    showMsg(`Updating to ${next}...`);
    const res = await api(`/vendor/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status: next },
      auth: true,
    });
    showMsg(res.message || `Updated to ${next}`, "success");
  }

  // Events
  btnRefresh?.addEventListener("click", () => fetchOrders());

  btnLogout?.addEventListener("click", () => {
    storage.remove("token");
    storage.remove("refreshToken");
    storage.remove("authType");
    storage.remove("vendor");
    storage.remove("user");
    window.location.href = "login.html";
  });

  statusFilter?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);

  ordersTbody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    // extra safety: ensure paid-only actions
    const order = allOrders.find((x) => String(x.id) === String(id));
    if (!order) {
      showMsg("Order not found in list (try refresh).", "error");
      return;
    }
    if (!isPaid(order)) {
      showMsg("Blocked: only PAID orders can be processed here.", "error");
      return;
    }

    // frontend rule enforcement (matches your backend guards)
    if (action === "accept" && !canAccept(order)) {
      showMsg("Cannot accept: must be PAID and PENDING.", "error");
      return;
    }
    if (action === "reject" && !canReject(order)) {
      showMsg("Cannot reject this order at its current status.", "error");
      return;
    }
    if (["preparing", "ready", "completed"].includes(String(action))) {
      const nextMap = {
        preparing: "PREPARING",
        ready: "READY",
        completed: "COMPLETED",
      };
      const next = nextMap[action];
      if (!canMoveTo(order, next)) {
        showMsg(`Cannot move to ${next}. Follow the correct flow.`, "error");
        return;
      }
    }

    // Handle delivery action - open modal instead of API call
    if (action === "delivery") {
      if (!canCreateDelivery(order)) {
        showMsg("Cannot create delivery for this order.", "error");
        return;
      }
      openDeliveryModal(order);
      return;
    }

    try {
      btn.disabled = true;
      await updateOrder(id, action);
      await fetchOrders();
    } catch (err) {
      showMsg(err?.message || "Action failed", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // Delivery modal close handlers
  document.querySelectorAll("[data-close-delivery-modal]").forEach((el) => {
    el.addEventListener("click", closeDeliveryModal);
  });

  // Delivery form submission
  deliveryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const orderId = deliveryOrderId?.value;
    if (!orderId) {
      showMsg("No order selected for delivery.", "error");
      return;
    }

    const data = {
      pickupLocation: pickupLocation?.value?.trim() || "",
      dropoffLocation: dropoffLocation?.value?.trim() || "",
      riderName: riderName?.value?.trim() || "",
      riderPhone: riderPhone?.value?.trim() || "",
      notes: deliveryNotes?.value?.trim() || "",
    };

    if (!data.pickupLocation || !data.dropoffLocation) {
      showMsg("Pickup and dropoff locations are required.", "error");
      return;
    }

    try {
      if (btnSubmitDelivery) btnSubmitDelivery.disabled = true;
      showMsg("Creating delivery...");

      const res = await createDelivery(orderId, data);
      showMsg(res.message || "Delivery created successfully!", "success");

      closeDeliveryModal();
      await fetchDeliveries();
      applyFilters(); // Re-render to show "Delivery Created" badge
    } catch (err) {
      showMsg(err?.message || "Failed to create delivery", "error");
    } finally {
      if (btnSubmitDelivery) btnSubmitDelivery.disabled = false;
    }
  });

  // Boot
  try {
    await fetchDeliveries(); // Load existing deliveries first
    await fetchOrders();
  } catch (err) {
    showMsg(err?.message || "Failed to load orders", "error");
  }
})();
