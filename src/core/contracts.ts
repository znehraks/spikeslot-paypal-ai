// Adapted from znehraks/spikeslot 4abf7bd; see docs/provenance.md.
export const STAGES = ["normal", "rising", "peak", "decaying"] as const;
export type Stage = (typeof STAGES)[number];

export const SPIKE_REASONS = [
  "surge_detected", // normal|decaying → rising
  "below_min_rate",
  "few_surge_minutes",
  "few_sources",
  "few_visitors", // fewer than MIN_VISITORS_PER_MIN distinct visitors per minute
  "bot_heavy", // legacy: the bot-ratio gate was removed (SPEC §7.4)
  "warming_up", // first WARMUP_MINUTES of a site's stats: stays normal while the baseline is learned
  "growth_stalled", // rising → peak
  "rising_timeout", // rising → peak after RISING_MAX_MINUTES
  "still_growing",
  "cooled_down", // rising|peak → decaying
  "peak_timeout", // peak → decaying after PEAK_MAX_MINUTES
  "holding_peak",
  "back_to_normal", // decaying → normal
  "decay_timeout", // decaying → normal after SPIKE.DECAYING_MAX_MINUTES
  "still_elevated",
] as const;
export type SpikeReason = (typeof SPIKE_REASONS)[number];

/** What one spike evaluation measured (site_spike_state.metrics). Rates are human pageviews per minute. */
export interface SpikeMetrics {
  /** Start of the judged minute (the last complete one), ISO. */
  minute: string;
  /** Average of the last 5 complete minutes. */
  rate: number;
  /** Baseline the rules compared against (never below the floor). */
  baseline: number;
  peakRate: number;
  /**
   * What surges are measured against: the baseline, or while decaying max(baseline, lowest rate of
   * the decaying stage). Missing on rows written before it existed.
   */
  surgeBase?: number;
  /** Minutes of the last 15 at ≥ 5 × surgeBase, counting only the current stage. */
  surgeMinutes: number;
  /** External sources with at least 3 pageviews in the last 15 minutes. */
  sourceKinds: number;
  /** Bot-suspect share of pageviews in the last 15 minutes, 0-1 (reported only; no longer a gate). */
  botRatio: number;
  /** Distinct visitors per minute, 5-minute average. Missing on rows written before it existed. */
  visitorRate?: number;
  /** Consecutive minutes of the current stage whose 5-minute average did not grow. */
  flatMinutes: number;
  /** Consecutive minutes of the current stage under the decay threshold (share of the peak). */
  coolMinutes: number;
  /** Consecutive minutes of the current stage back near the baseline. */
  calmMinutes: number;
  /** Largest sources of the last 15 minutes. */
  topSources: Array<{ source: string; pageviews: number }>;
}
