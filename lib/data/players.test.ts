import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PITCHER_SLOTS, rollPitchingStaff } from "../rules/pitchers";
import { openDatabase, type Database } from "./db";
import { createLeague } from "./leagues";
import {
  createPitchingStaff,
  listTeamPitchers,
  listUsedNameIds,
  type NewPitcher,
} from "./players";
import { getTeam, listTeams, saveTeams } from "./teams";

let folder: string;
let database: Database;
let leagueId: number;
let teamIds: number[];

function blankTeam(number: number) {
  return {
    number,
    city: null,
    name: null,
    gmName: null,
    gmRisk: null,
    gmDevFocus: null,
    gmTeamBuilding: null,
    managerName: null,
    ballparkName: null,
    ballparkQuality: "neutral" as const,
    cityRoll: null,
    gmRiskRoll: null,
    gmDevFocusRoll: null,
    gmTeamBuildingRoll: null,
  };
}

async function addLeague(name: string) {
  const league = await createLeague(
    { name, startYear: 2026, teamCount: 2, useDh: true },
    database,
  );
  await saveTeams(league.id, [blankTeam(1), blankTeam(2)], database);
  const teams = await listTeams(league.id, database);
  return { leagueId: league.id, teamIds: teams.map((team) => team.id) };
}

// A rolled staff named from consecutive name-list ids.
function namedStaff(firstNameId: number): NewPitcher[] {
  return rollPitchingStaff().map((pitcher, index) => ({
    ...pitcher,
    name: `Pitcher ${firstNameId + index}`,
    nameListId: firstNameId + index,
  }));
}

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
  ({ leagueId, teamIds } = await addLeague("Great Lakes League"));
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("getTeam", () => {
  it("returns a team in its own league", async () => {
    const team = await getTeam(leagueId, teamIds[0], database);
    expect(team).toMatchObject({ id: teamIds[0], leagueId, number: 1 });
  });

  it("returns null for a team in another league or a missing team", async () => {
    const other = await addLeague("Sun Belt League");
    expect(await getTeam(leagueId, other.teamIds[0], database)).toBeNull();
    expect(await getTeam(leagueId, 9999, database)).toBeNull();
  });
});

describe("pitching staff data", () => {
  it("starts with no pitchers and no used names", async () => {
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual([]);
    expect(await listUsedNameIds(leagueId, database)).toEqual([]);
  });

  it("saves a staff of 11 and reads it back in order with its 40 rolls", async () => {
    const staff = namedStaff(100);
    // Saved out of order to prove the read sorts by slot.
    const result = await createPitchingStaff(
      leagueId,
      teamIds[0],
      [...staff].reverse(),
      database,
    );
    expect(result).toEqual({ created: true });

    const saved = await listTeamPitchers(leagueId, teamIds[0], database);
    expect(saved.map((pitcher) => pitcher.slot)).toEqual([...PITCHER_SLOTS]);
    expect(saved.flatMap((pitcher) => pitcher.rolls)).toHaveLength(40);

    saved.forEach((pitcher, index) => {
      const rolled = staff[index];
      expect(pitcher).toMatchObject({
        leagueId,
        teamId: teamIds[0],
        naturalPosition: rolled.role,
        name: rolled.name,
        nameListId: rolled.nameListId,
        age: rolled.age,
        grade: rolled.grade,
        gradeCeiling: rolled.gradeCeiling,
        hrTendency: rolled.hrTendency,
        stamina: rolled.stamina,
        breakthroughUsed: false,
      });
      expect(pitcher.rolls).toHaveLength(rolled.rolls.length);
      expect(pitcher.rolls).toEqual(
        expect.arrayContaining(
          rolled.rolls.map((roll) => ({ ...roll, source: "app" })),
        ),
      );
    });
  });

  it("does nothing when the team already has a staff", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    const before = await listTeamPitchers(leagueId, teamIds[0], database);

    const result = await createPitchingStaff(
      leagueId,
      teamIds[0],
      namedStaff(200),
      database,
    );

    expect(result).toEqual({ created: false });
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(before);
  });

  it("lists the name ids used across the league's teams", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    await createPitchingStaff(leagueId, teamIds[1], namedStaff(200), database);

    const used = await listUsedNameIds(leagueId, database);
    expect(used).toHaveLength(22);
    expect(new Set(used)).toEqual(
      new Set([...namedStaff(100), ...namedStaff(200)].map((p) => p.nameListId)),
    );
  });

  it("rejects a repeated name in one league and saves none of that staff", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);

    // Ids 105 to 115 overlap the first team's 100 to 110 part way through.
    await expect(
      createPitchingStaff(leagueId, teamIds[1], namedStaff(105), database),
    ).rejects.toThrow();
    expect(await listTeamPitchers(leagueId, teamIds[1], database)).toEqual([]);
  });

  it("lets another league reuse the same names and keeps unnamed pitchers", async () => {
    const other = await addLeague("Sun Belt League");
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    await createPitchingStaff(other.leagueId, other.teamIds[0], namedStaff(100), database);

    const unnamed = rollPitchingStaff().map((pitcher) => ({
      ...pitcher,
      name: null,
      nameListId: null,
    }));
    await createPitchingStaff(leagueId, teamIds[1], unnamed, database);

    const saved = await listTeamPitchers(leagueId, teamIds[1], database);
    expect(saved).toHaveLength(11);
    expect(saved.every((pitcher) => pitcher.name === null)).toBe(true);
    expect(await listUsedNameIds(leagueId, database)).toHaveLength(11);
    expect(
      await listTeamPitchers(other.leagueId, other.teamIds[0], database),
    ).toHaveLength(11);
  });
});
