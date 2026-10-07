import { describe, expect, it } from "vitest";
import { applySavedDiceSetting, DICE_STORAGE_KEY, parseDiceSetting } from "./dice";

describe("parseDiceSetting", () => {
  it("reads a saved hidden choice", () => {
    expect(parseDiceSetting("hidden")).toBe("hidden");
  });

  it("shows dice for a saved shown choice, no saved value or an unknown one", () => {
    expect(parseDiceSetting("shown")).toBe("shown");
    expect(parseDiceSetting(null)).toBe("shown");
    expect(parseDiceSetting(undefined)).toBe("shown");
    expect(parseDiceSetting("HIDDEN")).toBe("shown");
    expect(parseDiceSetting("garbage")).toBe("shown");
  });
});

describe("applySavedDiceSetting", () => {
  function run(getItem: (key: string) => string | null) {
    const dataset: Record<string, string> = {};
    const script = new Function("localStorage", "document", applySavedDiceSetting);
    script({ getItem }, { documentElement: { dataset } });
    return dataset;
  }

  it("hides dice for a saved hidden choice", () => {
    const keys: string[] = [];
    const dataset = run((key) => {
      keys.push(key);
      return "hidden";
    });
    expect(dataset.dice).toBe("hidden");
    expect(keys).toEqual([DICE_STORAGE_KEY]);
  });

  it("leaves the page alone for any other saved value", () => {
    expect(run(() => "shown")).toEqual({});
    expect(run(() => null)).toEqual({});
    expect(run(() => "garbage")).toEqual({});
  });

  it("does not throw when storage is blocked", () => {
    expect(
      run(() => {
        throw new Error("blocked");
      }),
    ).toEqual({});
  });
});
