import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(64),
  value: z.string().min(1).max(256),
});

export const createPassSchema = z.object({
  organizationName: z.string().min(1).max(120),
  description: z.string().min(1).max(200),
  style: z.enum(["generic", "coupon", "eventTicket", "storeCard", "boardingPass"]),
  // Apple Wallet is temporarily unavailable — only Google passes can be created.
  platforms: z
    .enum(["apple", "google", "both"])
    .default("google")
    .transform(() => "google" as const),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  labelColor: z.string().optional(),
  logoText: z.string().max(40).optional(),
  headerFields: z.array(fieldSchema).max(6).optional(),
  primaryFields: z.array(fieldSchema).max(4).optional(),
  secondaryFields: z.array(fieldSchema).max(6).optional(),
  auxiliaryFields: z.array(fieldSchema).max(6).optional(),
  backFields: z.array(fieldSchema).max(10).optional(),
  barcodeMessage: z.string().max(256).optional(),
  barcodeFormat: z.enum(["QR", "PDF417", "Aztec", "Code128"]).optional(),
  relevantDate: z.string().optional(),
  transitType: z
    .enum([
      "PKTransitTypeAir",
      "PKTransitTypeTrain",
      "PKTransitTypeBus",
      "PKTransitTypeBoat",
      "PKTransitTypeGeneric",
    ])
    .optional(),
  discount: z.string().max(64).optional(),
  venue: z.string().max(120).optional(),
  eventName: z.string().max(120).optional(),
  balance: z.string().max(64).optional(),
  serialPrefix: z.string().max(12).optional(),
  recipientPhone: z.string().min(9).max(20).optional(),
  /** When true (default if recipientPhone set), send SMS with the public pass page link. */
  sendSms: z.boolean().optional(),
});

export type CreatePassBody = z.infer<typeof createPassSchema>;
