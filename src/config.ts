import fs from "node:fs";
import path from "node:path";
import type { AppConfig, SmsProvider } from "./types.js";

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function resolvePath(maybePath: string | undefined, fallback: string): string {
  if (!maybePath) return fallback;
  return path.isAbsolute(maybePath) ? maybePath : path.resolve(process.cwd(), maybePath);
}

/** Ensure PUBLIC_BASE_URL is an absolute https URL (Google Wallet rejects relative image URIs). */
export function normalizePublicBaseUrl(raw: string | undefined, port: number): string {
  const fallback = `http://localhost:${port}`;
  let value = (raw || fallback).trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  return value.replace(/\/$/, "");
}

/** True when the URL points at a local loopback host (common .env.example leftover on Railway). */
export function isLocalPublicBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
  } catch {
    return true;
  }
}

/**
 * Resolve the public site URL used in pass links, SMS, and Google Wallet JWT origins.
 * Prefer an explicit non-local PUBLIC_BASE_URL; otherwise use Railway's public domain.
 */
export function resolvePublicBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  port = Number(env.PORT || 3000),
): string {
  const explicit = env.PUBLIC_BASE_URL?.trim();
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();

  if (explicit) {
    const normalized = normalizePublicBaseUrl(explicit, port);
    if (!isLocalPublicBaseUrl(normalized) || !railwayDomain) {
      return normalized;
    }
  }

  if (railwayDomain) {
    return normalizePublicBaseUrl(railwayDomain, port);
  }

  return normalizePublicBaseUrl(explicit, port);
}

/**
 * When the configured base URL is still localhost (misconfigured deploy), rebuild it from
 * the incoming request's forwarded host — Railway always sends X-Forwarded-*.
 */
export function publicBaseUrlFromRequest(
  req: { protocol?: string; headers: Record<string, unknown> },
  configured: string,
): string {
  if (!isLocalPublicBaseUrl(configured)) {
    return configured.replace(/\/$/, "");
  }

  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = String(protoHeader ?? req.protocol ?? "https")
    .split(",")[0]
    .trim();
  const host = String(hostHeader ?? "")
    .split(",")[0]
    .trim();

  if (!host || isLocalPublicBaseUrl(`http://${host}`)) {
    return configured.replace(/\/$/, "");
  }

  return normalizePublicBaseUrl(`${proto}://${host}`, 443);
}

function resolveDataDir(): {
  dataDir: string;
  persistent: boolean;
  volumeMountPath?: string;
} {
  const volumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || undefined;

  if (process.env.DATA_DIR?.trim()) {
    const dataDir = resolvePath(process.env.DATA_DIR, path.join(process.cwd(), "data"));
    const persistent = Boolean(
      volumeMountPath &&
        (dataDir === volumeMountPath || dataDir.startsWith(`${volumeMountPath}${path.sep}`)),
    );
    return { dataDir, persistent, volumeMountPath };
  }

  if (volumeMountPath) {
    return {
      dataDir: path.isAbsolute(volumeMountPath)
        ? volumeMountPath
        : path.resolve(process.cwd(), volumeMountPath),
      persistent: true,
      volumeMountPath,
    };
  }

  // Production containers default to /data so a Railway volume can mount there.
  if (process.env.NODE_ENV === "production") {
    return { dataDir: "/data", persistent: false, volumeMountPath };
  }

  return {
    dataDir: path.join(process.cwd(), "data"),
    persistent: false,
    volumeMountPath,
  };
}

export function loadConfig(): AppConfig {
  const { dataDir, persistent, volumeMountPath } = resolveDataDir();
  const certsDir = resolvePath(process.env.CERTS_DIR, path.join(process.cwd(), "certs"));

  const wwdrPath = process.env.APPLE_WWDR_CERT_PATH
    ? resolvePath(process.env.APPLE_WWDR_CERT_PATH, "")
    : path.join(certsDir, "wwdr.pem");
  const signerCertPath = process.env.APPLE_SIGNER_CERT_PATH
    ? resolvePath(process.env.APPLE_SIGNER_CERT_PATH, "")
    : path.join(certsDir, "signerCert.pem");
  const signerKeyPath = process.env.APPLE_SIGNER_KEY_PATH
    ? resolvePath(process.env.APPLE_SIGNER_KEY_PATH, "")
    : path.join(certsDir, "signerKey.pem");

  const appleCertsPresent =
    fs.existsSync(wwdrPath) && fs.existsSync(signerCertPath) && fs.existsSync(signerKeyPath);

  const appleEnabled =
    truthy(process.env.APPLE_WALLET_ENABLED) ||
    (Boolean(process.env.APPLE_PASS_TYPE_ID) &&
      Boolean(process.env.APPLE_TEAM_ID) &&
      appleCertsPresent);

  const googleKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH &&
    fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
      ? fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, "utf8")
      : undefined);

  const googleEnabled =
    truthy(process.env.GOOGLE_WALLET_ENABLED) ||
    (Boolean(process.env.GOOGLE_ISSUER_ID) && Boolean(googleKey));

  const port = Number(process.env.PORT || 3000);
  const publicBaseUrl = resolvePublicBaseUrl(process.env, port);

  const smsProviderRaw = (process.env.SMS_PROVIDER || "none").toLowerCase();
  const smsProvider: SmsProvider = (
    ["none", "twilio", "smsapi", "log"] as const
  ).includes(smsProviderRaw as SmsProvider)
    ? (smsProviderRaw as SmsProvider)
    : "none";

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(certsDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "passes"), { recursive: true });

  return {
    port,
    publicBaseUrl,
    dataDir,
    certsDir,
    storage: {
      persistent,
      volumeMountPath,
      backend: "filesystem",
    },
    apple: {
      enabled: appleEnabled && appleCertsPresent && Boolean(process.env.APPLE_PASS_TYPE_ID),
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      organizationName: process.env.APPLE_ORG_NAME,
      wwdrPath,
      signerCertPath,
      signerKeyPath,
      signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || "",
    },
    google: {
      enabled: googleEnabled,
      issuerId: process.env.GOOGLE_ISSUER_ID,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      serviceAccountKey: googleKey,
      classSuffix: process.env.GOOGLE_CLASS_SUFFIX || "walletpass",
      classId: process.env.GOOGLE_CLASS_ID,
      heroImageUrl: process.env.GOOGLE_HERO_IMAGE_URL,
      logoImageUrl: process.env.GOOGLE_LOGO_IMAGE_URL,
    },
    sms: {
      provider: smsProvider,
      messageTemplate: process.env.SMS_MESSAGE_TEMPLATE,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
      smsapiToken: process.env.SMSAPI_TOKEN,
      smsapiFrom: process.env.SMSAPI_FROM,
    },
  };
}
