import { desc, eq } from "drizzle-orm";
import { getDatabase, type Database } from "./db";
import { leagues } from "./schema";

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
