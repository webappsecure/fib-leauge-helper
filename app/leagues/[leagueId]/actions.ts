"use server";

import { revalidatePath } from "next/cache";
import { getLeague } from "@/lib/data";
import { generateLeague } from "@/lib/rosters/generate";
import { isId, LEAGUE_NOT_FOUND } from "../action-input";

export type GenerateLeagueResult =
  | { ok: true; teams: number; players: number }
  | { ok: false; error: string };

export async function generateLeagueAction(
  leagueId: unknown,
): Promise<GenerateLeagueResult> {
  // The id comes from the browser, so the league is reloaded here.
  const league = isId(leagueId) ? await getLeague(leagueId) : null;
  if (!league) return { ok: false, error: LEAGUE_NOT_FOUND };

  const result = await generateLeague(league);
  revalidatePath(`/leagues/${league.id}`);
  return { ok: true, ...result };
}
