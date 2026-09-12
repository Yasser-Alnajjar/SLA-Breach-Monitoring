/**
 * Statistical (not AI/LLM — Phase 10's DO NOT BUILD list rules that out)
 * anomaly detection on cycle times, roadmap step 25.
 *
 * Cycle times are durations, so they're right-skewed rather than normal —
 * a handful of very slow cases would inflate a mean/stddev check and mask
 * the very anomaly being looked for. Median and MAD (median absolute
 * deviation) are robust to that skew, so this uses Iglewicz & Hoaglin's
 * (1993) modified z-score instead of a classic z-score.
 */

export interface CycleTimeAnomaly {
  baselineMedianMinutes: number;
  baselineCount: number;
  recentMedianMinutes: number;
  recentCount: number;
  modifiedZScore: number;
  direction: "slower" | "faster";
}

export interface DetectCycleTimeAnomalyOptions {
  /** Below this many baseline samples, there isn't enough history for a median/MAD to mean anything. */
  minBaselineCount?: number;
  /** Below this many recent samples, a single slow or fast case could flip the call. */
  minRecentCount?: number;
  /** Modified z-score magnitude past which a departure counts as anomalous. */
  threshold?: number;
}

const DEFAULT_MIN_BASELINE_COUNT = 12;
const DEFAULT_MIN_RECENT_COUNT = 5;
const DEFAULT_THRESHOLD = 3.5;
// Scales MAD to be comparable to a standard deviation under normality.
const MAD_TO_STDDEV = 0.6745;
// Scales mean absolute deviation the same way, for the zero-MAD fallback.
const MEAN_ABSOLUTE_DEVIATION_TO_STDDEV = 1.2533;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Compares a recent run of cycle times (minutes) against a longer baseline
 * history. Returns null when there isn't enough history to judge, or when
 * the recent median isn't a statistically unusual departure from baseline.
 */
export function detectCycleTimeAnomaly(
  baselineMinutes: number[],
  recentMinutes: number[],
  options: DetectCycleTimeAnomalyOptions = {},
): CycleTimeAnomaly | null {
  const minBaselineCount = options.minBaselineCount ?? DEFAULT_MIN_BASELINE_COUNT;
  const minRecentCount = options.minRecentCount ?? DEFAULT_MIN_RECENT_COUNT;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  if (
    baselineMinutes.length < minBaselineCount ||
    recentMinutes.length < minRecentCount
  ) {
    return null;
  }

  const baselineMedian = median(baselineMinutes);
  const absoluteDeviations = baselineMinutes.map((v) =>
    Math.abs(v - baselineMedian),
  );
  let mad = median(absoluteDeviations);
  if (mad === 0) {
    // Degenerate baseline (e.g. every historical cycle time identical) —
    // fall back to mean absolute deviation rather than dividing by zero.
    const meanAbsoluteDeviation =
      absoluteDeviations.reduce((sum, v) => sum + v, 0) /
      absoluteDeviations.length;
    mad = meanAbsoluteDeviation / MEAN_ABSOLUTE_DEVIATION_TO_STDDEV;
  }
  if (mad === 0) return null;

  const recentMedian = median(recentMinutes);
  const modifiedZScore = (MAD_TO_STDDEV * (recentMedian - baselineMedian)) / mad;

  if (Math.abs(modifiedZScore) < threshold) return null;

  return {
    baselineMedianMinutes: Math.round(baselineMedian),
    baselineCount: baselineMinutes.length,
    recentMedianMinutes: Math.round(recentMedian),
    recentCount: recentMinutes.length,
    modifiedZScore: Math.round(modifiedZScore * 100) / 100,
    direction: recentMedian > baselineMedian ? "slower" : "faster",
  };
}
