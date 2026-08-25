import { GoogleAuth } from "google-auth-library";
import { SignJWT, importPKCS8 } from "jose";
import type { AppConfig, CreatePassInput, StoredPass } from "../types.js";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

type WalletImage = {
  sourceUri: { uri: string };
  contentDescription: {
    defaultValue: { language: string; value: string };
  };
};

type ClassResource = Record<string, unknown> & {
  id?: string;
  heroImage?: WalletImage;
  logo?: WalletImage;
  programLogo?: WalletImage;
  wideLogo?: WalletImage;
  wideProgramLogo?: WalletImage;
  imageModulesData?: Array<{
    id?: string;
    mainImage?: WalletImage;
  }>;
};

function parseServiceAccount(config: AppConfig): ServiceAccount {
  if (!config.google.serviceAccountKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY (or KEY_PATH) is required");
  }
  const parsed = JSON.parse(config.google.serviceAccountKey) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account JSON must include client_email and private_key");
  }
  return parsed;
}

export function googleStatus(config: AppConfig): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!config.google.issuerId) missing.push("GOOGLE_ISSUER_ID");
  if (!config.google.serviceAccountKey) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH");
  } else {
    try {
      parseServiceAccount(config);
    } catch {
      missing.push("valid Google service account JSON");
    }
  }
  return { configured: missing.length === 0, missing };
}

function classId(config: AppConfig, style: CreatePassInput["style"]): string {
  if (config.google.classId?.trim()) {
    const explicit = config.google.classId.trim();
    // Allow either full "issuerId.suffix" or just the suffix.
    if (explicit.includes(".")) return explicit;
    return `${config.google.issuerId!}.${explicit}`;
  }
  return `${config.google.issuerId!}.${config.google.classSuffix}_${style}`;
}

function objectId(config: AppConfig, serial: string): string {
  const safe = serial.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${config.google.issuerId!}.${safe}`;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 6 ? h : "0B3D2E", 16);
  return `#${((1 << 24) + n).toString(16).slice(1).toUpperCase()}`;
}

function walletImage(uri: string, description: string): WalletImage {
  return {
    sourceUri: { uri },
    contentDescription: {
      defaultValue: { language: "en-US", value: description },
    },
  };
}

function imageUri(image: WalletImage | undefined): string | undefined {
  const uri = image?.sourceUri?.uri?.trim();
  return uri || undefined;
}

/** Google Wallet only accepts publicly reachable HTTPS image URIs (no relative hosts). */
function absoluteHttpsUri(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Resolve branding images for a pass object.
 * Priority: explicit env URLs → images already configured on the Wallet class →
 * public WalletPass for Logistics hero asset (Generic only).
 */
function resolvePassImages(
  config: AppConfig,
  style: CreatePassInput["style"],
  classResource: ClassResource | null,
): {
  heroImage?: WalletImage;
  logo?: WalletImage;
  imageModulesData?: ClassResource["imageModulesData"];
} {
  const classHero =
    absoluteHttpsUri(imageUri(classResource?.heroImage)) ||
    absoluteHttpsUri(imageUri(classResource?.imageModulesData?.[0]?.mainImage));
  const classLogo =
    absoluteHttpsUri(imageUri(classResource?.logo)) ||
    absoluteHttpsUri(imageUri(classResource?.programLogo)) ||
    absoluteHttpsUri(imageUri(classResource?.wideLogo)) ||
    absoluteHttpsUri(imageUri(classResource?.wideProgramLogo));

  const defaultHero = absoluteHttpsUri(
    `${config.publicBaseUrl}/wallet-assets/logistics-park-gate-hero.jpg`,
  );

  const heroUri =
    absoluteHttpsUri(config.google.heroImageUrl) ||
    classHero ||
    (style === "generic" || style === "boardingPass" ? defaultHero : undefined);

  const logoUri = absoluteHttpsUri(config.google.logoImageUrl) || classLogo;

  const result: {
    heroImage?: WalletImage;
    logo?: WalletImage;
    imageModulesData?: ClassResource["imageModulesData"];
  } = {};

  if (heroUri) {
    result.heroImage = walletImage(heroUri, "Pass hero image");
  }
  if (logoUri) {
    result.logo = walletImage(logoUri, "Pass logo");
  }

  // Keep class-level image modules on the object only when the class did not
  // already define them (typed classes inherit class modules automatically).
  if (!classResource?.imageModulesData?.length && result.heroImage) {
    result.imageModulesData = [
      {
        id: "hero",
        mainImage: result.heroImage,
      },
    ];
  }

  return result;
}

function buildGenericClass(config: AppConfig, style: CreatePassInput["style"]) {
  const id = classId(config, style);
  const images = resolvePassImages(config, style, null);
  const base: Record<string, unknown> = {
    id,
    issuerName: "WalletPass for Logistics",
    reviewStatus: "UNDER_REVIEW",
  };

  // Seed new classes with hero/logo so Console graphics are not blank.
  // Existing classes are never overwritten — see ensureClass().
  if (images.imageModulesData) {
    base.imageModulesData = images.imageModulesData;
  }
  if (images.heroImage && (style === "eventTicket" || style === "coupon" || style === "storeCard")) {
    base.heroImage = images.heroImage;
  }
  if (images.logo && style === "storeCard") {
    base.programLogo = images.logo;
  }
  if (images.logo && (style === "eventTicket" || style === "coupon")) {
    base.logo = images.logo;
  }

  switch (style) {
    case "coupon":
      return {
        ...base,
        reviewStatus: "UNDER_REVIEW",
        redemptionChannel: "BOTH",
        provider: "WalletPass for Logistics",
      };
    case "eventTicket":
      return {
        ...base,
        eventName: {
          defaultValue: { language: "en-US", value: "Event" },
        },
      };
    case "storeCard":
    case "generic":
    case "boardingPass":
    default:
      return {
        ...base,
        classTemplateInfo: {
          cardTemplateOverride: {
            cardRowTemplateInfos: [
              {
                twoItems: {
                  startItem: {
                    firstValue: {
                      fields: [{ fieldPath: "object.textModulesData['title']" }],
                    },
                  },
                  endItem: {
                    firstValue: {
                      fields: [{ fieldPath: "object.textModulesData['subtitle']" }],
                    },
                  },
                },
              },
            ],
          },
        },
      };
  }
}

function buildObject(
  config: AppConfig,
  stored: StoredPass,
  classResource: ClassResource | null = null,
) {
  const input = stored.input;
  const id = objectId(config, stored.serialNumber);
  const cid = classId(config, input.style);
  const bg = hexToRgb(input.backgroundColor || "#0B3D2E");
  const barcode = {
    type: "QR_CODE",
    value: input.barcodeMessage || stored.serialNumber,
    alternateText: stored.serialNumber,
  };
  const images = resolvePassImages(config, input.style, classResource);

  const textModules = [
    {
      id: "title",
      header: "Title",
      body: input.primaryFields?.[0]?.value || input.eventName || input.description,
    },
    {
      id: "subtitle",
      header: "Details",
      body:
        input.secondaryFields?.[0]?.value ||
        input.venue ||
        input.discount ||
        input.organizationName,
    },
  ];

  const common: Record<string, unknown> = {
    id,
    classId: cid,
    state: "ACTIVE",
    barcode,
    hexBackgroundColor: bg,
    textModulesData: textModules,
  };

  // Generic objects carry logo/hero themselves (class has no heroImage/logo fields).
  // Typed passes inherit branding from the class — only set object images when env
  // overrides are present so we don't shadow class graphics.
  const isGenericStyle = input.style === "generic" || input.style === "boardingPass";
  if (isGenericStyle) {
    if (images.logo) common.logo = images.logo;
    if (images.heroImage) common.heroImage = images.heroImage;
  } else if (config.google.heroImageUrl || config.google.logoImageUrl) {
    if (images.logo) common.logo = images.logo;
    if (images.heroImage) common.heroImage = images.heroImage;
  }

  switch (input.style) {
    case "coupon":
      return {
        ...common,
        offerId: stored.serialNumber,
        redemptionChannel: "BOTH",
        provider: input.organizationName,
        title: input.discount || input.description,
      };
    case "eventTicket":
      return {
        ...common,
        ticketHolderName: input.organizationName,
        ticketNumber: stored.serialNumber,
      };
    case "storeCard":
    case "boardingPass":
    case "generic":
    default:
      return {
        ...common,
        cardTitle: {
          defaultValue: { language: "en-US", value: input.organizationName },
        },
        header: {
          defaultValue: {
            language: "en-US",
            value:
              input.logoText ||
              (input.style === "boardingPass"
                ? `${input.headerFields?.[0]?.value || "DEP"} → ${input.headerFields?.[1]?.value || "ARR"}`
                : input.description),
          },
        },
        subheader: {
          defaultValue: {
            language: "en-US",
            value: input.balance || input.organizationName,
          },
        },
      };
  }
}

function resourcePaths(style: CreatePassInput["style"]): {
  classPath: string;
  objectPath: string;
  classKey: string;
  objectKey: string;
} {
  switch (style) {
    case "coupon":
      return {
        classPath: "offerClass",
        objectPath: "offerObject",
        classKey: "offerClasses",
        objectKey: "offerObjects",
      };
    case "eventTicket":
      return {
        classPath: "eventTicketClass",
        objectPath: "eventTicketObject",
        classKey: "eventTicketClasses",
        objectKey: "eventTicketObjects",
      };
    case "storeCard":
      return {
        classPath: "loyaltyClass",
        objectPath: "loyaltyObject",
        classKey: "loyaltyClasses",
        objectKey: "loyaltyObjects",
      };
    case "boardingPass":
    case "generic":
    default:
      // Boarding passes use Generic Wallet objects to avoid flight-class required fields.
      return {
        classPath: "genericClass",
        objectPath: "genericObject",
        classKey: "genericClasses",
        objectKey: "genericObjects",
      };
  }
}

async function getAuthClient(config: AppConfig) {
  const sa = parseServiceAccount(config);
  const auth = new GoogleAuth({
    credentials: {
      client_email: sa.client_email,
      private_key: sa.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
  return auth.getClient();
}

async function fetchClass(
  config: AppConfig,
  style: CreatePassInput["style"],
): Promise<ClassResource | null> {
  const client = await getAuthClient(config);
  const { classPath } = resourcePaths(style);
  const id = classId(config, style);
  const base = "https://walletobjects.googleapis.com/walletobjects/v1";

  try {
    const res = await client.request({
      url: `${base}/${classPath}/${id}`,
      method: "GET",
    });
    return (res.data || null) as ClassResource | null;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}

/**
 * Ensure the Wallet class exists. Never overwrite an existing class so graphics
 * configured in Google Pay & Wallet Console are preserved.
 */
async function ensureClass(
  config: AppConfig,
  style: CreatePassInput["style"],
): Promise<{ created: boolean; classResource: ClassResource | null }> {
  const existing = await fetchClass(config, style);
  if (existing) {
    return { created: false, classResource: existing };
  }

  const client = await getAuthClient(config);
  const { classPath } = resourcePaths(style);
  const base = "https://walletobjects.googleapis.com/walletobjects/v1";
  const body = buildGenericClass(config, style);
  const res = await client.request({
    url: `${base}/${classPath}`,
    method: "POST",
    data: body,
  });
  return {
    created: true,
    classResource: (res.data as ClassResource) || (body as ClassResource),
  };
}

async function upsertObject(
  config: AppConfig,
  stored: StoredPass,
  classResource: ClassResource | null,
): Promise<string> {
  const client = await getAuthClient(config);
  const { objectPath } = resourcePaths(stored.input.style);
  const obj = buildObject(config, stored, classResource) as Record<string, unknown>;
  const base = "https://walletobjects.googleapis.com/walletobjects/v1";
  const id = String(obj.id);

  try {
    await client.request({
      url: `${base}/${objectPath}/${id}`,
      method: "PUT",
      data: obj,
    });
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      await client.request({
        url: `${base}/${objectPath}`,
        method: "POST",
        data: obj,
      });
    } else {
      // If PUT failed for another reason, try insert
      try {
        await client.request({
          url: `${base}/${objectPath}`,
          method: "POST",
          data: obj,
        });
      } catch {
        throw err;
      }
    }
  }
  return id;
}

export async function createGoogleSaveUrl(
  config: AppConfig,
  stored: StoredPass,
): Promise<string> {
  const status = googleStatus(config);
  if (!status.configured) {
    throw new Error(`Google Wallet is not configured. Missing: ${status.missing.join(", ")}`);
  }

  let classCreated = false;
  let classResource: ClassResource | null = null;

  // Prefer signed JWT "Save to Wallet" links — works without pre-creating via REST
  // when the class already exists. We still try to ensure class+object via API.
  try {
    const ensured = await ensureClass(config, stored.input.style);
    classCreated = ensured.created;
    classResource = ensured.classResource;
    await upsertObject(config, stored, classResource);
  } catch (err) {
    // Fall through to JWT-only claim if REST upsert fails (e.g. permissions pending)
    console.warn("Google Wallet REST upsert warning:", (err as Error).message);
    try {
      classResource = await fetchClass(config, stored.input.style);
    } catch {
      classResource = null;
    }
  }

  const sa = parseServiceAccount(config);
  const { classKey, objectKey } = resourcePaths(stored.input.style);
  const objectPayload = buildObject(config, stored, classResource) as Record<
    string,
    unknown
  >;

  // Important: when the class already exists (e.g. graphics set in Wallet Console),
  // do NOT re-send a bare class definition in the JWT — that would strip branding.
  // Only include the class payload when we just created it (or it is still missing).
  const payload: Record<string, unknown[]> = {
    [objectKey]: [objectPayload],
  };
  if (classCreated || !classResource) {
    payload[classKey] = [classResource || buildGenericClass(config, stored.input.style)];
  }

  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    origins: [config.publicBaseUrl],
    payload,
  };

  const key = await importPKCS8(sa.private_key, "RS256");
  const token = await new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(key);

  const heroUri = imageUri(objectPayload.heroImage as WalletImage | undefined);
  if (heroUri) {
    console.info(`Google Wallet pass ${stored.serialNumber}: heroImage=${heroUri}`);
  } else if (classResource) {
    console.info(
      `Google Wallet pass ${stored.serialNumber}: using existing class branding (${classResource.id})`,
    );
  }

  return `https://pay.google.com/gp/v/save/${token}`;
}

/** Demo JWT-less placeholder when Google is not configured. */
export function demoGoogleInstructions(stored: StoredPass): {
  message: string;
  objectPreview: unknown;
} {
  return {
    message:
      "Configure GOOGLE_ISSUER_ID and a Google Wallet service account to enable Save to Wallet links.",
    objectPreview: {
      serialNumber: stored.serialNumber,
      style: stored.input.style,
      organizationName: stored.input.organizationName,
      description: stored.input.description,
    },
  };
}
