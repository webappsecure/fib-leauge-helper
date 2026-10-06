import { describe, expect, it } from "vitest";
import { rollDie } from "./dice";

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
