"use server";

import { revalidatePath } from "next/cache";
import { getLeague, getTeam } from "@/lib/data";
import {
  generatePitchingStaff,
  generatePositionPlayers,
} from "@/lib/rosters/generate";
import { drawPlayerName, renameTeam, setPlayerName } from "@/lib/rosters/rename";
import { rerollPlayer, rerollTeam } from "@/lib/rosters/reroll";
import { isId } from "../../../action-input";

export type RollResult = { ok: true } | { ok: false; error: string };
export type NameResult = { ok: true; name: string } | { ok: false; error: string };

const TEAM_NOT_FOUND =
  "This team could not be found. Go back to the league and open the team again.";
const NO_PLAYERS = "This team has no players to re-roll yet.";
const NO_PLAYERS_TO_RENAME = "This team has no players to rename yet.";
const PLAYER_NOT_FOUND =
  "This player is no longer on this team. Reload the page and try again.";

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

// Rolls all of the player's values again and leaves the name alone. Every
// press is a new roll; nothing is kept from the one before.
export async function rerollPlayerAction(
  leagueId: unknown,
  teamId: unknown,
  playerId: unknown,
): Promise<RollResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };
  if (!isId(playerId)) return { ok: false, error: PLAYER_NOT_FOUND };

  const rerolled = await rerollPlayer(found.league.id, found.team.id, playerId);
  if (!rerolled) return { ok: false, error: PLAYER_NOT_FOUND };

  revalidatePath(`/leagues/${found.league.id}/teams/${found.team.id}`);
  return { ok: true };
}

// Re-rolls every player on the team in one save. Names are left alone.
export async function rerollTeamAction(
  leagueId: unknown,
  teamId: unknown,
): Promise<RollResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };

  const rerolled = await rerollTeam(found.league.id, found.team.id);
  if (rerolled === 0) return { ok: false, error: NO_PLAYERS };

  revalidatePath(`/leagues/${found.league.id}/teams/${found.team.id}`);
  return { ok: true };
}

// Saves a typed name for the player. The name is checked on the server
// against everyone in the league; the browser's text is never trusted.
export async function renamePlayerAction(
  leagueId: unknown,
  teamId: unknown,
  playerId: unknown,
  name: unknown,
): Promise<NameResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };
  if (!isId(playerId)) return { ok: false, error: PLAYER_NOT_FOUND };

  const result = await setPlayerName(found.league.id, found.team.id, playerId, name);
  return nameResult(result, found.league.id, found.team.id);
}

// Draws an unused name from the list for the player and saves it.
export async function randomPlayerNameAction(
  leagueId: unknown,
  teamId: unknown,
  playerId: unknown,
): Promise<NameResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };
  if (!isId(playerId)) return { ok: false, error: PLAYER_NOT_FOUND };

  const result = await drawPlayerName(found.league.id, found.team.id, playerId);
  return nameResult(result, found.league.id, found.team.id);
}

function nameResult(
  result: Awaited<ReturnType<typeof setPlayerName>>,
  leagueId: number,
  teamId: number,
): NameResult {
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === "not-found" ? PLAYER_NOT_FOUND : result.error,
    };
  }
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
  return { ok: true, name: result.name };
}

// Gives every player on the team a new name from the list in one save.
export async function renameTeamAction(
  leagueId: unknown,
  teamId: unknown,
): Promise<RollResult> {
  const found = await loadTeam(leagueId, teamId);
  if (!found) return { ok: false, error: TEAM_NOT_FOUND };

  const result = await renameTeam(found.league.id, found.team.id);
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === "no-players" ? NO_PLAYERS_TO_RENAME : result.error,
    };
  }

  revalidatePath(`/leagues/${found.league.id}/teams/${found.team.id}`);
  return { ok: true };
}
