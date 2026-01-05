// js/checkout.js
import { api } from "./api.js";
import { getCart, clearCart } from "./cart.js";
import { storage } from "./storage.js";

// Check for tokens - properly parse JSON-stored values
function hasValidToken() {
  let userToken = "";
  let vendorToken = "";

  // Try storage.get first (properly parses JSON)
  userToken = storage.get("token", "") || "";
  vendorToken = storage.get("vendor_token", "") || "";

  // Debug: log token status
  console.log("Checkout auth check:", {
    hasUserToken: !!userToken && userToken.length > 10,
    hasVendorToken: !!vendorToken && vendorToken.length > 10,
    authType: storage.get("authType", "")
  });

  return (userToken && userToken.length > 10) || (vendorToken && vendorToken.length > 10);
}

// Get selected payment method
function getSelectedPaymentMethod() {
  const selected = document.querySelector('input[name="paymentMethod"]:checked');
  return selected?.value || "paypal";
}

// Get selected shipping type
function getSelectedShippingType() {
  const selected = document.querySelector('input[name="shippingType"]:checked');
  return selected?.value || "standard";
}

// Update selection UI styling
function updateSelectionStyles() {
  // Payment method styling
  document.querySelectorAll('[data-payment-option]').forEach((label) => {
    const radio = label.querySelector('input[type="radio"]');
    if (radio?.checked) {
      label.classList.remove('border-slate-200', 'bg-white');
      label.classList.add('border-emerald-500', 'bg-emerald-50');
    } else {
      label.classList.remove('border-emerald-500', 'bg-emerald-50');
      label.classList.add('border-slate-200', 'bg-white');
    }
  });

  // Shipping type styling
  document.querySelectorAll('[data-shipping-option]').forEach((label) => {
    const radio = label.querySelector('input[type="radio"]');
    if (radio?.checked) {
      label.classList.remove('border-slate-200', 'bg-white');
      label.classList.add('border-emerald-500', 'bg-emerald-50');
    } else {
      label.classList.remove('border-emerald-500', 'bg-emerald-50');
      label.classList.add('border-slate-200', 'bg-white');
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("checkoutForm") || document.querySelector("form");
  if (!form) return;

  // Initialize selection styles
  updateSelectionStyles();

  // Update styles when selections change
  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateSelectionStyles();
      // Dispatch event for checkout-summary to update currency
      window.dispatchEvent(new CustomEvent("paymentMethodChange", {
        detail: { paymentMethod: getSelectedPaymentMethod() }
      }));
    });
  });

  document.querySelectorAll('input[name="shippingType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateSelectionStyles();
      // Dispatch event for checkout-summary to update shipping
      window.dispatchEvent(new CustomEvent("shippingTypeChange", {
        detail: { shippingType: getSelectedShippingType() }
      }));
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check if user or vendor is logged in
    if (!hasValidToken()) {
      alert("Please log in to place an order.");
      window.location.href = "login.html?redirect=checkout.html";
      return;
    }

    const cart = getCart();
    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    // If any item has 0 price, force user to re-add from shop (means it was legacy/invalid)
    if (cart.some((x) => Number(x.priceUsdCents || 0) <= 0)) {
      alert("One or more items have missing prices. Please remove them and re-add from the shop.");
      return;
    }

    const items = cart.map((item) => ({
      productId: item.productId || item.id,
      quantity: Number(item.quantity || 1),
    }));

    if (items.some((i) => !i.productId)) {
      alert("Some cart items are missing productId. Please re-add them to cart.");
      return;
    }

    // Get selected payment method and shipping type
    const paymentMethod = getSelectedPaymentMethod();
    const shippingType = getSelectedShippingType();

    const btn = form.querySelector('button[type="submit"]');
    const oldText = btn?.textContent;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processing...";
    }

    try {
      // Debug: Log what we're sending
      console.log("Creating order with:", { items, paymentMethod, shippingType });

      // Create order with payment method and shipping type
      const orderRes = await api("/orders", {
        method: "POST",
        auth: true,
        body: { items, paymentMethod, shippingType },
      });

      console.log("Order response:", orderRes);

      const orderId = orderRes?.order?.id;
      if (!orderId) throw new Error("Order created but order id not returned.");

      // Route to correct payment provider
      if (paymentMethod === "paypal") {
        // PayPal payment init
        const payRes = await api("/payments/paypal/init", {
          method: "POST",
          auth: true,
          body: { orderId },
        });

        const approvalUrl = payRes?.approvalUrl;
        if (!approvalUrl) throw new Error("PayPal init failed (no approval URL).");

        // Store PayPal order ID for capture after return
        storage.set("pendingPaypalOrder", {
          orderId,
          paypalOrderId: payRes.paypalOrderId,
        });

        // Clear cart before redirect
        clearCart();

        // Redirect to PayPal
        window.location.href = approvalUrl;
      } else {
        // Paystack payment init (NGN)
        const payRes = await api("/payments/paystack/init", {
          method: "POST",
          auth: true,
          body: { orderId },
        });

        const authorizationUrl = payRes?.authorizationUrl;
        if (!authorizationUrl) throw new Error("Payment init failed (no authorizationUrl).");

        // Clear cart before redirect
        clearCart();

        window.location.href = authorizationUrl;
      }
    } catch (err) {
      alert(err.message || "Checkout failed.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText || "Place Order";
      }
    }
  });
});
