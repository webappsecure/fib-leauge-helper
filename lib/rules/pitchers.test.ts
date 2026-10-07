import { describe, expect, it } from "vitest";
import { NEW_TEAM_AGE_TABLE } from "./age";
import { D66_RESULTS, lookupD66, type D66Row } from "./dice";
import { GRADES, gradeValue } from "./grades";
import {
  CL_STAMINA_TABLE,
  orderStarters,
  PITCHER_GRADE_TABLE,
  PITCHER_HR_TENDENCY_TABLE,
  PITCHER_SLOTS,
  pitcherCeiling,
  rollPitcher,
  rollPitchingStaff,
  SP_STAMINA_TABLE,
  STARTER_SLOTS,
} from "./pitchers";

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
  age: NEW_TEAM_AGE_TABLE,
  grade: PITCHER_GRADE_TABLE,
  "HR tendency": PITCHER_HR_TENDENCY_TABLE,
  "SP stamina": SP_STAMINA_TABLE,
  "CL stamina": CL_STAMINA_TABLE,
};

describe("pitcher tables", () => {
  it.each(Object.entries(tables))(
    "%s covers 11 to 66 with no gaps or overlaps",
    (_name, table) => {
      for (const result of D66_RESULTS) {
        const matches = table.filter(
          (row) => result >= row.low && result <= row.high,
        );
        expect(matches, `roll ${result}`).toHaveLength(1);
      }
      for (const row of table) {
        expect(D66_RESULTS).toContain(row.low);
        expect(D66_RESULTS).toContain(row.high);
      }
    },
  );

  it("matches the handbook at range edges", () => {
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 11)).toBe(21);
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 16)).toBe(24);
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 34)).toBe(27);
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 35)).toBe(28);
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 42)).toBe(28);
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 65)).toBe(34);
    expect(lookupD66(NEW_TEAM_AGE_TABLE, 66)).toBe(35);

    expect(lookupD66(PITCHER_GRADE_TABLE, 12)).toBe("F");
    expect(lookupD66(PITCHER_GRADE_TABLE, 13)).toBe("D");
    expect(lookupD66(PITCHER_GRADE_TABLE, 31)).toBe("C");
    expect(lookupD66(PITCHER_GRADE_TABLE, 32)).toBe("B");
    expect(lookupD66(PITCHER_GRADE_TABLE, 46)).toBe("B");
    expect(lookupD66(PITCHER_GRADE_TABLE, 61)).toBe("B+");
    expect(lookupD66(PITCHER_GRADE_TABLE, 64)).toBe("A");
    expect(lookupD66(PITCHER_GRADE_TABLE, 65)).toBe("A+");

    expect(lookupD66(PITCHER_HR_TENDENCY_TABLE, 13)).toBe("shaky");
    expect(lookupD66(PITCHER_HR_TENDENCY_TABLE, 23)).toBe("semi-shaky");
    expect(lookupD66(PITCHER_HR_TENDENCY_TABLE, 24)).toBe("neutral");
    expect(lookupD66(PITCHER_HR_TENDENCY_TABLE, 55)).toBe("neutral");
    expect(lookupD66(PITCHER_HR_TENDENCY_TABLE, 63)).toBe("semi-tough");
    expect(lookupD66(PITCHER_HR_TENDENCY_TABLE, 64)).toBe("tough");

    expect(lookupD66(SP_STAMINA_TABLE, 15)).toBe(5);
    expect(lookupD66(SP_STAMINA_TABLE, 16)).toBe(6);
    expect(lookupD66(SP_STAMINA_TABLE, 61)).toBe(6);
    expect(lookupD66(SP_STAMINA_TABLE, 62)).toBe(7);

    expect(lookupD66(CL_STAMINA_TABLE, 64)).toBe(1);
    expect(lookupD66(CL_STAMINA_TABLE, 65)).toBe(2);
  });
});

describe("grades", () => {
  it("runs F 1 to A+ 7", () => {
    expect(GRADES.map(gradeValue)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(gradeValue("B")).toBe(4);
  });
});

describe("pitcherCeiling", () => {
  it("is one grade higher before age 27", () => {
    expect(pitcherCeiling("C", 21)).toBe("B");
    expect(pitcherCeiling("B", 26)).toBe("B+");
  });

  it("equals the grade from age 27", () => {
    expect(pitcherCeiling("B", 27)).toBe("B");
    expect(pitcherCeiling("F", 35)).toBe("F");
  });

  it("is capped at A+", () => {
    expect(pitcherCeiling("A+", 21)).toBe("A+");
    expect(pitcherCeiling("A", 26)).toBe("A+");
  });
});

describe("rollPitcher", () => {
  it("rolls age, grade, HR tendency and stamina for a starter", () => {
    expect(rollPitcher("SP", dice(36, 63, 61, 64))).toEqual({
      role: "SP",
      age: 28,
      grade: "A",
      gradeCeiling: "A",
      hrTendency: "semi-tough",
      stamina: 7,
      rolls: [
        { attribute: "age", tableKey: "pitcher.age", dice: "36", result: "28" },
        { attribute: "grade", tableKey: "pitcher.grade", dice: "63", result: "A" },
        {
          attribute: "hrTendency",
          tableKey: "pitcher.hrTendency",
          dice: "61",
          result: "semi-tough",
        },
        {
          attribute: "stamina",
          tableKey: "pitcher.spStamina",
          dice: "64",
          result: "7",
        },
      ],
    });
  });

  it("makes three rolls and gives no stamina to a reliever", () => {
    const pitcher = rollPitcher("RP", dice(16, 31, 35));
    expect(pitcher).toMatchObject({
      age: 24,
      grade: "C",
      gradeCeiling: "B",
      hrTendency: "neutral",
      stamina: null,
    });
    expect(pitcher.rolls.map((roll) => roll.attribute)).toEqual([
      "age",
      "grade",
      "hrTendency",
    ]);
  });

  it("rolls closer stamina on its own table", () => {
    const pitcher = rollPitcher("CL", dice(41, 62, 46, 65));
    expect(pitcher.stamina).toBe(2);
    expect(pitcher.rolls[3]).toEqual({
      attribute: "stamina",
      tableKey: "pitcher.clStamina",
      dice: "65",
      result: "2",
    });
  });

  it("keeps stamina in range for every roll", () => {
    for (const result of D66_RESULTS) {
      const starter = rollPitcher("SP", dice(11, 11, 11, result)).stamina;
      const closer = rollPitcher("CL", dice(11, 11, 11, result)).stamina;
      expect([5, 6, 7]).toContain(starter);
      expect([1, 2]).toContain(closer);
    }
  });
});

describe("rollPitchingStaff", () => {
  it("fills SP1 to SP6, RP1 to RP4 and CL with 40 rolls", () => {
    const staff = rollPitchingStaff();
    expect(staff.map((pitcher) => pitcher.slot)).toEqual([...PITCHER_SLOTS]);
    expect(staff.map((pitcher) => pitcher.role)).toEqual([
      "SP", "SP", "SP", "SP", "SP", "SP", "RP", "RP", "RP", "RP", "CL",
    ]);
    expect(staff.flatMap((pitcher) => pitcher.rolls)).toHaveLength(40);
  });
});

describe("orderStarters", () => {
  const starter = (name: string, grade: string, hrTendency: string, stamina: number | null) =>
    ({ name, grade, hrTendency, stamina }) as Parameters<typeof orderStarters>[0][number] & {
      name: string;
    };
  const names = (starters: ReturnType<typeof starter>[]) =>
    orderStarters(starters).map((entry) => entry.name);

  it("puts the higher grade first", () => {
    expect(
      names([
        starter("c", "C", "tough", 7),
        starter("a-plus", "A+", "shaky", 5),
        starter("f", "F", "tough", 7),
        starter("b-plus", "B+", "neutral", 6),
        starter("a", "A", "neutral", 6),
        starter("b", "B", "neutral", 6),
      ]),
    ).toEqual(["a-plus", "a", "b-plus", "b", "c", "f"]);
  });

  it("breaks a tie on grade with tougher HR control, then more stamina", () => {
    expect(
      names([
        starter("shaky", "B", "shaky", 7),
        starter("neutral-5", "B", "neutral", 5),
        starter("tough", "B", "tough", 5),
        starter("neutral-7", "B", "neutral", 7),
        starter("semi-tough", "B", "semi-tough", 5),
        starter("semi-shaky", "B", "semi-shaky", 7),
      ]),
    ).toEqual(["tough", "semi-tough", "neutral-7", "neutral-5", "semi-shaky", "shaky"]);
  });

  it("keeps equal starters in the order they came in and does not change its input", () => {
    const equal = ["first", "second", "third"].map((name) => starter(name, "B", "neutral", 6));
    expect(names(equal)).toEqual(["first", "second", "third"]);
    const mixed = [starter("low", "D", "neutral", 6), starter("high", "A", "neutral", 6)];
    orderStarters(mixed);
    expect(mixed.map((entry) => entry.name)).toEqual(["low", "high"]);
  });
});

describe("a rolled staff", () => {
  it("has its starters best first in SP1 to SP6 and leaves the bullpen in its slots", () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const staff = rollPitchingStaff();
      expect(staff.map((pitcher) => pitcher.slot)).toEqual([...PITCHER_SLOTS]);
      const starters = staff.filter((pitcher) => pitcher.role === "SP");
      expect(starters.map((pitcher) => pitcher.slot)).toEqual([...STARTER_SLOTS]);
      expect(orderStarters(starters)).toEqual(starters);
      expect(staff.slice(6).map((pitcher) => pitcher.role)).toEqual(["RP", "RP", "RP", "RP", "CL"]);
    }
  });

  it("gives SP1 to the best of six scripted starters", () => {
    // Grade rolls of 11 are the lowest and 66 the highest; the fourth starter rolled gets 66.
    const scripted = [
      ...[11, 11, 11, 11], ...[11, 11, 11, 11], ...[11, 11, 11, 11],
      ...[11, 66, 11, 11], ...[11, 11, 11, 11], ...[11, 11, 11, 11],
      ...[11, 11, 11], ...[11, 11, 11], ...[11, 11, 11], ...[11, 11, 11],
      ...[11, 11, 11, 11],
    ];
    const staff = rollPitchingStaff(dice(...scripted));
    expect(staff[0].slot).toBe("SP1");
    expect(staff[0].rolls.find((roll) => roll.attribute === "grade")?.dice).toBe("66");
    expect(staff.slice(1, 6).every((pitcher) =>
      pitcher.rolls.find((roll) => roll.attribute === "grade")?.dice === "11",
    )).toBe(true);
  });
});
