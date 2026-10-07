import { describe, expect, it } from "vitest";
import { D66_RESULTS, lookupD66, rollD66, rollDie } from "./dice";

describe("rollDie", () => {
  it("returns 1 at the low end and the top face at the high end", () => {
    expect(rollDie(6, () => 0)).toBe(1);
    expect(rollDie(6, () => 0.999999)).toBe(6);
    expect(rollDie(348, () => 0)).toBe(1);
    expect(rollDie(348, () => 0.999999)).toBe(348);
  });

  it("splits the range evenly", () => {
    expect(rollDie(6, () => 0.5)).toBe(4);
    expect(rollDie(6, () => 1 / 6)).toBe(2);
  });

  it("stays in range with the default random source", () => {
    for (let i = 0; i < 200; i++) {
      const face = rollDie(6);
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
    }
  });
});

// Each die face is the middle of its sixth of the [0, 1) range.
function faces(...values: number[]) {
  const queue = values.map((face) => (face - 0.5) / 6);
  return () => queue.shift() ?? 0;
}

describe("rollD66", () => {
  it("reads the first die as tens and the second as ones", () => {
    expect(rollD66(faces(3, 6))).toBe(36);
    expect(rollD66(faces(6, 1))).toBe(61);
    expect(rollD66(() => 0)).toBe(11);
    expect(rollD66(() => 0.999999)).toBe(66);
  });

  it("only returns the 36 valid results", () => {
    expect(D66_RESULTS).toHaveLength(36);
    expect(D66_RESULTS[0]).toBe(11);
    expect(D66_RESULTS[35]).toBe(66);
    for (let i = 0; i < 500; i++) {
      expect(D66_RESULTS).toContain(rollD66());
    }
  });
});

describe("lookupD66", () => {
  const table = [
    { low: 11, high: 34, value: "low" },
    { low: 35, high: 42, value: "middle" },
    { low: 43, high: 66, value: "high" },
  ];

  it("finds the row at range edges, across a tens boundary", () => {
    expect(lookupD66(table, 34)).toBe("low");
    expect(lookupD66(table, 35)).toBe("middle");
    expect(lookupD66(table, 41)).toBe("middle");
    expect(lookupD66(table, 43)).toBe("high");
  });

  it("rejects numbers two dice cannot show", () => {
    expect(() => lookupD66(table, 10)).toThrow(RangeError);
    expect(() => lookupD66(table, 37)).toThrow(RangeError);
    expect(() => lookupD66(table, 67)).toThrow(RangeError);
  });
});
