"use server";

import { revalidatePath } from "next/cache";
import { getLeague, getTeam } from "@/lib/data";
import {
  generatePitchingStaff,
  generatePositionPlayers,
} from "@/lib/rosters/generate";

export type RollResult = { ok: true } | { ok: false; error: string };

const TEAM_NOT_FOUND =
  "This team could not be found. Go back to the league and open the team again.";

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

// Both ids come from the browser, so the league and team are reloaded here.
async function loadTeam(leagueId: unknown, teamId: unknown) {
  const league = isId(leagueId) ? await getLeague(leagueId) : null;
  const team = league && isId(teamId) ? await getTeam(league.id, teamId) : null;
  return league && team ? { league, team } : null;
}

// In both actions a team that already has the players is left as it is, so a
// double press or a stale tab still ends on the saved roster.

export async function rollPitchingStaffAction(
  leagueId: unknown,
  teamId: unknown,
): Promise<RollResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };

  await generatePitchingStaff(found.league.id, found.team.id);
  revalidatePath(`/leagues/${found.league.id}/teams/${found.team.id}`);
  return { ok: true };
}

export async function rollPositionPlayersAction(
  leagueId: unknown,
  teamId: unknown,
): Promise<RollResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };

  await generatePositionPlayers(found.league, found.team.id);
  revalidatePath(`/leagues/${found.league.id}/teams/${found.team.id}`);
  return { ok: true };
}
