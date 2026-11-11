import { z } from "zod";

export const PRICE_CENTS = 1000;
export const DURATION_MS = 30 * 60 * 1000;
export const siteIdSchema = z.enum(["royal-pets", "pet-collage", "pet-names"]);
export type SiteId = z.infer<typeof siteIdSchema>;
const short = (max: number) => z.string().trim().min(1).max(max);
export const briefSchema = z
  .object({
    brand: short(60),
    product: short(500),
    audience: short(500),
    benefits: z.array(short(160)).max(5),
    exclusions: z.string().trim().max(500),
    destination: z
      .string()
      .url()
      .max(1000)
      .refine((s) => {
        const u = new URL(s);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          !["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname)
        );
      }, "Use an HTTPS product URL."),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;
export const defaultBrief: Brief = {
  brand: "PetFrame",
  product:
    "Printed photo portraits in wooden frames. Customers upload their own finished pet image to order a physical keepsake.",
  audience:
    "People who have just made a pet portrait or photo collage and want to keep it beyond their screen.",
  benefits: ["First order: 10% off with code PET10"],
  exclusions:
    "Avoid medical advice and unrelated games. Never claim a predicted purchase rate.",
  destination: "https://example.com/petframe",
};
export const creativeSchema = z
  .object({
    headline: short(85),
    description: short(180),
    cta: short(28),
    benefitIndex: z.number().int().min(-1).max(4),
  })
  .strict();
export type Creative = z.infer<typeof creativeSchema>;
export const recommendationSchema = z
  .object({
    siteId: siteIdSchema,
    decision: z.enum(["recommend", "skip"]),
    reason: short(600),
    evidence: short(300),
    placement: short(200),
  })
  .strict();
export const analysisSchema = z
  .object({ recommendations: z.array(recommendationSchema).length(3) })
  .strict();
export type Analysis = z.infer<typeof analysisSchema>;
export interface Traffic {
  stage: string;
  rate: number;
  baseline: number;
  multiplier: number;
  points: number[];
  source: "simulated";
  reason: string;
}
export interface Run {
  id: string;
  version: number;
  brief: Brief;
  traffic: Record<SiteId, Traffic> | null;
  analysis: Analysis | null;
  model: string | null;
  createdAt: number;
}
export interface Plan {
  id: string;
  runId: string;
  siteId: SiteId;
  brief: Brief;
  creative: Creative;
  status: "draft" | "checkout" | "active";
  version: number;
  priceCents: number;
  durationMs: number;
  createRequestId: string;
  captureRequestId: string;
  orderId: string | null;
  approvalUrl: string | null;
  captureId: string | null;
  startedAt: number | null;
  endsAt: number | null;
  createdAt: number;
}
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function benefitFor(brief: Brief, creative: Creative): string | null {
  if (creative.benefitIndex === -1) return null;
  const benefit = brief.benefits[creative.benefitIndex];
  if (!benefit)
    throw new AppError(
      "invalid_benefit",
      "Select a benefit supplied by the advertiser.",
    );
  return benefit;
}
export function effectiveStatus(plan: Plan, now = Date.now()) {
  return plan.status === "active" && (plan.endsAt ?? 0) <= now
    ? "ended"
    : plan.status;
}
