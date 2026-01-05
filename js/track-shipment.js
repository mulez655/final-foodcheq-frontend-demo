import { api } from "./api.js";

function setResults(html, type = "muted") {
  const results = document.getElementById("results");
  if (!results) return;

  // type: muted | success | danger | info
  results.innerHTML = `
    <div class="text-${type}">
      ${html}
    </div>
  `;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("trackForm");
  const input = document.getElementById("trackingNumber");

  if (!form || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = input.value.trim();
    if (!code) {
      setResults("Please enter a tracking number.", "danger");
      return;
    }

    setResults("Checking shipment status...", "info");

    try {
      // Try both Delivery and LogisticsRequest tracking endpoints
      let data = null;
      let lastErr = null;

      const attempts = [
        // Delivery tracking (FCQ-TRK-XXXXXX)
        () => api(`/logistics/track/${encodeURIComponent(code)}`, { method: "GET", auth: false }),
        // LogisticsRequest tracking (FCQ-LOG-XXXXXX)
        () => api(`/logistics/requests/${encodeURIComponent(code)}`, { method: "GET", auth: false }),
      ];

      for (const attempt of attempts) {
        try {
          data = await attempt();
          if (data && (data.shipment || data.request)) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!data || (!data.shipment && !data.request)) {
        throw lastErr || new Error("Shipment not found. Please check your tracking number.");
      }

      // Normalize response - handle both Delivery and LogisticsRequest
      const item = data.shipment || data.request || data.data || data;
      const isLogisticsRequest = !!data.request;

      const status = item.status || "UNKNOWN";
      const location = item.currentLocation || item.dropoffLocation || "—";
      const eta = item.eta ? new Date(item.eta).toLocaleString() : "—";
      const updatedAt = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—";
      const events = item.events || [];

      // Build timeline HTML
      let timelineHtml = "";
      if (events.length > 0) {
        timelineHtml = `
          <div class="mt-4">
            <p class="font-semibold mb-2">Tracking History:</p>
            <ul class="space-y-2 text-sm">
              ${events.map(e => `
                <li class="flex gap-2">
                  <span class="text-emerald-600">●</span>
                  <span>${escapeHtml(e.title)} - ${new Date(e.createdAt).toLocaleString()}</span>
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }

      setResults(
        `
        <div class="space-y-2">
          <p><strong>Tracking Number:</strong> ${escapeHtml(code)}</p>
          <p><strong>Type:</strong> ${isLogisticsRequest ? "Logistics Request" : "Order Delivery"}</p>
          <p><strong>Status:</strong> <span class="font-semibold">${escapeHtml(status)}</span></p>
          ${item.pickupLocation ? `<p><strong>From:</strong> ${escapeHtml(item.pickupLocation)}</p>` : ""}
          ${item.dropoffLocation ? `<p><strong>To:</strong> ${escapeHtml(item.dropoffLocation)}</p>` : ""}
          ${item.riderName ? `<p><strong>Rider:</strong> ${escapeHtml(item.riderName)} ${item.riderPhone ? `(${escapeHtml(item.riderPhone)})` : ""}</p>` : ""}
          <p><strong>ETA:</strong> ${escapeHtml(eta)}</p>
          <p class="text-sm text-slate-500"><strong>Last Update:</strong> ${escapeHtml(updatedAt)}</p>
          ${timelineHtml}
        </div>
        `,
        "success"
      );
    } catch (err) {
      setResults(
        err?.message
          ? escapeHtml(err.message)
          : "Tracking failed. Please try again.",
        "danger"
      );
    }
  });
});
