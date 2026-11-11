import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { QueryDb } from "./db";
import {
  AppError,
  defaultBrief,
  PRICE_CENTS,
  DURATION_MS,
  type Run,
  type Plan,
  type Creative,
  type SiteId,
  type Brief,
  type Analysis,
} from "./model";
import { replayTraffic } from "./spike/replay";
export async function createRun(db: QueryDb, owner: string): Promise<Run> {
  const recent = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM demo_runs WHERE owner=$1 AND created_at>$2",
    [owner, Date.now() - 3600000],
  );
  if (recent.rows[0].count >= 12)
    throw new AppError(
      "run_limit",
      "You can start up to twelve demo runs per hour.",
      429,
    );
  const run: Run = {
    id: randomUUID(),
    version: 0,
    brief: defaultBrief,
    traffic: null,
    analysis: null,
    model: null,
    createdAt: Date.now(),
  };
  await db.query(
    "INSERT INTO demo_runs(id,owner,data,created_at) VALUES($1,$2,$3,$4)",
    [run.id, owner, JSON.stringify(run), run.createdAt],
  );
  return run;
}
export async function getRun(
  db: QueryDb,
  id: string,
  owner: string,
): Promise<Run> {
  const r = await db.query<{ data: Run; version: number }>(
    "SELECT data,version FROM demo_runs WHERE id=$1 AND owner=$2",
    [id, owner],
  );
  if (!r.rows[0])
    throw new AppError(
      "not_found",
      "This demo run is not available in your session.",
      404,
    );
  return { ...r.rows[0].data, version: r.rows[0].version };
}
async function saveRun(db: QueryDb, run: Run) {
  const q = await db.query(
    "UPDATE demo_runs SET data=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id",
    [JSON.stringify({ ...run, version: run.version + 1 }), run.id, run.version],
  );
  if (!q.rows.length)
    throw new AppError(
      "changed",
      "The brief changed. Refresh and try again.",
      409,
    );
  return { ...run, version: run.version + 1 };
}
export async function updateBrief(
  db: QueryDb,
  id: string,
  owner: string,
  brief: Brief,
) {
  const run = await getRun(db, id, owner);
  return saveRun(db, { ...run, brief, analysis: null, model: null });
}
export async function replayRun(db: QueryDb, id: string, owner: string) {
  const run = await getRun(db, id, owner);
  return saveRun(db, {
    ...run,
    traffic: replayTraffic(),
    analysis: null,
    model: null,
  });
}
export async function saveAnalysis(
  db: QueryDb,
  run: Run,
  analysis: Analysis,
  model: string,
) {
  return saveRun(db, { ...run, analysis, model });
}
export async function claimAiCall(db: QueryDb, id: string, owner: string) {
  const q = await db.query(
    "UPDATE demo_runs SET ai_calls=ai_calls+1 WHERE id=$1 AND owner=$2 AND ai_calls<8 RETURNING id",
    [id, owner],
  );
  if (!q.rows.length)
    throw new AppError(
      "ai_limit",
      "This demo run has reached its eight saved AI results. Start a new run.",
      429,
    );
}
export async function createPlan(
  db: QueryDb,
  run: Run,
  siteId: SiteId,
  creative: Creative,
): Promise<Plan> {
  const plan: Plan = {
    id: randomUUID(),
    runId: run.id,
    siteId,
    brief: run.brief,
    creative,
    status: "draft",
    version: 0,
    priceCents: PRICE_CENTS,
    durationMs: DURATION_MS,
    createRequestId: randomUUID(),
    captureRequestId: randomUUID(),
    orderId: null,
    approvalUrl: null,
    captureId: null,
    startedAt: null,
    endsAt: null,
    createdAt: Date.now(),
  };
  const inserted = await db.query(
    "INSERT INTO plans(id,run_id,data) SELECT $1,id,$2 FROM demo_runs WHERE id=$3 AND version=$4 RETURNING id",
    [plan.id, JSON.stringify(plan), run.id, run.version],
  );
  if (!inserted.rows.length)
    throw new AppError(
      "changed",
      "The brief changed while generating. Please try again.",
      409,
    );
  return plan;
}
export async function getPlan(
  db: QueryDb,
  id: string,
  owner: string,
): Promise<Plan> {
  const q = await db.query<{ data: Plan; version: number }>(
    "SELECT p.data,p.version FROM plans p JOIN demo_runs r ON r.id=p.run_id WHERE p.id=$1 AND r.owner=$2",
    [id, owner],
  );
  if (!q.rows[0])
    throw new AppError(
      "not_found",
      "This sponsorship is not available in your session.",
      404,
    );
  return { ...q.rows[0].data, version: q.rows[0].version };
}
export async function savePlan(db: QueryDb, plan: Plan) {
  const q = await db.query(
    "UPDATE plans SET data=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id",
    [
      JSON.stringify({ ...plan, version: plan.version + 1 }),
      plan.id,
      plan.version,
    ],
  );
  if (!q.rows.length)
    throw new AppError(
      "changed",
      "This sponsorship changed. Refresh and try again.",
      409,
    );
  return { ...plan, version: plan.version + 1 };
}
export async function editPlan(
  db: QueryDb,
  id: string,
  owner: string,
  creative: Creative,
  version: number,
) {
  const p = await getPlan(db, id, owner);
  if (p.status !== "draft" || p.version !== version)
    throw new AppError(
      "locked",
      "This creative has been approved or changed. Start a new draft to edit it.",
      409,
    );
  return savePlan(db, { ...p, creative });
}
export async function stats(db: QueryDb, id: string) {
  const q = await db.query<{ views: number; clicks: number }>(
    "SELECT count(viewed_at)::int AS views,count(clicked_at)::int AS clicks FROM impressions WHERE plan_id=$1",
    [id],
  );
  return q.rows[0];
}
export async function freezePlan(
  db: PGlite,
  id: string,
  owner: string,
  version: number,
) {
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM plans WHERE id=$1 FOR UPDATE", [id]);
    const p = await getPlan(tx, id, owner);
    if (p.status !== "draft") return p;
    if (p.version !== version)
      throw new AppError(
        "changed",
        "Review the latest creative before paying.",
        409,
      );
    return savePlan(tx, { ...p, status: "checkout" });
  });
}
export async function listPlans(db: QueryDb, runId: string, owner: string) {
  await getRun(db, runId, owner);
  const q = await db.query<{ data: Plan; version: number }>(
    "SELECT data,version FROM plans WHERE run_id=$1 ORDER BY (data->>'createdAt')::bigint DESC",
    [runId],
  );
  return q.rows.map((r) => ({ ...r.data, version: r.version }));
}
