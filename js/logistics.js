import { api } from "./api.js";

function showAlert(type, msg) {
  const el = document.getElementById("logisticsAlert");
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("logisticsForm");
  const btn = document.getElementById("logisticsBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      senderName: document.getElementById("senderName").value.trim(),
      senderPhone: document.getElementById("senderPhone").value.trim(),
      senderAddress: document.getElementById("senderAddress").value.trim(),

      receiverName: document.getElementById("receiverName").value.trim(),
      receiverPhone: document.getElementById("receiverPhone").value.trim(),
      receiverAddress: document.getElementById("receiverAddress").value.trim(),

      packageType: document.getElementById("packageType").value,
      packageWeight: Number(document.getElementById("packageWeight").value),
      note: document.getElementById("note").value.trim() || undefined,
    };

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting...";
    }

    try {
      const res = await api("/api/logistics", {
        method: "POST",
        auth: true,
        body: payload,
      });

      // Try to detect tracking code if backend returns it
      const trackingCode =
        res?.trackingCode || res?.shipment?.trackingCode || res?.data?.trackingCode;

      if (trackingCode) {
        showAlert("success", `Request created! Tracking code: ${trackingCode}`);
      } else {
        showAlert("success", "Request submitted successfully.");
      }

      form.reset();
    } catch (err) {
      showAlert("danger", err.message || "Failed to submit request.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit Request";
      }
    }
  });
});
