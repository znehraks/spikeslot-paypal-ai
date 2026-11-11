import { notFound } from "next/navigation";
import { owner } from "@/core/http";
import { getDb } from "@/core/db";
import { getPlan, stats } from "@/core/repository";
import { AppError, type Plan } from "@/core/model";
import { Studio } from "@/components/studio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  let plan: Plan, counts: { views: number; clicks: number };
  try {
    const { id } = await params,
      db = await getDb();
    plan = await getPlan(db, id, await owner());
    counts = await stats(db, id);
  } catch (e) {
    if (e instanceof AppError && [401, 404].includes(e.status)) notFound();
    throw e;
  }
  return (
    <Studio
      initial={plan}
      initialStats={counts}
      payment={(await searchParams).payment}
    />
  );
}
