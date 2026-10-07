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
import { generatePitchingStaff, generatePositionPlayers } from "./generate";
import { usedNameIds } from "./name-pool";
import {
  drawPlayerName,
  LIST_USED_UP,
  NAME_BLANK,
  NAME_TOO_LONG,
  renameTeam,
  setPlayerName,
  TOO_FEW_NAMES,
  validatePlayerName,
} from "./rename";

let folder: string;
let database: Database;
let leagueId: number;
let teamIds: number[];

const nameOf = (id: number) => NAME_LIST[id - 1].fullName;
// Always picks the first unused name and rolls 11 on every table.
const first = () => 0;
const never = () => {
  throw new Error("no name should be drawn");
};

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

// Uses up list names by parking them on players with no team. The data
// module cannot create those yet, so the rows are written directly.
async function holdNames(entries: readonly { id: number; fullName: string }[]) {
  await database.$client.batch(
    entries.map((entry) => ({
      sql: "INSERT INTO players (league_id, kind, natural_position, name, name_list_id, age) VALUES (?, 'pitcher', 'SP', ?, ?, 25)",
      args: [leagueId, entry.fullName, entry.id],
    })),
    "write",
  );
}

async function everyone() {
  const players = [];
  for (const teamId of teamIds) {
    players.push(
      ...(await listTeamPitchers(leagueId, teamId, database)),
      ...(await listTeamPositionPlayers(leagueId, teamId, database)),
    );
  }
  return players;
}

// Team 1: GM holds list name 1, manager "Made Up Manager"; pitchers hold 3 to
// 13 and position players 14 to 22. Team 2: GM holds 2; pitchers hold 23 to 33.
beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
  const league = await createLeague(
    { name: "Great Lakes League", startYear: 2026, teamCount: 2, useDh: true },
    database,
  );
  leagueId = league.id;
  await saveTeams(
    leagueId,
    [team(1, nameOf(1), "Made Up Manager"), team(2, nameOf(2), null)],
    database,
  );
  teamIds = (await listTeams(leagueId, database)).map((saved) => saved.id);
  await generatePitchingStaff(leagueId, teamIds[0], first, database);
  await generatePositionPlayers(league, teamIds[0], first, database);
  await generatePitchingStaff(leagueId, teamIds[1], first, database);
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("validatePlayerName", () => {
  it("trims the text and keeps it as typed", () => {
    expect(validatePlayerName("  Walt  Harlow ")).toEqual({ ok: true, name: "Walt  Harlow" });
  });

  it("refuses a blank, spaces only, or anything that is not text", () => {
    for (const raw of ["", "   ", null, undefined, 42, {}, ["Walt"]]) {
      expect(validatePlayerName(raw)).toEqual({ ok: false, error: NAME_BLANK });
    }
  });

  it("allows 60 characters and refuses 61, counting characters and not bytes", () => {
    expect(validatePlayerName("é".repeat(60)).ok).toBe(true);
    expect(validatePlayerName("😀".repeat(60)).ok).toBe(true);
    expect(validatePlayerName("a".repeat(61))).toEqual({ ok: false, error: NAME_TOO_LONG });
  });
});

describe("setPlayerName", () => {
  it("saves a name that is not on the list with no list id and changes nothing else", async () => {
    const before = await everyone();
    const target = before[0];

    expect(
      await setPlayerName(leagueId, teamIds[0], target.id, "  Typed By Hand ", database),
    ).toEqual({ ok: true, name: "Typed By Hand" });

    const after = await everyone();
    expect(after[0]).toEqual({ ...target, name: "Typed By Hand", nameListId: null });
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it("stores the list id for a free list name typed in other capitals", async () => {
    const [target] = await everyone();
    const typed = nameOf(500).toUpperCase();

    expect(await setPlayerName(leagueId, teamIds[0], target.id, typed, database)).toEqual({
      ok: true,
      name: typed,
    });
    expect((await everyone())[0]).toMatchObject({ name: typed, nameListId: 500 });
    expect((await usedNameIds(leagueId, database)).has(500)).toBe(true);
  });

  it("lets a player keep its own name in other capitals", async () => {
    const [target] = await everyone();
    const shouted = nameOf(3).toUpperCase();

    expect(await setPlayerName(leagueId, teamIds[0], target.id, shouted, database)).toEqual({
      ok: true,
      name: shouted,
    });
    expect((await everyone())[0]).toMatchObject({ name: shouted, nameListId: 3 });
  });

  it("refuses a name another player holds and says who, on this team or another", async () => {
    const before = await everyone();
    const [target] = before;

    expect(
      await setPlayerName(leagueId, teamIds[0], target.id, nameOf(4).toLowerCase(), database),
    ).toEqual({
      ok: false,
      reason: "refused",
      error: `${nameOf(4).toLowerCase()} is already team 1's SP2. Type another name or press Random name.`,
    });
    expect(
      await setPlayerName(leagueId, teamIds[0], target.id, nameOf(23), database),
    ).toMatchObject({
      error: `${nameOf(23)} is already team 2's SP1. Type another name or press Random name.`,
    });
    expect(await everyone()).toEqual(before);
  });

  it("refuses a GM's or a manager's name, typed or from the list", async () => {
    const before = await everyone();
    const [target] = before;

    expect(
      await setPlayerName(leagueId, teamIds[0], target.id, nameOf(2), database),
    ).toMatchObject({
      error: `${nameOf(2)} is already team 2's GM. Type another name or press Random name.`,
    });
    expect(
      await setPlayerName(leagueId, teamIds[0], target.id, "made up  MANAGER", database),
    ).toMatchObject({
      error:
        "made up  MANAGER is already team 1's manager. Type another name or press Random name.",
    });
    expect(await everyone()).toEqual(before);
  });

  it("refuses a typed name that another player typed first", async () => {
    const [firstPlayer, second] = await everyone();
    await setPlayerName(leagueId, teamIds[0], firstPlayer.id, "Custom Name", database);

    expect(
      await setPlayerName(leagueId, teamIds[0], second.id, "custom name", database),
    ).toMatchObject({
      error: "custom name is already team 1's SP1. Type another name or press Random name.",
    });
  });

  it("refuses a blank or over-long name without writing", async () => {
    const before = await everyone();
    const [target] = before;

    expect(await setPlayerName(leagueId, teamIds[0], target.id, "  ", database)).toEqual({
      ok: false,
      reason: "refused",
      error: NAME_BLANK,
    });
    expect(
      await setPlayerName(leagueId, teamIds[0], target.id, "a".repeat(61), database),
    ).toEqual({ ok: false, reason: "refused", error: NAME_TOO_LONG });
    expect(await everyone()).toEqual(before);
  });

  it("reports a player that is not on the team", async () => {
    const [target] = await everyone();
    const notFound = { ok: false, reason: "not-found" };

    expect(await setPlayerName(leagueId, teamIds[1], target.id, "Anyone", database)).toEqual(notFound);
    expect(await setPlayerName(leagueId + 1, teamIds[0], target.id, "Anyone", database)).toEqual(notFound);
    expect(await setPlayerName(leagueId, teamIds[0], 9999, "Anyone", database)).toEqual(notFound);
  });
});

describe("drawPlayerName", () => {
  it("gives the player an unused list name and frees the old one", async () => {
    const before = await everyone();
    const target = before[0];

    // 1 to 33 are held, so the first unused name is 34.
    expect(await drawPlayerName(leagueId, teamIds[0], target.id, first, database)).toEqual({
      ok: true,
      name: nameOf(34),
    });

    const after = await everyone();
    expect(after[0]).toEqual({ ...target, name: nameOf(34), nameListId: 34 });
    expect(after.slice(1)).toEqual(before.slice(1));

    const used = await usedNameIds(leagueId, database);
    expect(used.has(34)).toBe(true);
    expect(used.has(3)).toBe(false);
  });

  it("gives a new name on every press", async () => {
    const [target] = await everyone();
    const drawn = [];
    for (let press = 0; press < 3; press += 1) {
      const result = await drawPlayerName(leagueId, teamIds[0], target.id, first, database);
      drawn.push(result.ok ? result.name : null);
    }
    // The freed name 3 is first in line again on the second press.
    expect(drawn).toEqual([nameOf(34), nameOf(3), nameOf(34)]);
  });

  it("says so and keeps the name when the list is used up", async () => {
    const before = await everyone();
    await holdNames(NAME_LIST.slice(33));

    expect(
      await drawPlayerName(leagueId, teamIds[0], before[0].id, never, database),
    ).toEqual({ ok: false, reason: "refused", error: LIST_USED_UP });
    expect((await everyone())[0]).toEqual(before[0]);
  });

  it("reports a player that is not on the team without drawing", async () => {
    const [target] = await everyone();
    expect(await drawPlayerName(leagueId, teamIds[1], target.id, never, database)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("renameTeam", () => {
  it("gives all 20 players distinct unused names and frees the old ones", async () => {
    const before = await everyone();

    expect(await renameTeam(leagueId, teamIds[0], first, database)).toEqual({
      ok: true,
      renamed: 20,
    });

    const after = await everyone();
    const team1 = after.slice(0, 20);
    // 1 to 33 were held when the names were drawn, so the team took 34 to 53.
    expect(team1.map((player) => player.nameListId).sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 20 }, (_, index) => 34 + index),
    );
    team1.forEach((player, index) => {
      expect(player).toEqual({
        ...before[index],
        name: nameOf(player.nameListId!),
        nameListId: player.nameListId,
      });
    });
    expect(after.slice(20)).toEqual(before.slice(20));

    const used = await usedNameIds(leagueId, database);
    expect(used.has(3)).toBe(false);
    expect(used.has(22)).toBe(false);
    expect(used.has(23)).toBe(true);
  });

  it("replaces a typed name too", async () => {
    const [target] = await everyone();
    await setPlayerName(leagueId, teamIds[0], target.id, "Typed By Hand", database);

    await renameTeam(leagueId, teamIds[0], first, database);

    const names = (await everyone()).slice(0, 20).map((player) => player.name);
    expect(names).not.toContain("Typed By Hand");
  });

  it("changes nothing when the list has too few free names", async () => {
    await holdNames(NAME_LIST.slice(33, NAME_LIST.length - 19));
    const before = await everyone();

    // 19 names are free and the team needs 20.
    expect(await renameTeam(leagueId, teamIds[0], first, database)).toEqual({
      ok: false,
      reason: "refused",
      error: TOO_FEW_NAMES,
    });
    expect(await everyone()).toEqual(before);
  });

  it("reports a team with no players without drawing", async () => {
    await database.$client.execute({
      sql: "DELETE FROM rolls WHERE player_id IN (SELECT id FROM players WHERE team_id = ?)",
      args: [teamIds[1]],
    });
    await database.$client.execute({
      sql: "DELETE FROM players WHERE team_id = ?",
      args: [teamIds[1]],
    });
    expect(await renameTeam(leagueId, teamIds[1], never, database)).toEqual({
      ok: false,
      reason: "no-players",
    });
    expect(await renameTeam(leagueId + 1, teamIds[0], never, database)).toEqual({
      ok: false,
      reason: "no-players",
    });
  });
});
