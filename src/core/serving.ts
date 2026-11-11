import { randomUUID } from "node:crypto";
import type { QueryDb } from "./db";
import { getPlan } from "./repository";
import { AppError, effectiveStatus, type SiteId } from "./model";

export async function issueImpression(db:QueryDb,id:string,siteId:SiteId,owner:string,now=Date.now()){
  const plan=await getPlan(db,id,owner);
  if(plan.siteId!==siteId)throw new AppError("wrong_site","This placement belongs to another publisher.",404);
  if(effectiveStatus(plan,now)!=="active")return null;
  const impressionId=randomUUID();
  await db.query("INSERT INTO impressions(id,plan_id,issued_at) VALUES($1,$2,$3)",[impressionId,plan.id,now]);
  return {plan,impressionId};
}
export async function recordEvent(db:QueryDb,id:string,impressionId:string,owner:string,kind:"view"|"click",now=Date.now()){
  const plan=await getPlan(db,id,owner);
  if(effectiveStatus(plan,now)!=="active")throw new AppError("ended","This sponsorship is no longer active.",410);
  const column=kind==="view"?"viewed_at":"clicked_at";
  const q=await db.query(`UPDATE impressions SET ${column}=$1 WHERE id=$2 AND plan_id=$3 AND ${column} IS NULL AND issued_at <= $4 RETURNING id`,[now,impressionId,id,now-(kind==="view"?1000:0)]);
  return {recorded:q.rows.length>0};
}
