import type { Request } from "express";
import type { AuthStore } from "./store.js";
import { hashToken } from "./authCrypto.js";
import type { Account } from "./types.js";

export const SESSION_COOKIE = "walletpass_for_logistics_session";

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/** Load account from session cookie; returns null when anonymous. */
export async function getOptionalAccount(
  req: Request,
  store: AuthStore,
): Promise<Account | null> {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  const session = await store.getSessionByTokenHash(hashToken(raw));
  if (!session) return null;
  if (Date.parse(session.expiresAt) < Date.now()) {
    await store.deleteSession(session.id);
    return null;
  }
  return (await store.getAccountById(session.accountId)) ?? null;
}
