import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../data/db";
import { createLeague } from "../data/leagues";
import {
  createPitchingStaff,
  createPositionPlayers,
  listTeamPitchers,
  listTeamPositionPlayers,
} from "../data/players";
import { listTeams, saveTeams } from "../data/teams";
import { DEFAULT_BALLPARK_QUALITY } from "../rules/ballpark";
import { rollPitcher, rollPitchingStaff } from "../rules/pitchers";
import { rollLineup, rollPositionPlayer } from "../rules/positions";
import { rerollPlayer, rerollTeam } from "./reroll";

let folder: string;
let database: Database;
let leagueId: number;
let teamIds: number[];

// Turns d66 results such as 36 into the two random numbers that roll them.
function dice(...results: number[]) {
  const queue = results.flatMap((result) =>
    [Math.floor(result / 10), result % 10].map((face) => (face - 0.5) / 6),
  );
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("ran out of scripted dice");
    return next;
  };
}

const saved = (rolls: { attribute: string }[]) =>
  expect.arrayContaining(rolls.map((roll) => ({ ...roll, source: "app" })));

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
    [1, 2].map((number) => ({
      number,
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
  teamIds = (await listTeams(leagueId, database)).map((team) => team.id);
  await createPitchingStaff(
    leagueId,
    teamIds[0],
    rollPitchingStaff().map((pitcher, index) => ({
      ...pitcher,
      name: `Pitcher ${index}`,
      nameListId: 100 + index,
    })),
    database,
  );
  await createPositionPlayers(
    leagueId,
    teamIds[0],
    rollLineup(true).map((player, index) => ({
      ...player,
      name: `Hitter ${index}`,
      nameListId: 200 + index,
    })),
    database,
  );
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("rerollPlayer", () => {
  it("re-rolls a starter, a closer and a reliever on their own tables", async () => {
    const staff = await listTeamPitchers(leagueId, teamIds[0], database);
    const cases = [
      { slot: "SP2", role: "SP", script: [31, 44, 25, 62] },
      { slot: "CL", role: "CL", script: [11, 66, 43, 15] },
      { slot: "RP3", role: "RP", script: [66, 12, 51] },
    ] as const;

    for (const { slot, role, script } of cases) {
      const target = staff.find((pitcher) => pitcher.slot === slot)!;
      const expected = rollPitcher(role, dice(...script));

      expect(
        await rerollPlayer(leagueId, teamIds[0], target.id, dice(...script), database),
      ).toBe(true);

      const after = (await listTeamPitchers(leagueId, teamIds[0], database)).find(
        (pitcher) => pitcher.id === target.id,
      )!;
      expect(after).toMatchObject({
        slot,
        name: target.name,
        nameListId: target.nameListId,
        age: expected.age,
        grade: expected.grade,
        gradeCeiling: expected.gradeCeiling,
        hrTendency: expected.hrTendency,
        stamina: expected.stamina,
      });
      expect(after.rolls).toHaveLength(script.length);
      expect(after.rolls).toEqual(saved(expected.rolls));
    }
  });

  it("re-rolls a position player on the tables for its natural position", async () => {
    const lineup = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    // Seven results cover an Elite check; a roll that needs fewer ignores the rest.
    const script = [33, 52, 24, 41, 16, 63, 35];

    for (const slot of ["SS", "LF", "DH"] as const) {
      const target = lineup.find((player) => player.slot === slot)!;
      const expected = rollPositionPlayer(slot, dice(...script));

      expect(
        await rerollPlayer(leagueId, teamIds[0], target.id, dice(...script), database),
      ).toBe(true);

      const after = (
        await listTeamPositionPlayers(leagueId, teamIds[0], database)
      ).find((player) => player.id === target.id)!;
      expect(after).toMatchObject({
        slot,
        naturalPosition: slot,
        name: target.name,
        nameListId: target.nameListId,
        archetype: expected.archetype,
        age: expected.age,
        hitting: expected.hitting,
        power: expected.power,
        defense: expected.defense,
        clutch: expected.clutch,
        hittingCeiling: expected.hittingCeiling,
        powerCeiling: expected.powerCeiling,
        defenseCeiling: expected.defenseCeiling,
        clutchCeiling: expected.clutchCeiling,
      });
      expect(after.rolls).toHaveLength(expected.rolls.length);
      expect(after.rolls).toEqual(saved(expected.rolls));
    }

    const dh = (await listTeamPositionPlayers(leagueId, teamIds[0], database)).find(
      (player) => player.slot === "DH",
    )!;
    expect(dh.rolls.find((roll) => roll.attribute === "archetype")?.tableKey).toBe(
      "position.archetype.DH",
    );
  });

  it("uses the natural position's tables after a player has changed slot", async () => {
    const lineup = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const shortstop = lineup.find((player) => player.slot === "SS")!;
    const dh = lineup.find((player) => player.slot === "DH")!;
    // No roster move exists yet, so the natural shortstop is put in the DH
    // slot directly.
    await database.$client.execute({
      sql: "UPDATE players SET slot = NULL WHERE id = ?",
      args: [dh.id],
    });
    await database.$client.execute({
      sql: "UPDATE players SET slot = 'DH' WHERE id = ?",
      args: [shortstop.id],
    });
    const script = [33, 52, 24, 41, 16, 63, 35];
    const expected = rollPositionPlayer("SS", dice(...script));

    expect(
      await rerollPlayer(leagueId, teamIds[0], shortstop.id, dice(...script), database),
    ).toBe(true);

    const after = (await listTeamPositionPlayers(leagueId, teamIds[0], database)).find(
      (player) => player.id === shortstop.id,
    )!;
    expect(after).toMatchObject({
      slot: "DH",
      naturalPosition: "SS",
      archetype: expected.archetype,
    });
    expect(after.rolls.find((roll) => roll.attribute === "archetype")?.tableKey).toBe(
      "position.archetype.SS",
    );
    expect(after.rolls).toEqual(saved(expected.rolls));
  });

  it("gives a different player each time it is pressed", async () => {
    const [target] = await listTeamPitchers(leagueId, teamIds[0], database);

    await rerollPlayer(leagueId, teamIds[0], target.id, dice(11, 11, 11, 11), database);
    const [first] = await listTeamPitchers(leagueId, teamIds[0], database);
    await rerollPlayer(leagueId, teamIds[0], target.id, dice(66, 66, 66, 66), database);
    const [second] = await listTeamPitchers(leagueId, teamIds[0], database);

    expect(first.rolls.map((roll) => roll.dice)).toEqual(["11", "11", "11", "11"]);
    expect(second.rolls.map((roll) => roll.dice)).toEqual(["66", "66", "66", "66"]);
    expect(second.age).not.toBe(first.age);
  });

  it("does nothing for a player that is not on the team", async () => {
    const pitchers = await listTeamPitchers(leagueId, teamIds[0], database);
    const never = () => {
      throw new Error("no dice should be rolled");
    };

    expect(await rerollPlayer(leagueId, teamIds[1], pitchers[0].id, never, database)).toBe(false);
    expect(await rerollPlayer(leagueId + 1, teamIds[0], pitchers[0].id, never, database)).toBe(false);
    expect(await rerollPlayer(leagueId, teamIds[0], 9999, never, database)).toBe(false);

    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(pitchers);
  });
});

describe("rerollTeam", () => {
  it("re-rolls all 20 players and keeps every name and slot", async () => {
    const pitchers = await listTeamPitchers(leagueId, teamIds[0], database);
    const hitters = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    // Every die comes up 1, so every roll is 11.
    const ones = () => 0;

    expect(await rerollTeam(leagueId, teamIds[0], ones, database)).toBe(20);

    const newPitchers = await listTeamPitchers(leagueId, teamIds[0], database);
    const newHitters = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const identity = (player: { id: number; slot: string; name: string | null; nameListId: number | null }) => ({
      id: player.id,
      slot: player.slot,
      name: player.name,
      nameListId: player.nameListId,
    });
    expect(newPitchers.map(identity)).toEqual(pitchers.map(identity));
    expect(newHitters.map(identity)).toEqual(hitters.map(identity));

    for (const player of [...newPitchers, ...newHitters]) {
      expect(player.rolls.length).toBeGreaterThan(0);
      expect(player.rolls.every((roll) => roll.dice === "11")).toBe(true);
    }
    const { age, grade, gradeCeiling, hrTendency, stamina } = rollPitcher("SP", ones);
    expect(newPitchers[0]).toMatchObject({ age, grade, gradeCeiling, hrTendency, stamina });
  });

  it("re-rolls a moved player on the tables for its natural position", async () => {
    const lineup = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const shortstop = lineup.find((player) => player.slot === "SS")!;
    const dh = lineup.find((player) => player.slot === "DH")!;
    await database.$client.execute({
      sql: "UPDATE players SET slot = NULL WHERE id = ?",
      args: [dh.id],
    });
    await database.$client.execute({
      sql: "UPDATE players SET slot = 'DH' WHERE id = ?",
      args: [shortstop.id],
    });

    expect(await rerollTeam(leagueId, teamIds[0], () => 0, database)).toBe(20);

    const moved = (await listTeamPositionPlayers(leagueId, teamIds[0], database)).find(
      (player) => player.id === shortstop.id,
    )!;
    expect(moved.slot).toBe("DH");
    expect(moved.rolls.find((roll) => roll.attribute === "archetype")?.tableKey).toBe(
      "position.archetype.SS",
    );
  });

  it("returns 0 and rolls nothing for a team with no players", async () => {
    const never = () => {
      throw new Error("no dice should be rolled");
    };
    expect(await rerollTeam(leagueId, teamIds[1], never, database)).toBe(0);
    expect(await rerollTeam(leagueId + 1, teamIds[0], never, database)).toBe(0);
  });
});
