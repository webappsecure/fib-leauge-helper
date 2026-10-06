import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "./db";
import { createLeague, getLeague, listLeagues } from "./leagues";

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
