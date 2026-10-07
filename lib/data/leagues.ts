import { desc, eq } from "drizzle-orm";
import { getDatabase, type Database } from "./db";
import { leagues, players, rolls, teams } from "./schema";

export type League = {
  id: number;
  name: string;
  startYear: number;
  teamCount: number;
  useDh: boolean;
  createdAt: string;
};

export type NewLeague = Pick<
  League,
  "name" | "startYear" | "teamCount" | "useDh"
>;

export async function createLeague(
  input: NewLeague,
  database?: Database,
): Promise<League> {
  const db = database ?? (await getDatabase());
  const [league] = await db
    .insert(leagues)
    .values({ ...input, createdAt: new Date().toISOString() })
    .returning();
  return league;
}

export async function listLeagues(database?: Database): Promise<League[]> {
  const db = database ?? (await getDatabase());
  return db.select().from(leagues).orderBy(desc(leagues.id));
}

export async function getLeague(
  id: number,
  database?: Database,
): Promise<League | null> {
  const db = database ?? (await getDatabase());
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
  return league ?? null;
}

// Changes the two settings that can be edited after creation. Returns the
// updated league, or null when it does not exist.
export async function updateLeagueSettings(
  id: number,
  settings: Pick<League, "name" | "startYear">,
  database?: Database,
): Promise<League | null> {
  const db = database ?? (await getDatabase());
  const [league] = await db
    .update(leagues)
    .set({ name: settings.name, startYear: settings.startYear })
    .where(eq(leagues.id, id))
    .returning();
  return league ?? null;
}

// Removes a league and everything in it for good, all or nothing. The
// foreign keys do not cascade, so the rows are removed child first. Returns
// false, changing nothing, when the league does not exist.
export async function deleteLeague(id: number, database?: Database): Promise<boolean> {
  const db = database ?? (await getDatabase());
  return db.transaction(async (tx) => {
    await tx.delete(rolls).where(eq(rolls.leagueId, id));
    await tx.delete(players).where(eq(players.leagueId, id));
    await tx.delete(teams).where(eq(teams.leagueId, id));
    const removed = await tx
      .delete(leagues)
      .where(eq(leagues.id, id))
      .returning({ id: leagues.id });
    return removed.length > 0;
  });
}
