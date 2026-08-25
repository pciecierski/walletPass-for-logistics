import fs from "node:fs";
import path from "node:path";
import type { Account, PasswordSetupToken, Session } from "./types.js";

export type AuthStore = {
  createAccount(account: Account): Promise<Account>;
  listAccounts(): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | undefined>;
  getAccountByEmail(email: string): Promise<Account | undefined>;
  getAccountByLocationName(locationName: string): Promise<Account | undefined>;
  updateAccount(account: Account): Promise<Account>;
  deleteAccount(id: string): Promise<void>;

  createPasswordSetupToken(row: PasswordSetupToken): Promise<PasswordSetupToken>;
  getPasswordSetupToken(token: string): Promise<PasswordSetupToken | undefined>;
  markPasswordSetupTokenUsed(token: string, usedAt: string): Promise<void>;

  createSession(session: Session): Promise<Session>;
  getSessionByTokenHash(tokenHash: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteSessionsForAccount(accountId: string): Promise<void>;
};

type AuthSnapshot = {
  accounts: Account[];
  passwordTokens: PasswordSetupToken[];
  sessions: Session[];
};

function emptySnapshot(): AuthSnapshot {
  return { accounts: [], passwordTokens: [], sessions: [] };
}

export function createAuthStore(dataDir: string): AuthStore {
  const authDir = path.join(dataDir, "auth");
  const filePath = path.join(authDir, "auth.json");
  fs.mkdirSync(authDir, { recursive: true });

  let snapshot = loadSnapshot(filePath);

  function persist() {
    fs.mkdirSync(authDir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  }

  return {
    async createAccount(account) {
      if (snapshot.accounts.some((a) => a.email.toLowerCase() === account.email.toLowerCase())) {
        throw Object.assign(new Error("EMAIL_TAKEN"), { code: "EMAIL_TAKEN" });
      }
      const locKey = account.locationName.toLocaleLowerCase("pl");
      if (
        snapshot.accounts.some(
          (a) => a.locationName.toLocaleLowerCase("pl") === locKey,
        )
      ) {
        throw Object.assign(new Error("LOCATION_TAKEN"), { code: "LOCATION_TAKEN" });
      }
      snapshot.accounts.push(account);
      persist();
      return account;
    },

    async listAccounts() {
      return [...snapshot.accounts].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    },

    async getAccountById(id) {
      return snapshot.accounts.find((a) => a.id === id);
    },

    async getAccountByEmail(email) {
      const key = email.toLowerCase();
      return snapshot.accounts.find((a) => a.email.toLowerCase() === key);
    },

    async getAccountByLocationName(locationName) {
      const key = locationName.toLocaleLowerCase("pl");
      return snapshot.accounts.find(
        (a) => a.locationName.toLocaleLowerCase("pl") === key,
      );
    },

    async updateAccount(account) {
      const idx = snapshot.accounts.findIndex((a) => a.id === account.id);
      if (idx < 0) throw new Error("ACCOUNT_NOT_FOUND");
      snapshot.accounts[idx] = account;
      persist();
      return account;
    },

    async deleteAccount(id) {
      snapshot.accounts = snapshot.accounts.filter((a) => a.id !== id);
      snapshot.passwordTokens = snapshot.passwordTokens.filter((t) => t.accountId !== id);
      snapshot.sessions = snapshot.sessions.filter((s) => s.accountId !== id);
      persist();
    },

    async createPasswordSetupToken(row) {
      snapshot.passwordTokens.push(row);
      persist();
      return row;
    },

    async getPasswordSetupToken(token) {
      return snapshot.passwordTokens.find((t) => t.token === token);
    },

    async markPasswordSetupTokenUsed(token, usedAt) {
      const row = snapshot.passwordTokens.find((t) => t.token === token);
      if (!row) return;
      row.usedAt = usedAt;
      persist();
    },

    async createSession(session) {
      snapshot.sessions.push(session);
      persist();
      return session;
    },

    async getSessionByTokenHash(tokenHash) {
      return snapshot.sessions.find((s) => s.tokenHash === tokenHash);
    },

    async deleteSession(id) {
      snapshot.sessions = snapshot.sessions.filter((s) => s.id !== id);
      persist();
    },

    async deleteSessionsForAccount(accountId) {
      snapshot.sessions = snapshot.sessions.filter((s) => s.accountId !== accountId);
      persist();
    },
  };
}

function loadSnapshot(filePath: string): AuthSnapshot {
  if (!fs.existsSync(filePath)) return emptySnapshot();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<AuthSnapshot>;
    return {
      accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
      passwordTokens: Array.isArray(raw.passwordTokens) ? raw.passwordTokens : [],
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    };
  } catch (e) {
    console.error("[walletpass-for-logistics] Failed to read auth store — starting empty", e);
    return emptySnapshot();
  }
}
