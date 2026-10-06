import { describe, expect, it } from "vitest";
import { CITY_ROLL_MAX, CITY_TABLE, cityForRoll, rollCity } from "./cities";

function scripted(...rolls: number[]) {
  const queue = [...rolls];
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("ran out of scripted rolls");
    return next;
  };
}

describe("city table", () => {
  it("has 68 uniquely named cities", () => {
    expect(CITY_TABLE).toHaveLength(68);
    expect(new Set(CITY_TABLE.map((row) => row.city)).size).toBe(68);
  });

  it("covers 1 to 348 with no gaps or overlaps", () => {
    let next = 1;
    for (const row of CITY_TABLE) {
      expect(row.low).toBe(next);
      expect(row.high).toBeGreaterThanOrEqual(row.low);
      next = row.high + 1;
    }
    expect(next - 1).toBe(CITY_ROLL_MAX);
  });
});

describe("cityForRoll", () => {
  it("finds the city at range boundaries", () => {
    expect(cityForRoll(1).city).toBe("New York");
    expect(cityForRoll(42).city).toBe("New York");
    expect(cityForRoll(43).city).toBe("Los Angeles");
    expect(cityForRoll(246).city).toBe("Milwaukee");
    expect(cityForRoll(347).city).toBe("Toledo");
    expect(cityForRoll(348).city).toBe("Winston-Salem");
  });

  it("rejects rolls outside the table", () => {
    expect(() => cityForRoll(0)).toThrow(RangeError);
    expect(() => cityForRoll(349)).toThrow(RangeError);
    expect(() => cityForRoll(12.5)).toThrow(RangeError);
  });
});

describe("rollCity", () => {
  it("returns the rolled city with its roll and range", () => {
    expect(rollCity([], scripted(244))).toEqual({
      city: "Milwaukee",
      low: 242,
      high: 246,
      roll: 244,
    });
  });

  it("rolls again when the city is taken", () => {
    expect(rollCity(["New York"], scripted(5, 30, 70))?.city).toBe("Chicago");
  });

  it("treats a typed city as taken regardless of case and spacing", () => {
    expect(rollCity(["  chicago "], scripted(70, 347))?.city).toBe("Toledo");
  });

  it("ignores typed cities that are not on the list", () => {
    expect(rollCity(["Springfield"], scripted(1))?.city).toBe("New York");
  });

  it("returns null without rolling when every listed city is taken", () => {
    const everyCity = CITY_TABLE.map((row) => row.city);
    expect(rollCity(everyCity, scripted())).toBeNull();
  });
});
