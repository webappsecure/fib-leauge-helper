import { listTeams, listUsedNameIds } from "../data";
import type { Database } from "../data/db";
import type { RandomSource } from "../rules/dice";
import { nameIdFor, pickName } from "../rules/names";
import type { TeamFieldErrors, TeamInput } from "../teams/validate";

// Server-side only: this pulls in the 5,000-name list.
//
// One pool of list names per league. A player holds the name it was given. A
// GM or manager holds a list name when the saved text is exactly that name,
// whether it was drawn or typed.

type Staffed = Pick<TeamInput, "number" | "gmName" | "managerName">;

const STAFF_FIELDS = [
  { field: "gmName", role: "GM" },
  { field: "managerName", role: "manager" },
] as const;

function listIds(names: Iterable<string | null>) {
  const ids: number[] = [];
  for (const name of names) {
    const id = nameIdFor(name);
    if (id !== null) ids.push(id);
  }
  return ids;
}

// Every list name in use in the league: players, saved GMs and saved managers.
export async function usedNameIds(
  leagueId: number,
  database?: Database,
): Promise<Set<number>> {
  const teams = await listTeams(leagueId, database);
  return new Set([
    ...(await listUsedNameIds(leagueId, database)),
    ...listIds(teams.flatMap((team) => [team.gmName, team.managerName])),
  ]);
}

// Draws names for the team setup grid. `gridNames` are the GM and manager
// names the grid shows now; they stand in for the saved ones because the grid
// replaces those on save. Returns fewer names when the list runs out.
export async function drawStaffNames(
  leagueId: number,
  count: number,
  gridNames: string[],
  random: RandomSource = Math.random,
  database?: Database,
): Promise<string[]> {
  const used = new Set([
    ...(await listUsedNameIds(leagueId, database)),
    ...listIds(gridNames),
  ]);
  const names: string[] = [];
  for (let drawn = 0; drawn < count; drawn++) {
    const entry = pickName(used, random);
    if (!entry) break;
    used.add(entry.id);
    names.push(entry.fullName);
  }
  return names;
}

// Finds GM and manager names that would repeat a list name in the league.
// Teams are read in number order, GM before manager, and the later holder of
// a name gets the error. Names that are not on the list are never flagged.
export function checkStaffNames(
  teams: Staffed[],
  playerNameIds: ReadonlySet<number>,
): TeamFieldErrors {
  const errors: TeamFieldErrors = {};
  const holders = new Map<number, string>();

  for (const team of [...teams].sort((a, b) => a.number - b.number)) {
    for (const { field, role } of STAFF_FIELDS) {
      const name = team[field];
      const id = nameIdFor(name);
      if (name === null || id === null) continue;

      const holder = holders.get(id);
      if (playerNameIds.has(id)) {
        (errors[team.number] ??= {})[field] =
          `${name.trim()} is already a player in this league. Draw or type another name.`;
      } else if (holder) {
        (errors[team.number] ??= {})[field] =
          `${name.trim()} is already ${holder}. Draw or type another name.`;
      } else {
        holders.set(id, `team ${team.number}'s ${role}`);
      }
    }
  }
  return errors;
}
