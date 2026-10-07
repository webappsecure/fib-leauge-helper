import { NEW_TEAM_AGE_TABLE } from "./age";
import { lookupD66, rollD66, type D66Row, type RandomSource } from "./dice";
import type { Grade } from "./grades";

export const ARCHETYPES = ["5E", "5T", "HE", "HK", "DS", "JM"] as const;

export type Archetype = (typeof ARCHETYPES)[number];

// Lineup order on the team sheet. The DH is used only in a DH league.
export const LINEUP_SLOTS = [
  "C",
  "1B",
  "2B",
  "SS",
  "3B",
  "LF",
  "CF",
  "RF",
  "DH",
] as const;

export type LineupSlot = (typeof LINEUP_SLOTS)[number];

export const GRADE_ATTRIBUTES = ["hitting", "power", "defense", "clutch"] as const;

export type GradeAttribute = (typeof GRADE_ATTRIBUTES)[number];

function table<T>(...rows: [low: number, high: number, value: T][]): D66Row<T>[] {
  return rows.map(([low, high, value]) => ({ low, high, value }));
}

// The three outfield slots share one archetype table.
export type ArchetypeTableKey = "C" | "1B" | "2B" | "SS" | "3B" | "OF" | "DH";

export function archetypeTableKey(slot: LineupSlot): ArchetypeTableKey {
  return slot === "LF" || slot === "CF" || slot === "RF" ? "OF" : slot;
}

// Handbook 2.1.2 step 1. A DH is never a defensive specialist or five-tool
// player.
export const ARCHETYPE_TABLES: Record<
  ArchetypeTableKey,
  readonly D66Row<Archetype>[]
> = {
  C: table([11, 26, "JM"], [31, 44, "DS"], [45, 53, "HE"], [54, 65, "HK"], [66, 66, "5T"]),
  "1B": table([11, 24, "JM"], [25, 34, "DS"], [35, 51, "HE"], [52, 63, "HK"], [64, 66, "5T"]),
  "2B": table([11, 32, "JM"], [33, 54, "DS"], [55, 61, "HE"], [62, 64, "HK"], [65, 66, "5T"]),
  SS: table([11, 32, "JM"], [33, 53, "DS"], [54, 61, "HE"], [62, 64, "HK"], [65, 66, "5T"]),
  "3B": table([11, 23, "JM"], [24, 34, "DS"], [35, 51, "HE"], [52, 61, "HK"], [62, 66, "5T"]),
  OF: table([11, 26, "JM"], [31, 36, "DS"], [41, 52, "HE"], [53, 61, "HK"], [62, 66, "5T"]),
  DH: table([11, 26, "JM"], [31, 56, "HE"], [61, 66, "HK"]),
};

// Rolled only after a 5T archetype result: 51-66 makes the player elite.
export const ELITE_CHECK_TABLE: readonly D66Row<Archetype>[] = table(
  [11, 46, "5T"],
  [51, 66, "5E"],
);

type GradeTable = readonly D66Row<Grade>[];

const STANDARD_CLUTCH: GradeTable = table(
  [11, 16, "D"],
  [21, 26, "C"],
  [31, 46, "B"],
  [51, 56, "B+"],
  [61, 66, "A"],
);

// Handbook 2.1.2 step 3.
export const GRADE_TABLES: Record<Archetype, Record<GradeAttribute, GradeTable>> = {
  "5E": {
    hitting: table([11, 14, "B"], [15, 34, "B+"], [35, 54, "A"], [55, 66, "A+"]),
    power: table([11, 21, "B"], [22, 54, "B+"], [55, 66, "A"]),
    defense: table([11, 16, "B"], [21, 46, "B+"], [51, 66, "A"]),
    clutch: STANDARD_CLUTCH,
  },
  "5T": {
    hitting: table([11, 12, "B"], [13, 36, "B+"], [41, 66, "A"]),
    power: table([11, 31, "B"], [32, 66, "B+"]),
    defense: table([11, 16, "B"], [21, 56, "B+"], [61, 66, "A"]),
    clutch: STANDARD_CLUTCH,
  },
  HE: {
    hitting: table([11, 21, "B"], [22, 42, "B+"], [43, 56, "A"], [61, 66, "A+"]),
    power: table([11, 15, "F"], [16, 31, "D"], [32, 46, "C"], [51, 66, "B"]),
    defense: table([11, 11, "F"], [12, 15, "D"], [16, 24, "C"], [25, 46, "B"], [51, 66, "B+"]),
    clutch: STANDARD_CLUTCH,
  },
  HK: {
    hitting: table([11, 14, "D"], [15, 34, "C"], [35, 44, "B"], [45, 66, "B+"]),
    power: table([11, 31, "B+"], [32, 54, "A"], [55, 66, "A+"]),
    defense: table([11, 22, "F"], [23, 34, "D"], [35, 66, "C"]),
    clutch: table([11, 12, "F"], [13, 26, "D"], [31, 46, "C"], [51, 66, "B"]),
  },
  DS: {
    hitting: table([11, 16, "F"], [21, 33, "D"], [34, 43, "C"], [44, 66, "B"]),
    power: table([11, 11, "F"], [12, 23, "D"], [24, 64, "C"], [65, 66, "B"]),
    defense: table([11, 31, "B+"], [32, 53, "A"], [54, 66, "A+"]),
    clutch: STANDARD_CLUTCH,
  },
  JM: {
    hitting: table([11, 11, "F"], [12, 14, "D"], [15, 41, "C"], [42, 66, "B"]),
    power: table([11, 12, "F"], [13, 23, "D"], [24, 63, "C"], [64, 66, "B"]),
    defense: table([11, 11, "F"], [12, 14, "D"], [15, 31, "C"], [32, 66, "B"]),
    clutch: table(
      [11, 16, "F"],
      [21, 26, "D"],
      [31, 36, "C"],
      [41, 46, "B"],
      [51, 56, "B+"],
      [61, 66, "A"],
    ),
  },
};

// The highest grade each archetype can develop to (handbook 1.2.3 and
// 10.2.2.4). Age does not change these.
export const ARCHETYPE_CEILINGS: Record<Archetype, Record<GradeAttribute, Grade>> = {
  "5E": { hitting: "A+", power: "A", defense: "A", clutch: "A" },
  "5T": { hitting: "A", power: "B+", defense: "A", clutch: "A" },
  HE: { hitting: "A+", power: "B", defense: "B+", clutch: "A" },
  HK: { hitting: "B+", power: "A+", defense: "C", clutch: "B" },
  DS: { hitting: "B", power: "B", defense: "A+", clutch: "A" },
  JM: { hitting: "B", power: "B", defense: "B", clutch: "A" },
};

export type PositionAttribute = "archetype" | "eliteCheck" | "age" | GradeAttribute;

export type PositionRoll = {
  attribute: PositionAttribute;
  tableKey: string;
  dice: string;
  result: string;
};

export type RolledPositionPlayer = {
  slot: LineupSlot;
  archetype: Archetype;
  age: number;
  hitting: Grade;
  power: Grade;
  defense: Grade;
  clutch: Grade;
  hittingCeiling: Grade;
  powerCeiling: Grade;
  defenseCeiling: Grade;
  clutchCeiling: Grade;
  rolls: PositionRoll[];
};

// Rolls the archetype, the Elite check after a 5T result, the age, then the
// four grades on the final archetype's tables.
export function rollPositionPlayer(
  slot: LineupSlot,
  random: RandomSource = Math.random,
): RolledPositionPlayer {
  const rolls: PositionRoll[] = [];
  function roll<T extends string | number>(
    attribute: PositionAttribute,
    tableKey: string,
    rows: readonly D66Row<T>[],
  ): T {
    const dice = rollD66(random);
    const value = lookupD66(rows, dice);
    rolls.push({ attribute, tableKey, dice: String(dice), result: String(value) });
    return value;
  }

  const key = archetypeTableKey(slot);
  const rolled = roll("archetype", `position.archetype.${key}`, ARCHETYPE_TABLES[key]);
  const archetype =
    rolled === "5T"
      ? roll("eliteCheck", "position.eliteCheck", ELITE_CHECK_TABLE)
      : rolled;
  const age = roll("age", "position.age", NEW_TEAM_AGE_TABLE);
  const grade = (attribute: GradeAttribute) =>
    roll(attribute, `position.${archetype}.${attribute}`, GRADE_TABLES[archetype][attribute]);
  const hitting = grade("hitting");
  const power = grade("power");
  const defense = grade("defense");
  const clutch = grade("clutch");
  const ceilings = ARCHETYPE_CEILINGS[archetype];

  return {
    slot,
    archetype,
    age,
    hitting,
    power,
    defense,
    clutch,
    hittingCeiling: ceilings.hitting,
    powerCeiling: ceilings.power,
    defenseCeiling: ceilings.defense,
    clutchCeiling: ceilings.clutch,
    rolls,
  };
}

export function lineupSlots(useDh: boolean): LineupSlot[] {
  return LINEUP_SLOTS.filter((slot) => useDh || slot !== "DH");
}

export function rollLineup(
  useDh: boolean,
  random: RandomSource = Math.random,
): RolledPositionPlayer[] {
  return lineupSlots(useDh).map((slot) => rollPositionPlayer(slot, random));
}
