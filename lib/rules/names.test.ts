import { describe, expect, it } from "vitest";
import { NAME_LIST } from "./name-list";
import { nameIdFor, nameKey, pickName } from "./names";

describe("name list", () => {
  it("has 5,000 entries with ids 1 to 5,000 and no gaps", () => {
    expect(NAME_LIST).toHaveLength(5000);
    expect(NAME_LIST.every((entry, index) => entry.id === index + 1)).toBe(true);
  });

  // The name rules rely on this: a name has at most one list id.
  it("never repeats a full name, even in other capitals or spacing", () => {
    expect(new Set(NAME_LIST.map((entry) => nameKey(entry.fullName))).size).toBe(5000);
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

describe("nameIdFor", () => {
  it("returns the id of a listed name", () => {
    expect(nameIdFor("Andrew Martinelli")).toBe(1);
    expect(nameIdFor("Brady Beasley")).toBe(5000);
  });

  it("ignores surrounding spaces", () => {
    expect(nameIdFor("  Andrew Martinelli ")).toBe(1);
  });

  it("ignores capitals and extra spaces between words", () => {
    expect(nameIdFor("andrew martinelli")).toBe(1);
    expect(nameIdFor("ANDREW   Martinelli")).toBe(1);
  });

  it("returns null for a partial name, an unlisted name or nothing", () => {
    expect(nameIdFor("Andrew")).toBeNull();
    expect(nameIdFor("Gordon Howland Made Up")).toBeNull();
    expect(nameIdFor("")).toBeNull();
    expect(nameIdFor(null)).toBeNull();
  });
});

describe("nameKey", () => {
  it("treats capitals, outer spaces and runs of inner spaces as the same name", () => {
    expect(nameKey("  John   SMITH ")).toBe("john smith");
    expect(nameKey("john smith")).toBe(nameKey("John Smith"));
    expect(nameKey("John\tSmith")).toBe("john smith");
  });

  it("keeps different names apart and gives an empty key for a blank", () => {
    expect(nameKey("John Smith")).not.toBe(nameKey("John Smyth"));
    expect(nameKey("JohnSmith")).not.toBe(nameKey("John Smith"));
    expect(nameKey("   ")).toBe("");
    expect(nameKey(null)).toBe("");
    expect(nameKey(undefined)).toBe("");
  });
});
