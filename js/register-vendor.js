// js/register-vendor.js
import { api } from "./api.js";
import { storage } from "./storage.js";

function qs(id) {
  return document.getElementById(id);
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.oldText = btn.textContent || "Submit";
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Submitting...`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.oldText || "Submit Vendor Application";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("vendorRegisterForm");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      businessName: qs("businessName")?.value?.trim(),
      contactName: qs("contactName")?.value?.trim(),
      phone: qs("phone")?.value?.trim(),
      email: qs("email")?.value?.trim(),
      password: qs("password")?.value,
    };

    // Frontend validation (mirrors backend zod)
    if (!payload.businessName || payload.businessName.length < 2) {
      alert("Business name must be at least 2 characters.");
      return;
    }
    if (!payload.email || !payload.email.includes("@")) {
      alert("Please enter a valid email.");
      return;
    }
    if (!payload.password || payload.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    // address exists in the form but your backend schema doesn't need it yet
    // so we don't send it to avoid confusion.

    setLoading(submitBtn, true);

    try {
      // IMPORTANT:
      // Your api.js has API_BASE = "http://localhost:4000/api"
      // So we call WITHOUT "/api" prefix here.
      const res = await api("/vendor/auth/register", {
        method: "POST",
        body: payload,
        auth: false,
      });

      // Store vendor session (optional; useful if you want auto-fill later)
      if (res?.accessToken) storage.set("vendor_token", res.accessToken);
      if (res?.vendor) storage.set("vendor", res.vendor);

      alert(
        "✅ Vendor registration submitted!\n\nYour account is pending approval. Once approved, you can login."
      );

      // Send them to login page (they can't login until approved anyway)
      window.location.href = "login.html";
    } catch (err) {
      alert(err?.message || "Vendor registration failed. Please try again.");
      console.error("Vendor register error:", err);
    } finally {
      setLoading(submitBtn, false);
    }
  });
});
