import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { Grade } from "../rules/grades";
import {
  PITCHER_SLOTS,
  type HrTendency,
  type PitcherAttribute,
  type PitcherRole,
  type PitcherSlot,
  type StaffPitcher,
} from "../rules/pitchers";
import {
  LINEUP_SLOTS,
  type Archetype,
  type LineupSlot,
  type PositionAttribute,
  type RolledPositionPlayer,
} from "../rules/positions";
import { getDatabase, type Database } from "./db";
import { players, rolls } from "./schema";

export type RollSource = "app" | "entered" | "edited";

export type PlayerRoll = {
  attribute: PitcherAttribute | PositionAttribute;
  tableKey: string;
  dice: string;
  result: string;
  source: RollSource;
};

type PlayerBase = {
  id: number;
  leagueId: number;
  teamId: number;
  name: string | null;
  nameListId: number | null;
  age: number;
  breakthroughUsed: boolean;
  rolls: PlayerRoll[];
};

export type Pitcher = PlayerBase & {
  slot: PitcherSlot;
  naturalPosition: PitcherRole;
  grade: Grade;
  gradeCeiling: Grade;
  hrTendency: HrTendency;
  stamina: number | null;
};

export type PositionPlayer = PlayerBase & {
  slot: LineupSlot;
  naturalPosition: LineupSlot;
  archetype: Archetype;
  hitting: Grade;
  power: Grade;
  defense: Grade;
  clutch: Grade;
  hittingCeiling: Grade;
  powerCeiling: Grade;
  defenseCeiling: Grade;
  clutchCeiling: Grade;
};

type Named = { name: string | null; nameListId: number | null };

export type NewPitcher = StaffPitcher & Named;
export type NewPositionPlayer = RolledPositionPlayer & Named;

type PlayerKind = "pitcher" | "position";

// A team's players of one kind, each with the dice behind its values.
async function listTeamPlayers(
  kind: PlayerKind,
  leagueId: number,
  teamId: number,
  database?: Database,
) {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select()
    .from(players)
    .where(
      and(
        eq(players.leagueId, leagueId),
        eq(players.teamId, teamId),
        eq(players.kind, kind),
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

  return rows.map((row) => ({
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
  }));
}

// Text columns come back as plain strings; the create functions below only
// write values produced by the rules code.
export async function listTeamPitchers(
  leagueId: number,
  teamId: number,
  database?: Database,
): Promise<Pitcher[]> {
  const rows = await listTeamPlayers("pitcher", leagueId, teamId, database);
  return (rows as unknown as Pitcher[]).sort(
    (a, b) => PITCHER_SLOTS.indexOf(a.slot) - PITCHER_SLOTS.indexOf(b.slot),
  );
}

export async function listTeamPositionPlayers(
  leagueId: number,
  teamId: number,
  database?: Database,
): Promise<PositionPlayer[]> {
  const rows = await listTeamPlayers("position", leagueId, teamId, database);
  return (rows as unknown as PositionPlayer[]).sort(
    (a, b) => LINEUP_SLOTS.indexOf(a.slot) - LINEUP_SLOTS.indexOf(b.slot),
  );
}

export type TeamPlayerCount = {
  teamId: number;
  pitchers: number;
  positionPlayers: number;
};

// Player counts for every team in the league that has at least one player.
export async function countPlayersByTeam(
  leagueId: number,
  database?: Database,
): Promise<TeamPlayerCount[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select({ teamId: players.teamId, kind: players.kind, total: count() })
    .from(players)
    .where(and(eq(players.leagueId, leagueId), isNotNull(players.teamId)))
    .groupBy(players.teamId, players.kind);

  const counts = new Map<number, TeamPlayerCount>();
  for (const row of rows) {
    if (row.teamId === null) continue;
    const entry = counts.get(row.teamId) ?? {
      teamId: row.teamId,
      pitchers: 0,
      positionPlayers: 0,
    };
    if (row.kind === "pitcher") entry.pitchers = row.total;
    else entry.positionPlayers = row.total;
    counts.set(row.teamId, entry);
  }
  return [...counts.values()];
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

type PlayerInsert = Omit<typeof players.$inferInsert, "leagueId" | "teamId" | "kind">;
type RollInsert = Pick<PlayerRoll, "attribute" | "tableKey" | "dice" | "result">;

// Saves a team's players of one kind and their rolls together. A team that
// already has a player of that kind is left untouched, so a repeated request
// cannot add a second set.
async function createTeamPlayers(
  kind: PlayerKind,
  leagueId: number,
  teamId: number,
  entries: { player: PlayerInsert; rolls: RollInsert[] }[],
  database?: Database,
): Promise<{ created: boolean }> {
  const db = database ?? (await getDatabase());
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.teamId, teamId), eq(players.kind, kind)))
      .limit(1);
    if (existing.length > 0) return { created: false };

    for (const entry of entries) {
      const [{ id: playerId }] = await tx
        .insert(players)
        .values({ ...entry.player, leagueId, teamId, kind, breakthroughUsed: false })
        .returning({ id: players.id });
      await tx.insert(rolls).values(
        entry.rolls.map((roll) => ({
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

export function createPitchingStaff(
  leagueId: number,
  teamId: number,
  staff: NewPitcher[],
  database?: Database,
): Promise<{ created: boolean }> {
  return createTeamPlayers(
    "pitcher",
    leagueId,
    teamId,
    staff.map((pitcher) => ({
      player: {
        slot: pitcher.slot,
        naturalPosition: pitcher.role,
        name: pitcher.name,
        nameListId: pitcher.nameListId,
        age: pitcher.age,
        grade: pitcher.grade,
        gradeCeiling: pitcher.gradeCeiling,
        hrTendency: pitcher.hrTendency,
        stamina: pitcher.stamina,
      },
      rolls: pitcher.rolls,
    })),
    database,
  );
}

export function createPositionPlayers(
  leagueId: number,
  teamId: number,
  lineup: NewPositionPlayer[],
  database?: Database,
): Promise<{ created: boolean }> {
  return createTeamPlayers(
    "position",
    leagueId,
    teamId,
    lineup.map(({ rolls: playerRolls, slot, ...player }) => ({
      // A player's natural position is the slot they were rolled for.
      player: { ...player, slot, naturalPosition: slot },
      rolls: playerRolls,
    })),
    database,
  );
}
