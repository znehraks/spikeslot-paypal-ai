import { owner, response } from "@/core/http";
import { getDb } from "@/core/db";
import { getPlan, stats } from "@/core/repository";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => {
    const { id } = await params,
      db = await getDb();
    return {
      plan: await getPlan(db, id, await owner()),
      stats: await stats(db, id),
    };
  });
}
