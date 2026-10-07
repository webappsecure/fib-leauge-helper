import { describe, expect, it } from "vitest";
import { D66_RESULTS, lookupD66, type D66Row } from "./dice";
import { gradeValue } from "./grades";
import {
  ARCHETYPES,
  ARCHETYPE_CEILINGS,
  ARCHETYPE_TABLES,
  ELITE_CHECK_TABLE,
  GRADE_ATTRIBUTES,
  GRADE_TABLES,
  archetypeTableKey,
  rollLineup,
  rollPositionPlayer,
} from "./positions";

// Turns d66 results such as 36 into the two random numbers that roll them.
function dice(...results: number[]) {
  const queue = results.flatMap((result) =>
    [Math.floor(result / 10), result % 10].map((face) => (face - 0.5) / 6),
  );
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("ran out of scripted dice");
    return next;
  };
}

const allTables: [string, readonly D66Row<string>[]][] = [
  ...Object.entries(ARCHETYPE_TABLES).map(
    ([key, rows]): [string, readonly D66Row<string>[]] => [`archetype ${key}`, rows],
  ),
  ["elite check", ELITE_CHECK_TABLE],
  ...ARCHETYPES.flatMap((archetype) =>
    GRADE_ATTRIBUTES.map(
      (attribute): [string, readonly D66Row<string>[]] => [
        `${archetype} ${attribute}`,
        GRADE_TABLES[archetype][attribute],
      ],
    ),
  ),
];

describe("position player tables", () => {
  it("has 7 archetype tables, the elite check and 24 grade tables", () => {
    expect(allTables).toHaveLength(32);
  });

  it.each(allTables)("%s covers 11 to 66 with no gaps or overlaps", (_name, rows) => {
    for (const result of D66_RESULTS) {
      const matches = rows.filter((row) => result >= row.low && result <= row.high);
      expect(matches, `roll ${result}`).toHaveLength(1);
    }
    for (const row of rows) {
      expect(D66_RESULTS).toContain(row.low);
      expect(D66_RESULTS).toContain(row.high);
    }
  });

  it("matches the handbook archetype tables at range edges", () => {
    const edges: [keyof typeof ARCHETYPE_TABLES, number, string][] = [
      ["C", 26, "JM"], ["C", 31, "DS"], ["C", 44, "DS"], ["C", 45, "HE"],
      ["C", 53, "HE"], ["C", 54, "HK"], ["C", 65, "HK"], ["C", 66, "5T"],
      ["1B", 24, "JM"], ["1B", 25, "DS"], ["1B", 34, "DS"], ["1B", 35, "HE"],
      ["1B", 51, "HE"], ["1B", 52, "HK"], ["1B", 63, "HK"], ["1B", 64, "5T"],
      ["2B", 32, "JM"], ["2B", 33, "DS"], ["2B", 54, "DS"], ["2B", 55, "HE"],
      ["2B", 61, "HE"], ["2B", 62, "HK"], ["2B", 64, "HK"], ["2B", 65, "5T"],
      ["SS", 32, "JM"], ["SS", 33, "DS"], ["SS", 53, "DS"], ["SS", 54, "HE"],
      ["SS", 61, "HE"], ["SS", 62, "HK"], ["SS", 64, "HK"], ["SS", 65, "5T"],
      ["3B", 23, "JM"], ["3B", 24, "DS"], ["3B", 34, "DS"], ["3B", 35, "HE"],
      ["3B", 51, "HE"], ["3B", 52, "HK"], ["3B", 61, "HK"], ["3B", 62, "5T"],
      ["OF", 26, "JM"], ["OF", 31, "DS"], ["OF", 36, "DS"], ["OF", 41, "HE"],
      ["OF", 52, "HE"], ["OF", 53, "HK"], ["OF", 61, "HK"], ["OF", 62, "5T"],
      ["DH", 26, "JM"], ["DH", 31, "HE"], ["DH", 56, "HE"], ["DH", 61, "HK"],
      ["DH", 66, "HK"],
    ];
    for (const [key, roll, archetype] of edges) {
      expect(lookupD66(ARCHETYPE_TABLES[key], roll), `${key} ${roll}`).toBe(archetype);
    }
  });

  it("never gives a DH the DS, 5T or 5E archetype", () => {
    const results = new Set(ARCHETYPE_TABLES.DH.map((row) => row.value));
    expect([...results].sort()).toEqual(["HE", "HK", "JM"]);
  });

  it("makes a five-tool player elite on 51 to 66", () => {
    expect(lookupD66(ELITE_CHECK_TABLE, 46)).toBe("5T");
    expect(lookupD66(ELITE_CHECK_TABLE, 51)).toBe("5E");
  });

  it("matches the handbook grade tables at range edges", () => {
    const edges: [(typeof ARCHETYPES)[number], (typeof GRADE_ATTRIBUTES)[number], number, string][] = [
      ["5E", "hitting", 14, "B"], ["5E", "hitting", 15, "B+"], ["5E", "hitting", 34, "B+"],
      ["5E", "hitting", 35, "A"], ["5E", "hitting", 54, "A"], ["5E", "hitting", 55, "A+"],
      ["5E", "power", 21, "B"], ["5E", "power", 22, "B+"], ["5E", "power", 54, "B+"], ["5E", "power", 55, "A"],
      ["5E", "defense", 16, "B"], ["5E", "defense", 21, "B+"], ["5E", "defense", 46, "B+"], ["5E", "defense", 51, "A"],
      ["5E", "clutch", 16, "D"], ["5E", "clutch", 26, "C"], ["5E", "clutch", 46, "B"], ["5E", "clutch", 56, "B+"], ["5E", "clutch", 61, "A"],
      ["5T", "hitting", 12, "B"], ["5T", "hitting", 13, "B+"], ["5T", "hitting", 36, "B+"], ["5T", "hitting", 41, "A"],
      ["5T", "power", 31, "B"], ["5T", "power", 32, "B+"],
      ["5T", "defense", 16, "B"], ["5T", "defense", 56, "B+"], ["5T", "defense", 61, "A"],
      ["HE", "hitting", 21, "B"], ["HE", "hitting", 22, "B+"], ["HE", "hitting", 42, "B+"],
      ["HE", "hitting", 43, "A"], ["HE", "hitting", 56, "A"], ["HE", "hitting", 61, "A+"],
      ["HE", "power", 15, "F"], ["HE", "power", 16, "D"], ["HE", "power", 31, "D"],
      ["HE", "power", 32, "C"], ["HE", "power", 46, "C"], ["HE", "power", 51, "B"],
      ["HE", "defense", 11, "F"], ["HE", "defense", 12, "D"], ["HE", "defense", 15, "D"],
      ["HE", "defense", 16, "C"], ["HE", "defense", 24, "C"], ["HE", "defense", 25, "B"],
      ["HE", "defense", 46, "B"], ["HE", "defense", 51, "B+"],
      ["HK", "hitting", 14, "D"], ["HK", "hitting", 15, "C"], ["HK", "hitting", 34, "C"],
      ["HK", "hitting", 35, "B"], ["HK", "hitting", 44, "B"], ["HK", "hitting", 45, "B+"],
      ["HK", "power", 31, "B+"], ["HK", "power", 32, "A"], ["HK", "power", 54, "A"], ["HK", "power", 55, "A+"],
      ["HK", "defense", 22, "F"], ["HK", "defense", 23, "D"], ["HK", "defense", 34, "D"], ["HK", "defense", 35, "C"],
      ["HK", "clutch", 12, "F"], ["HK", "clutch", 13, "D"], ["HK", "clutch", 26, "D"],
      ["HK", "clutch", 31, "C"], ["HK", "clutch", 46, "C"], ["HK", "clutch", 51, "B"], ["HK", "clutch", 66, "B"],
      ["DS", "hitting", 16, "F"], ["DS", "hitting", 21, "D"], ["DS", "hitting", 33, "D"],
      ["DS", "hitting", 34, "C"], ["DS", "hitting", 43, "C"], ["DS", "hitting", 44, "B"],
      ["DS", "power", 11, "F"], ["DS", "power", 12, "D"], ["DS", "power", 23, "D"],
      ["DS", "power", 24, "C"], ["DS", "power", 64, "C"], ["DS", "power", 65, "B"],
      ["DS", "defense", 31, "B+"], ["DS", "defense", 32, "A"], ["DS", "defense", 53, "A"], ["DS", "defense", 54, "A+"],
      ["JM", "hitting", 11, "F"], ["JM", "hitting", 12, "D"], ["JM", "hitting", 14, "D"],
      ["JM", "hitting", 15, "C"], ["JM", "hitting", 41, "C"], ["JM", "hitting", 42, "B"],
      ["JM", "power", 12, "F"], ["JM", "power", 13, "D"], ["JM", "power", 23, "D"],
      ["JM", "power", 24, "C"], ["JM", "power", 63, "C"], ["JM", "power", 64, "B"],
      ["JM", "defense", 11, "F"], ["JM", "defense", 12, "D"], ["JM", "defense", 14, "D"],
      ["JM", "defense", 15, "C"], ["JM", "defense", 31, "C"], ["JM", "defense", 32, "B"],
      ["JM", "clutch", 16, "F"], ["JM", "clutch", 21, "D"], ["JM", "clutch", 31, "C"],
      ["JM", "clutch", 36, "C"], ["JM", "clutch", 41, "B"], ["JM", "clutch", 51, "B+"], ["JM", "clutch", 61, "A"],
    ];
    for (const [archetype, attribute, roll, grade] of edges) {
      expect(
        lookupD66(GRADE_TABLES[archetype][attribute], roll),
        `${archetype} ${attribute} ${roll}`,
      ).toBe(grade);
    }
  });

  it("never rolls a grade above the archetype's ceiling", () => {
    for (const archetype of ARCHETYPES) {
      for (const attribute of GRADE_ATTRIBUTES) {
        const ceiling = gradeValue(ARCHETYPE_CEILINGS[archetype][attribute]);
        for (const row of GRADE_TABLES[archetype][attribute]) {
          expect(gradeValue(row.value), `${archetype} ${attribute}`).toBeLessThanOrEqual(ceiling);
        }
      }
    }
  });
});

describe("archetypeTableKey", () => {
  it("sends every outfield slot to the outfield table", () => {
    expect(archetypeTableKey("LF")).toBe("OF");
    expect(archetypeTableKey("CF")).toBe("OF");
    expect(archetypeTableKey("RF")).toBe("OF");
    expect(archetypeTableKey("SS")).toBe("SS");
    expect(archetypeTableKey("DH")).toBe("DH");
  });
});

describe("rollPositionPlayer", () => {
  it("makes six rolls when there is no elite check", () => {
    // The prototype's third baseman: 43 is HE, then age 45 and four grades.
    expect(rollPositionPlayer("3B", dice(43, 45, 51, 62, 33, 64))).toEqual({
      slot: "3B",
      archetype: "HE",
      age: 29,
      hitting: "A",
      power: "B",
      defense: "B",
      clutch: "A",
      hittingCeiling: "A+",
      powerCeiling: "B",
      defenseCeiling: "B+",
      clutchCeiling: "A",
      rolls: [
        { attribute: "archetype", tableKey: "position.archetype.3B", dice: "43", result: "HE" },
        { attribute: "age", tableKey: "position.age", dice: "45", result: "29" },
        { attribute: "hitting", tableKey: "position.HE.hitting", dice: "51", result: "A" },
        { attribute: "power", tableKey: "position.HE.power", dice: "62", result: "B" },
        { attribute: "defense", tableKey: "position.HE.defense", dice: "33", result: "B" },
        { attribute: "clutch", tableKey: "position.HE.clutch", dice: "64", result: "A" },
      ],
    });
  });

  it("keeps a five-tool player 5T when the elite check misses", () => {
    const player = rollPositionPlayer("CF", dice(63, 34, 21, 43, 41, 35, 36));
    expect(player).toMatchObject({
      archetype: "5T",
      age: 25,
      hitting: "A",
      power: "B+",
      defense: "B+",
      clutch: "B",
      hittingCeiling: "A",
      powerCeiling: "B+",
      defenseCeiling: "A",
      clutchCeiling: "A",
    });
    expect(player.rolls).toHaveLength(7);
    expect(player.rolls.slice(0, 2)).toEqual([
      { attribute: "archetype", tableKey: "position.archetype.OF", dice: "63", result: "5T" },
      { attribute: "eliteCheck", tableKey: "position.eliteCheck", dice: "34", result: "5T" },
    ]);
    expect(player.rolls[3].tableKey).toBe("position.5T.hitting");
  });

  it("turns a five-tool player into 5E and uses the 5E tables", () => {
    const player = rollPositionPlayer("C", dice(66, 51, 31, 55, 55, 51, 61));
    expect(player).toMatchObject({
      archetype: "5E",
      age: 27,
      hitting: "A+",
      power: "A",
      defense: "A",
      clutch: "A",
      hittingCeiling: "A+",
      powerCeiling: "A",
    });
    expect(player.rolls).toHaveLength(7);
    expect(player.rolls[0].result).toBe("5T");
    expect(player.rolls[1]).toMatchObject({ attribute: "eliteCheck", result: "5E" });
    expect(player.rolls[3].tableKey).toBe("position.5E.hitting");
  });

  it("rolls a DH on the DH table with no elite check", () => {
    // 62 is HK for a DH but would be 5T for an outfielder.
    const player = rollPositionPlayer("DH", dice(62, 65, 42, 56, 14, 61));
    expect(player).toMatchObject({
      slot: "DH",
      archetype: "HK",
      age: 34,
      hitting: "B",
      power: "A+",
      defense: "F",
      clutch: "B",
      defenseCeiling: "C",
    });
    expect(player.rolls).toHaveLength(6);
    expect(player.rolls[0].tableKey).toBe("position.archetype.DH");
  });

  it("gives every archetype its own ceilings", () => {
    // Catcher archetype rolls: 11 JM, 31 DS, 45 HE, 54 HK.
    expect(rollPositionPlayer("C", dice(11, 11, 11, 11, 11, 11))).toMatchObject({
      archetype: "JM", hittingCeiling: "B", powerCeiling: "B", defenseCeiling: "B", clutchCeiling: "A",
    });
    expect(rollPositionPlayer("C", dice(31, 11, 11, 11, 11, 11))).toMatchObject({
      archetype: "DS", hittingCeiling: "B", powerCeiling: "B", defenseCeiling: "A+", clutchCeiling: "A",
    });
    expect(rollPositionPlayer("C", dice(54, 11, 11, 11, 11, 11))).toMatchObject({
      archetype: "HK", hittingCeiling: "B+", powerCeiling: "A+", defenseCeiling: "C", clutchCeiling: "B",
    });
  });
});

describe("rollLineup", () => {
  it("fills nine slots in order with a DH", () => {
    expect(rollLineup(true).map((player) => player.slot)).toEqual([
      "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH",
    ]);
  });

  it("fills eight slots with no DH", () => {
    expect(rollLineup(false).map((player) => player.slot)).toEqual([
      "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF",
    ]);
  });
});
