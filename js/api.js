// js/api.js
import { storage } from "./storage.js";

export const API_BASE = "http://localhost:4000/api";
export const SERVER_BASE = "http://localhost:4000"; // For static files (no /api prefix)

export function resolveImageUrl(imageUrl) {
  const u = String(imageUrl || "").trim();

  if (!u) return "images/placeholder.jpg";

  if (u.startsWith("http://") || u.startsWith("https://")) {
    return u;
  }

  // Static uploads are served at /uploads, not /api/uploads
  if (u.startsWith("/uploads")) {
    return `${SERVER_BASE}${u}`;
  }

  return u;
}

// ===== User token (customers) =====
export function getToken() {
  return storage.get("token", "");
}
export function setToken(token) {
  storage.set("token", token);
}
export function clearToken() {
  storage.remove("token");
}

// ===== Vendor token (partners) =====
export function getVendorToken() {
  return storage.get("vendor_token", "");
}
export function setVendorToken(token) {
  storage.set("vendor_token", token);
}
export function clearVendorToken() {
  storage.remove("vendor_token");
}

/**
 * api(path, options)
 * path example: "/vendor/auth/me" (NO "/api" prefix)
 * auth can be: false | true | "user" | "vendor"
 *
 * Supports JSON bodies AND FormData (for uploads).
 */
export async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  // Only set JSON content-type if NOT FormData
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  // Decide which token to attach
  let token = "";

  if (auth === true) {
    const authType = storage.get("authType", "user");
    token = authType === "vendor" ? getVendorToken() : getToken();
    // Debug: log token retrieval
    console.log(`API auth: authType=${authType}, hasToken=${!!token}, tokenLength=${token?.length || 0}`);
  } else if (auth === "vendor") {
    token = getVendorToken();
  } else if (auth === "user") {
    token = getToken();
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (auth) {
    console.warn("API call requires auth but no token found!");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  // Try to parse JSON, log if it fails
  let data = {};
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch (parseError) {
    console.error("Failed to parse response as JSON:", parseError);
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    throw new Error("Invalid response from server");
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data;
}
