import { it, expect } from "vitest";
import { validateAnalysis, validateCreative } from "./ai";
import { defaultBrief, type Run } from "./model";
import { publishers } from "./sites";
import { replayTraffic } from "./spike/replay";
const recommendations = publishers.map((s) => ({
  siteId: s.id,
  decision: s.id === "pet-names" ? ("skip" as const) : ("recommend" as const),
  reason: "A completed image can be printed; text-only names cannot.",
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
it("requires measured traffic and validates three grounded publishers", () => {
  expect(() =>
    validateAnalysis({ ...run, traffic: null }, { recommendations }),
  ).toThrow("Replay");
  expect(
    validateAnalysis(run, { recommendations }).recommendations[2].decision,
  ).toBe("skip");
});
it.each(["duplicate", "unsupported evidence", "wrong placement"])(
  "rejects %s",
  (fault) => {
    const copy = structuredClone(recommendations);
    if (fault === "duplicate") copy[2] = copy[0];
    if (fault === "unsupported evidence")
      copy[0].evidence = "Users buy three times more often.";
    if (fault === "wrong placement")
      copy[0].placement = "Cover the download button";
    expect(() => validateAnalysis(run, { recommendations: copy })).toThrow(
      "Evidence or placement",
    );
  },
);
it("refuses creative for skipped publishers and nonexistent benefits", () => {
  const analyzed = { ...run, analysis: { recommendations } };
  const creative = {
    headline: "Make room for royalty",
    description: "Keep a pet portrait in a wooden frame.",
    cta: "Explore",
    benefitIndex: 0,
  };
  expect(() => validateCreative(analyzed, "pet-names", creative)).toThrow(
    "recommended",
  );
  expect(() =>
    validateCreative(analyzed, "royal-pets", { ...creative, benefitIndex: 4 }),
  ).toThrow("benefit");
  expect(validateCreative(analyzed, "royal-pets", creative)).toEqual(creative);
});
it("rejects extra model-owned payment fields and malformed output", () => {
  expect(() =>
    validateAnalysis(run, { recommendations, priceCents: 1 }),
  ).toThrow();
  expect(() =>
    validateCreative({ ...run, analysis: { recommendations } }, "royal-pets", {
      headline: "Hello",
    }),
  ).toThrow();
});
