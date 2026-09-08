import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import { z } from "zod";
import type { AppConfig, CreatePassInput } from "../types.js";
import { PassStore } from "../passes/store.js";
import { createPassSchema } from "../lib/schema.js";
import { appleStatus, buildApplePass, writeApplePreview } from "../passes/apple.js";
import {
  createGoogleSaveUrl,
  demoGoogleInstructions,
  googleStatus,
} from "../passes/google.js";
import { normalizePhone } from "../lib/phone.js";
import { sendPassSms, smsStatus } from "../lib/sms.js";
import {
  APPLE_COMING_SOON_MESSAGE,
  WALLET_FEATURES,
} from "../lib/wallet-features.js";
import { publicBaseUrlFromRequest } from "../config.js";

function configForRequest(config: AppConfig, req: Request): AppConfig {
  const publicBaseUrl = publicBaseUrlFromRequest(req, config.publicBaseUrl);
  if (publicBaseUrl === config.publicBaseUrl) return config;
  return { ...config, publicBaseUrl };
}

export function createApiRouter(config: AppConfig, store: PassStore): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "walletpass-for-logistics" });
  });

  router.get("/status", (req, res) => {
    const runtimeConfig = configForRequest(config, req);
    const apple = appleStatus(config);
    const google = googleStatus(config);
    const sms = smsStatus(config);
    res.json({
      publicBaseUrl: runtimeConfig.publicBaseUrl,
      storage: {
        backend: config.storage.backend,
        dataDir: config.dataDir,
        persistent: config.storage.persistent,
        volumeMountPath: config.storage.volumeMountPath || null,
        hint: config.storage.persistent
          ? "Pass data is stored on a Railway volume and survives deploys."
          : "Pass data is on ephemeral disk and will be lost on redeploy. Attach a Railway volume mounted at /data (or set DATA_DIR to the volume mount path).",
      },
      apple: {
        enabled: false,
        available: WALLET_FEATURES.appleEnabled,
        comingSoon: !WALLET_FEATURES.appleEnabled,
        message: APPLE_COMING_SOON_MESSAGE,
        configured: false,
        missing: apple.missing,
        passTypeIdentifier: config.apple.passTypeIdentifier || null,
      },
      google: {
        enabled: config.google.enabled,
        available: WALLET_FEATURES.googleEnabled,
        configured: google.configured,
        missing: google.missing,
        issuerId: config.google.issuerId || null,
        classId: config.google.classId || null,
        heroImageUrl: config.google.heroImageUrl || null,
        logoImageUrl: config.google.logoImageUrl || null,
        defaultHeroImageUrl: `${runtimeConfig.publicBaseUrl}/wallet-assets/logistics-park-gate-hero.jpg`,
      },
      platforms: {
        create: WALLET_FEATURES.appleEnabled ? ("both" as const) : ("google" as const),
        apple: WALLET_FEATURES.appleEnabled,
        google: WALLET_FEATURES.googleEnabled,
      },
      sms: {
        enabled: config.sms.provider !== "none",
        configured: sms.configured,
        provider: sms.provider,
        missing: sms.missing,
      },
    });
  });

  router.get("/passes", (_req, res) => {
    res.json({ passes: store.list() });
  });

  router.get("/passes/:id", (req, res) => {
    const pass = store.get(req.params.id);
    if (!pass) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }
    const baseUrl = configForRequest(config, req).publicBaseUrl;
    res.json({
      pass,
      urls: {
        page: `${baseUrl}${pass.statusPagePath}`,
        apple: `${baseUrl}${pass.appleDownloadPath}`,
        google: `${baseUrl}${pass.googleSavePath}`,
      },
      wallets: {
        apple: WALLET_FEATURES.appleEnabled,
        google: WALLET_FEATURES.googleEnabled,
      },
    });
  });

  router.post("/passes", async (req, res) => {
    try {
      const parsed = createPassSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid pass payload", details: parsed.error.flatten() });
        return;
      }

      const runtimeConfig = configForRequest(config, req);
      const { sendSms: sendSmsFlag, ...rest } = parsed.data;
      let recipientPhone = rest.recipientPhone?.trim() || undefined;
      if (recipientPhone) {
        try {
          recipientPhone = normalizePhone(recipientPhone);
        } catch (err) {
          res.status(400).json({ error: (err as Error).message });
          return;
        }
      }
      const input: CreatePassInput = {
        ...rest,
        platforms: "google",
        recipientPhone,
      };
      const stored = store.create(input, runtimeConfig.publicBaseUrl);
      const dir = store.passDir(stored.id);

      let appleReady = false;
      let googleReady = false;
      let googleSaveUrl: string | undefined;
      const errors: string[] = [];

      const wantApple =
        WALLET_FEATURES.appleEnabled &&
        (input.platforms === "apple" || input.platforms === "both");
      const wantGoogle =
        input.platforms === "google" || input.platforms === "both" || !WALLET_FEATURES.appleEnabled;

      if (wantApple) {
        try {
          if (appleStatus(runtimeConfig).configured) {
            await buildApplePass(runtimeConfig, stored, dir);
            appleReady = true;
          } else {
            await writeApplePreview(runtimeConfig, stored, dir);
            errors.push(
              `Apple preview only — configure: ${appleStatus(runtimeConfig).missing.join(", ")}`,
            );
          }
        } catch (err) {
          errors.push(`Apple: ${(err as Error).message}`);
          await writeApplePreview(runtimeConfig, stored, dir).catch(() => undefined);
        }
      }

      if (wantGoogle) {
        try {
          if (googleStatus(runtimeConfig).configured) {
            googleSaveUrl = await createGoogleSaveUrl(runtimeConfig, stored);
            googleReady = true;
            fs.writeFileSync(
              `${dir}/google-save-url.txt`,
              googleSaveUrl,
              "utf8",
            );
          } else {
            const demo = demoGoogleInstructions(stored);
            fs.writeFileSync(
              `${dir}/google-preview.json`,
              JSON.stringify(demo, null, 2),
              "utf8",
            );
            errors.push(`Google preview only — configure: ${googleStatus(runtimeConfig).missing.join(", ")}`);
          }
        } catch (err) {
          errors.push(`Google: ${(err as Error).message}`);
        }
      }

      const updated = store.update(stored.id, {
        appleReady,
        googleReady,
        googleSaveUrl,
      });

      const pageUrl = `${runtimeConfig.publicBaseUrl}${updated.statusPagePath}`;
      const urls = {
        page: pageUrl,
        apple: `${runtimeConfig.publicBaseUrl}${updated.appleDownloadPath}`,
        google: `${runtimeConfig.publicBaseUrl}${updated.googleSavePath}`,
      };

      let sms = undefined as Awaited<ReturnType<typeof sendPassSms>> | undefined;
      const shouldSendSms =
        Boolean(recipientPhone) && (sendSmsFlag === undefined ? true : sendSmsFlag);
      if (shouldSendSms && recipientPhone) {
        sms = await sendPassSms(runtimeConfig, {
          to: recipientPhone,
          organizationName: input.organizationName,
          pageUrl,
        });
        if (!sms.sent && sms.error) {
          errors.push(`SMS: ${sms.error}`);
        }
      }

      res.status(201).json({
        pass: updated,
        urls,
        sms,
        warnings: errors,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const sendSmsBodySchema = z.object({
    phone: z.string().min(9).max(20).optional(),
  });

  router.post("/passes/:id/sms", async (req, res) => {
    const pass = store.get(req.params.id);
    if (!pass) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }

    const parsed = sendSmsBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SMS payload", details: parsed.error.flatten() });
      return;
    }

    const phone = parsed.data.phone?.trim() || pass.input.recipientPhone;
    if (!phone) {
      res.status(400).json({
        error: "No recipient phone. Pass phone in the body or set recipientPhone when creating the pass.",
      });
      return;
    }

    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    if (normalized !== pass.input.recipientPhone) {
      store.update(pass.id, {
        input: { ...pass.input, recipientPhone: normalized },
      });
    }

    const runtimeConfig = configForRequest(config, req);
    const pageUrl = `${runtimeConfig.publicBaseUrl}${pass.statusPagePath}`;
    const sms = await sendPassSms(runtimeConfig, {
      to: normalized,
      organizationName: pass.input.organizationName,
      pageUrl,
    });

    if (!sms.sent) {
      res.status(502).json({ error: sms.error || "Failed to send SMS", sms });
      return;
    }

    res.json({ ok: true, sms, url: pageUrl });
  });

  router.get("/passes/:id/apple.pkpass", async (req, res) => {
    if (!WALLET_FEATURES.appleEnabled) {
      res.status(503).json({
        error: APPLE_COMING_SOON_MESSAGE,
        comingSoon: true,
      });
      return;
    }

    const pass = store.get(req.params.id);
    if (!pass) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }

    const runtimeConfig = configForRequest(config, req);
    const dir = store.passDir(pass.id);
    const pkpassPath = `${dir}/pass.pkpass`;

    try {
      if (!fs.existsSync(pkpassPath)) {
        if (!appleStatus(runtimeConfig).configured) {
          res.status(503).json({
            error: "Apple Wallet certificates are not configured",
            missing: appleStatus(runtimeConfig).missing,
            preview: fs.existsSync(`${dir}/pass.json`)
              ? `${runtimeConfig.publicBaseUrl}/api/passes/${pass.id}/preview`
              : null,
          });
          return;
        }
        await buildApplePass(runtimeConfig, pass, dir);
        store.update(pass.id, { appleReady: true });
      }

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${pass.serialNumber}.pkpass"`,
      );
      fs.createReadStream(pkpassPath).pipe(res);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.get("/passes/:id/preview", (req, res) => {
    const pass = store.get(req.params.id);
    if (!pass) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }
    const previewPath = `${store.passDir(pass.id)}/pass.json`;
    if (!fs.existsSync(previewPath)) {
      res.status(404).json({ error: "No preview available" });
      return;
    }
    res.type("json").send(fs.readFileSync(previewPath, "utf8"));
  });

  router.get("/passes/:id/google", async (req, res) => {
    const pass = store.get(req.params.id);
    if (!pass) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }

    try {
      if (!googleStatus(config).configured) {
        res.status(503).json(demoGoogleInstructions(pass));
        return;
      }

      // Always rebuild the Save URL so JWT reflects current public base URL,
      // class graphics, and image overrides (cached JWTs can go stale/broken).
      const runtimeConfig = configForRequest(config, req);
      const url = await createGoogleSaveUrl(runtimeConfig, pass);
      store.update(pass.id, { googleReady: true, googleSaveUrl: url });

      if (req.query.redirect === "1" || req.query.redirect === "true") {
        res.redirect(url);
        return;
      }
      res.json({ saveUrl: url });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.delete("/passes/:id", (req, res) => {
    const ok = store.delete(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }
    res.status(204).end();
  });

  // Convenience typed handlers for TS
  void (null as unknown as Request);
  void (null as unknown as Response);

  return router;
}
