import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { analyze, generateCreative } from "./ai";
import { defaultBrief, type Run } from "./model";
import { publishers } from "./sites";
import { replayTraffic } from "./spike/replay";
const recommendations = publishers.map((s) => ({
  siteId: s.id,
  decision: s.id === "pet-names" ? ("skip" as const) : ("recommend" as const),
  reason: "This visitor has a completed image to print.",
  evidence: s.flow,
  placement: s.placement,
}));
const run: Run = {
  id: "test",
  version: 0,
  createdAt: 0,
  brief: defaultBrief,
  traffic: replayTraffic(),
  analysis: null,
  model: null,
};
function reply(value: unknown, status = "completed") {
  return new Response(
    JSON.stringify({
      status,
      model: "test-model",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(value) }],
        },
      ],
    }),
  );
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.stubEnv("OPENAI_MODEL", "test-model");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("requires real configuration and never substitutes a fixture", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(analyze(run)).rejects.toMatchObject({ code: "ai_setup" });
  expect(fetch).not.toHaveBeenCalled();
});
it("validates grounded evidence for all three distinct publishers", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    reply({ recommendations }),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await analyze(run);
  expect(result.value.recommendations[2].decision).toBe("skip");
  const input = JSON.parse(fetch.mock.calls[0][1]!.body as string);
  expect(input.store).toBe(false);
  expect(input.text.format.strict).toBe(true);
  expect(input.input).toContain("simulated");
});
it.each(["duplicate", "unsupported evidence", "wrong placement"])(
  "rejects %s",
  async (fault) => {
    const copy = structuredClone(recommendations);
    if (fault === "duplicate") copy[2] = copy[0];
    if (fault === "unsupported evidence")
      copy[0].evidence = "These users buy three times more often.";
    if (fault === "wrong placement")
      copy[0].placement = "Cover the download button";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ recommendations: copy })),
    );
    await expect(analyze(run)).rejects.toMatchObject({ code: "ai_grounding" });
  },
);
it("refuses generation for an excluded publisher", async () => {
  vi.stubGlobal("fetch", vi.fn());
  await expect(
    generateCreative({ ...run, analysis: { recommendations } }, "pet-names"),
  ).rejects.toMatchObject({ code: "not_recommended" });
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects a benefit not supplied by the advertiser", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      reply({
        headline: "A portrait to keep",
        description: "Put it in a wooden frame.",
        cta: "Explore",
        benefitIndex: 4,
      }),
    ),
  );
  await expect(
    generateCreative({ ...run, analysis: { recommendations } }, "royal-pets"),
  ).rejects.toMatchObject({ code: "invalid_benefit" });
});
it("shows incomplete, malformed and unavailable provider results as errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply({}, "incomplete")),
  );
  await expect(analyze(run)).rejects.toMatchObject({ code: "ai_incomplete" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply({ unrelated: true })),
  );
  await expect(analyze(run)).rejects.toMatchObject({ code: "ai_invalid" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 429 })),
  );
  await expect(analyze(run)).rejects.toMatchObject({ code: "ai_unavailable" });
});
