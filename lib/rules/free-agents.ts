import { lookupD66, rollD66, type D66Row, type RandomSource } from "./dice";
import type { Grade } from "./grades";
import {
  CL_STAMINA_TABLE,
  PITCHER_HR_TENDENCY_TABLE,
  type PitcherAttribute,
  type PitcherRole,
  type RolledPitcher,
} from "./pitchers";
import type {
  Archetype,
  GradeAttribute,
  PositionAttribute,
  RolledPositionPlayer,
} from "./positions";

// Free agents for an established league (handbook 2.2). The pool is kept by
// position, in this order. Outfielders are one position: a free agent has no
// outfield slot until a team signs them into one.
export const FREE_AGENT_POSITIONS = [
  "SP",
  "RP",
  "CL",
  "C",
  "1B",
  "2B",
  "SS",
  "3B",
  "OF",
] as const;

export type FreeAgentPosition = (typeof FREE_AGENT_POSITIONS)[number];
export type FreeAgentFieldPosition = Exclude<FreeAgentPosition, PitcherRole>;

export function isPitcherRole(position: FreeAgentPosition): position is PitcherRole {
  return position === "SP" || position === "RP" || position === "CL";
}

function table<T>(...rows: [low: number, high: number, value: T][]): D66Row<T>[] {
  return rows.map(([low, high, value]) => ({ low, high, value }));
}

// Pitchers and position players share this table (2.2.1 and 2.2.2 step 2).
export const FREE_AGENT_AGE_TABLE: readonly D66Row<number>[] = table(
  [11, 12, 25],
  [13, 14, 26],
  [15, 21, 27],
  [22, 24, 28],
  [25, 32, 29],
  [33, 36, 30],
  [41, 44, 31],
  [45, 52, 32],
  [53, 55, 33],
  [56, 62, 34],
  [63, 64, 35],
  [65, 66, 36],
);

// Handbook 2.2.1. HR tendency and closer stamina are printed unchanged from
// the new-team tables, so those are reused.
export const FREE_AGENT_PITCHER_GRADE_TABLE: readonly D66Row<Grade>[] = table(
  [11, 12, "F"],
  [13, 26, "D"],
  [31, 45, "C"],
  [46, 56, "B"],
  [61, 65, "B+"],
  [66, 66, "A"],
);

export const FREE_AGENT_SP_STAMINA_TABLE: readonly D66Row<number>[] = table(
  [11, 31, 5],
  [32, 62, 6],
  [63, 66, 7],
);

export type FreeAgentArchetype = Extract<Archetype, "JM" | "DS" | "HE" | "HK">;

// Handbook 2.2.2 step 1: one table for every position, and no five-tool
// players.
export const FREE_AGENT_ARCHETYPE_TABLE: readonly D66Row<FreeAgentArchetype>[] = table(
  [11, 56, "JM"],
  [61, 62, "DS"],
  [63, 64, "HE"],
  [65, 66, "HK"],
);

type GradeTable = readonly D66Row<Grade>[];

const HK_DS_CLUTCH: GradeTable = table(
  [11, 11, "F"],
  [12, 22, "D"],
  [23, 35, "C"],
  [36, 46, "B"],
  [51, 56, "B+"],
  [61, 65, "A"],
  [66, 66, "A+"],
);

// Handbook 2.2.2 step 3.
export const FREE_AGENT_GRADE_TABLES: Record<
  FreeAgentArchetype,
  Record<GradeAttribute, GradeTable>
> = {
  HE: {
    hitting: table([11, 64, "B"], [65, 66, "B+"]),
    power: table([11, 46, "D"], [51, 66, "C"]),
    defense: table([11, 46, "D"], [51, 66, "C"]),
    clutch: table(
      [11, 11, "F"],
      [12, 16, "D"],
      [21, 26, "C"],
      [31, 46, "B"],
      [51, 56, "B+"],
      [61, 65, "A"],
      [66, 66, "A+"],
    ),
  },
  HK: {
    hitting: table([11, 46, "C"], [51, 66, "B"]),
    power: table([11, 64, "B"], [65, 66, "B+"]),
    defense: table([11, 56, "F"], [61, 66, "D"]),
    clutch: HK_DS_CLUTCH,
  },
  DS: {
    hitting: table([11, 56, "D"], [61, 66, "C"]),
    power: table([11, 56, "F"], [61, 66, "D"]),
    defense: table([11, 26, "B"], [31, 56, "B+"], [61, 66, "A"]),
    clutch: HK_DS_CLUTCH,
  },
  JM: {
    hitting: table([11, 36, "D"], [41, 53, "C"], [54, 66, "B"]),
    power: table([11, 56, "D"], [61, 66, "C"]),
    defense: table([11, 36, "C"], [41, 66, "B"]),
    clutch: table(
      [11, 11, "F"],
      [12, 21, "D"],
      [22, 32, "C"],
      [33, 46, "B"],
      [51, 56, "B+"],
      [61, 65, "A"],
      [66, 66, "A+"],
    ),
  },
};

// Rolls age, grade and HR tendency, then stamina for SP and CL. The rolled
// grade is also the ceiling, whatever the age.
export function rollFreeAgentPitcher(
  role: PitcherRole,
  random: RandomSource = Math.random,
): RolledPitcher {
  const rolls: RolledPitcher["rolls"] = [];
  function roll<T extends string | number>(
    attribute: PitcherAttribute,
    tableKey: string,
    rows: readonly D66Row<T>[],
  ): T {
    const dice = rollD66(random);
    const value = lookupD66(rows, dice);
    rolls.push({ attribute, tableKey, dice: String(dice), result: String(value) });
    return value;
  }

  const age = roll("age", "freeAgent.age", FREE_AGENT_AGE_TABLE);
  const grade = roll("grade", "freeAgent.pitcher.grade", FREE_AGENT_PITCHER_GRADE_TABLE);
  const hrTendency = roll("hrTendency", "pitcher.hrTendency", PITCHER_HR_TENDENCY_TABLE);
  const stamina =
    role === "SP"
      ? roll("stamina", "freeAgent.spStamina", FREE_AGENT_SP_STAMINA_TABLE)
      : role === "CL"
        ? roll("stamina", "pitcher.clStamina", CL_STAMINA_TABLE)
        : null;

  return { role, age, grade, gradeCeiling: grade, hrTendency, stamina, rolls };
}

export type RolledFreeAgentPositionPlayer = Omit<RolledPositionPlayer, "slot"> & {
  position: FreeAgentFieldPosition;
};

// Rolls the archetype, the age, then the four grades. Each rolled grade is
// also that grade's ceiling, even above the archetype's usual ceiling.
export function rollFreeAgentPositionPlayer(
  position: FreeAgentFieldPosition,
  random: RandomSource = Math.random,
): RolledFreeAgentPositionPlayer {
  const rolls: RolledPositionPlayer["rolls"] = [];
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

  const archetype = roll("archetype", "freeAgent.archetype", FREE_AGENT_ARCHETYPE_TABLE);
  const age = roll("age", "freeAgent.age", FREE_AGENT_AGE_TABLE);
  const grade = (attribute: GradeAttribute) =>
    roll(
      attribute,
      `freeAgent.${archetype}.${attribute}`,
      FREE_AGENT_GRADE_TABLES[archetype][attribute],
    );
  const hitting = grade("hitting");
  const power = grade("power");
  const defense = grade("defense");
  const clutch = grade("clutch");

  return {
    position,
    archetype,
    age,
    hitting,
    power,
    defense,
    clutch,
    hittingCeiling: hitting,
    powerCeiling: power,
    defenseCeiling: defense,
    clutchCeiling: clutch,
    rolls,
  };
}
