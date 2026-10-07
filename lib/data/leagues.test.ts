import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "./db";
import { rollPitchingStaff } from "../rules/pitchers";
import { rollLineup } from "../rules/positions";
import {
  createLeague,
  deleteLeague,
  getLeague,
  listLeagues,
  updateLeagueSettings,
} from "./leagues";
import { createPitchingStaff, createPositionPlayers } from "./players";
import { listTeams, saveTeams } from "./teams";

let folder: string;
let database: Database;

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "nested", "test.db"));
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

const greatLakes = {
  name: "Great Lakes League",
  startYear: 2026,
  teamCount: 12,
  useDh: true,
};

describe("league data", () => {
  it("creates the folder, applies migrations and starts with no leagues", async () => {
    expect(await listLeagues(database)).toEqual([]);
  });

  it("stores a league and reads it back", async () => {
    const created = await createLeague(greatLakes, database);

    expect(created).toMatchObject(greatLakes);
    expect(created.id).toBeGreaterThan(0);
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(await listLeagues(database)).toEqual([created]);
  });

  it("stores DH off as false", async () => {
    const created = await createLeague({ ...greatLakes, useDh: false }, database);
    expect((await getLeague(created.id, database))?.useDh).toBe(false);
  });

  it("lists leagues newest first", async () => {
    const first = await createLeague(greatLakes, database);
    const second = await createLeague({ ...greatLakes, name: "Sun Belt League" }, database);

    expect((await listLeagues(database)).map((league) => league.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("gets a league by id and returns null for a missing id", async () => {
    const created = await createLeague(greatLakes, database);

    expect(await getLeague(created.id, database)).toEqual(created);
    expect(await getLeague(created.id + 1, database)).toBeNull();
  });

  it("allows two leagues with the same name", async () => {
    await createLeague(greatLakes, database);
    await createLeague(greatLakes, database);
    expect(await listLeagues(database)).toHaveLength(2);
  });
});

describe("updateLeagueSettings", () => {
  it("changes only the name and starting year of that league", async () => {
    const league = await createLeague(greatLakes, database);
    const other = await createLeague({ ...greatLakes, name: "Sun Belt League" }, database);

    const updated = await updateLeagueSettings(
      league.id,
      { name: "Rust Belt League", startYear: 1975 },
      database,
    );

    expect(updated).toEqual({ ...league, name: "Rust Belt League", startYear: 1975 });
    expect(await getLeague(league.id, database)).toEqual(updated);
    expect(await getLeague(other.id, database)).toEqual(other);
  });

  it("returns null and changes nothing for a league that does not exist", async () => {
    const league = await createLeague(greatLakes, database);
    expect(
      await updateLeagueSettings(9999, { name: "Nobody", startYear: 1 }, database),
    ).toBeNull();
    expect(await listLeagues(database)).toEqual([league]);
  });
});

describe("deleteLeague", () => {
  const tables = ["leagues", "teams", "players", "rolls"] as const;

  // Row counts per table for one league, straight from the database.
  async function rowCounts(leagueId: number) {
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const column = table === "leagues" ? "id" : "league_id";
      const result = await database.$client.execute({
        sql: `SELECT COUNT(*) AS total FROM ${table} WHERE ${column} = ?`,
        args: [leagueId],
      });
      counts[table] = Number(result.rows[0].total);
    }
    return counts;
  }

  async function everyRow(leagueId: number) {
    const rows: Record<string, unknown[]> = {};
    for (const table of tables) {
      const column = table === "leagues" ? "id" : "league_id";
      const result = await database.$client.execute({
        sql: `SELECT * FROM ${table} WHERE ${column} = ? ORDER BY id`,
        args: [leagueId],
      });
      rows[table] = result.rows.map((row) => ({ ...row }));
    }
    return rows;
  }

  async function filledLeague(name: string) {
    const league = await createLeague({ ...greatLakes, name, teamCount: 2 }, database);
    await saveTeams(
      league.id,
      [1, 2].map((number) => ({
        number,
        city: null,
        name: null,
        gmName: `GM ${number}`,
        gmRisk: null,
        gmDevFocus: null,
        gmTeamBuilding: null,
        managerName: `Manager ${number}`,
        ballparkName: null,
        ballparkQuality: "neutral" as const,
        cityRoll: null,
        gmRiskRoll: null,
        gmDevFocusRoll: null,
        gmTeamBuildingRoll: null,
      })),
      database,
    );
    const [first, second] = await listTeams(league.id, database);
    const named = <T,>(players: T[]) =>
      players.map((player) => ({ ...player, name: null, nameListId: null }));
    await createPitchingStaff(league.id, first.id, named(rollPitchingStaff()), database);
    await createPositionPlayers(league.id, first.id, named(rollLineup(true)), database);
    await createPitchingStaff(league.id, second.id, named(rollPitchingStaff()), database);
    return league;
  }

  it("removes the league with its teams, players and rolls and leaves another league alone", async () => {
    const league = await filledLeague("Great Lakes League");
    const other = await filledLeague("Sun Belt League");
    const before = await rowCounts(league.id);
    expect(before).toMatchObject({ leagues: 1, teams: 2, players: 31 });
    expect(before.rolls).toBeGreaterThan(100);
    const otherRows = await everyRow(other.id);

    expect(await deleteLeague(league.id, database)).toBe(true);

    expect(await rowCounts(league.id)).toEqual({ leagues: 0, teams: 0, players: 0, rolls: 0 });
    expect(await getLeague(league.id, database)).toBeNull();
    expect(await everyRow(other.id)).toEqual(otherRows);
    expect(await listLeagues(database)).toEqual([other]);
  });

  it("deletes a league that has no teams", async () => {
    const league = await createLeague(greatLakes, database);
    expect(await deleteLeague(league.id, database)).toBe(true);
    expect(await listLeagues(database)).toEqual([]);
  });

  it("reports a missing league and changes nothing", async () => {
    const league = await filledLeague("Great Lakes League");
    const rows = await everyRow(league.id);

    expect(await deleteLeague(9999, database)).toBe(false);
    expect(await deleteLeague(league.id + 1, database)).toBe(false);

    expect(await everyRow(league.id)).toEqual(rows);
  });

  it("keeps everything when the delete fails part way", async () => {
    const league = await filledLeague("Great Lakes League");
    const rows = await everyRow(league.id);
    // The rolls, players and teams are already gone when the last step,
    // removing the league row, is made to fail.
    await database.$client.execute(
      "CREATE TRIGGER block_league_delete BEFORE DELETE ON leagues BEGIN SELECT RAISE(ABORT, 'blocked'); END",
    );

    await expect(deleteLeague(league.id, database)).rejects.toThrow();

    expect(await everyRow(league.id)).toEqual(rows);
  });
});
