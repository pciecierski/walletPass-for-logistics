import { initI18n, onLocaleChange, t } from "./i18n.js";

const id = location.pathname.split("/").filter(Boolean).pop();
const title = document.getElementById("pass-title");
const desc = document.getElementById("pass-desc");
const preview = document.getElementById("pass-preview");
const actions = document.getElementById("pass-actions");
const meta = document.getElementById("pass-meta");

/** @type {unknown} */
let lastPayload = null;

initI18n();

/** @returns {"ios" | "android" | "other"} */
export function detectDevicePlatform(ua = navigator.userAgent || "") {
  const value = ua.toLowerCase();
  const iPadOsDesktopUa =
    value.includes("macintosh") && typeof navigator.maxTouchPoints === "number"
      ? navigator.maxTouchPoints > 1
      : false;
  if (/iphone|ipod|ipad/.test(value) || iPadOsDesktopUa) return "ios";
  if (/android/.test(value)) return "android";
  return "other";
}

/**
 * @param {"ios" | "android" | "other"} device
 * @param {{ apple: boolean, google: boolean }} wallets
 * @returns {"apple" | "google" | "both"}
 */
export function preferredWallet(device, wallets) {
  const params = new URLSearchParams(location.search);
  const forced = params.get("wallet");
  if (forced === "apple" || forced === "google" || forced === "both") {
    if (forced === "apple" && !wallets.apple) return wallets.google ? "google" : "both";
    if (forced === "google" && !wallets.google) return wallets.apple ? "apple" : "both";
    return forced;
  }

  if (device === "ios") {
    if (wallets.apple) return "apple";
    if (wallets.google) return "google";
  }
  if (device === "android") {
    if (wallets.google) return "google";
    if (wallets.apple) return "apple";
  }
  if (wallets.apple && wallets.google) return "both";
  if (wallets.google) return "google";
  if (wallets.apple) return "apple";
  return "both";
}

async function main() {
  const res = await fetch(`/api/passes/${id}`);
  if (!res.ok) {
    title.removeAttribute("data-i18n");
    title.textContent = t("pass.notFound");
    return;
  }
  const data = await res.json();
  lastPayload = data;
  renderPass(data);
}

function renderPass(data) {
  const pass = data.pass;
  const input = pass.input;
  const wallets = data.wallets || { apple: false, google: true };
  const device = detectDevicePlatform();
  const preference = preferredWallet(device, wallets);

  title.removeAttribute("data-i18n");
  document.title = `${input.organizationName} · WalletPass for Logistics`;
  title.textContent = input.eventName || input.discount || input.description;
  desc.textContent = `${input.organizationName} · ${input.style}`;

  const bg = input.backgroundColor || "#1A3A6B";
  const fg = input.foregroundColor || "#EEF3FA";
  preview.style.background = `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, black))`;
  preview.style.color = fg;
  preview.innerHTML = `
    <div class="org">${escapeHtml(input.organizationName)}</div>
    <div class="title">${escapeHtml(input.logoText || input.eventName || input.description)}</div>
    <p style="margin:0.75rem 0 0;opacity:.85">${escapeHtml(
      input.venue || input.balance || input.discount || pass.serialNumber,
    )}</p>
  `;

  renderWalletActions({ data, wallets, device, preference });

  meta.textContent = t("pass.metaLine", {
    serial: pass.serialNumber,
    google: pass.googleReady ? t("pass.ready") : t("pass.preview"),
  });
}

function ensureEl(idName, tag, className, afterEl) {
  let el = document.getElementById(idName);
  if (!el) {
    el = document.createElement(tag);
    el.id = idName;
    if (className) el.className = className;
    afterEl.after(el);
  }
  return el;
}

function renderWalletActions({ data, wallets, device, preference }) {
  actions.innerHTML = "";

  const hint = ensureEl("device-hint", "p", "device-hint", preview);
  hint.setAttribute("role", "status");
  if (device === "ios") {
    hint.textContent = wallets.apple ? t("pass.device.ios") : t("pass.device.iosAppleSoon");
  } else if (device === "android") {
    hint.textContent = t("pass.device.android");
  } else {
    hint.textContent = t("pass.device.other");
  }

  const buttons = [];
  if (wallets.apple && (preference === "apple" || preference === "both")) {
    buttons.push({
      href: data.urls.apple,
      label: t("pass.addApple"),
      primary: preference === "apple" || (preference === "both" && device === "ios"),
    });
  }
  if (wallets.google && (preference === "google" || preference === "both")) {
    buttons.push({
      href: `${data.urls.google}?redirect=1`,
      label: t("pass.addGoogle"),
      primary:
        preference === "google" ||
        (preference === "both" && device !== "ios") ||
        !wallets.apple,
    });
  }

  // Ensure at least one primary when both are secondary by accident.
  if (buttons.length && !buttons.some((b) => b.primary)) {
    buttons[0].primary = true;
  }

  for (const btn of buttons) {
    const a = document.createElement("a");
    a.className = btn.primary ? "btn primary" : "btn secondary";
    a.href = btn.href;
    a.textContent = btn.label;
    actions.append(a);
  }

  const alt = ensureEl("wallet-alt", "p", "wallet-alt", actions);
  alt.innerHTML = "";

  if (preference === "apple" && wallets.google) {
    const link = document.createElement("a");
    link.href = withWalletQuery("google");
    link.textContent = t("pass.alt.google");
    alt.append(link);
  } else if (preference === "google" && wallets.apple) {
    const link = document.createElement("a");
    link.href = withWalletQuery("apple");
    link.textContent = t("pass.alt.apple");
    alt.append(link);
  } else if (!wallets.apple) {
    alt.textContent = t("pass.appleNote");
  }
}

function withWalletQuery(wallet) {
  const url = new URL(location.href);
  url.searchParams.set("wallet", wallet);
  return `${url.pathname}${url.search}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

onLocaleChange(() => {
  if (lastPayload) renderPass(lastPayload);
});

main().catch((err) => {
  title.removeAttribute("data-i18n");
  title.textContent = t("pass.loadError");
  desc.textContent = err.message;
});
