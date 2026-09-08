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

function stripToLocalDateTime(value: string): string | undefined {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?/);
  if (!match) return undefined;
  return `${match[1]}:${match[2] ?? "00"}`;
}

/**
 * Google Wallet dateTime / TimeInterval string as a local date/time (no offset).
 * Mixing local times with `Z` / `+02:00` values makes Wallet reject the pass.
 */
export function toGoogleDateTime(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  return stripToLocalDateTime(raw);
}

export function addDaysToLocalDateTime(local: string, days: number): string {
  const normalized = stripToLocalDateTime(local) ?? local;
  const [datePart, timePart = "00:00:00"] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  return new Date(utc + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

/** Start/end pair for Google TimeInterval — both local, never mixed with offsets. */
export function googleLocalTimeInterval(
  startValue?: string,
  endValue?: string,
  endDaysAfterStart = 7,
): { start: { date: string }; end: { date: string } } | undefined {
  const start = toGoogleDateTime(startValue);
  if (!start) return undefined;
  const end = toGoogleDateTime(endValue) ?? addDaysToLocalDateTime(start, endDaysAfterStart);
  return {
    start: { date: start },
    end: { date: end },
  };
}

export function passEventName(input: CreatePassInput): string {
  return input.eventName?.trim() || input.description;
}
