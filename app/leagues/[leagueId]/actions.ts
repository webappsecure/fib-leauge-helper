"use server";

import { revalidatePath } from "next/cache";
import { getLeague } from "@/lib/data";
import { generateLeague } from "@/lib/rosters/generate";

export type GenerateLeagueResult =
  | { ok: true; teams: number; players: number }
  | { ok: false; error: string };

const LEAGUE_NOT_FOUND =
  "This league could not be found. Go back to the league list and open it again.";

export async function generateLeagueAction(
  leagueId: unknown,
): Promise<GenerateLeagueResult> {
  // The id comes from the browser, so the league is reloaded here.
  const league =
    typeof leagueId === "number" && Number.isSafeInteger(leagueId) && leagueId > 0
      ? await getLeague(leagueId)
      : null;
  if (!league) return { ok: false, error: LEAGUE_NOT_FOUND };

  const result = await generateLeague(league);
  revalidatePath(`/leagues/${league.id}`);
  return { ok: true, ...result };
}
