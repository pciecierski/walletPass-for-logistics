import sgMail from "@sendgrid/mail";

export type PasswordSetupMailInput = {
  to: string;
  firstName: string;
  locationName: string;
  setupUrl: string;
};

export type MailResult = {
  sent: boolean;
  previewUrl?: string;
  error?: string;
};

function fromAddress(): string {
  return (
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "noreply@walletpass-for-logistics.pl"
  );
}

/** Railway/UI sometimes wraps secrets in quotes — strip them. */
function readApiKey(): string | null {
  const raw = process.env.SENDGRID_API_KEY?.trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^['"]|['"]$/g, "").trim();
  return unquoted || null;
}

function describeSendGridError(e: unknown): string {
  const err = e as {
    message?: string;
    code?: number | string;
    response?: { body?: { errors?: Array<{ message?: string }> } };
  };
  const status = err.code;
  const apiMessages = err.response?.body?.errors
    ?.map((x) => x.message)
    .filter(Boolean)
    .join("; ");

  if (status === 401 || /unauthorized/i.test(err.message ?? "")) {
    return (
      "SendGrid odrzucił klucz API (Unauthorized). Sprawdź SENDGRID_API_KEY na Railway — musi zaczynać się od SG. i mieć uprawnienie Mail Send."
    );
  }
  if (status === 403 || /forbidden/i.test(err.message ?? "")) {
    return (
      `SendGrid zabronił wysyłki (403). Zweryfikuj nadawcę SENDGRID_FROM_EMAIL (${fromAddress()}) w SendGrid → Sender Authentication.` +
      (apiMessages ? ` Szczegóły: ${apiMessages}` : "")
    );
  }
  return apiMessages || err.message || "Nie udało się wysłać e-maila przez SendGrid";
}

async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  previewUrl: string;
  logLabel: string;
}): Promise<MailResult> {
  const apiKey = readApiKey();

  if (!apiKey) {
    console.warn(
      `[walletpass-for-logistics] SENDGRID_API_KEY missing — ${input.logLabel} link (dev):\n`,
      input.previewUrl,
    );
    return { sent: false, previewUrl: input.previewUrl };
  }

  if (!apiKey.startsWith("SG.")) {
    console.error(
      "[walletpass-for-logistics] SENDGRID_API_KEY does not start with SG. — check Railway variable (no quotes/spaces)",
    );
    return {
      sent: false,
      previewUrl: input.previewUrl,
      error:
        "SENDGRID_API_KEY wygląda na niepoprawny (powinien zaczynać się od SG.). Popraw zmienną na Railway.",
    };
  }

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: input.to,
      from: fromAddress(),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { sent: true };
  } catch (e) {
    const error = describeSendGridError(e);
    console.error("[walletpass-for-logistics] SendGrid send failed:", error, e);
    return {
      sent: false,
      previewUrl: input.previewUrl,
      error,
    };
  }
}

export async function sendPasswordSetupEmail(
  input: PasswordSetupMailInput,
): Promise<MailResult> {
  const subject = "WalletPass for Logistics — potwierdź konto i ustaw hasło";
  const text = [
    `Cześć ${input.firstName},`,
    "",
    `Konto WalletPass for Logistics dla lokalizacji „${input.locationName}” zostało utworzone.`,
    "Potwierdź adres e-mail i ustaw hasło, klikając jednorazowy link:",
    input.setupUrl,
    "",
    "Link jest ważny 48 godzin i działa tylko raz.",
    "",
    "Jeśli nie zakładałeś konta, zignoruj tę wiadomość.",
    "",
    "— WalletPass for Logistics",
  ].join("\n");

  const html = `
    <p>Cześć ${escapeHtml(input.firstName)},</p>
    <p>Konto WalletPass for Logistics dla lokalizacji <strong>${escapeHtml(input.locationName)}</strong> zostało utworzone.</p>
    <p>Potwierdź adres e-mail i ustaw hasło, klikając jednorazowy link:</p>
    <p><a href="${escapeHtml(input.setupUrl)}">${escapeHtml(input.setupUrl)}</a></p>
    <p>Link jest ważny 48 godzin i działa tylko raz.</p>
    <p>Jeśli nie zakładałeś konta, zignoruj tę wiadomość.</p>
    <p>— WalletPass for Logistics</p>
  `;

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
    previewUrl: input.setupUrl,
    logLabel: "password setup",
  });
}

export type PasswordResetMailInput = {
  to: string;
  firstName: string;
  locationName: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(
  input: PasswordResetMailInput,
): Promise<MailResult> {
  const subject = "WalletPass for Logistics — reset hasła";
  const text = [
    `Cześć ${input.firstName},`,
    "",
    `Otrzymaliśmy prośbę o reset hasła do konta WalletPass for Logistics (lokalizacja „${input.locationName}”).`,
    "Ustaw nowe hasło, klikając jednorazowy link:",
    input.resetUrl,
    "",
    "Link jest ważny 48 godzin i działa tylko raz.",
    "",
    "Jeśli nie prosiłeś o reset, zignoruj tę wiadomość — hasło pozostanie bez zmian.",
    "",
    "— WalletPass for Logistics",
  ].join("\n");

  const html = `
    <p>Cześć ${escapeHtml(input.firstName)},</p>
    <p>Otrzymaliśmy prośbę o reset hasła do konta WalletPass for Logistics (lokalizacja <strong>${escapeHtml(input.locationName)}</strong>).</p>
    <p>Ustaw nowe hasło, klikając jednorazowy link:</p>
    <p><a href="${escapeHtml(input.resetUrl)}">${escapeHtml(input.resetUrl)}</a></p>
    <p>Link jest ważny 48 godzin i działa tylko raz.</p>
    <p>Jeśli nie prosiłeś o reset, zignoruj tę wiadomość — hasło pozostanie bez zmian.</p>
    <p>— WalletPass for Logistics</p>
  `;

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
    previewUrl: input.resetUrl,
    logLabel: "password reset",
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
