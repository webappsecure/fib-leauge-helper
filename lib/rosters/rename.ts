import {
  getTeamPlayer,
  listTeamPlayerIds,
  renamePlayer,
  renameTeamPlayers,
} from "../data";
import type { Database } from "../data/db";
import type { RandomSource } from "../rules/dice";
import { nameIdFor, pickName } from "../rules/names";
import { TEAM_TEXT_MAX_LENGTH } from "../teams/validate";
import { findNameHolder, listNameHolders, usedNameIds } from "./name-pool";

// Server-side only: this pulls in the 5,000-name list.

export const NAME_BLANK = "Type a name, or press Random name.";
export const NAME_TOO_LONG = `Keep the name to ${TEAM_TEXT_MAX_LENGTH} characters or fewer.`;
export const LIST_USED_UP = "Every name on the list is in use. Type a name instead.";
export const TOO_FEW_NAMES =
  "There are not enough unused names on the list to rename the whole team.";

type Refused = { ok: false; reason: "refused"; error: string };
type NotFound = { ok: false; reason: "not-found" };

export type RenameResult = { ok: true; name: string } | Refused | NotFound;
export type RenameTeamResult =
  | { ok: true; renamed: number }
  | Refused
  | { ok: false; reason: "no-players" };

const refused = (error: string): Refused => ({ ok: false, reason: "refused", error });

// A typed name as it will be stored: trimmed, not blank, 60 characters at
// most. Characters are counted the way the team text fields count them.
export function validatePlayerName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name === "") return { ok: false, error: NAME_BLANK };
  if ([...name].length > TEAM_TEXT_MAX_LENGTH) return { ok: false, error: NAME_TOO_LONG };
  return { ok: true, name };
}

// Saves a typed name unless someone else in the league holds it.
export async function setPlayerName(
  leagueId: number,
  teamId: number,
  playerId: number,
  raw: unknown,
  database?: Database,
): Promise<RenameResult> {
  if (!(await getTeamPlayer(leagueId, teamId, playerId, database))) {
    return { ok: false, reason: "not-found" };
  }
  const valid = validatePlayerName(raw);
  if (!valid.ok) return refused(valid.error);

  const holder = findNameHolder(
    await listNameHolders(leagueId, database),
    valid.name,
    playerId,
  );
  if (holder) {
    return refused(
      `${valid.name} is already ${holder.label}. Type another name or press Random name.`,
    );
  }

  const saved = await renamePlayer(
    leagueId,
    teamId,
    { playerId, name: valid.name, nameListId: nameIdFor(valid.name) },
    database,
  );
  return saved ? { ok: true, name: valid.name } : { ok: false, reason: "not-found" };
}

// Gives the player a list name nobody in the league holds. The player's own
// current name counts as held, so the draw always changes the name.
export async function drawPlayerName(
  leagueId: number,
  teamId: number,
  playerId: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<RenameResult> {
  if (!(await getTeamPlayer(leagueId, teamId, playerId, database))) {
    return { ok: false, reason: "not-found" };
  }
  const entry = pickName(await usedNameIds(leagueId, database), random);
  if (!entry) return refused(LIST_USED_UP);

  const saved = await renamePlayer(
    leagueId,
    teamId,
    { playerId, name: entry.fullName, nameListId: entry.id },
    database,
  );
  return saved ? { ok: true, name: entry.fullName } : { ok: false, reason: "not-found" };
}

// Gives every player on the team a new list name in one save. The team's
// current names count as held while drawing, so no new name can collide with
// one that is about to be replaced.
export async function renameTeam(
  leagueId: number,
  teamId: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<RenameTeamResult> {
  const teamPlayers = await listTeamPlayerIds(leagueId, teamId, database);
  if (teamPlayers.length === 0) return { ok: false, reason: "no-players" };

  const used = await usedNameIds(leagueId, database);
  const entries = [];
  for (const player of teamPlayers) {
    const entry = pickName(used, random);
    if (!entry) return refused(TOO_FEW_NAMES);
    used.add(entry.id);
    entries.push({ playerId: player.id, name: entry.fullName, nameListId: entry.id });
  }
  await renameTeamPlayers(leagueId, teamId, entries, database);
  return { ok: true, renamed: entries.length };
}
