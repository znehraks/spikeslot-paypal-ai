import { z } from "zod";
import { body, owner, response } from "@/core/http";
import { getDb } from "@/core/db";
import { getPlan, editPlan } from "@/core/repository";
import { beginCheckout, completeCheckout } from "@/core/payments";
import { issueImpression, recordEvent } from "@/core/serving";
import {
  AppError,
  creativeSchema,
  benefitFor,
  siteIdSchema,
} from "@/core/model";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  return response(async () => {
    const input = await body(request),
      { id, action } = await params,
      who = await owner(),
      db = await getDb();
    if (action === "edit") {
      const { creative, version } = z
        .object({ creative: creativeSchema, version: z.number().int().min(0) })
        .strict()
        .parse(input);
      benefitFor((await getPlan(db, id, who)).brief, creative);
      return editPlan(db, id, who, creative, version);
    }
    if (action === "checkout") {
      const { version } = z
        .object({ version: z.number().int().min(0) })
        .strict()
        .parse(input);
      return beginCheckout(db, id, who, version);
    }
    if (action === "capture") {
      z.object({}).strict().parse(input);
      return completeCheckout(db, id, who);
    }
    if (action === "slot") {
      const { siteId } = z
        .object({ siteId: siteIdSchema })
        .strict()
        .parse(input);
      return issueImpression(db, id, siteId, who);
    }
    if (action === "event") {
      const { impressionId, kind } = z
        .object({
          impressionId: z.string().uuid(),
          kind: z.enum(["view", "click"]),
        })
        .strict()
        .parse(input);
      return recordEvent(db, id, impressionId, who, kind);
    }
    throw new AppError("not_found", "Unknown sponsorship action.", 404);
  });
}
