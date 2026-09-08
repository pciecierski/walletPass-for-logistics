export type PassStyle =
  | "generic"
  | "coupon"
  | "eventTicket"
  | "storeCard"
  | "boardingPass";

export type Platform = "apple" | "google" | "both";

export interface PassField {
  key: string;
  label: string;
  value: string;
}

export interface CreatePassInput {
  organizationName: string;
  description: string;
  style: PassStyle;
  platforms: Platform;
  foregroundColor?: string;
  backgroundColor?: string;
  labelColor?: string;
  logoText?: string;
  headerFields?: PassField[];
  primaryFields?: PassField[];
  secondaryFields?: PassField[];
  auxiliaryFields?: PassField[];
  backFields?: PassField[];
  barcodeMessage?: string;
  barcodeFormat?: "QR" | "PDF417" | "Aztec" | "Code128";
  relevantDate?: string;
  // boarding pass
  transitType?: "PKTransitTypeAir" | "PKTransitTypeTrain" | "PKTransitTypeBus" | "PKTransitTypeBoat" | "PKTransitTypeGeneric";
  // coupon
  discount?: string;
  // event
  venue?: string;
  eventName?: string;
  // store
  balance?: string;
  // recipient / metadata
  serialPrefix?: string;
  /** Recipient phone (E.164 or PL national). When set, pass page link is SMS'd. */
  recipientPhone?: string;
}

export type SmsProvider = "none" | "twilio" | "smsapi" | "log";

export interface SmsDeliveryResult {
  sent: boolean;
  provider: SmsProvider;
  to?: string;
  error?: string;
}

export interface StoredPass {
  id: string;
  serialNumber: string;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp — test passes expire exactly 7 days after creation. */
  expiresAt: string;
  input: CreatePassInput;
  appleReady: boolean;
  googleReady: boolean;
  googleSaveUrl?: string;
  appleDownloadPath: string;
  googleSavePath: string;
  statusPagePath: string;
}

export interface AppConfig {
  port: number;
  publicBaseUrl: string;
  dataDir: string;
  certsDir: string;
  storage: {
    /** True when DATA_DIR lives on an attached Railway volume (survives deploys). */
    persistent: boolean;
    volumeMountPath?: string;
    backend: "filesystem";
  };
  apple: {
    enabled: boolean;
    passTypeIdentifier?: string;
    teamIdentifier?: string;
    organizationName?: string;
    wwdrPath?: string;
    signerCertPath?: string;
    signerKeyPath?: string;
    signerKeyPassphrase?: string;
  };
  google: {
    enabled: boolean;
    issuerId?: string;
    serviceAccountEmail?: string;
    serviceAccountKey?: string;
    classSuffix?: string;
    /** Full class id (`issuerId.suffix`) or suffix only — overrides style-based class id. */
    classId?: string;
    /** HTTPS URL for Generic/object hero banner (or override). */
    heroImageUrl?: string;
    /** HTTPS URL for pass logo (or override). */
    logoImageUrl?: string;
  };
  sms: {
    provider: SmsProvider;
    messageTemplate?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    smsapiToken?: string;
    smsapiFrom?: string;
  };
}
