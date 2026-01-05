// js/order-success.js
import { api } from "./api.js";
import { storage } from "./storage.js";

const $ = (s) => document.querySelector(s);

function getParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name) || "";
}

function setMsg(html, tone = "slate") {
  const el = $("#successMsg");
  if (!el) return;

  const toneCls =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
      ? "text-red-700"
      : "text-slate-600";

  el.className = `mt-5 text-sm ${toneCls}`;
  el.innerHTML = html;
}

async function verifyPaystackPayment(reference) {
  // Try common patterns:
  // 1) GET /payments/paystack/verify?reference=xxx
  // 2) POST /payments/paystack/verify { reference }
  // 3) GET /payments/paystack/verify/xxx
  // Adjust if your backend differs.

  try {
    return await api(`/payments/paystack/verify?reference=${encodeURIComponent(reference)}`, {
      method: "GET",
      auth: true,
    });
  } catch (_) {}

  try {
    return await api(`/payments/paystack/verify`, {
      method: "POST",
      auth: true,
      body: { reference },
    });
  } catch (_) {}

  try {
    return await api(`/payments/paystack/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      auth: true,
    });
  } catch (e) {
    throw e;
  }
}

async function capturePayPalPayment(orderId, paypalOrderId) {
  return await api("/payments/paypal/capture", {
    method: "POST",
    auth: true,
    body: { orderId, paypalOrderId },
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const provider = getParam("provider");
  const orderId = getParam("orderId") || "";

  // Check if this is a PayPal return
  if (provider === "paypal") {
    // Get stored PayPal order info
    const pendingPaypal = storage.get("pendingPaypalOrder", null);

    $("#payRef").textContent = pendingPaypal?.paypalOrderId || "PayPal";
    $("#orderId").textContent = orderId || pendingPaypal?.orderId || "—";

    if (!pendingPaypal || !pendingPaypal.paypalOrderId) {
      setMsg(
        `No PayPal order info found. Please check <a class="underline font-semibold" href="orders.html">My Orders</a>.`,
        "red"
      );
      return;
    }

    try {
      setMsg(`<i class="fa-solid fa-spinner fa-spin mr-2"></i> Capturing PayPal payment...`);

      const res = await capturePayPalPayment(
        pendingPaypal.orderId,
        pendingPaypal.paypalOrderId
      );

      // Clear pending PayPal order
      storage.remove("pendingPaypalOrder");

      if (res?.success) {
        $("#orderId").textContent = res.orderId || orderId || "—";
        setMsg(
          `✅ Payment successful! Your order is being processed.
           <a class="underline font-semibold" href="orders.html">Go to My Orders</a>.`,
          "green"
        );
      } else {
        setMsg(
          `Payment capture failed. Please check <a class="underline font-semibold" href="orders.html">My Orders</a>.`,
          "red"
        );
      }
    } catch (e) {
      console.error("PayPal capture error:", e);
      setMsg(
        `Couldn't capture payment. Please refresh or check
         <a class="underline font-semibold" href="orders.html">My Orders</a>.`,
        "red"
      );
    }
    return;
  }

  // Handle Paystack return (existing logic)
  const reference = getParam("reference") || getParam("trxref") || getParam("ref");

  $("#payRef").textContent = reference || "—";
  $("#orderId").textContent = orderId || "—";

  if (!reference) {
    setMsg(
      `No reference found. Please check <a class="underline font-semibold" href="orders.html">My Orders</a>.`,
      "red"
    );
    return;
  }

  try {
    setMsg(`<i class="fa-solid fa-spinner fa-spin mr-2"></i> Verifying payment...`);

    const res = await verifyPaystackPayment(reference);

    // Expecting your backend to return something like { success:true, order?:{id,...}, paymentStatus?:... }
    const ok = !!res?.success;
    const returnedOrderId = res?.order?.id || res?.orderId || orderId || "—";

    $("#orderId").textContent = returnedOrderId;

    if (!ok) {
      setMsg(
        `Verification returned no success. Check <a class="underline font-semibold" href="orders.html">My Orders</a>.`,
        "red"
      );
      return;
    }

    setMsg(
      `✅ Payment verified. Your order is being processed.
       <a class="underline font-semibold" href="orders.html">Go to My Orders</a>.`,
      "green"
    );
  } catch (e) {
    console.error(e);
    setMsg(
      `Couldn't verify right now. Please refresh or check
       <a class="underline font-semibold" href="orders.html">My Orders</a>.`,
      "red"
    );
  }
});
