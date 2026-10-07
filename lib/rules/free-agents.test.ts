import { describe, expect, it } from "vitest";
import { D66_RESULTS, lookupD66, type D66Row } from "./dice";
import {
  FREE_AGENT_AGE_TABLE,
  FREE_AGENT_ARCHETYPE_TABLE,
  FREE_AGENT_GRADE_TABLES,
  FREE_AGENT_PITCHER_GRADE_TABLE,
  FREE_AGENT_POSITIONS,
  FREE_AGENT_SP_STAMINA_TABLE,
  isPitcherRole,
  rollFreeAgentPitcher,
  rollFreeAgentPositionPlayer,
} from "./free-agents";
import { GRADE_ATTRIBUTES } from "./positions";

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

const tables: Record<string, readonly D66Row<string | number>[]> = {
  age: FREE_AGENT_AGE_TABLE,
  "pitcher grade": FREE_AGENT_PITCHER_GRADE_TABLE,
  "SP stamina": FREE_AGENT_SP_STAMINA_TABLE,
  archetype: FREE_AGENT_ARCHETYPE_TABLE,
  ...Object.fromEntries(
    Object.entries(FREE_AGENT_GRADE_TABLES).flatMap(([archetype, byAttribute]) =>
      GRADE_ATTRIBUTES.map((attribute) => [
        `${archetype} ${attribute}`,
        byAttribute[attribute],
      ]),
    ),
  ),
};

describe("free agent tables", () => {
  it.each(Object.entries(tables))(
    "%s covers 11 to 66 with no gaps or overlaps",
    (_name, table) => {
      for (const result of D66_RESULTS) {
        const matches = table.filter((row) => result >= row.low && result <= row.high);
        expect(matches, `roll ${result}`).toHaveLength(1);
      }
      for (const row of table) {
        expect(D66_RESULTS).toContain(row.low);
        expect(D66_RESULTS).toContain(row.high);
      }
    },
  );

  it("matches the handbook at range edges", () => {
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 11)).toBe(25);
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 21)).toBe(27);
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 32)).toBe(29);
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 36)).toBe(30);
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 41)).toBe(31);
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 62)).toBe(34);
    expect(lookupD66(FREE_AGENT_AGE_TABLE, 66)).toBe(36);
    expect(lookupD66(FREE_AGENT_PITCHER_GRADE_TABLE, 26)).toBe("D");
    expect(lookupD66(FREE_AGENT_PITCHER_GRADE_TABLE, 45)).toBe("C");
    expect(lookupD66(FREE_AGENT_PITCHER_GRADE_TABLE, 65)).toBe("B+");
    expect(lookupD66(FREE_AGENT_PITCHER_GRADE_TABLE, 66)).toBe("A");
    expect(lookupD66(FREE_AGENT_SP_STAMINA_TABLE, 31)).toBe(5);
    expect(lookupD66(FREE_AGENT_SP_STAMINA_TABLE, 62)).toBe(6);
    expect(lookupD66(FREE_AGENT_SP_STAMINA_TABLE, 63)).toBe(7);
    expect(lookupD66(FREE_AGENT_ARCHETYPE_TABLE, 56)).toBe("JM");
    expect(lookupD66(FREE_AGENT_ARCHETYPE_TABLE, 61)).toBe("DS");
    expect(lookupD66(FREE_AGENT_ARCHETYPE_TABLE, 64)).toBe("HE");
    expect(lookupD66(FREE_AGENT_ARCHETYPE_TABLE, 65)).toBe("HK");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.JM.hitting, 53)).toBe("C");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.JM.hitting, 54)).toBe("B");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.JM.clutch, 32)).toBe("C");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.HE.clutch, 16)).toBe("D");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.DS.clutch, 35)).toBe("C");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.DS.defense, 61)).toBe("A");
    expect(lookupD66(FREE_AGENT_GRADE_TABLES.HK.power, 65)).toBe("B+");
  });

  it("lists nine positions, pitchers first", () => {
    expect(FREE_AGENT_POSITIONS).toEqual(["SP", "RP", "CL", "C", "1B", "2B", "SS", "3B", "OF"]);
    expect(FREE_AGENT_POSITIONS.filter(isPitcherRole)).toEqual(["SP", "RP", "CL"]);
  });
});

describe("rollFreeAgentPitcher", () => {
  it("rolls a starter in handbook order, with the grade as the ceiling", () => {
    // Age 25 is under 27, where a new-team pitcher would get a higher ceiling.
    const pitcher = rollFreeAgentPitcher("SP", dice(11, 46, 64, 63));
    expect(pitcher).toMatchObject({
      role: "SP",
      age: 25,
      grade: "B",
      gradeCeiling: "B",
      hrTendency: "tough",
      stamina: 7,
    });
    expect(pitcher.rolls).toEqual([
      { attribute: "age", tableKey: "freeAgent.age", dice: "11", result: "25" },
      { attribute: "grade", tableKey: "freeAgent.pitcher.grade", dice: "46", result: "B" },
      { attribute: "hrTendency", tableKey: "pitcher.hrTendency", dice: "64", result: "tough" },
      { attribute: "stamina", tableKey: "freeAgent.spStamina", dice: "63", result: "7" },
    ]);
  });

  it("rolls no stamina for a reliever", () => {
    const pitcher = rollFreeAgentPitcher("RP", dice(66, 66, 24));
    expect(pitcher).toMatchObject({
      role: "RP",
      age: 36,
      grade: "A",
      gradeCeiling: "A",
      hrTendency: "neutral",
      stamina: null,
    });
    expect(pitcher.rolls.map((roll) => roll.attribute)).toEqual(["age", "grade", "hrTendency"]);
  });

  it("rolls closer stamina on the closer table", () => {
    const pitcher = rollFreeAgentPitcher("CL", dice(33, 12, 13, 65));
    expect(pitcher).toMatchObject({
      role: "CL",
      age: 30,
      grade: "F",
      gradeCeiling: "F",
      hrTendency: "shaky",
      stamina: 2,
    });
    expect(pitcher.rolls[3]).toMatchObject({ tableKey: "pitcher.clStamina", dice: "65" });
  });
});

describe("rollFreeAgentPositionPlayer", () => {
  it.each([
    // Archetype, age, hitting, power, defense, clutch.
    ["JM", [56, 45, 54, 61, 41, 66], { age: 32, hitting: "B", power: "C", defense: "B", clutch: "A+" }],
    ["DS", [61, 11, 61, 56, 61, 22], { age: 25, hitting: "C", power: "F", defense: "A", clutch: "D" }],
    ["HE", [63, 53, 65, 51, 46, 61], { age: 33, hitting: "B+", power: "C", defense: "D", clutch: "A" }],
    ["HK", [65, 66, 46, 65, 61, 36], { age: 36, hitting: "C", power: "B+", defense: "D", clutch: "B" }],
  ] as const)("rolls a %s with each grade as its ceiling", (archetype, rolled, expected) => {
    const player = rollFreeAgentPositionPlayer("OF", dice(...rolled));
    expect(player).toMatchObject({
      position: "OF",
      archetype,
      ...expected,
      hittingCeiling: expected.hitting,
      powerCeiling: expected.power,
      defenseCeiling: expected.defense,
      clutchCeiling: expected.clutch,
    });
    expect(player.rolls.map((roll) => roll.attribute)).toEqual([
      "archetype",
      "age",
      "hitting",
      "power",
      "defense",
      "clutch",
    ]);
    expect(player.rolls[0].tableKey).toBe("freeAgent.archetype");
    expect(player.rolls[2].tableKey).toBe(`freeAgent.${archetype}.hitting`);
  });

  it("keeps a clutch grade above the archetype's usual ceiling", () => {
    // A slugger's clutch normally tops out at B.
    const player = rollFreeAgentPositionPlayer("1B", dice(65, 11, 11, 11, 11, 66));
    expect(player.clutch).toBe("A+");
    expect(player.clutchCeiling).toBe("A+");
  });
});
