import { describe, expect, it } from "vitest";
import { rosterSize } from "./roster";

describe("rosterSize", () => {
  it("is 20 with a DH and 19 without", () => {
    expect(rosterSize(true)).toBe(20);
    expect(rosterSize(false)).toBe(19);
  });
});
