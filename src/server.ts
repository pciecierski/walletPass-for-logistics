import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthRouter } from "./auth/routes.js";
import { createAuthStore } from "./auth/store.js";
import { loadConfig } from "./config.js";
import { PassStore } from "./passes/store.js";
import { createApiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const store = new PassStore(config.dataDir);
const authStore = createAuthStore(config.dataDir);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use("/api", createApiRouter(config, store));
app.use("/api/auth", createAuthRouter(authStore, config.publicBaseUrl));

const publicDir = path.join(__dirname, "..", "public");

/** Signal Polish as the primary language for HTML documents (SEO / crawlers). */
function sendHtml(res: express.Response, file: string) {
  res.setHeader("Content-Language", "pl");
  res.sendFile(file);
}

app.use(
  express.static(publicDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Content-Language", "pl");
        res.setHeader("Cache-Control", "no-cache");
      } else if (filePath.endsWith(".js") || filePath.endsWith(".css")) {
        // Avoid long CDN caches that serve stale i18n.js against newer HTML.
        res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
      }
    },
  }),
);

app.get("/p/:id", (_req, res) => {
  sendHtml(res, path.join(publicDir, "pass.html"));
});

app.get(["/zarejestruj", "/zaloguj", "/przypomnij-haslo"], (req, res) => {
  const map: Record<string, string> = {
    "/zarejestruj": "register.html",
    "/zaloguj": "login.html",
    "/przypomnij-haslo": "forgot-password.html",
  };
  sendHtml(res, path.join(publicDir, map[req.path]));
});

app.get("/ustaw-haslo/:token", (_req, res) => {
  sendHtml(res, path.join(publicDir, "set-password.html"));
});

app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  sendHtml(res, path.join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  const purged = store.purgeExpired();
  console.log(`WalletPass for Logistics server listening on :${config.port}`);
  console.log(`Public base URL: ${config.publicBaseUrl}`);
  console.log(
    `Storage: ${config.dataDir} (${config.storage.persistent ? "persistent volume" : "ephemeral — attach Railway volume at /data"})`,
  );
  console.log(
    `Google Wallet: ${config.google.enabled ? "enabled" : "needs credentials"} · Apple Wallet: coming soon`,
  );
  if (purged > 0) {
    console.log(`Purged ${purged} expired test pass(es)`);
  }
});

/** Periodically drop expired test passes (TTL = 7 days). */
const PURGE_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  const purged = store.purgeExpired();
  if (purged > 0) {
    console.log(`Purged ${purged} expired test pass(es)`);
  }
}, PURGE_INTERVAL_MS).unref();
