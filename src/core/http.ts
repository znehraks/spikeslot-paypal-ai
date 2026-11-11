import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./model";
import { appOrigin } from "./paypal";
const cookieName = "spikeslot_session";
function signature(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-with"))
    throw new AppError(
      "session_setup",
      "Set a random SESSION_SECRET of at least 32 characters on the server.",
      503,
    );
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
export function signSession(id: string, expires: number) {
  const payload = `${id}.${expires}`;
  return `${payload}.${signature(payload)}`;
}
export function verifySession(
  token: string | undefined,
  now = Date.now(),
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    !/^[a-f0-9-]{36}$/.test(parts[0]) ||
    !/^\d+$/.test(parts[1]) ||
    Number(parts[1]) <= now
  )
    return null;
  const expected = Buffer.from(signature(`${parts[0]}.${parts[1]}`)),
    actual = Buffer.from(parts[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? parts[0]
    : null;
}
export async function owner(create = false) {
  const jar = await cookies(),
    existing = verifySession(jar.get(cookieName)?.value);
  if (existing) return existing;
  if (!create)
    throw new AppError(
      "session_missing",
      "Start a demo in this browser to continue.",
      401,
    );
  const id = randomUUID(),
    maxAge = 86400;
  jar.set(cookieName, signSession(id, Date.now() + maxAge * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: appOrigin().startsWith("https:"),
    maxAge,
    path: "/",
  });
  return id;
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new AppError(
      "origin",
      "This action must come from your SpikeSlot page.",
      403,
    );
}
export async function body(request: Request): Promise<unknown> {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("content_type", "Send a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("body", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new AppError("body_size", "This request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("json", "The request is not valid JSON.");
  }
}
export async function response(work: () => Promise<unknown>) {
  try {
    return NextResponse.json(await work(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join(" "),
          code: "validation",
        },
        { status: 400 },
      );
    if (e instanceof AppError)
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    // Provider responses, credentials and customer data never enter logs or errors.
    return NextResponse.json(
      {
        error:
          "The server could not finish this action. Your saved work is still available.",
        code: "server",
      },
      { status: 500 },
    );
  }
}
