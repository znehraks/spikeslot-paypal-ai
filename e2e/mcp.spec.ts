import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const origin = process.env.E2E_BASE_URL || "http://localhost:3610";
test("MCP HTTP results reach the browser API, with revocation and no cookie/payment authority", async ({
  request,
  playwright,
}) => {
  const created = await request.post("/api/runs", {
    headers: { origin },
    data: {},
  });
  const run = await created.json();
  await request.post(`/api/runs/${run.id}/replay`, {
    headers: { origin },
    data: {},
  });
  const connected = await request.post(`/api/runs/${run.id}/connect`, {
    headers: { origin },
    data: {},
  });
  expect(connected.status()).toBe(200);
  const { token, url } = await connected.json();
  expect(connected.headers()["cache-control"]).toBe("no-store");
  const stranger = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  const c = new Client({ name: "http-integration-test", version: "1.0" });
  try {
    expect((await stranger.get(`/api/runs/${run.id}`)).status()).toBe(401);
    expect(
      (
        await stranger.post(`/api/plans/anything/checkout`, {
          headers: { origin },
          data: { version: 0 },
        })
      ).status(),
    ).toBe(401);
    await c.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const value = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await c.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const context = await value("get_campaign");
    const analyzed = await value("save_recommendations", {
      version: context.run.version,
      source: "HTTP test fixture, no AI",
      analysis: {
        recommendations: context.publishers.map(
          (p: { id: string; flow: string; placement: string }) => ({
            siteId: p.id,
            decision: p.id === "pet-names" ? "skip" : "recommend",
            reason: "Test fixture: photo printing requires a finished image.",
            evidence: p.flow,
            placement: p.placement,
          }),
        ),
      },
    });
    const draft = await value("create_draft", {
      version: analyzed.version,
      requestId: crypto.randomUUID(),
      siteId: "royal-pets",
      creative: {
        headline: "HTTP test fixture — no AI",
        description: "Keep a portrait in a wooden frame.",
        cta: "Explore",
        benefitIndex: 0,
      },
    });
    const saved = await request.get(`/api/runs/${run.id}`);
    const state = await saved.json();
    expect(state.plans[0].id).toBe(draft.id);
    expect(state.plans[0].status).toBe("draft");
    expect(state.plans[0].orderId).toBeNull();
    expect(state.run.analysis.recommendations[2].decision).toBe("skip");
    await request.post(`/api/runs/${run.id}/disconnect`, {
      headers: { origin },
      data: {},
    });
    await expect(c.listTools()).rejects.toThrow();
  } finally {
    await c.close();
    await stranger.dispose();
  }
});
