import { describe, expect, it } from "vitest";
import { NEW_TEAM_AGE_TABLE } from "./age";
import { D66_RESULTS, lookupD66, type D66Row } from "./dice";
import { GRADES, gradeValue } from "./grades";
import {
  CL_STAMINA_TABLE,
  PITCHER_GRADE_TABLE,
  PITCHER_HR_TENDENCY_TABLE,
  PITCHER_SLOTS,
  SP_STAMINA_TABLE,
  pitcherCeiling,
  rollPitcher,
  rollPitchingStaff,
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
