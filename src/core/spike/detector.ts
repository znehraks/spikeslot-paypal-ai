import { STAGES, type SpikeMetrics, type SpikeReason, type Stage } from "@/core/contracts";
import { SPIKE } from "./config";

// Pure stage machine over one site's minute series (SPEC §7.4). Only complete minutes are judged:
// the minute that is still filling up would read as a drop. Every rule counts only minutes of the
// current stage (from stage_changed_at), so the same evidence never moves a site twice and each
// stage lasts at least as long as the rule that ends it needs.
//
// normal → rising → peak → decaying → normal, plus decaying → rising when a new surge starts on
// top of the tail. Each spike stage also ends by age whatever the rate (rising after
// RISING_MAX_MINUTES, peak after PEAK_MAX_MINUTES, decaying after DECAYING_MAX_MINUTES), so a
// plateau or a scripted trickle cannot hold a higher floor for ever. A site whose stats began less
// than WARMUP_MINUTES ago and whose baseline was never learned stays normal while it warms up.

export const MINUTE_MS = 60_000;

export interface MinutePoint {
  /** Start of the minute bucket. */
  minute: Date;
  pageviews: number;
  botSuspect: number;
  /** Distinct non-bot visitors within the minute (site_minute_stats.visitors). */
  visitors: number;
  /** Source → human pageviews within the minute; only the rising window's minutes are read. */
  sources: Record<string, number> | null;
}

export interface DetectorInput {
  stage: Stage;
  /** Stored baseline; may be under the floor (0 for a new site). */
  baselineRate: number;
  peakRate: number;
  stageChangedAt: Date | null;
  now: Date;
  /** Missing minutes count as zero; points outside the window are ignored. */
  points: MinutePoint[];
  /** Minute judged by the previous run; the baseline folds at most once per judged minute. */
  lastEvaluatedMinute?: Date | null;
  /** The site's oldest site_minute_stats minute, which starts the warm-up. Unknown: no warm-up. */
  firstStatsMinute?: Date | null;
}

export interface DetectorOutput {
  stage: Stage;
  baselineRate: number;
  peakRate: number;
  reason: SpikeReason;
  metrics: SpikeMetrics;
  /** The minute this run judged: the last complete minute before `now`. */
  evaluatedMinute: Date;
}

export function floorToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);
}

export function lastCompleteMinute(now: Date): Date {
  return new Date(floorToMinute(now).getTime() - MINUTE_MS);
}

/** First minute of the window ending at `evaluatedMinute`. */
export function windowStart(evaluatedMinute: Date): Date {
  return new Date(evaluatedMinute.getTime() - (SPIKE.WINDOW_MINUTES - 1) * MINUTE_MS);
}

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
const round = (value: number, digits = 2): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

export function detectStage(input: DetectorInput): DetectorOutput {
  const evaluatedMinute = lastCompleteMinute(input.now);
  const size = SPIKE.WINDOW_MINUTES;
  const last = size - 1;
  const startMs = windowStart(evaluatedMinute).getTime();
  const riseFrom = size - SPIKE.RISE_WINDOW_MINUTES;

  const pageviews = new Array<number>(size).fill(0);
  const bots = new Array<number>(size).fill(0);
  const visitors = new Array<number>(size).fill(0);
  const hasRow = new Array<boolean>(size).fill(false);
  const windowSources = new Map<string, number>();
  for (const point of input.points) {
    const i = Math.floor((point.minute.getTime() - startMs) / MINUTE_MS);
    if (!(i >= 0 && i < size)) continue; // also drops invalid dates (NaN)
    hasRow[i] = true;
    pageviews[i] += count(point.pageviews);
    bots[i] += count(point.botSuspect);
    visitors[i] += count(point.visitors);
    if (i < riseFrom || !point.sources) continue;
    for (const [source, n] of Object.entries(point.sources)) {
      if (SPIKE.NON_SOURCES.includes(source)) continue;
      windowSources.set(source, (windowSources.get(source) ?? 0) + count(n));
    }
  }

  // prefix[i] = human pageviews of minutes [0, i); minutes before the window count as zero.
  // rowsBefore[i] = minutes in [0, i) that have a stats row at all.
  const prefix = new Array<number>(size + 1).fill(0);
  const rowsBefore = new Array<number>(size + 1).fill(0);
  for (let i = 0; i < size; i++) {
    bots[i] = Math.min(bots[i], pageviews[i]);
    // A visitor is a client with at least one human pageview in the minute.
    visitors[i] = Math.min(visitors[i], pageviews[i] - bots[i]);
    prefix[i + 1] = prefix[i] + pageviews[i] - bots[i];
    rowsBefore[i + 1] = rowsBefore[i] + (hasRow[i] ? 1 : 0);
  }
  const rateAt = (i: number): number =>
    i < 0 ? 0 : (prefix[i + 1] - prefix[Math.max(0, i - SPIKE.RATE_MINUTES + 1)]) / SPIKE.RATE_MINUTES;
  /** Every minute of the 5-minute average at i has a stats row: a measured rate, not a zero-filled gap. */
  const measured = (i: number): boolean =>
    i >= SPIKE.RATE_MINUTES - 1 && rowsBefore[i + 1] - rowsBefore[i + 1 - SPIKE.RATE_MINUTES] === SPIKE.RATE_MINUTES;

  const current: Stage = (STAGES as readonly string[]).includes(input.stage) ? input.stage : "normal";
  const changedMs = input.stageChangedAt?.getTime();
  // A stage_changed_at after `now` (a replay of older minutes) tells nothing about this window.
  const stageStart =
    changedMs !== undefined && Number.isFinite(changedMs) && changedMs <= input.now.getTime()
      ? (floorToMinute(new Date(changedMs)).getTime() - startMs) / MINUTE_MS
      : -Infinity;
  const inStage = (i: number) => i >= stageStart;
  const streak = (holds: (i: number) => boolean): number => {
    let minutes = 0;
    for (let i = last; i >= 0 && inStage(i) && holds(i); i--) minutes++;
    return minutes;
  };

  const storedBaseline = count(input.baselineRate);
  // Warm-up (SPEC §7.4): a baseline still at the floor was never learned (a new site stores 0). While
  // the site's stats are younger than WARMUP_MINUTES it stays normal and the baseline does not fold;
  // otherwise its everyday traffic would read as a surge against the floor of 1.
  const unlearned = storedBaseline <= SPIKE.BASELINE_FLOOR;
  const firstMs = input.firstStatsMinute ? floorToMinute(input.firstStatsMinute).getTime() : Number.NaN;
  const warmupMs = SPIKE.WARMUP_MINUTES * MINUTE_MS;
  const observedMs = evaluatedMinute.getTime() - firstMs; // NaN when the first minute is unknown
  const warming = current === "normal" && unlearned && observedMs < warmupMs;
  // The judgment that ends the warm-up sets the baseline to the mean human rate of the minutes
  // observed so far (all of them must be in the window). It is the first judgment past the warm-up:
  // the previous one was still inside it, or there was none. Later ones fold as usual.
  const previousMs = input.lastEvaluatedMinute?.getTime();
  const previousPastWarmup = previousMs !== undefined && previousMs - firstMs >= warmupMs;
  const seedFrom = Math.max((firstMs - startMs) / MINUTE_MS, stageStart); // NaN without a first minute
  const seeding =
    current === "normal" &&
    unlearned &&
    observedMs >= warmupMs &&
    !previousPastWarmup &&
    seedFrom >= 0 &&
    seedFrom <= last;

  let baselineRate = storedBaseline;
  const alreadyFolded = input.lastEvaluatedMinute?.getTime() === evaluatedMinute.getTime();
  const foldIndex = last - SPIKE.BASELINE_LAG_MINUTES;
  if (seeding) {
    const observed = (prefix[last + 1] - prefix[seedFrom]) / (last - seedFrom + 1);
    baselineRate = Math.max(SPIKE.BASELINE_FLOOR, observed);
  } else if (current === "normal" && !warming && !alreadyFolded && inStage(foldIndex)) {
    const base = Math.max(storedBaseline, SPIKE.BASELINE_FLOOR);
    baselineRate = Math.max(
      SPIKE.BASELINE_FLOOR,
      base * (1 - SPIKE.BASELINE_WEIGHT) + rateAt(foldIndex) * SPIKE.BASELINE_WEIGHT,
    );
  }
  const baseline = Math.max(baselineRate, SPIKE.BASELINE_FLOOR);

  // The spike's peak grows only while rising or at its peak. A wave during decaying is a new spike
  // (decaying → rising below) and must not inflate the one that is winding down.
  let peakRate = count(input.peakRate);
  if (current === "rising" || current === "peak") {
    for (let i = Math.max(0, stageStart); i <= last; i++) peakRate = Math.max(peakRate, rateAt(i));
  }

  const rate = rateAt(last);
  let windowVisitors = 0;
  for (let i = last - SPIKE.RATE_MINUTES + 1; i <= last; i++) windowVisitors += visitors[i];
  const visitorRate = windowVisitors / SPIKE.RATE_MINUTES;
  // What a surge is measured against: the baseline, or while decaying the larger of the baseline
  // and the lowest rate of this decaying stage (a new wave must rise 5× above the tail it starts from).
  let surgeBase = baseline;
  if (current === "decaying") {
    // The window's first minutes have no full 5-minute average (earlier minutes read as zero), and
    // nor do minutes next to a gap in the stats: a deploy or restart writes no rows, and those
    // minutes are missing, not quiet. Every minute counts only when none was fully measured.
    let lowest = Infinity;
    let lowestAny = Infinity;
    for (let i = Math.max(SPIKE.RATE_MINUTES - 1, stageStart); i <= last; i++) {
      lowestAny = Math.min(lowestAny, rateAt(i));
      if (measured(i)) lowest = Math.min(lowest, rateAt(i));
    }
    const tail = Number.isFinite(lowest) ? lowest : lowestAny;
    if (Number.isFinite(tail)) surgeBase = Math.max(baseline, tail);
  }
  let surgeMinutes = 0;
  let windowPageviews = 0;
  let windowBots = 0;
  let windowMaxRate = 0;
  for (let i = riseFrom; i <= last; i++) {
    if (inStage(i) && rateAt(i) >= SPIKE.RISE_BASELINE_MULT * surgeBase) surgeMinutes++;
    windowPageviews += pageviews[i];
    windowBots += bots[i];
    windowMaxRate = Math.max(windowMaxRate, rateAt(i));
  }
  const botRatio = windowPageviews > 0 ? windowBots / windowPageviews : 0;
  const sourceKinds = [...windowSources.values()].filter((n) => n >= SPIKE.SOURCE_MIN_PAGEVIEWS).length;

  const flatMinutes = streak((i) => rateAt(i) <= rateAt(i - SPIKE.RATE_MINUTES));
  const coolMinutes = streak((i) => rateAt(i) < SPIKE.DECAY_PEAK_RATIO * peakRate);
  const calmMinutes = streak(
    (i) => rateAt(i) < SPIKE.CALM_BASELINE_MULT * baseline || rateAt(i) < SPIKE.MIN_RATE,
  );

  /**
   * The normal → rising rules (also used from decaying): "surge_detected" when they all hold. The bot
   * share is no gate: rate already leaves bots out, and anyone can post bot pageviews for any site,
   * so a gate would let outsiders veto a real spike.
   */
  const riseVerdict = (): SpikeReason => {
    if (rate < SPIKE.MIN_RATE) return "below_min_rate";
    if (visitorRate < SPIKE.MIN_VISITORS_PER_MIN) return "few_visitors";
    if (surgeMinutes < SPIKE.RISE_MIN_MINUTES) return "few_surge_minutes";
    if (sourceKinds < SPIKE.MIN_SOURCE_KINDS) return "few_sources";
    return "surge_detected";
  };
  const stageAgeMs =
    changedMs !== undefined && Number.isFinite(changedMs) && changedMs <= input.now.getTime()
      ? input.now.getTime() - changedMs
      : null;

  let stage: Stage = current;
  let reason: SpikeReason;
  switch (current) {
    case "normal":
      if (warming) {
        reason = "warming_up";
        break;
      }
      reason = riseVerdict();
      if (reason === "surge_detected") {
        stage = "rising";
        peakRate = windowMaxRate; // a new spike: the previous one's peak no longer applies
      }
      break;
    case "rising":
      // Checked first: a crash that never looked flat for 10 minutes still ends the spike.
      if (coolMinutes >= SPIKE.DECAY_SUSTAIN_MINUTES) {
        stage = "decaying";
        reason = "cooled_down";
      } else if (flatMinutes >= SPIKE.PEAK_SUSTAIN_MINUTES) {
        stage = "peak";
        reason = "growth_stalled";
      } else if (stageAgeMs !== null && stageAgeMs >= SPIKE.RISING_MAX_MINUTES * MINUTE_MS) {
        stage = "peak";
        reason = "rising_timeout";
      } else reason = "still_growing";
      break;
    case "peak":
      if (coolMinutes >= SPIKE.DECAY_SUSTAIN_MINUTES) {
        stage = "decaying";
        reason = "cooled_down";
      } else if (stageAgeMs !== null && stageAgeMs >= SPIKE.PEAK_MAX_MINUTES * MINUTE_MS) {
        // Still high after hours: the decaying cap later makes this level the new baseline.
        stage = "decaying";
        reason = "peak_timeout";
      } else reason = "holding_peak";
      break;
    case "decaying":
      if (riseVerdict() === "surge_detected") {
        stage = "rising";
        reason = "surge_detected";
        peakRate = windowMaxRate; // a new wave is a new spike with its own peak
      } else if (calmMinutes >= SPIKE.CALM_SUSTAIN_MINUTES) {
        stage = "normal";
        reason = "back_to_normal";
      } else if (stageAgeMs !== null && stageAgeMs >= SPIKE.DECAYING_MAX_MINUTES * MINUTE_MS) {
        stage = "normal";
        reason = "decay_timeout";
        // The site settled at a higher level: make that the new normal so it does not count as a surge.
        baselineRate = Math.max(baselineRate, rate, SPIKE.BASELINE_FLOOR);
      } else reason = "still_elevated";
      break;
  }

  const topSources = [...windowSources.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, SPIKE.TOP_SOURCES)
    .map(([source, n]) => ({ source, pageviews: n }));

  return {
    stage,
    baselineRate,
    peakRate,
    reason,
    evaluatedMinute,
    metrics: {
      minute: evaluatedMinute.toISOString(),
      rate: round(rate),
      baseline: round(baseline),
      peakRate: round(peakRate),
      surgeBase: round(surgeBase),
      surgeMinutes,
      sourceKinds,
      botRatio: round(botRatio, 3),
      visitorRate: round(visitorRate),
      flatMinutes,
      coolMinutes,
      calmMinutes,
      topSources,
    },
  };
}
