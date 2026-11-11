import { describe, expect, it } from "vitest";
import type { SpikeReason, Stage } from "@/core/contracts";
import { SPIKE } from "./config";
import { detectStage, MINUTE_MS, type DetectorOutput, type MinutePoint } from "./detector";

const T0 = Date.parse("2026-10-30T03:00:00.000Z");
const minute = (i: number) => new Date(T0 + i * MINUTE_MS);
/** Evaluating at the start of minute i + 1 judges minute i (the last complete one). */
const judging = (i: number) => minute(i + 1);

interface Traffic {
  pageviews: number;
  botSuspect?: number;
  /** Distinct visitors; defaults to one per human pageview. */
  visitors?: number;
  sources?: Record<string, number>;
}

/** Typed constructor so branches with different source keys stay plain Traffic values. */
const tr = (pageviews: number, sources: Record<string, number>, botSuspect = 0, visitors?: number): Traffic => ({
  pageviews,
  botSuspect,
  sources,
  visitors,
});

/** One row per minute; a null minute has no row at all (ingestion down). */
function series(from: number, to: number, traffic: (i: number) => Traffic | null): MinutePoint[] {
  const points: MinutePoint[] = [];
  for (let i = from; i <= to; i++) {
    const t = traffic(i);
    if (!t) continue;
    const botSuspect = t.botSuspect ?? 0;
    points.push({
      minute: minute(i),
      pageviews: t.pageviews,
      botSuspect,
      visitors: t.visitors ?? t.pageviews - botSuspect,
      sources: t.sources ?? {},
    });
  }
  return points;
}

interface SiteState {
  stage: Stage;
  baselineRate: number;
  peakRate: number;
  stageChangedAt: Date | null;
  lastEvaluatedMinute: Date | null;
}

/**
 * Evaluates every minute in [from, to] and carries the state the way evaluateSite persists it. The
 * first stats minute is the oldest point, as evaluateSite reads it from the table.
 */
function replay(points: MinutePoint[], from: number, to: number, initial: Partial<SiteState> = {}) {
  let state: SiteState = { stage: "normal", baselineRate: 0, peakRate: 0, stageChangedAt: null, lastEvaluatedMinute: null, ...initial };
  const firstStatsMinute = points.reduce<Date | null>((min, p) => (!min || p.minute < min ? p.minute : min), null);
  const transitions: Array<{ minute: number; from: Stage; to: Stage; reason: SpikeReason }> = [];
  const outputs = new Map<number, DetectorOutput>();
  for (let i = from; i <= to; i++) {
    const now = judging(i);
    const out = detectStage({ ...state, now, points, firstStatsMinute });
    outputs.set(i, out);
    const moved = out.stage !== state.stage;
    if (moved) transitions.push({ minute: i, from: state.stage, to: out.stage, reason: out.reason });
    state = {
      stage: out.stage,
      baselineRate: out.baselineRate,
      peakRate: out.peakRate,
      stageChangedAt: moved ? now : state.stageChangedAt,
      lastEvaluatedMinute: out.evaluatedMinute,
    };
  }
  return { transitions, out: (i: number) => outputs.get(i)!, state };
}

// Normal 10/min for two hours, a 100/min wave for 30 minutes from minute 0, then a 20/min tail.
const VIRAL: (i: number) => Traffic = (i) =>
  i < 0
    ? tr(10, { direct: 6, kakaotalk: 4 })
    : i < 30
      ? tr(100, { kakaotalk: 60, instagram: 30, direct: 10 })
      : tr(20, { direct: 12, kakaotalk: 8 });

const VIRAL_PATH = [
  { minute: 11, from: "normal", to: "rising", reason: "surge_detected" },
  { minute: 21, from: "rising", to: "peak", reason: "growth_stalled" },
  { minute: 63, from: "peak", to: "decaying", reason: "cooled_down" },
  { minute: 123, from: "decaying", to: "normal", reason: "back_to_normal" },
];

describe("detectStage: a full spike", () => {
  const run = replay(series(-120, 200, VIRAL), -10, 200, { baselineRate: 10 });

  it("moves normal → rising → peak → decaying → normal at the expected minutes", () => {
    // rising: minute 11 is the 10th minute (from minute 2, rate 64) at ≥ 5 × baseline 10.
    // peak: minutes 12-21 are 10 in-stage minutes whose 5-minute average did not grow.
    // decaying: rate < 35 (0.35 × peak 100) from minute 34, 30 in-stage minutes → minute 63.
    // normal: rate 20 < MIN_RATE for 60 in-stage minutes from 64 → minute 123.
    expect(run.transitions).toEqual(VIRAL_PATH);
  });

  it("reports what the rising rule saw", () => {
    expect(run.out(10)).toMatchObject({ stage: "normal", reason: "few_surge_minutes" });
    expect(run.out(11).metrics).toMatchObject({
      minute: minute(11).toISOString(),
      rate: 100,
      visitorRate: 100,
      surgeMinutes: 10,
      sourceKinds: 3,
      botRatio: 0,
      peakRate: 100,
      topSources: [
        { source: "kakaotalk", pageviews: 732 },
        { source: "instagram", pageviews: 360 },
        { source: "direct", pageviews: 138 },
      ],
    });
    expect(run.out(11).peakRate).toBe(100);
  });

  it("keeps the baseline out of the wave and frozen until 15 minutes back in normal", () => {
    const atRise = run.out(11).baselineRate;
    expect(atRise).toBeCloseTo(10, 6); // the surge minutes were not folded in before rising
    for (let i = 12; i <= 138; i++) expect(run.out(i).baselineRate).toBe(atRise);
    expect(run.out(139).baselineRate).toBeCloseTo(atRise * 0.98 + 20 * 0.02, 6); // minute 124's rate
  });

  it("starts a new spike's peak from the rising window and keeps it", () => {
    expect(run.out(63).peakRate).toBe(100);
    expect(run.state).toMatchObject({ stage: "normal", peakRate: 100 });
  });
});

// 10/min before minute 0, a 300/min wave for 30 minutes, then a tail of 60/min: under 35% of the
// peak (decaying) but still above MIN_RATE and 5 × the old baseline.
const TAIL = (i: number): Traffic =>
  i < 0
    ? tr(10, { direct: 6, kakaotalk: 4 })
    : i < 30
      ? tr(300, { kakaotalk: 180, instagram: 90, direct: 30 })
      : tr(60, { kakaotalk: 30, instagram: 20, direct: 10 });
// The same, with a second 400/min wave on top of the tail from minute 150 to 179.
const SECOND_WAVE = (i: number): Traffic =>
  i >= 150 && i < 180 ? tr(400, { kakaotalk: 240, instagram: 120, direct: 40 }) : TAIL(i);
/** TAIL without stats rows for `length` minutes from `from` (a deploy, a restart, ingestion down). */
const TAIL_WITH_GAP =
  (from: number, length: number) =>
  (i: number): Traffic | null =>
    i >= from && i < from + length ? null : TAIL(i);

describe("detectStage: after decaying", () => {
  const spike = [
    { minute: 9, from: "normal", to: "rising", reason: "surge_detected" },
    { minute: 19, from: "rising", to: "peak", reason: "growth_stalled" },
    { minute: 63, from: "peak", to: "decaying", reason: "cooled_down" },
  ];

  it("keeps a busy tail in decaying: a new surge must rise 5× above the tail", () => {
    const run = replay(series(-120, 149, TAIL), -10, 149, { baselineRate: 10 });
    expect(run.transitions).toEqual(spike);
    // Against the old baseline (10) the tail would count as a surge from minute 64 on.
    expect(run.out(100)).toMatchObject({ stage: "decaying", reason: "still_elevated" });
    expect(run.out(100).metrics).toMatchObject({ rate: 60, baseline: 10, surgeBase: 60, surgeMinutes: 0 });
  });

  it("moves decaying → rising when a new wave starts on top of the tail", () => {
    const run = replay(series(-120, 170, SECOND_WAVE), -10, 170, { baselineRate: 10 });
    // Minute 153 is the first at ≥ 5 × 60 (5-minute average 332); the 10th such minute is 162.
    expect(run.transitions).toEqual([...spike, { minute: 162, from: "decaying", to: "rising", reason: "surge_detected" }]);
    expect(run.out(162).metrics).toMatchObject({ surgeBase: 60, surgeMinutes: 10, sourceKinds: 3 });
    // A new spike: its peak starts from the new wave, the baseline is still the pre-spike one.
    expect(run.out(162)).toMatchObject({ peakRate: 400, baselineRate: 10 });
  });

  it("needs enough distinct visitors to start a new spike from decaying too", () => {
    // The second wave comes from 4 clients: rate and sources qualify, visitors do not.
    const fewClients = (i: number): Traffic => {
      const t = SECOND_WAVE(i);
      return i >= 150 && i < 180 ? { ...t, visitors: 4 } : t;
    };
    const run = replay(series(-120, 175, fewClients), -10, 175, { baselineRate: 10 });
    expect(run.transitions).toEqual(spike);
    expect(run.out(170)).toMatchObject({ stage: "decaying", reason: "still_elevated" });
    expect(run.out(170).metrics.visitorRate).toBe(4);
  });

  it.each([5, 4])("ignores a %i-minute gap in the stats instead of starting a new spike on the tail", (length) => {
    const run = replay(series(-120, 200, TAIL_WITH_GAP(100, length)), -10, 200, { baselineRate: 10 });
    // Read as zero traffic, the gap made the tail's lowest rate 0 and the old baseline (10) the
    // reference again: a "new spike" at minute 118 or 117.
    expect(run.transitions).toEqual(spike);
    expect(run.out(115).metrics).toMatchObject({ surgeBase: 60 });
    expect(run.out(118)).toMatchObject({ stage: "decaying", reason: "still_elevated" });
  });

  it("falls back to every in-stage minute when none has a full 5-minute window of rows", () => {
    // Decaying since minute 100; minute 98 has no row, so minute 100's window is not fully measured.
    const out = detectStage({
      stage: "decaying",
      baselineRate: 10,
      peakRate: 300,
      stageChangedAt: minute(100),
      now: judging(100),
      points: series(-120, 100, (i) => (i === 98 ? null : TAIL(i))),
    });
    expect(out.metrics.surgeBase).toBe(48); // (4 × 60 + 0) ÷ 5, not the baseline 10
  });

  it(`moves decaying → normal after ${SPIKE.DECAYING_MAX_MINUTES} minutes and adopts the new level as baseline`, () => {
    const run = replay(series(-120, 520, TAIL), -10, 520, { baselineRate: 10 });
    // Decaying since the start of minute 64: 360 minutes have passed when minute 423 is judged.
    expect(run.transitions).toEqual([...spike, { minute: 423, from: "decaying", to: "normal", reason: "decay_timeout" }]);
    expect(run.out(422)).toMatchObject({ stage: "decaying", reason: "still_elevated" });
    expect(run.out(423).baselineRate).toBe(60);
    // The tail is the new normal: no rising right after, and the baseline holds.
    expect(run.state).toMatchObject({ stage: "normal" });
    expect(run.state.baselineRate).toBeCloseTo(60, 6);
    expect(run.out(520)).toMatchObject({ stage: "normal", reason: "few_surge_minutes" });
  });

  it("does not time out without a known stage start", () => {
    const out = detectStage({
      stage: "decaying",
      baselineRate: 10,
      peakRate: 300,
      stageChangedAt: null,
      now: judging(149),
      points: series(-120, 149, TAIL),
    });
    expect(out).toMatchObject({ stage: "decaying", reason: "still_elevated" });
  });
});

describe("detectStage: rising and peak have age limits", () => {
  it(`moves rising → peak after ${SPIKE.RISING_MAX_MINUTES} minutes when growth never stalls`, () => {
    // Traffic keeps growing by 2/min, so "last 5 minutes ≤ the 5 before" never holds.
    const ramp = (i: number): Traffic => (i < 0 ? tr(10, { direct: 6, kakaotalk: 4 }) : tr(100 + 2 * i, { kakaotalk: 60, instagram: 40 + 2 * i }));
    const run = replay(series(-120, 120, ramp), -10, 120, { baselineRate: 10 });
    const [rise, peak] = run.transitions;
    expect(rise).toMatchObject({ from: "normal", to: "rising", reason: "surge_detected" });
    expect(peak).toEqual({ minute: rise.minute + SPIKE.RISING_MAX_MINUTES, from: "rising", to: "peak", reason: "rising_timeout" });
    expect(run.out(rise.minute + SPIKE.RISING_MAX_MINUTES - 1)).toMatchObject({ stage: "rising", reason: "still_growing" });
  });

  it(`moves a plateau peak → decaying after ${SPIKE.PEAK_MAX_MINUTES} minutes, then makes the plateau the baseline`, () => {
    // 10/min, a 100/min wave, then 40/min for the rest of the day: 40% of the peak never cools down.
    const plateau = (i: number): Traffic =>
      i < 0
        ? tr(10, { direct: 6, kakaotalk: 4 })
        : i < 30
          ? tr(100, { kakaotalk: 60, instagram: 30, direct: 10 })
          : tr(40, { direct: 24, kakaotalk: 16 });
    const run = replay(series(-120, 800, plateau), -10, 800, { baselineRate: 10 });
    const peakAt = 21;
    const decayAt = peakAt + SPIKE.PEAK_MAX_MINUTES;
    expect(run.transitions).toEqual([
      VIRAL_PATH[0],
      VIRAL_PATH[1],
      { minute: decayAt, from: "peak", to: "decaying", reason: "peak_timeout" },
      // The tail is its own lowest rate, so it is no new spike; it never looks calm against the old
      // baseline, so the decaying cap ends it and adopts 40/min as the baseline.
      { minute: decayAt + SPIKE.DECAYING_MAX_MINUTES, from: "decaying", to: "normal", reason: "decay_timeout" },
    ]);
    expect(run.out(decayAt - 1)).toMatchObject({ stage: "peak", reason: "holding_peak" });
    expect(run.state).toMatchObject({ stage: "normal", baselineRate: 40 });
  });
});

describe("detectStage: surges that must not count", () => {
  it("ignores 2 → 20 per minute: 10× the baseline but under MIN_RATE", () => {
    const growth = series(-120, 60, (i) =>
      i < 0 ? tr(2, { direct: 1, kakaotalk: 1 }) : tr(20, { direct: 8, kakaotalk: 6, instagram: 6 }),
    );
    const run = replay(growth, 0, 60, { baselineRate: 2 });
    expect(run.transitions).toEqual([]);
    expect(run.out(20)).toMatchObject({ stage: "normal", reason: "below_min_rate" });
    expect(run.out(20).metrics.surgeMinutes).toBeGreaterThanOrEqual(SPIKE.RISE_MIN_MINUTES);
  });

  it("ignores a surge from a single source (internal navigation is not a source)", () => {
    const single = series(-120, 40, (i) =>
      i < 0 ? tr(10, { direct: 10 }) : tr(200, { direct: 150, internal: 50 }),
    );
    const run = replay(single, 0, 40, { baselineRate: 10 });
    expect(run.transitions).toEqual([]);
    expect(run.out(20)).toMatchObject({ stage: "normal", reason: "few_sources" });
    expect(run.out(20).metrics).toMatchObject({ rate: 200, sourceKinds: 1 });
    expect(run.out(20).metrics.topSources.map((s) => s.source)).toEqual(["direct"]);
  });

  it("ignores one client sending 40 pageviews a minute under two referrers", () => {
    // Every absolute and source rule passes against a baseline of 5; only one visitor is behind it.
    const oneClient = (visitors: number) => (i: number) =>
      i < 0 ? tr(5, { direct: 3, kakaotalk: 2 }) : tr(40, { "t.co": 20, "instagram.com": 20 }, 0, visitors);
    const run = replay(series(-120, 60, oneClient(1)), 0, 60, { baselineRate: 5 });
    expect(run.transitions).toEqual([]);
    // Minute 14: every other rule holds (rate 40 ≥ 30, 13 minutes at ≥ 5 × 5, two sources).
    expect(run.out(14)).toMatchObject({ stage: "normal", reason: "few_visitors" });
    expect(run.out(14).metrics).toMatchObject({ rate: 40, visitorRate: 1, sourceKinds: 2 });
    expect(run.out(14).metrics.surgeMinutes).toBeGreaterThanOrEqual(SPIKE.RISE_MIN_MINUTES);
    // The same pageviews from 40 people a minute are a spike.
    const crowd = replay(series(-120, 60, oneClient(40)), 0, 60, { baselineRate: 5 });
    expect(crowd.transitions[0]).toMatchObject({ to: "rising", reason: "surge_detected" });
  });

  it("still catches a real wave when bot pageviews are mixed in (bots are no veto)", () => {
    // 45 bot pv/min on top of VIRAL: a bot share of 0.31 in the wave and 0.82 before it, 0.354 over
    // minute 11's rising window (3 minutes before the wave, 12 in it). The old 0.3 gate vetoed this.
    const withBots = (i: number): Traffic => {
      const t = VIRAL(i);
      return { ...t, pageviews: t.pageviews + 45, botSuspect: 45 };
    };
    const run = replay(series(-120, 200, withBots), -10, 200, { baselineRate: 10 });
    expect(run.transitions).toEqual(VIRAL_PATH);
    expect(run.out(11).metrics).toMatchObject({ rate: 100, botRatio: 0.354 });
  });

  it("leaves bots out of the rate", () => {
    const botty = series(-120, 40, (i) =>
      i < 0 ? tr(10, { direct: 6, kakaotalk: 4 }) : tr(300, { kakaotalk: 100, instagram: 50 }, 150),
    );
    const run = replay(botty, 0, 40, { baselineRate: 10 });
    expect(run.out(9)).toMatchObject({ stage: "normal", reason: "few_surge_minutes" });
    expect(run.transitions[0]).toMatchObject({ minute: 10, to: "rising" });
    expect(run.out(20).metrics).toMatchObject({ rate: 150, botRatio: 0.5, sourceKinds: 2 });
  });

  it("rises once the same surge comes with a clean audience", () => {
    const clean = series(-120, 40, (i) =>
      i < 0 ? tr(10, { direct: 6, kakaotalk: 4 }) : tr(150, { kakaotalk: 100, instagram: 50 }),
    );
    // A 15× wave already reaches 5 × baseline in its second minute, so the 10th such minute is 10.
    expect(replay(clean, 0, 40, { baselineRate: 10 }).transitions[0]).toMatchObject({ minute: 10, to: "rising" });
  });
});

describe("detectStage: warm-up of a new site", () => {
  const STEADY_40 = (i: number): Traffic | null => (i < 0 ? null : tr(40, { direct: 20, "google.com": 20 }));

  it(`keeps a new site with steady traffic normal for ${SPIKE.WARMUP_MINUTES} minutes, then learns that traffic`, () => {
    // Installed at minute 0 with 40 pv/min: against the floor of 1 this read as a 40× surge.
    const run = replay(series(0, 480, STEADY_40), 0, 480, { baselineRate: 0 });
    expect(run.transitions).toEqual([]);
    for (const i of [0, 30, 59]) expect(run.out(i)).toMatchObject({ stage: "normal", reason: "warming_up", baselineRate: 0 });
    // Minute 60 ends the warm-up: the mean human rate of minutes 0-60 becomes the baseline.
    expect(run.out(60).baselineRate).toBe(40);
    expect(run.out(60)).toMatchObject({ stage: "normal", reason: "few_surge_minutes" });
    expect(run.state.baselineRate).toBeCloseTo(40, 6);
  });

  it("takes the mean of the observed minutes, bots left out", () => {
    const mixed = (i: number): Traffic | null => (i < 0 ? null : i < 31 ? tr(30, { direct: 30 }, 10) : tr(50, { direct: 50 }));
    const run = replay(series(0, 60, mixed), 0, 60, { baselineRate: 0 });
    expect(run.out(60).baselineRate).toBeCloseTo((31 * 20 + 30 * 50) / 61, 6);
  });

  it("misses a wave inside the warm-up (the decided trade-off) but not one after it", () => {
    const early = (i: number): Traffic | null =>
      i < 0 ? null : i >= 20 && i < 40 ? tr(150, { kakaotalk: 100, instagram: 50 }) : tr(5, { direct: 3, kakaotalk: 2 });
    expect(replay(series(0, 90, early), 0, 90, { baselineRate: 0 }).transitions).toEqual([]);
    const later = (i: number): Traffic | null =>
      i < 0 ? null : i >= 100 && i < 130 ? tr(150, { kakaotalk: 100, instagram: 50 }) : tr(5, { direct: 3, kakaotalk: 2 });
    const run = replay(series(0, 130, later), 0, 130, { baselineRate: 0 });
    expect(run.out(60).baselineRate).toBe(5);
    expect(run.transitions[0]).toMatchObject({ from: "normal", to: "rising", reason: "surge_detected" });
  });

  it("seeds the baseline once: later judgments fold as usual", () => {
    // About 0.5 pv/min for the first hour (seeded at the floor), then 20/min.
    const quiet = (i: number): Traffic | null =>
      i < 0 ? null : i <= 60 ? tr(i % 2 === 0 ? 1 : 0, { direct: i % 2 === 0 ? 1 : 0 }) : tr(20, { direct: 20 });
    const run = replay(series(0, 70, quiet), 0, 70, { baselineRate: 0 });
    expect(run.out(60).baselineRate).toBe(SPIKE.BASELINE_FLOOR);
    // A second seed at minute 70 would take the mean of minutes 0-70 (≈ 3.3); the fold uses minute 55.
    expect(run.out(70).baselineRate).toBe(SPIKE.BASELINE_FLOOR);
    expect(run.out(70).reason).toBe("below_min_rate");
  });

  it("seeds from the window on a first judgment after the warm-up, but never from an old site's history", () => {
    const steady = series(0, 90, STEADY_40);
    const base = { stage: "normal" as Stage, baselineRate: 0, peakRate: 0, stageChangedAt: null, points: steady, now: judging(90) };
    expect(detectStage({ ...base, firstStatsMinute: minute(0) }).baselineRate).toBe(40);
    // Stats that began before the window: not a new site, the usual fold from the floor.
    expect(detectStage({ ...base, firstStatsMinute: minute(-500) }).baselineRate).toBeCloseTo(1 * 0.98 + 40 * 0.02, 10);
  });

  it("does not hold back a site whose baseline is already learned", () => {
    // Stats begin at minute 0, but the stored baseline (10) is above the floor: no warm-up.
    const run = replay(series(0, 60, (i) => VIRAL(i - 20)), 0, 60, { baselineRate: 10 });
    for (const i of [0, 5, 19]) expect(run.out(i)).toMatchObject({ stage: "normal", reason: "below_min_rate" });
    // The minutes before the first row fold in as zero, so the baseline sits near 7.5 when the wave
    // comes: minute 21 (rate 46) is the first surge minute and minute 30 the 10th.
    expect(run.transitions[0]).toMatchObject({ minute: 30, to: "rising", reason: "surge_detected" });
  });
});

describe("detectStage: baseline", () => {
  const steady = series(-120, 10, () => tr(10, { direct: 10 }));
  const input = { stage: "normal" as Stage, baselineRate: 5, peakRate: 0, stageChangedAt: null, points: steady };

  it("folds one minute per judged minute while normal", () => {
    const first = detectStage({ ...input, now: judging(0) });
    expect(first.baselineRate).toBeCloseTo(5 * 0.98 + 10 * 0.02, 10);
    const sameMinute = detectStage({
      ...input,
      baselineRate: first.baselineRate,
      now: new Date(judging(0).getTime() + 30_000),
      lastEvaluatedMinute: first.evaluatedMinute,
    });
    expect(sameMinute.baselineRate).toBe(first.baselineRate);
    const nextMinute = detectStage({ ...input, baselineRate: first.baselineRate, now: judging(1), lastEvaluatedMinute: first.evaluatedMinute });
    expect(nextMinute.baselineRate).toBeCloseTo(first.baselineRate * 0.98 + 10 * 0.02, 10);
  });

  it("never moves outside normal", () => {
    for (const stage of ["rising", "peak", "decaying"] as const) {
      const out = detectStage({ ...input, stage, peakRate: 50, stageChangedAt: minute(-60), now: judging(0) });
      expect(out.baselineRate).toBe(5);
    }
  });

  it("does not learn from minutes before the current normal stage began", () => {
    // Back in normal 5 minutes ago: the minute that would be folded (15 back) predates it.
    const out = detectStage({ ...input, stageChangedAt: minute(-4), now: judging(0) });
    expect(out.baselineRate).toBe(5);
  });

  it("stays at the floor without traffic", () => {
    const out = detectStage({ ...input, baselineRate: 0, points: [], now: judging(0) });
    expect(out.baselineRate).toBe(SPIKE.BASELINE_FLOOR);
    expect(out.metrics.baseline).toBe(SPIKE.BASELINE_FLOOR);
  });
});

describe("detectStage: evaluation rules", () => {
  it("moves at most one stage per evaluation and needs fresh minutes for the next", () => {
    // Left in rising (stage time unknown) while a whole wave came and went: cooled down and calm.
    const gone = series(-120, 71, (i) => (i < 0 ? tr(100, { a: 50, b: 50 }) : tr(5, { a: 5 })));
    const base = { baselineRate: 10, peakRate: 100, points: gone };
    const first = detectStage({ ...base, stage: "rising", stageChangedAt: null, now: judging(70) });
    expect(first).toMatchObject({ stage: "decaying", reason: "cooled_down" });
    const next = detectStage({ ...base, stage: "decaying", stageChangedAt: judging(70), now: judging(71) });
    expect(next).toMatchObject({ stage: "decaying", reason: "still_elevated" });
    expect(next.metrics.calmMinutes).toBe(1);
  });

  it("judges only complete minutes and counts missing minutes as zero", () => {
    const points: MinutePoint[] = [
      { minute: minute(0), pageviews: 100, botSuspect: 0, visitors: 80, sources: {} },
      { minute: minute(1), pageviews: 1_000_000, botSuspect: 0, visitors: 1_000, sources: {} }, // still filling up
    ];
    const out = detectStage({
      stage: "normal",
      baselineRate: 1,
      peakRate: 0,
      stageChangedAt: null,
      now: new Date(minute(1).getTime() + 30_000),
      points,
    });
    expect(out.evaluatedMinute).toEqual(minute(0));
    expect(out.metrics).toMatchObject({ rate: 20, visitorRate: 16 });
  });

  it("treats junk counts as zero and caps bots at the pageviews and visitors at the human ones", () => {
    const points: MinutePoint[] = [
      { minute: minute(0), pageviews: Number.NaN, botSuspect: -3, visitors: Number.NaN, sources: { a: Number.NaN } },
      { minute: minute(-1), pageviews: 10, botSuspect: 50, visitors: 10, sources: null },
      { minute: minute(-2), pageviews: 10, botSuspect: 5, visitors: 99, sources: null },
      { minute: new Date(Number.NaN), pageviews: 10, botSuspect: 0, visitors: 10, sources: {} },
    ];
    const out = detectStage({ stage: "normal", baselineRate: 1, peakRate: 0, stageChangedAt: null, now: judging(0), points });
    expect(out.metrics).toMatchObject({ rate: 1, visitorRate: 1, botRatio: 0.75, sourceKinds: 0, topSources: [] });
  });

  it("ignores a stage time later than now (a replay of older minutes)", () => {
    const wave = series(-120, 30, VIRAL);
    const out = detectStage({ stage: "normal", baselineRate: 10, peakRate: 0, stageChangedAt: minute(500), now: judging(11), points: wave });
    expect(out.stage).toBe("rising");
  });
});
