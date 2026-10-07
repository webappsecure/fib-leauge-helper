import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../data/db";
import { createLeague } from "../data/leagues";
import { listTeamPitchers, listTeamPositionPlayers } from "../data/players";
import { listTeams, saveTeams } from "../data/teams";
import { DEFAULT_BALLPARK_QUALITY } from "../rules/ballpark";
import { NAME_LIST } from "../rules/name-list";
import type { TeamInput } from "../teams/validate";
import { generateLeague, generatePitchingStaff } from "./generate";
import { checkStaffNames, drawStaffNames, usedNameIds } from "./name-pool";

let folder: string;
let database: Database;

const nameOf = (id: number) => NAME_LIST[id - 1].fullName;

function team(number: number, gmName: string | null, managerName: string | null): TeamInput {
  return {
    number,
    city: null,
    name: null,
    gmName,
    gmRisk: null,
    gmDevFocus: null,
    gmTeamBuilding: null,
    managerName,
    ballparkName: null,
    ballparkQuality: DEFAULT_BALLPARK_QUALITY,
    cityRoll: null,
    gmRiskRoll: null,
    gmDevFocusRoll: null,
    gmTeamBuildingRoll: null,
  };
}

async function addLeague(teams: TeamInput[]) {
  const league = await createLeague(
    { name: "Great Lakes League", startYear: 2026, teamCount: teams.length, useDh: true },
    database,
  );
  await saveTeams(league.id, teams, database);
  const teamIds = (await listTeams(league.id, database)).map((saved) => saved.id);
  return { league, teamIds };
}

// Always picks the first unused name and rolls 11 on every table.
const first = () => 0;

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("usedNameIds", () => {
  it("holds players, saved GMs and saved managers that are on the list", async () => {
    const { league, teamIds } = await addLeague([
      team(1, nameOf(1), nameOf(3)),
      team(2, "Gordon Howland Made Up", null),
    ]);
    await generatePitchingStaff(league.id, teamIds[0], first, database);

    const used = await usedNameIds(league.id, database);
    // Staff hold 1 and 3, so the eleven pitchers took 2 and 4 to 13.
    expect([...used].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 1),
    );
  });

  it("keeps leagues apart", async () => {
    await addLeague([team(1, nameOf(1), null), team(2, null, null)]);
    const other = await addLeague([team(1, nameOf(2), null), team(2, null, null)]);
    expect([...(await usedNameIds(other.league.id, database))]).toEqual([2]);
  });
});

describe("generated players and staff names", () => {
  it("never gives a player a saved GM's or manager's name", async () => {
    const { league, teamIds } = await addLeague([
      team(1, nameOf(1), nameOf(2)),
      team(2, nameOf(5), null),
    ]);

    await generateLeague(league, first, database);

    const names: (string | null)[] = [];
    for (const teamId of teamIds) {
      names.push(
        ...(await listTeamPitchers(league.id, teamId, database)).map((p) => p.name),
        ...(await listTeamPositionPlayers(league.id, teamId, database)).map((p) => p.name),
      );
    }
    expect(names).toHaveLength(40);
    expect(names).not.toContain(nameOf(1));
    expect(names).not.toContain(nameOf(2));
    expect(names).not.toContain(nameOf(5));
    // With a first-unused picker the players take 3, 4 and 6 onward.
    expect(names.slice(0, 3)).toEqual([nameOf(3), nameOf(4), nameOf(6)]);
  });
});

describe("drawStaffNames", () => {
  it("skips players' names and the names already in the grid", async () => {
    const { league, teamIds } = await addLeague([team(1, null, null), team(2, null, null)]);
    await generatePitchingStaff(league.id, teamIds[0], first, database);

    // Players hold 1 to 11; the grid shows 12 and 14, not yet saved.
    const drawn = await drawStaffNames(
      league.id,
      3,
      [nameOf(12), ` ${nameOf(14)} `, "Gordon Howland Made Up"],
      first,
      database,
    );
    expect(drawn).toEqual([nameOf(13), nameOf(15), nameOf(16)]);
  });

  it("frees a saved name the grid no longer shows", async () => {
    const { league } = await addLeague([team(1, nameOf(1), null), team(2, null, null)]);
    expect(await drawStaffNames(league.id, 1, [], first, database)).toEqual([nameOf(1)]);
    expect(await drawStaffNames(league.id, 1, [nameOf(1)], first, database)).toEqual([nameOf(2)]);
  });

  it("returns different names in one draw with real randomness", async () => {
    const { league } = await addLeague([team(1, null, null), team(2, null, null)]);
    const drawn = await drawStaffNames(league.id, 40, [], Math.random, database);
    expect(drawn).toHaveLength(40);
    expect(new Set(drawn).size).toBe(40);
  });

  it("returns fewer names when the list runs out", async () => {
    const { league } = await addLeague([team(1, null, null), team(2, null, null)]);
    const allButTwo = NAME_LIST.slice(2).map((entry) => entry.fullName);
    const drawn = await drawStaffNames(league.id, 5, allButTwo, first, database);
    expect(drawn).toEqual([nameOf(1), nameOf(2)]);

    const everyName = NAME_LIST.map((entry) => entry.fullName);
    expect(await drawStaffNames(league.id, 1, everyName, first, database)).toEqual([]);
  });
});

describe("checkStaffNames", () => {
  it("passes distinct names and names that are not on the list", () => {
    const teams = [
      team(1, nameOf(1), nameOf(2)),
      team(2, "Walt Harlow Made Up", "Walt Harlow Made Up"),
      team(3, null, null),
    ];
    expect(checkStaffNames(teams, new Set([10, 11]))).toEqual({});
  });

  it("flags a name already held by a player", () => {
    const errors = checkStaffNames([team(1, nameOf(10), nameOf(2))], new Set([10]));
    expect(errors).toEqual({
      1: {
        gmName: `${nameOf(10)} is already a player in this league. Draw or type another name.`,
      },
    });
  });

  it("flags the later of two GMs with the same list name", () => {
    const errors = checkStaffNames(
      [team(2, nameOf(1), null), team(1, nameOf(1), null)],
      new Set(),
    );
    expect(errors).toEqual({
      2: { gmName: `${nameOf(1)} is already team 1's GM. Draw or type another name.` },
    });
  });

  it("flags a manager who repeats a GM, on the same team or another", () => {
    const errors = checkStaffNames(
      [team(1, nameOf(1), nameOf(1)), team(2, null, nameOf(1)), team(3, nameOf(7), nameOf(7))],
      new Set(),
    );
    expect(errors).toEqual({
      1: { managerName: `${nameOf(1)} is already team 1's GM. Draw or type another name.` },
      2: { managerName: `${nameOf(1)} is already team 1's GM. Draw or type another name.` },
      3: { managerName: `${nameOf(7)} is already team 3's GM. Draw or type another name.` },
    });
  });

  it("names the manager as the holder when a later GM repeats it", () => {
    const errors = checkStaffNames(
      [team(1, null, nameOf(4)), team(2, nameOf(4), null)],
      new Set(),
    );
    expect(errors[2]?.gmName).toBe(
      `${nameOf(4)} is already team 1's manager. Draw or type another name.`,
    );
  });
});
