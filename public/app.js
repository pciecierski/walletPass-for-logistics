import { initI18n, onLocaleChange, t, getLocale, applyDomTranslations } from "./i18n.js";
import { bindAuthHeader } from "./auth.js";

const form = document.getElementById("pass-form");
const extras = document.getElementById("style-extras");
const styleSelect = form.querySelector('[name="style"]');
const result = document.getElementById("result");
const resultSerial = document.getElementById("result-serial");
const resultLinks = document.getElementById("result-links");
const resultWarnings = document.getElementById("result-warnings");
const formNote = document.getElementById("form-note");
const submitBtn = document.getElementById("submit-btn");
const passList = document.getElementById("pass-list");
const setupStatus = document.getElementById("setup-status");
const envHelp = document.getElementById("env-help");

/** @type {unknown} */
let lastStatus = null;
/** @type {unknown} */
let lastPasses = null;
/** @type {unknown} */
let lastResult = null;

initI18n();
bindAuthHeader().then(() => applyDomTranslations(document));

function syncExtras() {
  extras.className = `style-extras show-${styleSelect.value}`;
}

styleSelect.addEventListener("change", syncExtras);
syncExtras();

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || res.statusText || t("common.requestFailed"));
  }
  return data;
}

function linkButton(href, label, className = "btn secondary") {
  const a = document.createElement("a");
  a.href = href;
  a.className = className;
  a.textContent = label;
  if (href.endsWith(".pkpass")) a.download = "";
  return a;
}

function renderResult(payload) {
  lastResult = payload;
  result.hidden = false;
  resultSerial.textContent = `${payload.pass.serialNumber} · ${payload.pass.input.style} · Google Wallet`;
  resultLinks.innerHTML = "";
  resultLinks.append(
    linkButton(payload.urls.page, t("result.openPage"), "btn primary"),
    linkButton(`${payload.urls.google}?redirect=1`, t("result.google")),
  );

  if (payload.pass.input.recipientPhone || payload.sms) {
    const smsBtn = document.createElement("button");
    smsBtn.type = "button";
    smsBtn.className = "btn secondary";
    smsBtn.textContent = payload.sms?.sent
      ? t("result.smsSent", { to: payload.sms.to })
      : t("result.sendSms");
    if (payload.sms?.sent) smsBtn.disabled = true;
    smsBtn.addEventListener("click", async () => {
      smsBtn.disabled = true;
      smsBtn.textContent = t("result.smsSending");
      try {
        const resend = await api(`/api/passes/${payload.pass.id}/sms`, {
          method: "POST",
          body: JSON.stringify({
            phone: payload.pass.input.recipientPhone || undefined,
          }),
        });
        lastResult = { ...payload, sms: resend.sms };
        smsBtn.textContent = t("result.smsSent", { to: resend.sms.to });
      } catch (err) {
        smsBtn.disabled = false;
        smsBtn.textContent = t("result.sendSms");
        const li = document.createElement("li");
        li.textContent = `SMS: ${err.message}`;
        resultWarnings.append(li);
      }
    });
    resultLinks.append(smsBtn);
  }

  resultWarnings.innerHTML = "";
  for (const warning of payload.warnings || []) {
    const li = document.createElement("li");
    li.textContent = warning;
    resultWarnings.append(li);
  }
  if (payload.sms?.sent) {
    const li = document.createElement("li");
    li.className = "ok";
    li.textContent = t("result.smsDelivered", {
      provider: payload.sms.provider,
      to: payload.sms.to,
    });
    resultWarnings.append(li);
  }
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formNote.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = t("form.publishing");

  const fd = new FormData(form);
  const style = String(fd.get("style"));
  const body = {
    organizationName: String(fd.get("organizationName") || "").trim(),
    description: String(fd.get("description") || "").trim(),
    style,
    platforms: "google",
    logoText: String(fd.get("logoText") || "").trim() || undefined,
    barcodeMessage: String(fd.get("barcodeMessage") || "").trim() || undefined,
    recipientPhone: String(fd.get("recipientPhone") || "").trim() || undefined,
    sendSms: fd.get("sendSms") === "1",
    backgroundColor: String(fd.get("backgroundColor") || "#1A3A6B"),
    foregroundColor: String(fd.get("foregroundColor") || "#EEF3FA"),
    labelColor: "#9BB4D4",
  };

  if (style === "coupon") {
    body.discount = String(fd.get("discount") || "").trim() || undefined;
  }
  if (style === "eventTicket") {
    body.eventName = String(fd.get("eventName") || "").trim() || undefined;
    body.venue = String(fd.get("venue") || "").trim() || undefined;
  }
  if (style === "storeCard") {
    body.balance = String(fd.get("balance") || "").trim() || undefined;
  }
  if (style === "boardingPass") {
    const origin = String(fd.get("origin") || "").trim();
    const destination = String(fd.get("destination") || "").trim();
    body.headerFields = [
      { key: "origin", label: "From", value: origin || "DEP" },
      { key: "destination", label: "To", value: destination || "ARR" },
    ];
    body.transitType = "PKTransitTypeAir";
  }

  try {
    const payload = await api("/api/passes", {
      method: "POST",
      body: JSON.stringify(body),
    });
    renderResult(payload);
    await loadPasses();
  } catch (err) {
    formNote.hidden = false;
    formNote.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("form.submit");
  }
});

async function loadPasses() {
  const data = await api("/api/passes");
  lastPasses = data;
  renderPasses(data);
}

function renderPasses(data) {
  passList.innerHTML = "";
  if (!data.passes?.length) {
    passList.innerHTML = `<p class="muted">${escapeHtml(t("passes.empty"))}</p>`;
    return;
  }
  const locale = getLocale() === "pl" ? "pl-PL" : "en-GB";
  for (const pass of data.passes) {
    const created = new Date(pass.createdAt).toLocaleString(locale);
    const expiresAt = pass.expiresAt
      ? pass.expiresAt
      : new Date(new Date(pass.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expiresLabel = new Date(expiresAt).toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const row = document.createElement("div");
    row.className = "pass-row";
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(pass.input.organizationName)} · ${escapeHtml(pass.input.style)}</h3>
        <p>${escapeHtml(pass.serialNumber)} · ${escapeHtml(created)}</p>
        <p class="pass-expiry">${escapeHtml(t("passes.validUntil", { when: expiresLabel }))}</p>
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "pass-row-actions";
    actions.append(
      linkButton(pass.statusPagePath, t("passes.open")),
      linkButton(`${pass.googleSavePath}?redirect=1`, t("passes.google")),
    );
    if (pass.input.recipientPhone) {
      const smsBtn = document.createElement("button");
      smsBtn.type = "button";
      smsBtn.className = "btn secondary";
      smsBtn.textContent = t("passes.sms");
      smsBtn.title = t("passes.smsTitle", { phone: pass.input.recipientPhone });
      smsBtn.addEventListener("click", async () => {
        smsBtn.disabled = true;
        smsBtn.textContent = "…";
        try {
          await api(`/api/passes/${pass.id}/sms`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          smsBtn.textContent = t("passes.smsSent");
        } catch (err) {
          smsBtn.disabled = false;
          smsBtn.textContent = t("passes.sms");
          alert(err.message);
        }
      });
      actions.append(smsBtn);
    }
    row.append(actions);
    passList.append(row);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadStatus() {
  const status = await api("/api/status");
  lastStatus = status;
  renderStatus(status);
}

function renderStatus(status) {
  const storageHint = status.storage?.persistent
    ? t("setup.storageHintPersistent")
    : t("setup.storageHintEphemeral");

  setupStatus.innerHTML = `
    <div class="setup-block ${status.storage?.persistent ? "" : "coming-soon"}">
      <h3>${escapeHtml(t("setup.storage"))}</h3>
      <p class="${status.storage?.persistent ? "ok" : "bad"}">
        ${escapeHtml(status.storage?.persistent ? t("setup.storage.ok") : t("setup.storage.bad"))}
      </p>
      <p class="muted">${escapeHtml(storageHint)}</p>
      <p class="muted">DATA_DIR: ${escapeHtml(status.storage?.dataDir || "—")}</p>
    </div>
    <div class="setup-block coming-soon">
      <h3>${escapeHtml(t("setup.apple"))}</h3>
      <p class="bad">${escapeHtml(t("setup.apple.bad"))}</p>
      <p class="muted">${escapeHtml(t("setup.apple.note"))}</p>
    </div>
    <div class="setup-block">
      <h3>${escapeHtml(t("setup.google"))}</h3>
      <p class="${status.google.configured ? "ok" : "bad"}">
        ${escapeHtml(status.google.configured ? t("setup.configured") : t("setup.needsSetup"))}
      </p>
      ${
        status.google.missing?.length
          ? `<ul>${status.google.missing.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`
          : `<p class="muted">Issuer ID: ${escapeHtml(status.google.issuerId || "—")}</p>`
      }
    </div>
    <div class="setup-block">
      <h3>${escapeHtml(t("setup.sms"))}</h3>
      <p class="${status.sms?.configured ? "ok" : "bad"}">
        ${
          status.sms?.configured
            ? escapeHtml(`${t("setup.configured")} (${status.sms.provider})`)
            : escapeHtml(t("setup.needsSetup"))
        }
      </p>
      ${
        status.sms?.missing?.length
          ? `<ul>${status.sms.missing.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`
          : `<p class="muted">${escapeHtml(t("setup.provider", { provider: status.sms?.provider || "none" }))}</p>`
      }
    </div>
  `;

  envHelp.textContent = `PUBLIC_BASE_URL=${status.publicBaseUrl}
DATA_DIR=${status.storage?.dataDir || "/data"}

# Persist passes on Railway (no database):
# railway volume add --service <service> --mount-path /data
# Keep DATA_DIR=/data so it matches the volume mount.

# Google Wallet (active)
GOOGLE_ISSUER_ID=3388xxxxxxxx
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# or GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/secrets/google.json

# Apple Wallet — coming soon (not active yet)
# APPLE_PASS_TYPE_ID=pass.com.your.company
# APPLE_TEAM_ID=XXXXXXXXXX
# APPLE_ORG_NAME=Your Org

# SMS — Twilio or SMSAPI (PL)
# SMS_PROVIDER=twilio
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=+1...
# SMS_PROVIDER=smsapi
# SMSAPI_TOKEN=
# SMSAPI_FROM=WalletPass for Logistics
# SMS_MESSAGE_TEMPLATE=WalletPass for Logistics: Your pass from {{org}} — open {{url}}
# For local testing without a gateway: SMS_PROVIDER=log`;
}

onLocaleChange(() => {
  if (lastStatus) renderStatus(lastStatus);
  if (lastPasses) renderPasses(lastPasses);
  if (lastResult) renderResult(lastResult);
  if (!submitBtn.disabled) submitBtn.textContent = t("form.submit");
});

loadPasses().catch(console.error);
loadStatus().catch(console.error);
