import { notFound } from "next/navigation";
import { siteIdSchema } from "@/core/model";
import { Publisher } from "@/components/publisher";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const site = siteIdSchema.safeParse((await params).siteId);
  if (!site.success) notFound();
  return <Publisher siteId={site.data} planId={(await searchParams).plan} />;
}
