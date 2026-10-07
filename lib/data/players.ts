import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { Grade } from "../rules/grades";
import {
  PITCHER_SLOTS,
  type HrTendency,
  type PitcherAttribute,
  type PitcherRole,
  type PitcherSlot,
  type RolledPitcher,
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
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

// The columns a roll decides, shared by creating a player and re-rolling one.
function pitcherColumns(pitcher: RolledPitcher) {
  return {
    age: pitcher.age,
    grade: pitcher.grade,
    gradeCeiling: pitcher.gradeCeiling,
    hrTendency: pitcher.hrTendency,
    stamina: pitcher.stamina,
  };
}

function positionColumns(player: RolledPositionPlayer) {
  return {
    archetype: player.archetype,
    age: player.age,
    hitting: player.hitting,
    power: player.power,
    defense: player.defense,
    clutch: player.clutch,
    hittingCeiling: player.hittingCeiling,
    powerCeiling: player.powerCeiling,
    defenseCeiling: player.defenseCeiling,
    clutchCeiling: player.clutchCeiling,
  };
}

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
        ...pitcherColumns(pitcher),
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
    lineup.map((player) => ({
      player: {
        slot: player.slot,
        // A player's natural position is the slot they were rolled for.
        naturalPosition: player.slot,
        name: player.name,
        nameListId: player.nameListId,
        ...positionColumns(player),
      },
      rolls: player.rolls,
    })),
    database,
  );
}

export type TeamPlayer =
  | { id: number; kind: "pitcher"; naturalPosition: PitcherRole }
  | { id: number; kind: "position"; naturalPosition: LineupSlot };

// What a re-roll needs to know about a player. Returns null when the player
// does not exist or belongs to another team or league.
export async function getTeamPlayer(
  leagueId: number,
  teamId: number,
  playerId: number,
  database?: Database,
): Promise<TeamPlayer | null> {
  const db = database ?? (await getDatabase());
  const [row] = await db
    .select({
      id: players.id,
      kind: players.kind,
      naturalPosition: players.naturalPosition,
    })
    .from(players)
    .where(
      and(
        eq(players.id, playerId),
        eq(players.leagueId, leagueId),
        eq(players.teamId, teamId),
      ),
    );
  return (row as TeamPlayer | undefined) ?? null;
}

export type RosterGrades = { teamId: number; slot: string } & (
  | { kind: "pitcher"; grade: Grade; hrTendency: HrTendency }
  | { kind: "position"; hitting: Grade; power: Grade; defense: Grade }
);

// The grades team and bullpen qualities are worked out from, for every
// player on a team in the league. Players with no team or slot are left out.
export async function listLeagueRosterGrades(
  leagueId: number,
  database?: Database,
): Promise<RosterGrades[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select({
      teamId: players.teamId,
      slot: players.slot,
      kind: players.kind,
      grade: players.grade,
      hrTendency: players.hrTendency,
      hitting: players.hitting,
      power: players.power,
      defense: players.defense,
    })
    .from(players)
    .where(
      and(
        eq(players.leagueId, leagueId),
        isNotNull(players.teamId),
        isNotNull(players.slot),
      ),
    );
  return rows.map(({ teamId, slot, kind, grade, hrTendency, hitting, power, defense }) =>
    kind === "pitcher"
      ? { teamId, slot, kind, grade, hrTendency }
      : { teamId, slot, kind, hitting, power, defense },
  ) as RosterGrades[];
}

export type NamedPlayer = {
  id: number;
  teamId: number | null;
  slot: string | null;
  name: string;
};

// Every player in the league who has a name, with where they play.
export async function listLeaguePlayerNames(
  leagueId: number,
  database?: Database,
): Promise<NamedPlayer[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select({
      id: players.id,
      teamId: players.teamId,
      slot: players.slot,
      name: players.name,
    })
    .from(players)
    .where(and(eq(players.leagueId, leagueId), isNotNull(players.name)));
  return rows.flatMap((row) => (row.name === null ? [] : [{ ...row, name: row.name }]));
}

export type PlayerName = { playerId: number; name: string; nameListId: number | null };

// Sets a player's name and nothing else. Returns false, writing nothing,
// when the player is not on that team.
async function writePlayerName(
  tx: Transaction,
  leagueId: number,
  teamId: number,
  { playerId, name, nameListId }: PlayerName,
): Promise<boolean> {
  const updated = await tx
    .update(players)
    .set({ name, nameListId })
    .where(
      and(
        eq(players.id, playerId),
        eq(players.leagueId, leagueId),
        eq(players.teamId, teamId),
      ),
    )
    .returning({ id: players.id });
  return updated.length > 0;
}

export async function renamePlayer(
  leagueId: number,
  teamId: number,
  entry: PlayerName,
  database?: Database,
): Promise<boolean> {
  const db = database ?? (await getDatabase());
  return db.transaction((tx) => writePlayerName(tx, leagueId, teamId, entry));
}

// Renames several players on one team, all or nothing.
export async function renameTeamPlayers(
  leagueId: number,
  teamId: number,
  entries: PlayerName[],
  database?: Database,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      if (!(await writePlayerName(tx, leagueId, teamId, entry))) {
        throw new Error(`Player ${entry.playerId} is not on team ${teamId}.`);
      }
    }
  });
}

// Every player on a team, pitchers and position players alike.
export async function listTeamPlayerIds(
  leagueId: number,
  teamId: number,
  database?: Database,
): Promise<TeamPlayer[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select({
      id: players.id,
      kind: players.kind,
      naturalPosition: players.naturalPosition,
    })
    .from(players)
    .where(and(eq(players.leagueId, leagueId), eq(players.teamId, teamId)));
  return rows as TeamPlayer[];
}

type RolledColumns =
  | ReturnType<typeof pitcherColumns>
  | ReturnType<typeof positionColumns>;

// Overwrites a player's rolled values and swaps its rolls for the new ones.
// The name, slot, natural position and team are not touched. Returns false,
// writing nothing, when no such player of that kind is on the team.
async function writePlayerValues(
  tx: Transaction,
  kind: PlayerKind,
  leagueId: number,
  teamId: number,
  playerId: number,
  columns: RolledColumns,
  newRolls: RollInsert[],
): Promise<boolean> {
  const updated = await tx
    .update(players)
    .set(columns)
    .where(
      and(
        eq(players.id, playerId),
        eq(players.leagueId, leagueId),
        eq(players.teamId, teamId),
        eq(players.kind, kind),
      ),
    )
    .returning({ id: players.id });
  if (updated.length === 0) return false;

  await tx.delete(rolls).where(eq(rolls.playerId, playerId));
  await tx.insert(rolls).values(
    newRolls.map((roll) => ({ ...roll, leagueId, playerId, source: "app" })),
  );
  return true;
}

// One player, all or nothing.
async function replacePlayerValues(
  kind: PlayerKind,
  leagueId: number,
  teamId: number,
  playerId: number,
  columns: RolledColumns,
  newRolls: RollInsert[],
  database?: Database,
): Promise<boolean> {
  const db = database ?? (await getDatabase());
  return db.transaction((tx) =>
    writePlayerValues(tx, kind, leagueId, teamId, playerId, columns, newRolls),
  );
}

export type RerolledPlayer =
  | { playerId: number; kind: "pitcher"; rolled: RolledPitcher }
  | { playerId: number; kind: "position"; rolled: RolledPositionPlayer };

// Replaces the values of several players on one team, all or nothing: if any
// of them cannot be written, none of them change.
export async function replaceTeamValues(
  leagueId: number,
  teamId: number,
  entries: RerolledPlayer[],
  database?: Database,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      const written = await writePlayerValues(
        tx,
        entry.kind,
        leagueId,
        teamId,
        entry.playerId,
        entry.kind === "pitcher"
          ? pitcherColumns(entry.rolled)
          : positionColumns(entry.rolled),
        entry.rolled.rolls,
      );
      if (!written) {
        throw new Error(`Player ${entry.playerId} is not on team ${teamId}.`);
      }
    }
  });
}

export function replacePitcherValues(
  leagueId: number,
  teamId: number,
  playerId: number,
  pitcher: RolledPitcher,
  database?: Database,
): Promise<boolean> {
  return replacePlayerValues(
    "pitcher",
    leagueId,
    teamId,
    playerId,
    pitcherColumns(pitcher),
    pitcher.rolls,
    database,
  );
}

export function replacePositionPlayerValues(
  leagueId: number,
  teamId: number,
  playerId: number,
  player: RolledPositionPlayer,
  database?: Database,
): Promise<boolean> {
  return replacePlayerValues(
    "position",
    leagueId,
    teamId,
    playerId,
    positionColumns(player),
    player.rolls,
    database,
  );
}
