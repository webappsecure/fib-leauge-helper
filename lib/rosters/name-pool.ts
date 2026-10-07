import { listLeaguePlayerNames, listTeams, listUsedNameIds } from "../data";
import type { Database } from "../data/db";
import type { RandomSource } from "../rules/dice";
import { nameIdFor, nameKey, pickName } from "../rules/names";
import type { TeamFieldErrors, TeamInput } from "../teams/validate";

// Server-side only: this pulls in the 5,000-name list.
//
// No two people in a league share a name: players, GMs and managers, typed
// or drawn. Names are compared with `nameKey`. A blank name is nobody's.

type Staffed = Pick<TeamInput, "number" | "gmName" | "managerName">;

const STAFF_FIELDS = [
  { field: "gmName", role: "GM" },
  { field: "managerName", role: "manager" },
] as const;

// Someone who holds a name, and how to describe them in a message.
export type NameHolder = { name: string; label: string; playerId?: number };

// The league's named players, each described by team number and slot.
export async function listPlayerHolders(
  leagueId: number,
  database?: Database,
): Promise<NameHolder[]> {
  const numbers = new Map(
    (await listTeams(leagueId, database)).map((team) => [team.id, team.number]),
  );
  return (await listLeaguePlayerNames(leagueId, database)).map((player) => {
    const number = player.teamId === null ? undefined : numbers.get(player.teamId);
    return {
      name: player.name,
      playerId: player.id,
      label:
        player.teamId === null
          ? "a free agent"
          : number === undefined
            ? "a player in this league"
            : `team ${number}'s ${player.slot ?? "player"}`,
    };
  });
}

function staffHolders(teams: Staffed[]): NameHolder[] {
  return [...teams]
    .sort((a, b) => a.number - b.number)
    .flatMap((team) =>
      STAFF_FIELDS.flatMap(({ field, role }) => {
        const name = team[field];
        return name === null || nameKey(name) === ""
          ? []
          : [{ name, label: `team ${team.number}'s ${role}` }];
      }),
    );
}

// Everyone in the league who holds a name: players first, then each team's
// GM and manager in team-number order.
export async function listNameHolders(
  leagueId: number,
  database?: Database,
): Promise<NameHolder[]> {
  return [
    ...(await listPlayerHolders(leagueId, database)),
    ...staffHolders(await listTeams(leagueId, database)),
  ];
}

// The first holder of this name, or null when it is free. A player being
// renamed is left out so it does not clash with itself.
export function findNameHolder(
  holders: NameHolder[],
  name: string,
  exceptPlayerId?: number,
): NameHolder | null {
  const key = nameKey(name);
  if (key === "") return null;
  return (
    holders.find(
      (holder) =>
        nameKey(holder.name) === key &&
        (exceptPlayerId === undefined || holder.playerId !== exceptPlayerId),
    ) ?? null
  );
}

function listIds(names: Iterable<string | null>) {
  const ids: number[] = [];
  for (const name of names) {
    const id = nameIdFor(name);
    if (id !== null) ids.push(id);
  }
  return ids;
}

// Every list name someone in the league holds, typed or drawn, as list ids.
export async function usedNameIds(
  leagueId: number,
  database?: Database,
): Promise<Set<number>> {
  const holders = await listNameHolders(leagueId, database);
  return new Set([
    // The stored ids too, so a draw can never trip the unique index.
    ...(await listUsedNameIds(leagueId, database)),
    ...listIds(holders.map((holder) => holder.name)),
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
  const players = await listPlayerHolders(leagueId, database);
  const used = new Set([
    ...(await listUsedNameIds(leagueId, database)),
    ...listIds([...players.map((player) => player.name), ...gridNames]),
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

// Finds GM and manager names that someone else in the league holds. Players
// hold their names first; then teams are read in number order, GM before
// manager, and the later holder of a name gets the error, which says who has
// it. Blank names are left to the grid's own validation.
export function checkStaffNames(
  teams: Staffed[],
  players: NameHolder[],
): TeamFieldErrors {
  const errors: TeamFieldErrors = {};
  const holders = [...players];

  for (const team of [...teams].sort((a, b) => a.number - b.number)) {
    for (const { field, role } of STAFF_FIELDS) {
      const name = team[field]?.trim() ?? "";
      if (nameKey(name) === "") continue;

      const holder = findNameHolder(holders, name);
      if (holder) {
        (errors[team.number] ??= {})[field] =
          `${name} is already ${holder.label}. Draw or type another name.`;
      } else {
        holders.push({ name, label: `team ${team.number}'s ${role}` });
      }
    }
  }
  return errors;
}
