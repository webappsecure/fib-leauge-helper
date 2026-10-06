"use server";

import { revalidatePath } from "next/cache";
import { getLeague, saveTeams } from "@/lib/data";
import {
  TEAMS_PAGE_ERROR,
  validateTeams,
  type TeamErrors,
} from "@/lib/teams/validate";

export type SaveTeamsResult = { ok: true } | { ok: false; errors: TeamErrors };

export async function saveTeamsAction(
  leagueId: unknown,
  rows: unknown,
): Promise<SaveTeamsResult> {
  const league =
    typeof leagueId === "number" && Number.isSafeInteger(leagueId)
      ? await getLeague(leagueId)
      : null;
  if (!league) {
    return { ok: false, errors: { form: TEAMS_PAGE_ERROR, fields: {} } };
  }

  // The team count comes from the stored league, never from the browser.
  const result = validateTeams(rows, league.teamCount);
  if (!result.ok) return result;

  await saveTeams(league.id, result.teams);
  revalidatePath(`/leagues/${league.id}`);
  return { ok: true };
}
