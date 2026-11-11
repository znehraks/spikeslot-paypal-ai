import { z } from "zod";
import { body, owner, response } from "@/core/http";
import { getDb } from "@/core/db";
import { updateBrief, replayRun } from "@/core/repository";
import { AppError, briefSchema } from "@/core/model";
import { connectAgent, disconnectAgent } from "@/core/mcp";
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
    z.object({}).strict().parse(input);
    if (action === "replay") return replayRun(db, id, who);
    if (action === "connect") return connectAgent(db, id, who);
    if (action === "disconnect") return disconnectAgent(db, id, who);
    throw new AppError(
      "not_found",
      "Unknown campaign action. Use your connected AI for recommendations and drafts.",
      404,
    );
  });
}
