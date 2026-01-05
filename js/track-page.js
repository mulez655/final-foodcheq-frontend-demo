// js/track-page.js
import { api } from "./api.js";

(function () {
  const form = document.getElementById("trackForm");
  const input = document.getElementById("trackingCode");

  const result = document.getElementById("trackResult");
  const empty = document.getElementById("trackEmpty");

  const trkCodeText = document.getElementById("trkCodeText");
  const trkStatus = document.getElementById("trkStatus");
  const trkLocation = document.getElementById("trkLocation");
  const trkEta = document.getElementById("trkEta");
  const trkTimeline = document.getElementById("trkTimeline");

  function show(el) {
    el?.classList.remove("hidden");
  }
  function hide(el) {
    el?.classList.add("hidden");
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
      return String(d || "");
    }
  }

  function statusPill(status) {
    const s = String(status || "").toUpperCase();
    const map = {
      PENDING: "bg-amber-100 text-amber-900",
      ASSIGNED: "bg-blue-100 text-blue-900",
      IN_TRANSIT: "bg-indigo-100 text-indigo-900",
      COMPLETED: "bg-emerald-100 text-emerald-900",
      CANCELLED: "bg-rose-100 text-rose-900",
    };

    trkStatus.className =
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold " +
      (map[s] || "bg-slate-100 text-slate-900");

    trkStatus.textContent = s || "UNKNOWN";
  }

  function renderTimeline(events = []) {
    trkTimeline.innerHTML = "";

    if (!Array.isArray(events) || events.length === 0) {
      const row = document.createElement("div");
      row.className = "text-sm text-slate-600";
      row.textContent = "No timeline events yet.";
      trkTimeline.appendChild(row);
      return;
    }

    events.forEach((ev) => {
      const row = document.createElement("div");
      row.className = "flex items-start gap-3";
      row.innerHTML = `
        <div class="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-600"></div>
        <div class="flex-1">
          <p class="text-sm font-semibold text-slate-900">${ev.title || "Update"}</p>
          <p class="text-xs text-slate-500">${fmtDate(ev.createdAt)}</p>
        </div>
      `;
      trkTimeline.appendChild(row);
    });
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = (input?.value || "").trim();
    if (!code) return;

    hide(result);
    hide(empty);

    try {
      // ✅ api() already points to /api
      const data = await api(`/logistics/track/${encodeURIComponent(code)}`, {
        method: "GET",
        auth: false,
      });

      const shipment = data?.shipment;

      if (!shipment) {
        show(empty);
        return;
      }

      trkCodeText.textContent = shipment.trackingCode || code;
      statusPill(shipment.status);

      // “Current location” fallback since you don’t store live GPS
      const s = String(shipment.status || "").toUpperCase();
      const loc =
        s === "COMPLETED"
          ? shipment.dropoffLocation
          : s === "PENDING"
          ? shipment.pickupLocation
          : "In transit";

      trkLocation.textContent = loc || "—";
      trkEta.textContent = "—"; // you’re not storing ETA yet (fine)

      renderTimeline(shipment.events || []);
      show(result);
    } catch (err) {
      console.error(err);
      show(empty);
    }
  });
})();
