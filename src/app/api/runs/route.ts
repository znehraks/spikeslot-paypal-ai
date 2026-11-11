import { z } from "zod";
import { body, owner, response } from "@/core/http";
import { getDb } from "@/core/db";
import { createRun } from "@/core/repository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return response(async () => {
    z.object({})
      .strict()
      .parse(await body(request));
    return createRun(await getDb(), await owner(true));
  });
}
