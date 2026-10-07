import { describe, expect, it } from "vitest";
import { NAME_LIST } from "./name-list";
import { pickName } from "./names";

describe("name list", () => {
  it("has 5,000 entries with ids 1 to 5,000 and no gaps", () => {
    expect(NAME_LIST).toHaveLength(5000);
    expect(NAME_LIST.every((entry, index) => entry.id === index + 1)).toBe(true);
  });

  it("never repeats a full name", () => {
    expect(new Set(NAME_LIST.map((entry) => entry.fullName)).size).toBe(5000);
  });

  it("keeps every part of each row", () => {
    expect(NAME_LIST[0]).toEqual({
      id: 1,
      first: "Andrew",
      last: "Martinelli",
      fullName: "Andrew Martinelli",
      background: "White/Anglo",
    });
    expect(NAME_LIST[4999].fullName).toBe("Brady Beasley");
    expect(
      NAME_LIST.every((entry) => entry.first && entry.last && entry.background),
    ).toBe(true);
  });
});

describe("pickName", () => {
  it("is driven by the random source", () => {
    expect(pickName(new Set(), () => 0)?.id).toBe(1);
    expect(pickName(new Set(), () => 0.999999)?.id).toBe(5000);
    expect(pickName(new Set(), () => 0.5)?.id).toBe(2501);
  });

  it("never returns a used id", () => {
    const used = new Set([1, 2, 5000]);
    expect(pickName(used, () => 0)?.id).toBe(3);
    expect(pickName(used, () => 0.999999)?.id).toBe(4999);

    for (let i = 0; i < 50; i++) {
      const entry = pickName(used);
      if (!entry) throw new Error("expected a name");
      expect(used.has(entry.id)).toBe(false);
      used.add(entry.id);
    }
    expect(used.size).toBe(53);
  });

  it("returns null without rolling when every name is used", () => {
    const everyId = new Set(NAME_LIST.map((entry) => entry.id));
    const random = () => {
      throw new Error("should not roll");
    };
    expect(pickName(everyId, random)).toBeNull();
  });
});
