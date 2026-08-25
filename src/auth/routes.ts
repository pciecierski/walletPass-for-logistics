import type { Request, Response, NextFunction, Router } from "express";
import { Router as createRouter } from "express";
import { roleForEmail, syncAdminRoleFromEnv } from "./adminAccess.js";
import {
  hashPassword,
  hashToken,
  isValidEmail,
  normalizeEmail,
  normalizeLocationName,
  randomToken,
  shortId,
  verifyPassword,
} from "./authCrypto.js";
import { sendPasswordResetEmail, sendPasswordSetupEmail } from "./mail.js";
import { getOptionalAccount, parseCookies, SESSION_COOKIE } from "./requestAuth.js";
import type { AuthStore } from "./store.js";
import { toPublicAccount, type Account } from "./types.js";

const SESSION_DAYS = 30;
const PASSWORD_SETUP_HOURS = 48;
const MIN_PASSWORD_LEN = 8;

type AuthedRequest = Request & { account?: Account; sessionId?: string };

function setSessionCookie(res: Response, token: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: Response) {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT);
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function appBaseUrl(req: Request, publicBaseUrl: string): string {
  const configured =
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ||
    publicBaseUrl.replace(/\/$/, "");
  if (configured) return configured;
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol);
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000");
  return `${proto}://${host}`;
}

function readString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function createAuthRouter(store: AuthStore, publicBaseUrl: string): Router {
  const router = createRouter();

  async function loadAccountFromRequest(req: AuthedRequest): Promise<Account | null> {
    const account = await getOptionalAccount(req, store);
    if (!account) return null;
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[SESSION_COOKIE];
    if (raw) {
      const session = await store.getSessionByTokenHash(hashToken(raw));
      if (session) req.sessionId = session.id;
    }
    req.account = account;
    return account;
  }

  async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      let account = await loadAccountFromRequest(req);
      if (!account) {
        res.status(401).json({ error: "Wymagane logowanie" });
        return;
      }
      account = await syncAdminRoleFromEnv(account, (nextAcc) => store.updateAccount(nextAcc));
      req.account = account;
      if (!account.passwordHash || !account.emailConfirmedAt) {
        res.status(403).json({
          error: "Dokończ konfigurację konta — ustaw hasło z linku e-mail",
        });
        return;
      }
      next();
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Błąd autoryzacji",
      });
    }
  }

  router.post("/register", async (req, res) => {
    try {
      const firstName = readString(req.body?.firstName, 80);
      const lastName = readString(req.body?.lastName, 80);
      const company = readString(req.body?.company, 120);
      const locationRaw = readString(req.body?.locationName, 120);
      const emailRaw = readString(req.body?.email, 200);

      if (!firstName || !lastName || !company || !locationRaw || !emailRaw) {
        res.status(400).json({
          error: "Wymagane: imię, nazwisko, firma, nazwa lokalizacji i e-mail",
        });
        return;
      }

      const email = normalizeEmail(emailRaw);
      if (!isValidEmail(email)) {
        res.status(400).json({ error: "Nieprawidłowy adres e-mail" });
        return;
      }

      const locationName = normalizeLocationName(locationRaw);
      if (locationName.length < 2) {
        res.status(400).json({ error: "Nazwa lokalizacji jest za krótka" });
        return;
      }

      const existingEmail = await store.getAccountByEmail(email);
      if (existingEmail) {
        res.status(409).json({ error: "Konto z tym adresem e-mail już istnieje" });
        return;
      }
      const existingLocation = await store.getAccountByLocationName(locationName);
      if (existingLocation) {
        res.status(409).json({
          error: "Nazwa lokalizacji jest już zajęta — wybierz inną",
        });
        return;
      }

      const now = new Date();
      const account: Account = {
        id: shortId(12),
        firstName,
        lastName,
        company,
        locationName,
        email,
        passwordHash: null,
        emailConfirmedAt: null,
        role: roleForEmail(email),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      try {
        await store.createAccount(account);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "EMAIL_TAKEN") {
          res.status(409).json({ error: "Konto z tym adresem e-mail już istnieje" });
          return;
        }
        if (code === "LOCATION_TAKEN") {
          res.status(409).json({
            error: "Nazwa lokalizacji jest już zajęta — wybierz inną",
          });
          return;
        }
        throw e;
      }

      const setupToken = randomToken(32);
      await store.createPasswordSetupToken({
        token: setupToken,
        accountId: account.id,
        expiresAt: new Date(
          now.getTime() + PASSWORD_SETUP_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        usedAt: null,
      });

      const setupUrl = `${appBaseUrl(req, publicBaseUrl)}/ustaw-haslo/${setupToken}`;
      const mail = await sendPasswordSetupEmail({
        to: email,
        firstName,
        locationName,
        setupUrl,
      });

      const message = mail.sent
        ? "Konto utworzone. Sprawdź e-mail — wysłaliśmy link do potwierdzenia i ustawienia hasła."
        : mail.error
          ? `Konto utworzone, ale e-mail nie wyszedł: ${mail.error}`
          : "Konto utworzone, ale brak SENDGRID_API_KEY — e-mail nie został wysłany.";

      res.status(201).json({
        ok: true,
        message,
        email,
        emailSent: mail.sent,
        ...(mail.error ? { emailError: mail.error } : {}),
        ...(!mail.sent && mail.previewUrl ? { previewSetupUrl: mail.previewUrl } : {}),
      });
    } catch (e) {
      console.error("[walletpass-for-logistics] register failed", e);
      const raw = e instanceof Error ? e.message : "Nie udało się utworzyć konta";
      const error = /unauthorized/i.test(raw)
        ? "Błąd wysyłki e-mail (SendGrid Unauthorized). Sprawdź SENDGRID_API_KEY i SENDGRID_FROM_EMAIL na Railway."
        : raw;
      res.status(500).json({ error });
    }
  });

  router.get("/password-setup/:token", async (req, res) => {
    try {
      const token = String(req.params.token ?? "");
      const row = await store.getPasswordSetupToken(token);
      if (!row || row.usedAt || Date.parse(row.expiresAt) < Date.now()) {
        res.status(410).json({ error: "Link jest nieprawidłowy lub wygasł" });
        return;
      }
      const account = await store.getAccountById(row.accountId);
      if (!account) {
        res.status(404).json({ error: "Konto nie istnieje" });
        return;
      }
      res.json({
        ok: true,
        email: account.email,
        firstName: account.firstName,
        locationName: account.locationName,
        mode: account.passwordHash ? "reset" : "setup",
      });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Nie udało się sprawdzić linku",
      });
    }
  });

  router.post("/password-setup/:token", async (req, res) => {
    try {
      const token = String(req.params.token ?? "");
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (password.length < MIN_PASSWORD_LEN) {
        res.status(400).json({
          error: `Hasło musi mieć co najmniej ${MIN_PASSWORD_LEN} znaków`,
        });
        return;
      }

      const row = await store.getPasswordSetupToken(token);
      if (!row || row.usedAt || Date.parse(row.expiresAt) < Date.now()) {
        res.status(410).json({ error: "Link jest nieprawidłowy lub wygasł" });
        return;
      }

      const account = await store.getAccountById(row.accountId);
      if (!account) {
        res.status(404).json({ error: "Konto nie istnieje" });
        return;
      }

      const now = new Date().toISOString();
      const hadPassword = Boolean(account.passwordHash);
      const passwordHash = await hashPassword(password);
      let updated = await store.updateAccount({
        ...account,
        passwordHash,
        emailConfirmedAt: account.emailConfirmedAt ?? now,
        updatedAt: now,
      });
      updated = await syncAdminRoleFromEnv(updated, (nextAcc) => store.updateAccount(nextAcc));
      await store.markPasswordSetupTokenUsed(token, now);
      if (hadPassword) {
        await store.deleteSessionsForAccount(updated.id);
      }

      const sessionToken = randomToken(32);
      await store.createSession({
        id: shortId(16),
        accountId: updated.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(
          Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        createdAt: now,
      });
      setSessionCookie(res, sessionToken);

      res.json({
        ok: true,
        account: toPublicAccount(updated),
        message: hadPassword
          ? "Hasło zmienione. Jesteś zalogowany."
          : "Hasło ustawione. Jesteś zalogowany.",
      });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Nie udało się ustawić hasła",
      });
    }
  });

  router.post("/forgot-password", async (req, res) => {
    const genericMessage =
      "Jeśli konto z tym e-mailem istnieje, wysłaliśmy link do ustawienia nowego hasła. Sprawdź skrzynkę.";

    try {
      const emailRaw = readString(req.body?.email, 200);
      if (!emailRaw || !isValidEmail(emailRaw)) {
        res.status(400).json({ error: "Podaj prawidłowy adres e-mail" });
        return;
      }

      const email = normalizeEmail(emailRaw);
      const account = await store.getAccountByEmail(email);

      if (!account) {
        res.json({ ok: true, message: genericMessage, emailSent: false });
        return;
      }

      const setupToken = randomToken(32);
      await store.createPasswordSetupToken({
        token: setupToken,
        accountId: account.id,
        expiresAt: new Date(
          Date.now() + PASSWORD_SETUP_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        usedAt: null,
      });
      const linkUrl = `${appBaseUrl(req, publicBaseUrl)}/ustaw-haslo/${setupToken}`;

      const mail = account.passwordHash
        ? await sendPasswordResetEmail({
            to: account.email,
            firstName: account.firstName,
            locationName: account.locationName,
            resetUrl: linkUrl,
          })
        : await sendPasswordSetupEmail({
            to: account.email,
            firstName: account.firstName,
            locationName: account.locationName,
            setupUrl: linkUrl,
          });

      res.json({
        ok: true,
        message: genericMessage,
        emailSent: mail.sent,
        ...(mail.error ? { emailError: mail.error } : {}),
        ...(!mail.sent && mail.previewUrl ? { previewSetupUrl: mail.previewUrl } : {}),
      });
    } catch (e) {
      console.error("[walletpass-for-logistics] forgot-password failed", e);
      res.status(500).json({
        error: e instanceof Error ? e.message : "Nie udało się wysłać linku resetu",
      });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const emailRaw = readString(req.body?.email, 200);
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!emailRaw || !password) {
        res.status(400).json({ error: "Podaj e-mail i hasło" });
        return;
      }
      const email = normalizeEmail(emailRaw);
      const account = await store.getAccountByEmail(email);
      if (!account?.passwordHash) {
        res.status(401).json({
          error:
            "Nieprawidłowy e-mail lub hasło. Jeśli właśnie założyłeś konto, ustaw hasło z linku w e-mailu.",
        });
        return;
      }
      const ok = await verifyPassword(password, account.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Nieprawidłowy e-mail lub hasło" });
        return;
      }

      const ready = await syncAdminRoleFromEnv(account, (nextAcc) =>
        store.updateAccount(nextAcc),
      );

      const sessionToken = randomToken(32);
      const now = new Date().toISOString();
      await store.createSession({
        id: shortId(16),
        accountId: ready.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(
          Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        createdAt: now,
      });
      setSessionCookie(res, sessionToken);

      res.json({ ok: true, account: toPublicAccount(ready) });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Nie udało się zalogować",
      });
    }
  });

  router.post("/logout", async (req: AuthedRequest, res) => {
    try {
      await loadAccountFromRequest(req);
      if (req.sessionId) {
        await store.deleteSession(req.sessionId);
      }
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (e) {
      clearSessionCookie(res);
      res.status(500).json({
        error: e instanceof Error ? e.message : "Nie udało się wylogować",
      });
    }
  });

  router.get("/me", async (req: AuthedRequest, res) => {
    try {
      let account = await loadAccountFromRequest(req);
      if (!account) {
        res.status(401).json({ error: "Niezalogowany" });
        return;
      }
      account = await syncAdminRoleFromEnv(account, (nextAcc) => store.updateAccount(nextAcc));
      res.json({ account: toPublicAccount(account) });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Błąd sesji",
      });
    }
  });

  // Reserved for future gated studio routes.
  void requireAuth;

  return router;
}
