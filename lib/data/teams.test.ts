import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TeamInput } from "../teams/validate";
import { openDatabase, type Database } from "./db";
import { createLeague } from "./leagues";
import { listTeams, saveTeams } from "./teams";

let folder: string;
let database: Database;
let leagueId: number;

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
  const league = await createLeague(
    { name: "Great Lakes League", startYear: 2026, teamCount: 2, useDh: true },
    database,
  );
  leagueId = league.id;
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

function blank(number: number): TeamInput {
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
    ballparkQuality: "neutral",
    cityRoll: null,
    gmRiskRoll: null,
    gmDevFocusRoll: null,
    gmTeamBuildingRoll: null,
  };
}

const milwaukee: TeamInput = {
  number: 1,
  city: "Milwaukee",
  name: "Millers",
  gmName: "Gordon Howland",
  gmRisk: "conservative",
  gmDevFocus: "farm-first",
  gmTeamBuilding: "pitching",
  managerName: "Walt Harlow",
  ballparkName: "Lakefront Yards",
  ballparkQuality: "semi-pitchers",
  cityRoll: 244,
  gmRiskRoll: 2,
  gmDevFocusRoll: 1,
  gmTeamBuildingRoll: 2,
};

describe("team data", () => {
  it("starts with no teams", async () => {
    expect(await listTeams(leagueId, database)).toEqual([]);
  });

  it("creates rows on the first save, in team-number order, with rolls and nulls intact", async () => {
    await saveTeams(leagueId, [blank(2), milwaukee], database);

    const saved = await listTeams(leagueId, database);
    expect(saved).toHaveLength(2);
    expect(saved).toMatchObject([milwaukee, blank(2)]);
    expect(saved.every((team) => team.leagueId === leagueId)).toBe(true);
  });

  it("updates existing teams in place and keeps their ids", async () => {
    await saveTeams(leagueId, [milwaukee, blank(2)], database);
    const before = await listTeams(leagueId, database);

    await saveTeams(
      leagueId,
      [
        { ...milwaukee, name: "Brewmasters", cityRoll: null },
        { ...blank(2), city: "Chicago" },
      ],
      database,
    );
    const after = await listTeams(leagueId, database);

    expect(after.map((team) => team.id)).toEqual(before.map((team) => team.id));
    expect(after[0].name).toBe("Brewmasters");
    expect(after[0].cityRoll).toBeNull();
    expect(after[1].city).toBe("Chicago");
    expect(after).toHaveLength(2);
  });

  it("keeps each league's teams separate", async () => {
    const other = await createLeague(
      { name: "Sun Belt League", startYear: 2026, teamCount: 2, useDh: false },
      database,
    );
    await saveTeams(leagueId, [milwaukee, blank(2)], database);
    await saveTeams(other.id, [{ ...blank(1), city: "Phoenix" }, blank(2)], database);

    await saveTeams(leagueId, [{ ...milwaukee, city: "Toledo", cityRoll: 347 }, blank(2)], database);

    expect((await listTeams(other.id, database)).map((team) => team.city)).toEqual([
      "Phoenix",
      null,
    ]);
    expect((await listTeams(leagueId, database))[0].city).toBe("Toledo");
  });
});
