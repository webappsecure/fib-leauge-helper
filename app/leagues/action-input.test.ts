import { describe, expect, it } from "vitest";
import { formText, isId } from "./action-input";

describe("isId", () => {
  it("accepts positive whole numbers only", () => {
    expect(isId(1)).toBe(true);
    expect(isId(Number.MAX_SAFE_INTEGER)).toBe(true);
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "3", null, undefined, {}, [3]]) {
      expect(isId(value)).toBe(false);
    }
  });
});

describe("formText", () => {
  it("returns text as it is and blank for anything else", () => {
    expect(formText("  Great Lakes ")).toBe("  Great Lakes ");
    expect(formText("")).toBe("");
    expect(formText(null)).toBe("");
    expect(formText(new File(["x"], "x.txt"))).toBe("");
  });
});
