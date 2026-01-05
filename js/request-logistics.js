// js/request-logistics.js
import { api } from "./api.js";

(function () {
  const form = document.getElementById("logisticsForm");
  const btn = document.getElementById("submitBtn");

  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMsg = document.getElementById("modalMsg");

  function openModal(title, msg) {
    if (!modal) return;
    if (modalTitle) modalTitle.textContent = title;
    if (modalMsg) modalMsg.textContent = msg;
    modal.classList.remove("hidden");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
  }

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  function setLoading(on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle("opacity-70", !!on);
    btn.classList.toggle("cursor-not-allowed", !!on);
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      orderId: form.orderId?.value?.trim() || null,
      fullName: form.fullName?.value?.trim(),
      phone: form.phone?.value?.trim(),
      email: form.email?.value?.trim(),
      pickupLocation: form.pickupLocation?.value?.trim(),
      dropoffLocation: form.dropoffLocation?.value?.trim(),
      pickupDate: form.pickupDate?.value || null,
      packageType: form.packageType?.value || "",
      notes: form.notes?.value?.trim() || null,
    };

    // tiny validation (UI-side)
    if (!payload.fullName || !payload.phone || !payload.email) {
      openModal("Missing details", "Please fill in your name, phone, and email.");
      return;
    }
    if (!payload.pickupLocation || !payload.dropoffLocation) {
      openModal("Missing address", "Please fill in pickup and dropoff locations.");
      return;
    }
    if (!payload.packageType) {
      openModal("Missing package type", "Please select a package type.");
      return;
    }

    try {
      setLoading(true);

      // ✅ Backend request (public)
      const res = await api("/logistics/requests", {
        method: "POST",
        body: payload,
        auth: false,
      });

      const trackingCode =
        res?.request?.trackingCode || res?.trackingCode || res?.data?.trackingCode;

      if (!trackingCode) {
        openModal(
          "Request submitted",
          "Your request was submitted, but no tracking code was returned. Please contact support."
        );
        form.reset();
        return;
      }

      openModal(
        "Request submitted ✅",
        `Tracking Code: ${trackingCode}\n\nYou can track it on the Track Shipment page.`
      );

      // Optional: auto-redirect to track page with query param after 1.2s
      setTimeout(() => {
        window.location.href = `track-shipment.html?code=${encodeURIComponent(trackingCode)}`;
      }, 1200);

      form.reset();
    } catch (err) {
      openModal("Request failed", err?.message || "Could not submit request. Try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  });
})();
