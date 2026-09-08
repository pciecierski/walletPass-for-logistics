import fs from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";
import type { AppConfig, CreatePassInput, StoredPass } from "../types.js";
import { cssColorToRgb, generatePassImages } from "../lib/images.js";

const BARCODE_MAP = {
  QR: "PKBarcodeFormatQR",
  PDF417: "PKBarcodeFormatPDF417",
  Aztec: "PKBarcodeFormatAztec",
  Code128: "PKBarcodeFormatCode128",
} as const;

export function appleStatus(config: AppConfig): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!config.apple.passTypeIdentifier) missing.push("APPLE_PASS_TYPE_ID");
  if (!config.apple.teamIdentifier) missing.push("APPLE_TEAM_ID");
  if (!config.apple.wwdrPath || !fs.existsSync(config.apple.wwdrPath)) {
    missing.push("WWDR certificate (certs/wwdr.pem)");
  }
  if (!config.apple.signerCertPath || !fs.existsSync(config.apple.signerCertPath)) {
    missing.push("signer certificate (certs/signerCert.pem)");
  }
  if (!config.apple.signerKeyPath || !fs.existsSync(config.apple.signerKeyPath)) {
    missing.push("signer key (certs/signerKey.pem)");
  }
  return { configured: missing.length === 0, missing };
}

export async function buildApplePass(
  config: AppConfig,
  stored: StoredPass,
  outputDir: string,
): Promise<{ buffer: Buffer; path: string }> {
  const status = appleStatus(config);
  if (!status.configured) {
    throw new Error(`Apple Wallet is not configured. Missing: ${status.missing.join(", ")}`);
  }

  const input = stored.input;
  const bg = input.backgroundColor || "#0B3D2E";
  const fg = input.foregroundColor || "#F4EFE6";
  const label = input.labelColor || "#C8B8A0";
  const images = await generatePassImages(bg, fg);

  const certificates = {
    wwdr: fs.readFileSync(config.apple.wwdrPath!),
    signerCert: fs.readFileSync(config.apple.signerCertPath!),
    signerKey: fs.readFileSync(config.apple.signerKeyPath!),
    signerKeyPassphrase: config.apple.signerKeyPassphrase || undefined,
  };

  const passJson = buildPassJson(config, stored, input, bg, fg, label);

  const icon2x = "icon" + "@2x.png";
  const logo2x = "logo" + "@2x.png";
  const strip2x = "strip" + "@2x.png";

  const buffers: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson, null, 2)),
    "icon.png": images.icon,
    [icon2x]: images.icon,
    "logo.png": images.logo,
    [logo2x]: images.logo,
  };

  if (input.style === "coupon" || input.style === "eventTicket" || input.style === "storeCard") {
    if (images.strip) {
      buffers["strip.png"] = images.strip;
      buffers[strip2x] = images.strip;
    }
  }

  const pass = new PKPass(buffers, certificates, {});

  if (input.style === "boardingPass") {
    pass.setBarcodes({
      message: input.barcodeMessage || stored.serialNumber,
      format: BARCODE_MAP[input.barcodeFormat || "QR"],
      messageEncoding: "iso-8859-1",
    });
  } else {
    pass.setBarcodes({
      message: input.barcodeMessage || stored.serialNumber,
      format: BARCODE_MAP[input.barcodeFormat || "QR"],
      messageEncoding: "iso-8859-1",
    });
  }

  const buffer = pass.getAsBuffer();
  const outPath = path.join(outputDir, "pass.pkpass");
  fs.writeFileSync(outPath, buffer);
  fs.writeFileSync(path.join(outputDir, "pass.json"), JSON.stringify(passJson, null, 2));
  return { buffer, path: outPath };
}

/** Write an unsigned pass.json preview when Apple certs are missing. */
export async function writeApplePreview(
  config: AppConfig,
  stored: StoredPass,
  outputDir: string,
): Promise<void> {
  const input = stored.input;
  const bg = input.backgroundColor || "#0B3D2E";
  const fg = input.foregroundColor || "#F4EFE6";
  const label = input.labelColor || "#C8B8A0";
  const passJson = buildPassJson(config, stored, input, bg, fg, label);
  fs.writeFileSync(path.join(outputDir, "pass.json"), JSON.stringify(passJson, null, 2));
  const images = await generatePassImages(bg, fg);
  fs.writeFileSync(path.join(outputDir, "icon.png"), images.icon);
  fs.writeFileSync(path.join(outputDir, "logo.png"), images.logo);
}

function buildPassJson(
  config: AppConfig,
  stored: StoredPass,
  input: CreatePassInput,
  bg: string,
  fg: string,
  label: string,
) {
  const styleKey = input.style;
  const fields = {
    headerFields: mapFields(input.headerFields),
    primaryFields: mapFields(input.primaryFields?.length ? input.primaryFields : defaultPrimary(input)),
    secondaryFields: mapFields(
      input.secondaryFields?.length ? input.secondaryFields : defaultSecondary(input),
    ),
    auxiliaryFields: mapFields(input.auxiliaryFields),
    backFields: mapFields(
      input.backFields?.length
        ? input.backFields
        : [{ key: "about", label: "About", value: input.description }],
    ),
  };

  const styleBlock: Record<string, unknown> = { ...fields };
  if (styleKey === "boardingPass") {
    styleBlock.transitType = input.transitType || "PKTransitTypeGeneric";
  }

  return {
    formatVersion: 1,
    passTypeIdentifier:
      config.apple.passTypeIdentifier || "pass.com.example.walletpass",
    serialNumber: stored.serialNumber,
    teamIdentifier: config.apple.teamIdentifier || "TEAMIDXXXX",
    organizationName:
      config.apple.organizationName || input.organizationName || "WalletPass for Logistics",
    description: input.description,
    logoText: input.logoText || input.organizationName,
    foregroundColor: cssColorToRgb(fg),
    backgroundColor: cssColorToRgb(bg),
    labelColor: cssColorToRgb(label),
    relevantDate: input.relevantDate || undefined,
    [styleKey]: styleBlock,
    barcodes: [
      {
        message: input.barcodeMessage || stored.serialNumber,
        format: BARCODE_MAP[input.barcodeFormat || "QR"],
        messageEncoding: "iso-8859-1",
      },
    ],
  };
}

function mapFields(fields?: { key: string; label: string; value: string }[]) {
  return (fields || []).map((f) => ({
    key: f.key,
    label: f.label,
    value: f.value,
  }));
}

function defaultPrimary(input: CreatePassInput) {
  if (input.style === "coupon" && input.discount) {
    return [{ key: "offer", label: "Offer", value: input.discount }];
  }
  if (input.style === "eventTicket") {
    return [{ key: "event", label: "Event", value: input.eventName || input.description }];
  }
  if (input.style === "storeCard" && input.balance) {
    return [{ key: "balance", label: "Balance", value: input.balance }];
  }
  if (input.style === "boardingPass") {
    return [
      { key: "origin", label: "From", value: input.headerFields?.[0]?.value || "DEP" },
      { key: "destination", label: "To", value: input.headerFields?.[1]?.value || "ARR" },
    ];
  }
  return [{ key: "title", label: "Pass", value: input.description }];
}

function defaultSecondary(input: CreatePassInput) {
  if (input.style === "eventTicket" && input.venue) {
    return [{ key: "venue", label: "Venue", value: input.venue }];
  }
  return [{ key: "org", label: "Issued by", value: input.organizationName }];
}
