import { describe, expect, it } from "vitest";
import { detectCycleTimeAnomaly } from "../src/anomaly";

const STABLE_BASELINE = [58, 61, 59, 60, 62, 57, 60, 61, 59, 60, 58, 61];

describe("detectCycleTimeAnomaly", () => {
  it("returns null when baseline history is too thin", () => {
    const result = detectCycleTimeAnomaly(
      [60, 61, 59, 60],
      [200, 210, 205, 220, 215],
    );
    expect(result).toBeNull();
  });

  it("returns null when the recent sample is too thin", () => {
    const result = detectCycleTimeAnomaly(STABLE_BASELINE, [200, 210]);
    expect(result).toBeNull();
  });

  it("returns null when recent cycle times are in line with baseline", () => {
    const result = detectCycleTimeAnomaly(
      STABLE_BASELINE,
      [59, 60, 61, 58, 60],
    );
    expect(result).toBeNull();
  });

  it("flags a slower anomaly when recent cycle times run far above baseline", () => {
    const result = detectCycleTimeAnomaly(
      STABLE_BASELINE,
      [240, 250, 230, 260, 245],
    );
    expect(result).not.toBeNull();
    expect(result?.direction).toBe("slower");
    expect(result?.baselineCount).toBe(STABLE_BASELINE.length);
    expect(result?.recentCount).toBe(5);
    expect(result?.modifiedZScore).toBeGreaterThan(3.5);
  });

  it("flags a faster anomaly when recent cycle times run far below baseline", () => {
    const result = detectCycleTimeAnomaly(
      STABLE_BASELINE,
      [5, 6, 4, 7, 5],
    );
    expect(result).not.toBeNull();
    expect(result?.direction).toBe("faster");
    expect(result?.modifiedZScore).toBeLessThan(-3.5);
  });

  it("falls back to mean absolute deviation when baseline MAD is zero", () => {
    const result = detectCycleTimeAnomaly(
      [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 80],
      [200, 210, 205, 220, 215],
    );
    expect(result).not.toBeNull();
    expect(result?.direction).toBe("slower");
  });

  it("respects custom thresholds", () => {
    const lenient = detectCycleTimeAnomaly(STABLE_BASELINE, [64, 65, 63, 64, 66], {
      threshold: 1,
    });
    const strict = detectCycleTimeAnomaly(STABLE_BASELINE, [64, 65, 63, 64, 66], {
      threshold: 100,
    });
    expect(lenient).not.toBeNull();
    expect(strict).toBeNull();
  });
});
