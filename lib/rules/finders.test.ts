import { describe, expect, it } from "vitest";
import { D66_RESULTS } from "./dice";
import type { Grade } from "./grades";
import {
  finderNote,
  finderRanges,
  positionFinders,
  SP_FINDER_RANGES,
  type Finder,
  type FinderPlayer,
} from "./finders";

const SLOTS = ["C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH"];

function lineup(hitting: Grade[], power: Grade[] = hitting): FinderPlayer[] {
  return hitting.map((grade, index) => ({ slot: SLOTS[index], hitting: grade, power: power[index] }));
}

const all = (grade: Grade, count = 9): Grade[] => Array.from({ length: count }, () => grade);

function finders(players: FinderPlayer[], useDh = true) {
  const result = positionFinders(players, useDh);
  if (!result.available) throw new Error("expected finders");
  return result;
}

const values = (finder: Finder) => finder.rows.map((row) => row.value);

// Every result from 11 to 66 falls in exactly one row's range.
function expectCoversEveryResult(finder: Finder) {
  expect(values(finder).reduce((sum, value) => sum + value, 0)).toBe(36);
  const covered = finder.rows.flatMap((row) => {
    if (row.range === null) return [];
    const [first, last = first] = row.range.split("-").map(Number);
    return D66_RESULTS.filter((result) => result >= first && result <= last);
  });
  expect(covered).toEqual([...D66_RESULTS]);
}

describe("finderRanges", () => {
  it("follows the handbook's example: 4 then 3 give 11-14 and 15-21", () => {
    expect(finderRanges([4, 3])).toEqual(["11-14", "15-21"]);
  });

  it("counts in base 6, ends a full set at 66 and prints one result alone", () => {
    expect(finderRanges([6, 1, 5, 12, 1, 11])).toEqual([
      "11-16", "21", "22-26", "31-46", "51", "52-66",
    ]);
  });

  it("gives no range to a value of 0 and carries on after it", () => {
    expect(finderRanges([2, 0, 3, 0])).toEqual(["11-12", null, "13-15", null]);
  });

  it("refuses values that add up to more than 36", () => {
    expect(() => finderRanges([30, 7])).toThrow(RangeError);
  });
});

describe("starting pitcher finder", () => {
  it("is the handbook template and covers 11 to 66", () => {
    expect(SP_FINDER_RANGES).toEqual({
      SP1: "11-21", SP2: "22-32", SP3: "33-43", SP4: "44-53", SP5: "54-63", SP6: "64-66",
    });
    expect(Object.values(SP_FINDER_RANGES)).toEqual(finderRanges([7, 7, 7, 6, 6, 3]));
  });
});

describe("clutch hit finder", () => {
  it("values each Hitting grade A+ 7 down to F 1", () => {
    // 7+6+5+4+3+2+1 = 28 over seven players, plus two B (4 each) makes 36.
    const players = lineup(["A+", "A", "B+", "B", "C", "D", "F", "B", "B"]);
    const { clutch } = finders(players);
    expect(values(clutch)).toEqual([7, 6, 5, 4, 3, 2, 1, 4, 4]);
    expect(clutch).toMatchObject({ baseTotal: 36, changes: [], other: 0 });
    expect(clutch.rows.map((row) => row.range)).toEqual([
      "11-21", "22-31", "32-36", "41-44", "45-51", "52-53", "54", "55-62", "63-66",
    ]);
    expect(finderNote("Clutch", clutch)).toBeNull();
  });

  it("adds to the best hitters first when short, in lineup order for equal grades", () => {
    // 4+4+3+2+7+3+3+3+4 = 33: the three points go to the A+ at 3B, then to
    // the first two B hitters, at C and 1B.
    const players = lineup(["B", "B", "C", "D", "A+", "C", "C", "C", "B"]);
    const { clutch } = finders(players);
    expect(clutch.baseTotal).toBe(33);
    expect(values(clutch)).toEqual([5, 5, 3, 2, 8, 3, 3, 3, 4]);
    expect(clutch.changes).toEqual([
      { slot: "3B", by: 1 },
      { slot: "C", by: 1 },
      { slot: "1B", by: 1 },
    ]);
    expectCoversEveryResult(clutch);
    expect(finderNote("Clutch", clutch)).toBe(
      "Clutch finder raised from 33 to 36: 3B, C and 1B each gained 1.",
    );
  });

  it("takes from the worst hitters first when over", () => {
    // The prototype's note: 38 trimmed to 36, SS (D) then C (C) give up 1.
    const players = lineup(["C", "B+", "B", "D", "A", "B+", "B+", "B", "B"]);
    const { clutch } = finders(players);
    expect(clutch.baseTotal).toBe(38);
    expect(values(clutch)).toEqual([2, 5, 4, 1, 6, 5, 5, 4, 4]);
    expectCoversEveryResult(clutch);
    expect(finderNote("Clutch", clutch)).toBe(
      "Clutch finder trimmed from 38 to 36: SS and C each gave up 1.",
    );
  });

  it("never takes a player below 1 and goes round again", () => {
    // 7*7 + 1 + 2 = 52, sixteen over. The F is skipped; the D gives up only 1.
    const players = lineup(["A+", "A+", "F", "D", "A+", "A+", "A+", "A+", "A+"]);
    const { clutch } = finders(players);
    expect(values(clutch)).toEqual([4, 5, 1, 1, 5, 5, 5, 5, 5]);
    expect(Math.min(...values(clutch))).toBe(1);
    expectCoversEveryResult(clutch);
    expect(finderNote("Clutch", clutch)).toBe(
      "Clutch finder trimmed from 52 to 36: SS gave up 1, C gave up 3, 1B gave up 2, 3B gave up 2, LF gave up 2, CF gave up 2, RF gave up 2 and DH gave up 2.",
    );
  });

  it("shares 36 evenly at the extremes, with and without a DH", () => {
    expect(values(finders(lineup(all("F"))).clutch)).toEqual(all("F").map(() => 4));
    expect(values(finders(lineup(all("A+"))).clutch)).toEqual(all("A+").map(() => 4));

    // Eight batters: 36 / 8 leaves four extra points for the first four.
    const eightLow = finders(lineup(all("F", 8)), false).clutch;
    expect(values(eightLow)).toEqual([5, 5, 5, 5, 4, 4, 4, 4]);
    expectCoversEveryResult(eightLow);
    const eightHigh = finders(lineup(all("A+", 8)), false).clutch;
    expect(values(eightHigh)).toEqual([4, 4, 4, 4, 5, 5, 5, 5]);
    expectCoversEveryResult(eightHigh);
  });
});

describe("home run finder", () => {
  it("values each Power grade A+ 6 down to F 0", () => {
    const players = lineup(all("B"), ["A+", "A", "B+", "B", "C", "D", "F", "A+", "A+"]);
    const { homeRun } = finders(players);
    // 6+5+4+3+2+1+0+6+6 = 33, so 3 go to Other.
    expect(values(homeRun)).toEqual([6, 5, 4, 3, 2, 1, 0, 6, 6, 3]);
  });

  it("sends a shortfall to an Other row and leaves the players alone", () => {
    const players = lineup(all("B"), ["B", "B", "C", "C", "A", "B", "F", "B", "B+"]);
    const { homeRun } = finders(players);
    // 3+3+2+2+5+3+0+3+4 = 25, so 11 are left for Other.
    expect(homeRun.baseTotal).toBe(25);
    expect(homeRun.other).toBe(11);
    expect(homeRun.changes).toEqual([]);
    expect(homeRun.rows.at(-1)).toEqual({ slot: "Other", value: 11, range: "52-66" });
    expect(homeRun.rows[6]).toEqual({ slot: "CF", value: 0, range: null });
    expectCoversEveryResult(homeRun);
    expect(finderNote("HR", homeRun)).toBe("HR finder: 11 of 36 left over went to Other.");
  });

  it("has no Other row and no note when the values total exactly 36", () => {
    const { homeRun } = finders(lineup(all("B"), all("B+")));
    expect(values(homeRun)).toEqual(all("B+").map(() => 4));
    expect(homeRun.other).toBe(0);
    expect(homeRun.rows).toHaveLength(9);
    expect(finderNote("HR", homeRun)).toBeNull();
  });

  it("trims the lowest Power first when over, never below 1, and keeps F at nothing", () => {
    // 6*6 + 0 + 1 + 2 = 39, three over. F has no range and D is already 1.
    const players = lineup(all("B"), ["A+", "F", "D", "C", "A+", "A+", "A+", "A+", "A+"]);
    const { homeRun } = finders(players);
    expect(values(homeRun)).toEqual([5, 0, 1, 1, 5, 6, 6, 6, 6]);
    expect(homeRun.other).toBe(0);
    expectCoversEveryResult(homeRun);
    expect(finderNote("HR", homeRun)).toBe(
      "HR finder trimmed from 39 to 36: SS, C and 3B each gave up 1.",
    );
  });

  it("gives everything to Other for an all-F lineup and shares out an all-A+ one", () => {
    const none = finders(lineup(all("B"), all("F"))).homeRun;
    expect(none.rows.slice(0, 9).every((row) => row.range === null)).toBe(true);
    expect(none.rows.at(-1)).toEqual({ slot: "Other", value: 36, range: "11-66" });

    const most = finders(lineup(all("B"), all("A+"))).homeRun;
    expect(values(most)).toEqual(all("A+").map(() => 4));
    expectCoversEveryResult(most);
  });
});

describe("who counts", () => {
  it("counts whoever is in each slot now and ignores a DH in a league without one", () => {
    const players = lineup(all("B"), all("B+"));
    // Lineup order comes from the slots, not the order the players arrive in.
    const shuffled = [...players].reverse();
    expect(finders(shuffled).clutch.rows.map((row) => row.slot)).toEqual(SLOTS);

    const withoutDh = finders(players, false);
    expect(withoutDh.clutch.rows.map((row) => row.slot)).toEqual(SLOTS.slice(0, 8));
    // Eight B+ power values are 32, so 4 go to Other.
    expect(withoutDh.homeRun.other).toBe(4);
  });

  it("gives no finders without a full lineup", () => {
    const players = lineup(all("B"));
    expect(positionFinders(players.filter((player) => player.slot !== "SS"), true)).toEqual({
      available: false,
    });
    expect(positionFinders(players.slice(0, 8), true)).toEqual({ available: false });
    expect(positionFinders([], false)).toEqual({ available: false });
  });

  it("always totals 36 and covers 11 to 66 for random lineups", () => {
    const grades: Grade[] = ["F", "D", "C", "B", "B+", "A", "A+"];
    const pick = () => grades[Math.floor(Math.random() * grades.length)];
    for (let trial = 0; trial < 300; trial += 1) {
      const useDh = trial % 2 === 0;
      const count = useDh ? 9 : 8;
      const result = finders(
        lineup(Array.from({ length: count }, pick), Array.from({ length: count }, pick)),
        useDh,
      );
      expectCoversEveryResult(result.clutch);
      expectCoversEveryResult(result.homeRun);
      expect(Math.min(...values(result.clutch))).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("finderNote", () => {
  it("names a single player without 'each'", () => {
    // 1 + 4*4 + 5*4 = 37, one over. The F cannot go below 1, so the first B,
    // at 1B, gives up the point.
    const { clutch } = finders(lineup(["F", "B", "B", "B", "B", "B+", "B+", "B+", "B+"]));
    expect(clutch.baseTotal).toBe(37);
    expect(finderNote("Clutch", clutch)).toBe(
      "Clutch finder trimmed from 37 to 36: 1B gave up 1.",
    );
  });

  it("says 'each' when several players moved by the same amount", () => {
    // 2 + 4*4 + 5*3 + 6 = 39: the D at C, then the B at 1B and 2B.
    const { clutch } = finders(lineup(["D", "B", "B", "B", "B", "B+", "B+", "B+", "A"]));
    expect(finderNote("Clutch", clutch)).toBe(
      "Clutch finder trimmed from 39 to 36: C, 1B and 2B each gave up 1.",
    );
  });
});
