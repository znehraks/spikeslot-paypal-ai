import { z } from "zod";
import { body, owner, response } from "@/core/http";
import { getDb } from "@/core/db";
import {
  getRun,
  updateBrief,
  replayRun,
  claimAiCall,
  saveAnalysis,
  createPlan,
} from "@/core/repository";
import { AppError, briefSchema, siteIdSchema } from "@/core/model";
import { analyze, generateCreative } from "@/core/ai";
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
    if (action === "brief")
      return updateBrief(db, id, who, briefSchema.parse(input));
    if (action === "replay") {
      z.object({}).strict().parse(input);
      return replayRun(db, id, who);
    }
    if (action === "analyze") {
      z.object({}).strict().parse(input);
      const run = await getRun(db, id, who);
      await claimAiCall(db, id, who);
      const { value, model } = await analyze(run);
      return saveAnalysis(db, run, value, model);
    }
    if (action === "generate") {
      const { siteId } = z
          .object({ siteId: siteIdSchema })
          .strict()
          .parse(input),
        run = await getRun(db, id, who);
      await claimAiCall(db, id, who);
      return createPlan(db, run, siteId, await generateCreative(run, siteId));
    }
    throw new AppError("not_found", "Unknown campaign action.", 404);
  });
}
