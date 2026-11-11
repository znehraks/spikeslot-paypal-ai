// Every threshold of the spike module (SPEC §7.4). Rates are human pageviews per minute:
// pageviews − bot_suspect, so bot pageviews count toward neither starting nor keeping a spike.
// Anyone who knows a site key can post pageviews, so no rule lets them hold a site back either:
// the bot share is reported, not a gate.

export const SPIKE = {
  /** Minutes of site_minute_stats one evaluation reads (the longest rule needs 64). */
  WINDOW_MINUTES: 120,
  /** rate = human pageviews of the last 5 complete minutes ÷ 5; visitorRate the same over visitors. */
  RATE_MINUTES: 5,

  /** baseline = baseline × (1 − 0.02) + rate × 0.02, once per evaluated minute and only while normal. */
  BASELINE_WEIGHT: 0.02,
  BASELINE_FLOOR: 1,
  // The rate folded into the baseline is the one from 15 minutes before the judged minute, i.e. a
  // minute that already left the rising window. Folding the newest minute lets a surge lift its own
  // baseline while the 10-of-15 rule is still counting, and a plain 10× surge would never qualify.
  BASELINE_LAG_MINUTES: 15,
  /**
   * Warm-up: while the site's first stats minute is less than this before the judged minute and the
   * baseline was never learned (still at the floor), the site stays normal ("warming_up") and the
   * baseline does not fold. The judgment that ends it sets the baseline to the mean human rate of
   * the observed minutes, so the traffic a site already had when it installed the SDK is its normal.
   */
  WARMUP_MINUTES: 60,

  // normal → rising needs every one of these.
  MIN_RATE: 30,
  /** Distinct visitors per minute (5-minute average): one client sending many pageviews is not a spike. */
  MIN_VISITORS_PER_MIN: 10,
  RISE_WINDOW_MINUTES: 15,
  RISE_BASELINE_MULT: 5,
  RISE_MIN_MINUTES: 10,
  /** A source counts once it brought this many pageviews within the rising window. */
  SOURCE_MIN_PAGEVIEWS: 3,
  MIN_SOURCE_KINDS: 2,
  /** Serving's page-to-page navigation bucket: a click inside the site is not a traffic source. */
  NON_SOURCES: ["internal"] as readonly string[],

  /** rising → peak: the last 5-minute average ≤ the 5 minutes before it, for 10 minutes. */
  PEAK_SUSTAIN_MINUTES: 10,
  /** rising → peak at the latest after this long in rising ("rising_timeout"). */
  RISING_MAX_MINUTES: 60,
  /** rising|peak → decaying: rate < 0.35 × peak rate, for 30 minutes. */
  DECAY_PEAK_RATIO: 0.35,
  DECAY_SUSTAIN_MINUTES: 30,
  /**
   * peak → decaying at the latest after this long in peak ("peak_timeout"): a site that stays high
   * must not keep the 1.5× floor for ever. The decaying cap below then makes that level its baseline.
   */
  PEAK_MAX_MINUTES: 240,
  /** decaying → normal: rate < 2 × baseline or rate < MIN_RATE, for 60 minutes. */
  CALM_BASELINE_MULT: 2,
  CALM_SUSTAIN_MINUTES: 60,
  /**
   * decaying → normal at the latest after this long in decaying: a site that settled at a new,
   * higher level would otherwise never look calm. The baseline then jumps to that level.
   */
  DECAYING_MAX_MINUTES: 360,
  // decaying → rising: the normal → rising rules hold again, except that "5 × baseline" uses
  // max(baseline, lowest rate of the current decaying stage). The pre-spike baseline alone would
  // make any tail above MIN_RATE count as a new surge within 10 minutes of decaying.

  /** Sources kept in metrics. */
  TOP_SOURCES: 5,
} as const;
