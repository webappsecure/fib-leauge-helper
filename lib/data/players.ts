import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Grade } from "../rules/grades";
import {
  PITCHER_SLOTS,
  type HrTendency,
  type PitcherAttribute,
  type PitcherRole,
  type PitcherSlot,
  type StaffPitcher,
} from "../rules/pitchers";
import { getDatabase, type Database } from "./db";
import { players, rolls } from "./schema";

export type RollSource = "app" | "entered" | "edited";

export type PlayerRoll = {
  attribute: PitcherAttribute;
  tableKey: string;
  dice: string;
  result: string;
  source: RollSource;
};

export type Pitcher = {
  id: number;
  leagueId: number;
  teamId: number;
  slot: PitcherSlot;
  naturalPosition: PitcherRole;
  name: string | null;
  nameListId: number | null;
  age: number;
  grade: Grade;
  gradeCeiling: Grade;
  hrTendency: HrTendency;
  stamina: number | null;
  breakthroughUsed: boolean;
  rolls: PlayerRoll[];
};

export type NewPitcher = StaffPitcher & {
  name: string | null;
  nameListId: number | null;
};

// A team's pitchers in staff order, each with the dice behind its values.
export async function listTeamPitchers(
  leagueId: number,
  teamId: number,
  database?: Database,
): Promise<Pitcher[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select()
    .from(players)
    .where(
      and(
        eq(players.leagueId, leagueId),
        eq(players.teamId, teamId),
        eq(players.kind, "pitcher"),
      ),
    );
  if (rows.length === 0) return [];

  const rollRows = await db
    .select()
    .from(rolls)
    .where(
      inArray(
        rolls.playerId,
        rows.map((row) => row.id),
      ),
    );

  // Text columns come back as plain strings; createPitchingStaff only writes
  // values produced by the rules code.
  const pitchers = rows.map((row) => ({
    ...row,
    rolls: rollRows
      .filter((roll) => roll.playerId === row.id)
      .map(({ attribute, tableKey, dice, result, source }) => ({
        attribute,
        tableKey,
        dice,
        result,
        source,
      })),
  })) as Pitcher[];

  return pitchers.sort(
    (a, b) => PITCHER_SLOTS.indexOf(a.slot) - PITCHER_SLOTS.indexOf(b.slot),
  );
}

// Ids from the name list already given to a player in this league.
export async function listUsedNameIds(
  leagueId: number,
  database?: Database,
): Promise<number[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select({ nameListId: players.nameListId })
    .from(players)
    .where(and(eq(players.leagueId, leagueId), isNotNull(players.nameListId)));
  return rows.flatMap((row) => (row.nameListId === null ? [] : [row.nameListId]));
}

// Saves a whole staff and its rolls together. A team that already has a
// pitcher is left untouched, so a repeated request cannot add a second staff.
export async function createPitchingStaff(
  leagueId: number,
  teamId: number,
  staff: NewPitcher[],
  database?: Database,
): Promise<{ created: boolean }> {
  const db = database ?? (await getDatabase());
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.teamId, teamId), eq(players.kind, "pitcher")))
      .limit(1);
    if (existing.length > 0) return { created: false };

    for (const pitcher of staff) {
      const [{ id: playerId }] = await tx
        .insert(players)
        .values({
          leagueId,
          teamId,
          slot: pitcher.slot,
          kind: "pitcher",
          naturalPosition: pitcher.role,
          name: pitcher.name,
          nameListId: pitcher.nameListId,
          age: pitcher.age,
          grade: pitcher.grade,
          gradeCeiling: pitcher.gradeCeiling,
          hrTendency: pitcher.hrTendency,
          stamina: pitcher.stamina,
          breakthroughUsed: false,
        })
        .returning({ id: players.id });
      await tx.insert(rolls).values(
        pitcher.rolls.map((roll) => ({
          ...roll,
          leagueId,
          playerId,
          source: "app",
        })),
      );
    }
    return { created: true };
  });
}
