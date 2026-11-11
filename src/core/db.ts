import { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
export type QueryDb = Pick<PGlite,"query">;
const schema = `
CREATE TABLE IF NOT EXISTS demo_runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 0, ai_calls INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS run_owner ON demo_runs(owner);
CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES demo_runs(id), data JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS paypal_order_unique ON plans((data->>'orderId')) WHERE data->>'orderId' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS paypal_capture_unique ON plans((data->>'captureId')) WHERE data->>'captureId' IS NOT NULL;
CREATE TABLE IF NOT EXISTS impressions (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id), issued_at BIGINT NOT NULL, viewed_at BIGINT, clicked_at BIGINT);
CREATE INDEX IF NOT EXISTS impression_plan ON impressions(plan_id);
`;
export async function initDatabase(db:PGlite){await db.exec(schema);return db;}
const globalDb=globalThis as unknown as {spikeDb?:Promise<PGlite>};
export function getDb():Promise<PGlite>{
  if(!globalDb.spikeDb) globalDb.spikeDb=(async()=>{const path=resolve(process.env.PGLITE_DIR||"./data/pglite");await mkdir(path,{recursive:true});return initDatabase(new PGlite(path));})();
  return globalDb.spikeDb;
}
