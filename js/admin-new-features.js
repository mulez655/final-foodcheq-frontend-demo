// js/admin-new-features.js
// Extends admin.js with Partnership, Investment, and Barter management

import { api, API_BASE } from "./api.js";

const $ = (sel) => document.querySelector(sel);

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
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  const cls = tones[tone] || tones.slate;
  return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}">${escapeHtml(text)}</span>`;
}

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm shadow-lg";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ===================== PARTNERSHIPS =====================

let partnershipsCache = [];

async function loadPartnerships() {
  try {
    // Load stats
    const statsRes = await api("/admin/partnerships/stats", { auth: true });
    if (statsRes.stats) {
      $("#partnershipPending").textContent = statsRes.stats.pending || 0;
      $("#partnershipApproved").textContent = statsRes.stats.approved || 0;
      $("#partnershipRejected").textContent = statsRes.stats.rejected || 0;
      $("#partnershipTotal").textContent = statsRes.stats.totalPartners || 0;
    }

    // Load applications
    const status = $("#partnershipsStatus")?.value || "";
    const search = $("#partnershipsSearch")?.value || "";

    let url = "/admin/partnerships";
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (params.toString()) url += "?" + params.toString();

    const res = await api(url, { auth: true });
    partnershipsCache = res.applications || [];
    renderPartnerships(partnershipsCache);
  } catch (err) {
    console.error("Failed to load partnerships:", err);
  }
}

function renderPartnerships(list) {
  const tbody = $("#adminPartnershipsTable");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td class="px-6 py-6 text-slate-500 text-sm" colspan="5">No applications found.</td></tr>`;
    return;
  }

  const statusTones = {
    PENDING: "amber",
    APPROVED: "emerald",
    REJECTED: "red",
    NEEDS_INFO: "blue",
  };

  tbody.innerHTML = list.map((a) => `
    <tr class="border-b border-slate-100">
      <td class="px-6 py-4">
        <div class="font-semibold">${escapeHtml(a.name)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(a.user?.email || "")}</div>
      </td>
      <td class="py-4">${escapeHtml(a.location)}</td>
      <td class="py-4">${badge(a.status, statusTones[a.status] || "slate")}</td>
      <td class="py-4 text-sm text-slate-500">${new Date(a.createdAt).toLocaleDateString()}</td>
      <td class="py-4 pr-6 text-right">
        <div class="inline-flex flex-wrap justify-end gap-2">
          ${a.status === "PENDING" || a.status === "NEEDS_INFO" ? `
            <button class="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600" data-approve="${a.id}">Approve</button>
            <button class="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500" data-reject="${a.id}">Reject</button>
            <button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50" data-needsinfo="${a.id}">Request Info</button>
          ` : ""}
        </div>
      </td>
    </tr>
  `).join("");
}

async function handlePartnershipAction(id, status) {
  let notes = "";
  if (status === "REJECTED" || status === "NEEDS_INFO") {
    notes = prompt(`Enter notes for ${status === "REJECTED" ? "rejection" : "info request"}:`) || "";
  }

  try {
    await api(`/admin/partnerships/${id}`, {
      method: "PATCH",
      body: { status, notes },
      auth: true,
    });
    showToast(`Application ${status.toLowerCase()}`);
    loadPartnerships();
  } catch (err) {
    alert(err?.message || "Action failed");
  }
}

// ===================== INVESTMENTS =====================

let investmentsCache = [];

async function loadInvestments() {
  try {
    const res = await api("/admin/investments?includeInactive=true", { auth: true });
    investmentsCache = res.opportunities || [];
    renderInvestments(investmentsCache);
  } catch (err) {
    console.error("Failed to load investments:", err);
  }
}

function renderInvestments(list) {
  const container = $("#investmentsList");
  const noInvestments = $("#noInvestments");

  if (!list.length) {
    container.innerHTML = "";
    noInvestments?.classList.remove("hidden");
    return;
  }

  noInvestments?.classList.add("hidden");

  container.innerHTML = list.map((inv) => `
    <div class="p-6 hover:bg-slate-50">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold">${escapeHtml(inv.title)}</h3>
            ${inv.isActive ? badge("Active", "emerald") : badge("Inactive", "slate")}
          </div>
          <p class="mt-2 text-sm text-slate-600">${escapeHtml(inv.description)}</p>
          <p class="mt-2 text-xs text-slate-500">
            ${inv.interestCount || 0} interested partners
            <span class="mx-2">•</span>
            Created ${new Date(inv.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50" data-toggle-inv="${inv.id}" data-active="${inv.isActive}">
            ${inv.isActive ? "Deactivate" : "Activate"}
          </button>
          <button class="rounded-xl border border-red-200 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-50" data-delete-inv="${inv.id}">
            Delete
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

async function createInvestment() {
  const title = prompt("Investment title:");
  if (!title) return;

  const description = prompt("Investment description:");
  if (!description) return;

  try {
    await api("/admin/investments", {
      method: "POST",
      body: { title, description },
      auth: true,
    });
    showToast("Investment created");
    loadInvestments();
  } catch (err) {
    alert(err?.message || "Failed to create investment");
  }
}

async function toggleInvestment(id, currentlyActive) {
  try {
    await api(`/admin/investments/${id}`, {
      method: "PATCH",
      body: { isActive: !currentlyActive },
      auth: true,
    });
    showToast(currentlyActive ? "Investment deactivated" : "Investment activated");
    loadInvestments();
  } catch (err) {
    alert(err?.message || "Failed to update investment");
  }
}

async function deleteInvestment(id) {
  if (!confirm("Delete this investment opportunity?")) return;

  try {
    await api(`/admin/investments/${id}`, {
      method: "DELETE",
      auth: true,
    });
    showToast("Investment deleted");
    loadInvestments();
  } catch (err) {
    alert(err?.message || "Failed to delete investment");
  }
}

// ===================== BARTER =====================

let barterCache = [];

async function loadBarter() {
  try {
    // Load stats
    const statsRes = await api("/admin/barter/stats", { auth: true });
    if (statsRes.stats) {
      const s = statsRes.stats;
      $("#barterActive").textContent = (s.sent || 0) + (s.accepted || 0) + (s.inProgress || 0);
      $("#barterCompleted").textContent = s.completed || 0;
      $("#barterDisputed").textContent = s.disputed || 0;
      $("#barterTotal").textContent = s.total || 0;
    }

    // Load offers
    const status = $("#barterStatus")?.value || "";
    let url = "/admin/barter";
    if (status) url += `?status=${status}`;

    const res = await api(url, { auth: true });
    barterCache = res.offers || [];
    renderBarter(barterCache);
  } catch (err) {
    console.error("Failed to load barter:", err);
  }
}

function renderBarter(list) {
  const tbody = $("#adminBarterTable");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td class="px-6 py-6 text-slate-500 text-sm" colspan="6">No barter offers found.</td></tr>`;
    return;
  }

  const statusTones = {
    DRAFT: "slate",
    SENT: "blue",
    COUNTERED: "purple",
    ACCEPTED: "emerald",
    REJECTED: "red",
    CANCELLED: "slate",
    IN_PROGRESS: "amber",
    COMPLETED: "emerald",
    DISPUTED: "red",
  };

  tbody.innerHTML = list.map((o) => `
    <tr class="border-b border-slate-100">
      <td class="px-6 py-4">
        <div class="font-semibold">${escapeHtml(o.initiatorVendor?.businessName || "—")}</div>
        <div class="text-xs text-slate-500">${escapeHtml(o.initiatorVendor?.email || "")}</div>
      </td>
      <td class="py-4">
        <div class="font-semibold">${escapeHtml(o.recipientVendor?.businessName || "—")}</div>
        <div class="text-xs text-slate-500">${escapeHtml(o.recipientVendor?.email || "")}</div>
      </td>
      <td class="py-4">${badge(o.status, statusTones[o.status] || "slate")}</td>
      <td class="py-4 text-sm">${o.offeredCount || 0} → ${o.requestedCount || 0}</td>
      <td class="py-4 text-sm text-slate-500">${new Date(o.updatedAt).toLocaleDateString()}</td>
      <td class="py-4 pr-6 text-right">
        ${o.status === "DISPUTED" ? `
          <button class="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600" data-resolve="${o.id}">Resolve</button>
        ` : ""}
      </td>
    </tr>
  `).join("");
}

async function resolveBarter(id) {
  const resolution = prompt("Enter resolution notes:");
  if (!resolution) return;

  const newStatus = confirm("Mark as COMPLETED? (Cancel for CANCELLED)") ? "COMPLETED" : "CANCELLED";

  try {
    await api(`/admin/barter/${id}/resolve`, {
      method: "PATCH",
      body: { resolution, newStatus },
      auth: true,
    });
    showToast("Dispute resolved");
    loadBarter();
  } catch (err) {
    alert(err?.message || "Failed to resolve dispute");
  }
}

// ===================== PARTNER CONTENT =====================

let announcementsCache = [];
let documentsCache = [];

// --- Announcements ---

async function loadAnnouncements() {
  try {
    const res = await api("/admin/partner-content/announcements?includeInactive=true", { auth: true });
    announcementsCache = res.announcements || [];

    // Update stats
    const active = announcementsCache.filter(a => a.isActive).length;
    $("#announcementActive").textContent = active;
    $("#announcementTotal").textContent = announcementsCache.length;

    renderAnnouncements(announcementsCache);
  } catch (err) {
    console.error("Failed to load announcements:", err);
  }
}

function renderAnnouncements(list) {
  const container = $("#announcementsList");
  const noAnnouncements = $("#noAnnouncements");

  if (!list.length) {
    container.innerHTML = "";
    noAnnouncements?.classList.remove("hidden");
    return;
  }

  noAnnouncements?.classList.add("hidden");

  container.innerHTML = list.map((ann) => `
    <div class="p-6 hover:bg-slate-50">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-semibold">${escapeHtml(ann.title)}</h3>
            ${ann.isActive ? badge("Active", "emerald") : badge("Inactive", "slate")}
            ${ann.priority > 50 ? badge("High Priority", "red") : ""}
          </div>
          <p class="mt-2 text-sm text-slate-600 line-clamp-2">${escapeHtml(ann.content)}</p>
          <p class="mt-2 text-xs text-slate-500">
            Created ${new Date(ann.createdAt).toLocaleDateString()}
            ${ann.expiresAt ? `<span class="mx-2">•</span> Expires ${new Date(ann.expiresAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50" data-edit-ann="${ann.id}">
            Edit
          </button>
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50" data-toggle-ann="${ann.id}" data-active="${ann.isActive}">
            ${ann.isActive ? "Deactivate" : "Activate"}
          </button>
          <button class="rounded-xl border border-red-200 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-50" data-delete-ann="${ann.id}">
            Delete
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function openAnnouncementModal(announcement = null) {
  const modal = $("#announcementModal");
  const title = $("#announcementModalTitle");
  const idInput = $("#announcementId");
  const titleInput = $("#announcementTitleInput");
  const contentInput = $("#announcementContentInput");
  const priorityInput = $("#announcementPriorityInput");
  const expiresInput = $("#announcementExpiresInput");

  if (announcement) {
    title.textContent = "Edit Announcement";
    idInput.value = announcement.id;
    titleInput.value = announcement.title;
    contentInput.value = announcement.content;
    priorityInput.value = announcement.priority || 0;
    if (announcement.expiresAt) {
      expiresInput.value = new Date(announcement.expiresAt).toISOString().slice(0, 16);
    } else {
      expiresInput.value = "";
    }
  } else {
    title.textContent = "New Announcement";
    idInput.value = "";
    titleInput.value = "";
    contentInput.value = "";
    priorityInput.value = "0";
    expiresInput.value = "";
  }

  modal.classList.remove("hidden");
}

function closeAnnouncementModal() {
  $("#announcementModal").classList.add("hidden");
}

async function saveAnnouncement() {
  const id = $("#announcementId").value;
  const title = $("#announcementTitleInput").value.trim();
  const content = $("#announcementContentInput").value.trim();
  const priority = parseInt($("#announcementPriorityInput").value) || 0;
  const expiresAt = $("#announcementExpiresInput").value || null;

  if (!title || !content) {
    alert("Title and content are required");
    return;
  }

  try {
    const body = { title, content, priority };
    if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

    if (id) {
      await api(`/admin/partner-content/announcements/${id}`, {
        method: "PATCH",
        body,
        auth: true,
      });
      showToast("Announcement updated");
    } else {
      await api("/admin/partner-content/announcements", {
        method: "POST",
        body,
        auth: true,
      });
      showToast("Announcement created");
    }

    closeAnnouncementModal();
    loadAnnouncements();
  } catch (err) {
    alert(err?.message || "Failed to save announcement");
  }
}

async function toggleAnnouncement(id, currentlyActive) {
  try {
    await api(`/admin/partner-content/announcements/${id}`, {
      method: "PATCH",
      body: { isActive: !currentlyActive },
      auth: true,
    });
    showToast(currentlyActive ? "Announcement deactivated" : "Announcement activated");
    loadAnnouncements();
  } catch (err) {
    alert(err?.message || "Failed to update announcement");
  }
}

async function deleteAnnouncement(id) {
  if (!confirm("Delete this announcement?")) return;

  try {
    await api(`/admin/partner-content/announcements/${id}`, {
      method: "DELETE",
      auth: true,
    });
    showToast("Announcement deleted");
    loadAnnouncements();
  } catch (err) {
    alert(err?.message || "Failed to delete announcement");
  }
}

// --- Documents ---

async function loadDocuments() {
  try {
    const category = $("#docCategoryFilter")?.value || "";
    let url = "/admin/partner-content/documents?includeInactive=true";
    if (category) url += `&category=${category}`;

    const res = await api(url, { auth: true });
    documentsCache = res.documents || [];

    // Update stats
    const active = documentsCache.filter(d => d.isActive).length;
    $("#documentActive").textContent = active;
    $("#documentTotal").textContent = documentsCache.length;

    renderDocuments(documentsCache);
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getDocIcon(mimeType) {
  if (mimeType?.includes("pdf")) return "fa-file-pdf text-red-500";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "fa-file-word text-blue-500";
  if (mimeType?.includes("excel") || mimeType?.includes("sheet")) return "fa-file-excel text-emerald-500";
  if (mimeType?.includes("image")) return "fa-file-image text-purple-500";
  return "fa-file text-slate-500";
}

function renderDocuments(list) {
  const tbody = $("#documentsTable");
  const noDocuments = $("#noDocuments");

  if (!list.length) {
    tbody.innerHTML = "";
    noDocuments?.classList.remove("hidden");
    return;
  }

  noDocuments?.classList.add("hidden");

  tbody.innerHTML = list.map((doc) => `
    <tr class="border-b border-slate-100">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <i class="fa-solid ${getDocIcon(doc.mimeType)} text-xl"></i>
          <div>
            <div class="font-semibold">${escapeHtml(doc.title)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(doc.fileName)}</div>
          </div>
        </div>
      </td>
      <td class="py-4">${badge(doc.category, "blue")}</td>
      <td class="py-4 text-sm text-slate-600">${formatFileSize(doc.fileSize)}</td>
      <td class="py-4 text-sm text-slate-600">${doc.downloadCount || 0}</td>
      <td class="py-4">${doc.isActive ? badge("Active", "emerald") : badge("Inactive", "slate")}</td>
      <td class="py-4 pr-6 text-right">
        <div class="inline-flex gap-2">
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50" data-toggle-doc="${doc.id}" data-active="${doc.isActive}">
            ${doc.isActive ? "Deactivate" : "Activate"}
          </button>
          <button class="rounded-xl border border-red-200 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-50" data-delete-doc="${doc.id}">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openDocumentModal() {
  const modal = $("#documentModal");
  $("#documentTitleInput").value = "";
  $("#documentDescInput").value = "";
  $("#documentCategoryInput").value = "GENERAL";
  $("#documentFileInput").value = "";
  $("#selectedFileName").textContent = "";
  $("#selectedFileName").classList.add("hidden");
  modal.classList.remove("hidden");
}

function closeDocumentModal() {
  $("#documentModal").classList.add("hidden");
}

async function uploadDocument() {
  const title = $("#documentTitleInput").value.trim();
  const description = $("#documentDescInput").value.trim();
  const category = $("#documentCategoryInput").value;
  const fileInput = $("#documentFileInput");
  const file = fileInput.files?.[0];

  if (!title) {
    alert("Title is required");
    return;
  }

  if (!file) {
    alert("Please select a file");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert("File size must be less than 10MB");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  if (description) formData.append("description", description);
  formData.append("category", category);

  try {
    $("#documentUploadBtn").disabled = true;
    $("#documentUploadBtn").innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Uploading...';

    const token = localStorage.getItem("token") || "";
    const res = await fetch(`${API_BASE}/admin/partner-content/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Upload failed");
    }

    showToast("Document uploaded");
    closeDocumentModal();
    loadDocuments();
  } catch (err) {
    alert(err?.message || "Failed to upload document");
  } finally {
    $("#documentUploadBtn").disabled = false;
    $("#documentUploadBtn").innerHTML = '<i class="fa-solid fa-upload mr-2"></i> Upload';
  }
}

async function toggleDocument(id, currentlyActive) {
  try {
    await api(`/admin/partner-content/documents/${id}`, {
      method: "PATCH",
      body: { isActive: !currentlyActive },
      auth: true,
    });
    showToast(currentlyActive ? "Document deactivated" : "Document activated");
    loadDocuments();
  } catch (err) {
    alert(err?.message || "Failed to update document");
  }
}

async function deleteDocument(id) {
  if (!confirm("Delete this document? This will also remove the file.")) return;

  try {
    await api(`/admin/partner-content/documents/${id}`, {
      method: "DELETE",
      auth: true,
    });
    showToast("Document deleted");
    loadDocuments();
  } catch (err) {
    alert(err?.message || "Failed to delete document");
  }
}

// --- Sub-tabs ---

function initPartnerContentSubtabs() {
  const subtabBtns = document.querySelectorAll("#tab-partner-content [data-subtab]");
  const announcementsSection = $("#subtab-announcements");
  const documentsSection = $("#subtab-documents");

  subtabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab;

      // Update button styles
      subtabBtns.forEach(b => {
        b.classList.remove("border-emerald-600", "text-emerald-700");
        b.classList.add("border-transparent", "text-slate-500");
      });
      btn.classList.remove("border-transparent", "text-slate-500");
      btn.classList.add("border-emerald-600", "text-emerald-700");

      // Show/hide sections
      if (subtab === "announcements") {
        announcementsSection.classList.remove("hidden");
        documentsSection.classList.add("hidden");
        loadAnnouncements();
      } else {
        announcementsSection.classList.add("hidden");
        documentsSection.classList.remove("hidden");
        loadDocuments();
      }
    });
  });
}

// ===================== INIT =====================

function initNewFeatures() {
  // Partnerships
  $("#btnReloadPartnerships")?.addEventListener("click", loadPartnerships);
  $("#partnershipsSearch")?.addEventListener("input", loadPartnerships);
  $("#partnershipsStatus")?.addEventListener("change", loadPartnerships);

  $("#adminPartnershipsTable")?.addEventListener("click", (e) => {
    const approveBtn = e.target.closest("[data-approve]");
    const rejectBtn = e.target.closest("[data-reject]");
    const needsInfoBtn = e.target.closest("[data-needsinfo]");

    if (approveBtn) handlePartnershipAction(approveBtn.dataset.approve, "APPROVED");
    if (rejectBtn) handlePartnershipAction(rejectBtn.dataset.reject, "REJECTED");
    if (needsInfoBtn) handlePartnershipAction(needsInfoBtn.dataset.needsinfo, "NEEDS_INFO");
  });

  // Investments
  $("#btnReloadInvestments")?.addEventListener("click", loadInvestments);
  $("#btnNewInvestment")?.addEventListener("click", createInvestment);

  $("#investmentsList")?.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle-inv]");
    const deleteBtn = e.target.closest("[data-delete-inv]");

    if (toggleBtn) toggleInvestment(toggleBtn.dataset.toggleInv, toggleBtn.dataset.active === "true");
    if (deleteBtn) deleteInvestment(deleteBtn.dataset.deleteInv);
  });

  // Barter
  $("#btnReloadBarter")?.addEventListener("click", loadBarter);
  $("#barterStatus")?.addEventListener("change", loadBarter);

  $("#adminBarterTable")?.addEventListener("click", (e) => {
    const resolveBtn = e.target.closest("[data-resolve]");
    if (resolveBtn) resolveBarter(resolveBtn.dataset.resolve);
  });

  // Partner Content
  initPartnerContentSubtabs();

  // Announcements
  $("#btnReloadAnnouncements")?.addEventListener("click", loadAnnouncements);
  $("#btnNewAnnouncement")?.addEventListener("click", () => openAnnouncementModal());
  $("#announcementSaveBtn")?.addEventListener("click", saveAnnouncement);
  $("#announcementModalClose")?.addEventListener("click", closeAnnouncementModal);
  $("#announcementModalClose2")?.addEventListener("click", closeAnnouncementModal);
  $("#announcementModalBackdrop")?.addEventListener("click", closeAnnouncementModal);

  $("#announcementsList")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-ann]");
    const toggleBtn = e.target.closest("[data-toggle-ann]");
    const deleteBtn = e.target.closest("[data-delete-ann]");

    if (editBtn) {
      const ann = announcementsCache.find(a => a.id === editBtn.dataset.editAnn);
      if (ann) openAnnouncementModal(ann);
    }
    if (toggleBtn) toggleAnnouncement(toggleBtn.dataset.toggleAnn, toggleBtn.dataset.active === "true");
    if (deleteBtn) deleteAnnouncement(deleteBtn.dataset.deleteAnn);
  });

  // Documents
  $("#btnReloadDocuments")?.addEventListener("click", loadDocuments);
  $("#btnNewDocument")?.addEventListener("click", openDocumentModal);
  $("#documentUploadBtn")?.addEventListener("click", uploadDocument);
  $("#documentModalClose")?.addEventListener("click", closeDocumentModal);
  $("#documentModalClose2")?.addEventListener("click", closeDocumentModal);
  $("#documentModalBackdrop")?.addEventListener("click", closeDocumentModal);
  $("#docCategoryFilter")?.addEventListener("change", loadDocuments);

  // File drop zone
  const dropZone = $("#dropZone");
  const fileInput = $("#documentFileInput");
  const selectedFileName = $("#selectedFileName");

  dropZone?.addEventListener("click", () => fileInput?.click());

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-emerald-400", "bg-emerald-50");
  });

  dropZone?.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-emerald-400", "bg-emerald-50");
  });

  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-emerald-400", "bg-emerald-50");
    const file = e.dataTransfer?.files?.[0];
    if (file && fileInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      selectedFileName.textContent = file.name;
      selectedFileName.classList.remove("hidden");
    }
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      selectedFileName.textContent = file.name;
      selectedFileName.classList.remove("hidden");
    }
  });

  $("#documentsTable")?.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle-doc]");
    const deleteBtn = e.target.closest("[data-delete-doc]");

    if (toggleBtn) toggleDocument(toggleBtn.dataset.toggleDoc, toggleBtn.dataset.active === "true");
    if (deleteBtn) deleteDocument(deleteBtn.dataset.deleteDoc);
  });

  // Extend tab activation to include new tabs
  const originalActivate = window.__adminActivateTab;
  window.__adminActivateTab = (tab) => {
    if (tab === "partnerships") loadPartnerships();
    if (tab === "investments") loadInvestments();
    if (tab === "barter") loadBarter();
    if (tab === "partner-content") {
      loadAnnouncements();
    }
    if (originalActivate) originalActivate(tab);
  };

  // Handle hash for new tabs
  const hash = (window.location.hash || "").replace("#", "").trim();
  if (hash === "partnerships") loadPartnerships();
  if (hash === "investments") loadInvestments();
  if (hash === "barter") loadBarter();
  if (hash === "partner-content") loadAnnouncements();
}

// Wait for DOM and init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNewFeatures);
} else {
  initNewFeatures();
}

// Export for potential use
export { loadPartnerships, loadInvestments, loadBarter };
