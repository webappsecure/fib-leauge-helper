import { describe, expect, it } from "vitest";
import { gmQualityForD6, gmQualityLabel } from "./gm";

describe("gmQualityForD6", () => {
  it("maps each face for risk tolerance", () => {
    expect([1, 2, 3, 4, 5, 6].map((face) => gmQualityForD6("gmRisk", face))).toEqual([
      "conservative", "conservative", "neutral", "neutral", "aggressive", "aggressive",
    ]);
  });

  it("maps each face for development focus", () => {
    expect([1, 2, 3, 4, 5, 6].map((face) => gmQualityForD6("gmDevFocus", face))).toEqual([
      "farm-first", "farm-first", "mixed", "mixed", "win-now", "win-now",
    ]);
  });

  it("maps each face for team building", () => {
    expect([1, 2, 3, 4, 5, 6].map((face) => gmQualityForD6("gmTeamBuilding", face))).toEqual([
      "pitching", "pitching", "balanced", "balanced", "offense", "offense",
    ]);
  });

  it("rejects faces that are not on a d6", () => {
    for (const face of [0, 7, 2.5]) {
      expect(() => gmQualityForD6("gmRisk", face)).toThrow(RangeError);
    }
  });
});

describe("gmQualityLabel", () => {
  it("returns the display label, or null when unset", () => {
    expect(gmQualityLabel("gmDevFocus", "farm-first")).toBe("Farm First");
    expect(gmQualityLabel("gmTeamBuilding", "offense")).toBe("Offense Focused");
    expect(gmQualityLabel("gmRisk", null)).toBeNull();
  });
});
