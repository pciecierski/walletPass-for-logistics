import type { AppConfig, SmsDeliveryResult } from "../types.js";
import { normalizePhone } from "./phone.js";

export function smsStatus(config: AppConfig): {
  configured: boolean;
  provider: AppConfig["sms"]["provider"];
  missing: string[];
} {
  const { provider } = config.sms;
  const missing: string[] = [];

  if (provider === "twilio") {
    if (!config.sms.twilioAccountSid) missing.push("TWILIO_ACCOUNT_SID");
    if (!config.sms.twilioAuthToken) missing.push("TWILIO_AUTH_TOKEN");
    if (!config.sms.twilioFromNumber) missing.push("TWILIO_FROM_NUMBER");
  } else if (provider === "smsapi") {
    if (!config.sms.smsapiToken) missing.push("SMSAPI_TOKEN");
    if (!config.sms.smsapiFrom) missing.push("SMSAPI_FROM");
  } else if (provider === "log") {
    // always available for local/dev
  } else {
    missing.push("SMS_PROVIDER");
  }

  return {
    configured: missing.length === 0 && provider !== "none",
    provider,
    missing,
  };
}

export function buildPassSmsBody(
  config: AppConfig,
  opts: { organizationName: string; pageUrl: string },
): string {
  const template =
    config.sms.messageTemplate ||
    "WalletPass for Logistics: Your pass from {{org}} — open {{url}}";
  return template
    .replaceAll("{{org}}", opts.organizationName)
    .replaceAll("{{url}}", opts.pageUrl)
    .slice(0, 600);
}

export async function sendPassSms(
  config: AppConfig,
  opts: { to: string; organizationName: string; pageUrl: string },
): Promise<SmsDeliveryResult> {
  const status = smsStatus(config);
  if (!status.configured) {
    return {
      sent: false,
      provider: config.sms.provider,
      error:
        status.provider === "none"
          ? "SMS is not enabled. Set SMS_PROVIDER=twilio|smsapi|log"
          : `SMS not configured: missing ${status.missing.join(", ")}`,
    };
  }

  let to: string;
  try {
    to = normalizePhone(opts.to);
  } catch (err) {
    return {
      sent: false,
      provider: config.sms.provider,
      error: (err as Error).message,
    };
  }

  const body = buildPassSmsBody(config, {
    organizationName: opts.organizationName,
    pageUrl: opts.pageUrl,
  });

  try {
    if (config.sms.provider === "log") {
      console.info(`[sms:log] to=${to} body=${JSON.stringify(body)}`);
      return { sent: true, provider: "log", to };
    }
    if (config.sms.provider === "twilio") {
      await sendTwilio(config, to, body);
      return { sent: true, provider: "twilio", to };
    }
    if (config.sms.provider === "smsapi") {
      await sendSmsApi(config, to, body);
      return { sent: true, provider: "smsapi", to };
    }
    return {
      sent: false,
      provider: config.sms.provider,
      error: `Unsupported SMS provider: ${config.sms.provider}`,
    };
  } catch (err) {
    return {
      sent: false,
      provider: config.sms.provider,
      to,
      error: (err as Error).message,
    };
  }
}

async function sendTwilio(config: AppConfig, to: string, body: string): Promise<void> {
  const sid = config.sms.twilioAccountSid!;
  const token = config.sms.twilioAuthToken!;
  const from = config.sms.twilioFromNumber!;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as { message?: string };
      detail = json.message || text;
    } catch {
      // keep raw
    }
    throw new Error(`Twilio error (${res.status}): ${detail}`);
  }
}

async function sendSmsApi(config: AppConfig, to: string, body: string): Promise<void> {
  const token = config.sms.smsapiToken!;
  const from = config.sms.smsapiFrom!;
  // SMSAPI expects digits without leading +
  const phone = to.replace(/^\+/, "");
  const params = new URLSearchParams({
    to: phone,
    from,
    message: body,
    format: "json",
    encoding: "utf-8",
  });

  const res = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const text = await res.text();
  let json: { error?: number; message?: string; list?: unknown[] } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`SMSAPI error: invalid response (${res.status})`);
  }

  if (!res.ok || typeof json.error === "number") {
    throw new Error(
      `SMSAPI error${json.error != null ? ` (${json.error})` : ""}: ${json.message || text}`,
    );
  }
}
