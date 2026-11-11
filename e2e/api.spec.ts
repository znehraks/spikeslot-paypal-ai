import { test, expect } from "@playwright/test";
const origin = process.env.E2E_BASE_URL || "http://localhost:3610";
test("HTTP campaign persists its edits and processes labeled traffic", async ({
  request,
}) => {
  const created = await request.post("/api/runs", {
    headers: { origin },
    data: {},
  });
  expect(created.status()).toBe(200);
  const cookie = created.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie.toLowerCase()).toContain("samesite=lax");
  const run = await created.json();
  const updated = await request.post(`/api/runs/${run.id}/brief`, {
    headers: { origin },
    data: { ...run.brief, brand: "API test — local only" },
  });
  expect(updated.status()).toBe(200);
  const replay = await request.post(`/api/runs/${run.id}/replay`, {
    headers: { origin },
    data: {},
  });
  expect(replay.status()).toBe(200);
  const state = await replay.json();
  expect(Object.keys(state.traffic)).toHaveLength(3);
  expect(state.traffic["royal-pets"].source).toBe("simulated");
  expect(state.traffic["royal-pets"].stage).toBe("rising");
  expect(state.analysis).toBeNull();
  const reloaded = await request.get(`/api/runs/${run.id}`);
  expect((await reloaded.json()).run.brief.brand).toBe("API test — local only");
});
test("a second signed session cannot access another campaign", async ({
  request,
  playwright,
}) => {
  const created = await request.post("/api/runs", {
    headers: { origin },
    data: {},
  });
  const run = await created.json();
  const stranger = await playwright.request.newContext({ baseURL: origin });
  try {
    await stranger.post("/api/runs", { headers: { origin }, data: {} });
    expect((await stranger.get(`/api/runs/${run.id}`)).status()).toBe(404);
    expect(
      (
        await stranger.post(`/api/runs/${run.id}/replay`, {
          headers: { origin },
          data: {},
        })
      ).status(),
    ).toBe(404);
  } finally {
    await stranger.dispose();
  }
});
test("mutations reject foreign origins and oversized bodies", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/runs", {
        headers: { origin: "https://foreign.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/runs", {
        headers: { origin, "Content-Type": "application/json" },
        data: '{"extra":"' + "x".repeat(17000) + '"}',
      })
    ).status(),
  ).toBe(413);
});
test("invalid destinations and client-owned payment amounts are rejected", async ({
  request,
}) => {
  const created = await request.post("/api/runs", {
    headers: { origin },
    data: {},
  });
  const run = await created.json();
  expect(
    (
      await request.post(`/api/runs/${run.id}/brief`, {
        headers: { origin },
        data: { ...run.brief, destination: "javascript:alert(1)" },
      })
    ).status(),
  ).toBe(400);
  const checkout = await request.post("/api/plans/nonexistent/checkout", {
    headers: { origin },
    data: { version: 0, priceCents: 1 },
  });
  expect(checkout.status()).toBe(400);
});
