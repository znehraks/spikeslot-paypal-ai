import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { initDatabase } from "./db";
import {
  createRun,
  replayRun,
  updateBrief,
  getPlan,
  listPlans,
} from "./repository";
import {
  connectAgent,
  disconnectAgent,
  authenticateAgent,
  handleMcp,
} from "./mcp";
import { defaultBrief, type Run } from "./model";
import { publishers } from "./sites";
let db: PGlite, owner: string, run: Run, token: string;
const origin = "http://localhost:3610";
const recommendations = publishers.map((s) => ({
  siteId: s.id,
  decision: s.id === "pet-names" ? "skip" : "recommend",
  reason: "The visitor has a finished image, except at the name finder.",
  evidence: s.flow,
  placement: s.placement,
}));
const creative = {
  headline: "Make room for royalty",
  description: "Turn a pet portrait into a wooden-framed keepsake.",
  cta: "Explore PetFrame",
  benefitIndex: 0,
};
beforeAll(async () => {
  db = await initDatabase(new PGlite());
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  vi.stubEnv("APP_URL", origin);
  owner = crypto.randomUUID();
  run = await createRun(db, owner);
  run = await replayRun(db, run.id, owner);
  token = (await connectAgent(db, run.id, owner)).token;
});
async function client(key = token) {
  const c = new Client({ name: "protocol-test", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${origin}/api/mcp`),
    {
      requestInit: { headers: { Authorization: `Bearer ${key}` } },
      fetch: async (url, init) => {
        const request = new Request(url, init);
        request.headers.set("host", "localhost:3610");
        return handleMcp(request, db);
      },
    },
  );
  await c.connect(transport);
  return c;
}
async function call(
  c: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = await c.callTool({ name, arguments: args });
  const blocks = result.content as { type: string; text: string }[];
  return {
    isError: result.isError,
    text: blocks[0].text,
    value: result.isError ? null : JSON.parse(blocks[0].text),
  };
}
it("stores only token hashes, scopes access, and invalidates rotated, revoked and expired keys", async () => {
  const saved = await db.query<{ token_hash: string }>(
    "SELECT token_hash FROM mcp_connections WHERE run_id=$1",
    [run.id],
  );
  expect(saved.rows[0].token_hash).not.toContain(token);
  await expect(connectAgent(db, run.id, "other-owner")).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    disconnectAgent(db, run.id, "other-owner"),
  ).rejects.toMatchObject({ status: 404 });
  expect((await authenticateAgent(db, token)).run_id).toBe(run.id);
  const rotated = await connectAgent(db, run.id, owner);
  await expect(authenticateAgent(db, token)).rejects.toMatchObject({
    status: 401,
  });
  await disconnectAgent(db, run.id, owner);
  await expect(authenticateAgent(db, rotated.token)).rejects.toMatchObject({
    status: 401,
  });
  const expired = await connectAgent(db, run.id, owner);
  await db.query("UPDATE mcp_connections SET expires_at=0 WHERE run_id=$1", [
    run.id,
  ]);
  await expect(authenticateAgent(db, expired.token)).rejects.toMatchObject({
    status: 401,
  });
});
it("performs real MCP initialization, discovery and draft round-trip without payment authority", async () => {
  const c = await client();
  try {
    expect((await c.listTools()).tools.map((t) => t.name)).toEqual([
      "get_campaign",
      "save_recommendations",
      "create_draft",
    ]);
    const context = await call(c, "get_campaign");
    expect(context.value.run.id).toBe(run.id);
    expect(context.value.publishers).toHaveLength(3);
    expect((await call(c, "get_campaign", { runId: "other" })).isError).toBe(
      true,
    );
    const analyzed = await call(c, "save_recommendations", {
      version: run.version,
      source: "Test client",
      analysis: { recommendations },
    });
    expect(analyzed.isError).toBeFalsy();
    const args = {
      version: analyzed.value.version,
      requestId: crypto.randomUUID(),
      siteId: "royal-pets",
      creative,
    };
    const draft = await call(c, "create_draft", args);
    expect(draft.isError).toBeFalsy();
    expect(draft.value.status).toBe("draft");
    expect((await getPlan(db, draft.value.id, owner)).orderId).toBeNull();
    expect((await call(c, "create_draft", args)).value.id).toBe(draft.value.id);
    expect(await listPlans(db, run.id, owner)).toHaveLength(1);
    expect(
      (
        await call(c, "create_draft", {
          ...args,
          creative: { ...creative, headline: "Different" },
        })
      ).text,
    ).toContain("request_conflict");
    expect(
      (await call(c, "create_draft", { ...args, priceCents: 1 })).isError,
    ).toBe(true);
    expect(
      (
        await call(c, "create_draft", {
          ...args,
          requestId: crypto.randomUUID(),
          siteId: "pet-names",
        })
      ).text,
    ).toContain("not_recommended");
    expect(
      (
        await call(c, "create_draft", {
          ...args,
          requestId: crypto.randomUUID(),
          creative: { ...creative, benefitIndex: 4 },
        })
      ).text,
    ).toContain("invalid_benefit");
    expect((await call(c, "checkout")).isError).toBe(true);
  } finally {
    await c.close();
  }
});
it("rejects stale output and rechecks revocation on an existing client", async () => {
  const c = await client();
  try {
    await updateBrief(db, run.id, owner, {
      ...defaultBrief,
      brand: "Changed brand",
    });
    const stale = await call(c, "save_recommendations", {
      version: run.version,
      source: "Test",
      analysis: { recommendations },
    });
    expect(stale.text).toContain("changed");
    await disconnectAgent(db, run.id, owner);
    await expect(c.listTools()).rejects.toThrow();
  } finally {
    await c.close();
  }
});
it("rejects foreign origins, DNS rebinding, missing keys and oversized protocol bodies", async () => {
  const send = (headers: Record<string, string>, data = "{}") =>
    handleMcp(
      new Request(`${origin}/api/mcp`, {
        method: "POST",
        headers: {
          host: "localhost:3610",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...headers,
        },
        body: data,
      }),
      db,
    );
  expect((await send({ origin: "https://evil.example" })).status).toBe(403);
  expect((await send({ host: "evil.example" })).status).toBe(403);
  expect((await send({ Authorization: "" })).status).toBe(401);
  expect(
    (await send({}, JSON.stringify({ value: "x".repeat(20000) }))).status,
  ).toBe(413);
});
