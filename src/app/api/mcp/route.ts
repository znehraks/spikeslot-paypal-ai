import { getDb } from "@/core/db";
import { handleMcp } from "@/core/mcp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleMcp(request, await getDb());
}
export const GET = POST;
export const DELETE = POST;
