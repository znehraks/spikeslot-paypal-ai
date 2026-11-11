import { notFound } from "next/navigation";
import { owner } from "@/core/http";
import { getDb } from "@/core/db";
import { getRun, listPlans } from "@/core/repository";
import { AppError, type Run, type Plan } from "@/core/model";
import { Campaign } from "@/components/campaign";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let initial: Run, plans: Plan[];
  try {
    const { id } = await params,
      who = await owner(),
      db = await getDb();
    initial = await getRun(db, id, who);
    plans = await listPlans(db, id, who);
  } catch (e) {
    if (e instanceof AppError && [401, 404].includes(e.status)) notFound();
    throw e;
  }
  return <Campaign initial={initial} plans={plans} />;
}
