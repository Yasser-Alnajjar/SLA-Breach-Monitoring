import { describe, expect, it } from "vitest";
import { computeSourceHash } from "../src/hash";

describe("computeSourceHash", () => {
  it("is stable regardless of key order", () => {
    const a = computeSourceHash({ id: 1, status: "open" });
    const b = computeSourceHash({ status: "open", id: 1 });
    expect(a).toBe(b);
  });

  it("changes when a value changes", () => {
    const a = computeSourceHash({ id: 1, status: "open" });
    const b = computeSourceHash({ id: 1, status: "closed" });
    expect(a).not.toBe(b);
  });

  it("is stable regardless of nested key order", () => {
    const a = computeSourceHash({ id: 1, meta: { a: 1, b: 2 } });
    const b = computeSourceHash({ id: 1, meta: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });

  it("distinguishes arrays from their reordering", () => {
    const a = computeSourceHash({ tags: ["a", "b"] });
    const b = computeSourceHash({ tags: ["b", "a"] });
    expect(a).not.toBe(b);
  });
});
