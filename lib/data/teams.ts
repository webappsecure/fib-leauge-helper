import { asc, eq } from "drizzle-orm";
import type { TeamInput } from "../teams/validate";
import { getDatabase, type Database } from "./db";
import { teams } from "./schema";

export type Team = TeamInput & { id: number; leagueId: number };

export async function listTeams(
  leagueId: number,
  database?: Database,
): Promise<Team[]> {
  const db = database ?? (await getDatabase());
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.number));
  // Quality columns are plain text in SQLite; saveTeams only writes validated values.
  return rows as Team[];
}

// Inserts missing team numbers and updates existing ones in place, so a
// team's id never changes once it exists.
export async function saveTeams(
  leagueId: number,
  input: TeamInput[],
  database?: Database,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.transaction(async (tx) => {
    for (const { number, ...values } of input) {
      await tx
        .insert(teams)
        .values({ leagueId, number, ...values })
        .onConflictDoUpdate({
          target: [teams.leagueId, teams.number],
          set: values,
        });
    }
  });
}
