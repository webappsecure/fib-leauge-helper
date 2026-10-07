import { NEW_TEAM_AGE_TABLE } from "./age";
import { lookupD66, rollD66, type D66Row, type RandomSource } from "./dice";
import { nextGrade, type Grade } from "./grades";

export type PitcherRole = "SP" | "RP" | "CL";

// Staff order on the team sheet (handbook 2.1): 6 SP, 4 RP and the closer.
export const PITCHER_SLOTS = [
  "SP1",
  "SP2",
  "SP3",
  "SP4",
  "SP5",
  "SP6",
  "RP1",
  "RP2",
  "RP3",
  "RP4",
  "CL",
] as const;

export type PitcherSlot = (typeof PITCHER_SLOTS)[number];

export function roleForSlot(slot: PitcherSlot): PitcherRole {
  return slot === "CL" ? "CL" : slot.startsWith("SP") ? "SP" : "RP";
}

// Lowest to highest, worth 1 to 5. A bullet marks a "semi" quality, as in the
// handbook.
export const HR_TENDENCIES = [
  { value: "shaky", label: "SHAKY" },
  { value: "semi-shaky", label: "SHAKY•" },
  { value: "neutral", label: "neutral" },
  { value: "semi-tough", label: "TOUGH•" },
  { value: "tough", label: "TOUGH" },
] as const;

export type HrTendency = (typeof HR_TENDENCIES)[number]["value"];

export function hrTendencyLabel(value: HrTendency) {
  return HR_TENDENCIES.find((entry) => entry.value === value)?.label ?? value;
}

// Tables from handbook 2.1.1, pitcher creation for new teams.
export const PITCHER_GRADE_TABLE: readonly D66Row<Grade>[] = [
  { low: 11, high: 12, value: "F" },
  { low: 13, high: 16, value: "D" },
  { low: 21, high: 31, value: "C" },
  { low: 32, high: 46, value: "B" },
  { low: 51, high: 61, value: "B+" },
  { low: 62, high: 64, value: "A" },
  { low: 65, high: 66, value: "A+" },
];

// The handbook prints the neutral row (24-55) with an empty quality.
export const PITCHER_HR_TENDENCY_TABLE: readonly D66Row<HrTendency>[] = [
  { low: 11, high: 13, value: "shaky" },
  { low: 14, high: 23, value: "semi-shaky" },
  { low: 24, high: 55, value: "neutral" },
  { low: 56, high: 63, value: "semi-tough" },
  { low: 64, high: 66, value: "tough" },
];

export const SP_STAMINA_TABLE: readonly D66Row<number>[] = [
  { low: 11, high: 15, value: 5 },
  { low: 16, high: 61, value: 6 },
  { low: 62, high: 66, value: 7 },
];

export const CL_STAMINA_TABLE: readonly D66Row<number>[] = [
  { low: 11, high: 64, value: 1 },
  { low: 65, high: 66, value: 2 },
];

export type PitcherAttribute = "age" | "grade" | "hrTendency" | "stamina";

export type PitcherRoll = {
  attribute: PitcherAttribute;
  tableKey: string;
  dice: string;
  result: string;
};

export type RolledPitcher = {
  role: PitcherRole;
  age: number;
  grade: Grade;
  gradeCeiling: Grade;
  hrTendency: HrTendency;
  stamina: number | null;
  rolls: PitcherRoll[];
};

// A pitcher of 27 or older has reached their ceiling; a younger one can
// still improve by one grade.
export function pitcherCeiling(grade: Grade, age: number): Grade {
  return age >= 27 ? grade : nextGrade(grade);
}

// Rolls age, grade and HR tendency, then stamina for SP and CL. Relief
// pitchers have no stamina and make no stamina roll.
export function rollPitcher(
  role: PitcherRole,
  random: RandomSource = Math.random,
): RolledPitcher {
  const rolls: PitcherRoll[] = [];
  function roll<T extends string | number>(
    attribute: PitcherAttribute,
    tableKey: string,
    table: readonly D66Row<T>[],
  ): T {
    const dice = rollD66(random);
    const value = lookupD66(table, dice);
    rolls.push({
      attribute,
      tableKey,
      dice: String(dice),
      result: String(value),
    });
    return value;
  }

  const age = roll("age", "pitcher.age", NEW_TEAM_AGE_TABLE);
  const grade = roll("grade", "pitcher.grade", PITCHER_GRADE_TABLE);
  const hrTendency = roll(
    "hrTendency",
    "pitcher.hrTendency",
    PITCHER_HR_TENDENCY_TABLE,
  );
  const stamina =
    role === "SP"
      ? roll("stamina", "pitcher.spStamina", SP_STAMINA_TABLE)
      : role === "CL"
        ? roll("stamina", "pitcher.clStamina", CL_STAMINA_TABLE)
        : null;

  return {
    role,
    age,
    grade,
    gradeCeiling: pitcherCeiling(grade, age),
    hrTendency,
    stamina,
    rolls,
  };
}

export type StaffPitcher = RolledPitcher & { slot: PitcherSlot };

export function rollPitchingStaff(
  random: RandomSource = Math.random,
): StaffPitcher[] {
  return PITCHER_SLOTS.map((slot) => ({
    slot,
    ...rollPitcher(roleForSlot(slot), random),
  }));
}
