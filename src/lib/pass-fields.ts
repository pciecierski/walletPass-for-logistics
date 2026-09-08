import type { CreatePassInput, StoredPass } from "../types.js";

/** Value encoded in the barcode / QR and shown under it. */
export function resolveBarcodeMessage(stored: Pick<StoredPass, "serialNumber" | "input">): string {
  const custom = stored.input.barcodeMessage?.trim();
  return custom || stored.serialNumber;
}

/** Display date on the pass without shifting timezone on UTC servers. */
export function formatPassDateLabel(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]} ${match[4]}:${match[5]}`;
  }
  return raw;
}

/** Google Wallet dateTime / TimeInterval string (local, no forced UTC conversion). */
export function toGoogleDateTime(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
}

export function passEventName(input: CreatePassInput): string {
  return input.eventName?.trim() || input.description;
}
