import { owner, response } from "@/core/http";
import { getDb } from "@/core/db";
import { getRun, listPlans } from "@/core/repository";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => {
    const { id } = await params,
      who = await owner(),
      db = await getDb();
    return {
      run: await getRun(db, id, who),
      plans: await listPlans(db, id, who),
    };
  });
}
