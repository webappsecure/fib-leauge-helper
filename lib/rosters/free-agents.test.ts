import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../data/db";
import { createLeague } from "../data/leagues";
import { listFreeAgents, listUsedNameIds } from "../data/players";
import { saveTeams } from "../data/teams";
import { DEFAULT_BALLPARK_QUALITY } from "../rules/ballpark";
import { FREE_AGENT_POSITIONS } from "../rules/free-agents";
import { NAME_LIST } from "../rules/name-list";
import { nameIdFor } from "../rules/names";
import { generateFreeAgents } from "./free-agents";
import { generateLeague } from "./generate";

let folder: string;
let database: Database;

const nameOf = (id: number) => NAME_LIST[id - 1].fullName;

// Always picks the first unused name and rolls 11 on every table.
const first = () => 0;

async function addLeague(gmName: string | null = null, managerName: string | null = null) {
  const league = await createLeague(
    { name: "Great Lakes League", startYear: 2026, teamCount: 1, useDh: true },
    database,
  );
  await saveTeams(
    league.id,
    [
      {
        number: 1,
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
      },
    ],
    database,
  );
  return league;
}

async function positions(leagueId: number) {
  const pool = await listFreeAgents(leagueId, database);
  return [...pool.pitchers, ...pool.positionPlayers].map((player) => player.naturalPosition);
}

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("generateFreeAgents", () => {
  it("fills an empty pool with the target at every position", async () => {
    const league = await addLeague();

    expect(await generateFreeAgents(league.id, 2, Math.random, database)).toBe(18);
    expect(await positions(league.id)).toEqual(
      FREE_AGENT_POSITIONS.flatMap((position) => [position, position]),
    );
  });

  it("adds nothing on a second run and only the shortfall when the target rises", async () => {
    const league = await addLeague();
    await generateFreeAgents(league.id, 2, Math.random, database);
    const before = await listFreeAgents(league.id, database);

    expect(await generateFreeAgents(league.id, 2, Math.random, database)).toBe(0);
    expect(await listFreeAgents(league.id, database)).toEqual(before);

    expect(await generateFreeAgents(league.id, 3, Math.random, database)).toBe(9);
    const after = await listFreeAgents(league.id, database);
    expect(after.pitchers).toHaveLength(9);
    expect(after.positionPlayers).toHaveLength(18);
    // The earlier free agents are untouched.
    expect(after.pitchers).toEqual(expect.arrayContaining(before.pitchers));
    expect(after.positionPlayers).toEqual(expect.arrayContaining(before.positionPlayers));
  });

  it("adds nothing when the target is below what the pool holds", async () => {
    const league = await addLeague();
    await generateFreeAgents(league.id, 3, Math.random, database);
    expect(await generateFreeAgents(league.id, 1, Math.random, database)).toBe(0);
    expect(await positions(league.id)).toHaveLength(27);
  });

  it("gives every free agent a name nobody else in the league holds", async () => {
    // The GM and manager hold the first two list names without a stored id.
    const league = await addLeague(nameOf(1), nameOf(2));
    await generateLeague(league, first, database);
    await generateFreeAgents(league.id, 2, first, database);
    await generateFreeAgents(league.id, 3, first, database);

    const pool = await listFreeAgents(league.id, database);
    const agents = [...pool.pitchers, ...pool.positionPlayers];
    expect(agents).toHaveLength(27);
    expect(agents.every((agent) => agent.name && agent.nameListId)).toBe(true);

    // 20 team players and 27 free agents, all different, none of them 1 or 2.
    const ids = await listUsedNameIds(league.id, database);
    expect(ids).toHaveLength(47);
    expect(new Set(ids).size).toBe(47);
    expect(ids).not.toContain(nameIdFor(nameOf(1)));
    expect(ids).not.toContain(nameIdFor(nameOf(2)));
  });
});
