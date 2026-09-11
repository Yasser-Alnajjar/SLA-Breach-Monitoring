import { describe, expect, it } from "vitest";
import { computeSourceHash } from "../src/hash";

describe("computeSourceHash", () => {
  it("is stable across key order", () => {
    expect(computeSourceHash({ a: 1, b: 2 })).toBe(computeSourceHash({ b: 2, a: 1 }));
  });

  it("changes when a value changes", () => {
    expect(computeSourceHash({ a: 1 })).not.toBe(computeSourceHash({ a: 2 }));
  });

  it("is stable across nested key order and array order-sensitive", () => {
    expect(computeSourceHash({ a: [1, 2], b: { x: 1, y: 2 } })).toBe(
      computeSourceHash({ b: { y: 2, x: 1 }, a: [1, 2] }),
    );
    expect(computeSourceHash({ a: [1, 2] })).not.toBe(computeSourceHash({ a: [2, 1] }));
  });
});
