import {
  countPlayersByTeam,
  createPitchingStaff,
  createPositionPlayers,
  listTeams,
} from "../data";
import type { Database } from "../data/db";
import type { RandomSource } from "../rules/dice";
import { pickName } from "../rules/names";
import { rollPitchingStaff } from "../rules/pitchers";
import { rollLineup } from "../rules/positions";
import { usedNameIds } from "./name-pool";

// Server-side only: this pulls in the 5,000-name list.

// Gives each rolled player an unused name and marks it used, so no name
// repeats in the league, including the names of saved GMs and managers. A
// player gets no name once the list is exhausted.
export function withNames<T>(rolled: T[], used: Set<number>, random: RandomSource) {
  return rolled.map((player) => {
    const name = pickName(used, random);
    if (name) used.add(name.id);
    return {
      ...player,
      name: name?.fullName ?? null,
      nameListId: name?.id ?? null,
    };
  });
}

async function addPitchingStaff(
  leagueId: number,
  teamId: number,
  used: Set<number>,
  random: RandomSource,
  database?: Database,
) {
  const staff = withNames(rollPitchingStaff(random), used, random);
  const { created } = await createPitchingStaff(leagueId, teamId, staff, database);
  return created ? staff.length : 0;
}

async function addPositionPlayers(
  league: { id: number; useDh: boolean },
  teamId: number,
  used: Set<number>,
  random: RandomSource,
  database?: Database,
) {
  const lineup = withNames(rollLineup(league.useDh, random), used, random);
  const { created } = await createPositionPlayers(league.id, teamId, lineup, database);
  return created ? lineup.length : 0;
}

// Each function below returns the number of players it created. A team that
// already has the players in question is left as it is and counts as zero.

export async function generatePitchingStaff(
  leagueId: number,
  teamId: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<number> {
  const used = await usedNameIds(leagueId, database);
  return addPitchingStaff(leagueId, teamId, used, random, database);
}

export async function generatePositionPlayers(
  league: { id: number; useDh: boolean },
  teamId: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<number> {
  const used = await usedNameIds(league.id, database);
  return addPositionPlayers(league, teamId, used, random, database);
}

// Rolls whatever is missing for every saved team, in team-number order. Each
// staff and lineup is saved on its own, so if a later team fails the earlier
// ones are kept and a second run fills the rest.
export async function generateLeague(
  league: { id: number; useDh: boolean },
  random: RandomSource = Math.random,
  database?: Database,
): Promise<{ teams: number; players: number }> {
  const teams = await listTeams(league.id, database);
  const counts = new Map(
    (await countPlayersByTeam(league.id, database)).map((entry) => [entry.teamId, entry]),
  );
  const used = await usedNameIds(league.id, database);

  const result = { teams: 0, players: 0 };
  for (const team of teams) {
    const existing = counts.get(team.id);
    let added = 0;
    if (!existing?.pitchers) {
      added += await addPitchingStaff(league.id, team.id, used, random, database);
    }
    if (!existing?.positionPlayers) {
      added += await addPositionPlayers(league, team.id, used, random, database);
    }
    if (added > 0) {
      result.teams += 1;
      result.players += added;
    }
  }
  return result;
}
