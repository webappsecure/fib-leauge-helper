"use server";

import { revalidatePath } from "next/cache";
import { getLeague, saveTeams } from "@/lib/data";
import {
  checkStaffNames,
  drawStaffNames,
  listPlayerHolders,
} from "@/lib/rosters/name-pool";
import {
  TEAM_TEXT_MAX_LENGTH,
  TEAMS_PAGE_ERROR,
  validateTeams,
  type TeamErrors,
} from "@/lib/teams/validate";

export type SaveTeamsResult = { ok: true } | { ok: false; errors: TeamErrors };

// The league id comes from the browser, so the league is reloaded.
async function loadLeague(leagueId: unknown) {
  return typeof leagueId === "number" && Number.isSafeInteger(leagueId)
    ? getLeague(leagueId)
    : null;
}

export async function saveTeamsAction(
  leagueId: unknown,
  rows: unknown,
): Promise<SaveTeamsResult> {
  const league = await loadLeague(leagueId);
  if (!league) {
    return { ok: false, errors: { form: TEAMS_PAGE_ERROR, fields: {} } };
  }

  // The team count comes from the stored league, never from the browser.
  const result = validateTeams(rows, league.teamCount);
  if (!result.ok) return result;

  // A GM or manager may not take a name a player or another team's staff
  // already holds.
  const fields = checkStaffNames(result.teams, await listPlayerHolders(league.id));
  if (Object.keys(fields).length > 0) return { ok: false, errors: { fields } };

  await saveTeams(league.id, result.teams);
  revalidatePath(`/leagues/${league.id}`);
  return { ok: true };
}

export type DrawStaffNamesResult =
  | { ok: true; names: string[] }
  | { ok: false; error: string };

// Draws unused names for the GM and manager fields. `gridNames` are the names
// the grid shows now, saved or not. Nothing is stored until the teams are
// saved.
export async function drawStaffNamesAction(
  leagueId: unknown,
  count: unknown,
  gridNames: unknown,
): Promise<DrawStaffNamesResult> {
  const league = await loadLeague(leagueId);
  if (!league) return { ok: false, error: TEAMS_PAGE_ERROR };

  // A league has one GM and one manager per team.
  const most = league.teamCount * 2;
  const validCount =
    typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= most;
  const validNames =
    Array.isArray(gridNames) &&
    gridNames.length <= most &&
    gridNames.every(
      (name) => typeof name === "string" && [...name].length <= TEAM_TEXT_MAX_LENGTH,
    );
  if (!validCount || !validNames) return { ok: false, error: TEAMS_PAGE_ERROR };

  return {
    ok: true,
    names: await drawStaffNames(league.id, count, gridNames as string[]),
  };
}
