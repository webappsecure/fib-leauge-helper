import {
  getTeamPlayer,
  listTeamPlayerIds,
  replacePitcherValues,
  replacePositionPlayerValues,
  replaceTeamValues,
  type RerolledPlayer,
} from "../data";
import type { Database } from "../data/db";
import type { RandomSource } from "../rules/dice";
import { rollPitcher } from "../rules/pitchers";
import type { FieldPosition } from "../rules/moves";
import { rollPositionPlayer } from "../rules/positions";

// A player signed from the pool as an outfielder has no one outfield slot.
// The three outfield slots share an archetype table, so any of them will do.
function rollForPosition(naturalPosition: FieldPosition, random: RandomSource) {
  return rollPositionPlayer(naturalPosition === "OF" ? "LF" : naturalPosition, random);
}

// Rolls all of a player's values again, exactly as a new player is rolled,
// on the tables for the position the player was first rolled for. The name
// is left alone. Returns false when the player is not on that team.
export async function rerollPlayer(
  leagueId: number,
  teamId: number,
  playerId: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<boolean> {
  const player = await getTeamPlayer(leagueId, teamId, playerId, database);
  if (!player) return false;

  return player.kind === "pitcher"
    ? replacePitcherValues(
        leagueId,
        teamId,
        playerId,
        rollPitcher(player.naturalPosition, random),
        database,
      )
    : replacePositionPlayerValues(
        leagueId,
        teamId,
        playerId,
        rollForPosition(player.naturalPosition, random),
        database,
      );
}

// Re-rolls every player on the team in one save, so the team is never left
// half re-rolled. Names are left alone. Returns how many players changed.
export async function rerollTeam(
  leagueId: number,
  teamId: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<number> {
  const teamPlayers = await listTeamPlayerIds(leagueId, teamId, database);
  if (teamPlayers.length === 0) return 0;

  const entries: RerolledPlayer[] = teamPlayers.map((player) =>
    player.kind === "pitcher"
      ? {
          playerId: player.id,
          kind: "pitcher",
          rolled: rollPitcher(player.naturalPosition, random),
        }
      : {
          playerId: player.id,
          kind: "position",
          rolled: rollForPosition(player.naturalPosition, random),
        },
  );
  await replaceTeamValues(leagueId, teamId, entries, database);
  return entries.length;
}
