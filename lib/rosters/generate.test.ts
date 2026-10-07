import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../data/db";
import { createLeague, type League } from "../data/leagues";
import {
  countPlayersByTeam,
  listTeamPitchers,
  listTeamPositionPlayers,
  listUsedNameIds,
} from "../data/players";
import { listTeams, saveTeams } from "../data/teams";
import { DEFAULT_BALLPARK_QUALITY } from "../rules/ballpark";
import {
  generateLeague,
  generatePitchingStaff,
  generatePositionPlayers,
} from "./generate";

let folder: string;
let database: Database;

async function addLeague(teamCount: number, useDh: boolean) {
  const league = await createLeague(
    { name: "Great Lakes League", startYear: 2026, teamCount, useDh },
    database,
  );
  await saveTeams(
    league.id,
    Array.from({ length: teamCount }, (_, index) => ({
      number: index + 1,
      city: null,
      name: null,
      gmName: null,
      gmRisk: null,
      gmDevFocus: null,
      gmTeamBuilding: null,
      managerName: null,
      ballparkName: null,
      ballparkQuality: DEFAULT_BALLPARK_QUALITY,
      cityRoll: null,
      gmRiskRoll: null,
      gmDevFocusRoll: null,
      gmTeamBuildingRoll: null,
    })),
    database,
  );
  const teamIds = (await listTeams(league.id, database)).map((team) => team.id);
  return { league, teamIds };
}

async function allNames(league: League, teamIds: number[]) {
  const names: (string | null)[] = [];
  for (const teamId of teamIds) {
    const pitchers = await listTeamPitchers(league.id, teamId, database);
    const hitters = await listTeamPositionPlayers(league.id, teamId, database);
    names.push(...pitchers.map((p) => p.name), ...hitters.map((p) => p.name));
  }
  return names;
}

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("generating one team", () => {
  it("rolls, names and saves a pitching staff once", async () => {
    const { league, teamIds } = await addLeague(2, true);

    expect(await generatePitchingStaff(league.id, teamIds[0], Math.random, database)).toBe(11);
    const staff = await listTeamPitchers(league.id, teamIds[0], database);
    expect(staff).toHaveLength(11);
    expect(staff.every((pitcher) => pitcher.name && pitcher.nameListId)).toBe(true);

    expect(await generatePitchingStaff(league.id, teamIds[0], Math.random, database)).toBe(0);
    expect(await listTeamPitchers(league.id, teamIds[0], database)).toEqual(staff);
  });

  it("rolls nine position players with a DH and eight without", async () => {
    const dh = await addLeague(2, true);
    const noDh = await addLeague(2, false);

    expect(await generatePositionPlayers(dh.league, dh.teamIds[0], Math.random, database)).toBe(9);
    expect(await generatePositionPlayers(noDh.league, noDh.teamIds[0], Math.random, database)).toBe(8);
    expect(await generatePositionPlayers(dh.league, dh.teamIds[0], Math.random, database)).toBe(0);

    const lineup = await listTeamPositionPlayers(noDh.league.id, noDh.teamIds[0], database);
    expect(lineup.some((player) => player.slot === "DH")).toBe(false);
  });

  it("never reuses a name even when the dice always pick the first one", async () => {
    const { league, teamIds } = await addLeague(2, true);
    // A constant random source rolls 11 every time and always picks the first
    // unused name, so only the used-name set keeps the names apart.
    const first = () => 0;

    await generatePitchingStaff(league.id, teamIds[0], first, database);
    await generatePositionPlayers(league, teamIds[0], first, database);
    await generatePitchingStaff(league.id, teamIds[1], first, database);

    const used = await listUsedNameIds(league.id, database);
    expect(used).toHaveLength(31);
    expect([...used].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 31 }, (_, index) => index + 1),
    );
  });
});

describe("generateLeague", () => {
  it("fills every team with no repeated name", async () => {
    const { league, teamIds } = await addLeague(4, true);

    expect(await generateLeague(league, Math.random, database)).toEqual({
      teams: 4,
      players: 80,
    });

    const counts = await countPlayersByTeam(league.id, database);
    expect(counts).toHaveLength(4);
    expect(counts.every((c) => c.pitchers === 11 && c.positionPlayers === 9)).toBe(true);

    const names = await allNames(league, teamIds);
    expect(names).toHaveLength(80);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(80);
  });

  it("gives each team eight position players in a league without a DH", async () => {
    const { league } = await addLeague(3, false);

    expect(await generateLeague(league, Math.random, database)).toEqual({
      teams: 3,
      players: 57,
    });
    const counts = await countPlayersByTeam(league.id, database);
    expect(counts.every((c) => c.pitchers === 11 && c.positionPlayers === 8)).toBe(true);
  });

  it("changes nothing on a second run", async () => {
    const { league, teamIds } = await addLeague(2, true);
    await generateLeague(league, Math.random, database);
    const before = await allNames(league, teamIds);

    expect(await generateLeague(league, Math.random, database)).toEqual({
      teams: 0,
      players: 0,
    });
    expect(await allNames(league, teamIds)).toEqual(before);
  });

  it("only fills the gaps when some players already exist", async () => {
    const { league, teamIds } = await addLeague(3, true);
    await generatePitchingStaff(league.id, teamIds[0], Math.random, database);
    await generatePitchingStaff(league.id, teamIds[1], Math.random, database);
    await generatePositionPlayers(league, teamIds[1], Math.random, database);
    const staffBefore = await listTeamPitchers(league.id, teamIds[0], database);

    // Team 1 needs a lineup, team 2 nothing, team 3 everything.
    expect(await generateLeague(league, Math.random, database)).toEqual({
      teams: 2,
      players: 29,
    });
    expect(await listTeamPitchers(league.id, teamIds[0], database)).toEqual(staffBefore);

    const names = await allNames(league, teamIds);
    expect(new Set(names).size).toBe(60);
  });

  it("does nothing for a league with no saved teams", async () => {
    const league = await createLeague(
      { name: "Empty League", startYear: 2026, teamCount: 4, useDh: true },
      database,
    );
    expect(await generateLeague(league, Math.random, database)).toEqual({
      teams: 0,
      players: 0,
    });
  });
});
