import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../data/db";
import { createLeague } from "../data/leagues";
import {
  addFreeAgents,
  createPitchingStaff,
  createPositionPlayers,
  listFreeAgents,
  listLeaguePlayerPlaces,
  listTeamPitchers,
  listTeamPositionPlayers,
} from "../data/players";
import { listTeams, saveTeams } from "../data/teams";
import { DEFAULT_BALLPARK_QUALITY } from "../rules/ballpark";
import { rollFreeAgentPitcher, rollFreeAgentPositionPlayer } from "../rules/free-agents";
import { moveProblem } from "../rules/moves";
import { rollPitchingStaff } from "../rules/pitchers";
import { rollLineup } from "../rules/positions";
import { listMoveTargets, swapTeamPlayer } from "./moves";

let folder: string;
let database: Database;
let leagueId: number;
let teamIds: number[];

function blankTeam(number: number, city: string | null) {
  return {
    number,
    city,
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
  };
}

// Team 1 has no city, team 2 is Toledo and team 3 is Akron. Players are
// named for their team number and slot, such as "T2 SS".
async function addRoster(teamIndex: number) {
  const tag = `T${teamIndex + 1}`;
  await createPitchingStaff(
    leagueId,
    teamIds[teamIndex],
    rollPitchingStaff().map((pitcher, index) => ({
      ...pitcher,
      name: `${tag} ${pitcher.slot}`,
      nameListId: teamIndex * 100 + index + 1,
    })),
    database,
  );
  await createPositionPlayers(
    leagueId,
    teamIds[teamIndex],
    rollLineup(true).map((player, index) => ({
      ...player,
      name: `${tag} ${player.slot}`,
      nameListId: teamIndex * 100 + index + 50,
    })),
    database,
  );
}

async function addFreeAgent(position: "SP" | "RP" | "CL" | "C" | "SS" | "OF", nameListId: number, name: string | null) {
  await addFreeAgents(
    leagueId,
    99,
    [
      position === "SP" || position === "RP" || position === "CL"
        ? { name, nameListId, kind: "pitcher", rolled: rollFreeAgentPitcher(position) }
        : { name, nameListId, kind: "position", rolled: rollFreeAgentPositionPlayer(position) },
    ],
    database,
  );
}

async function playerId(teamIndex: number, slot: string) {
  const all = [
    ...(await listTeamPitchers(leagueId, teamIds[teamIndex], database)),
    ...(await listTeamPositionPlayers(leagueId, teamIds[teamIndex], database)),
  ];
  const found = all.find((player) => player.slot === slot);
  if (!found) throw new Error(`no ${slot}`);
  return found.id;
}

const labels = (groups: Awaited<ReturnType<typeof listMoveTargets>>) =>
  (groups ?? []).map((group) => [group.label, group.targets.map((target) => target.label)]);

beforeEach(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "fib-league-test-"));
  database = await openDatabase(path.join(folder, "test.db"));
  const league = await createLeague(
    { name: "Great Lakes League", startYear: 2026, teamCount: 3, useDh: true },
    database,
  );
  leagueId = league.id;
  await saveTeams(
    leagueId,
    [blankTeam(1, null), blankTeam(2, "Toledo"), blankTeam(3, "Akron")],
    database,
  );
  teamIds = (await listTeams(leagueId, database)).map((team) => team.id);
  for (const index of [0, 1, 2]) await addRoster(index);
});

afterEach(() => {
  database.$client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("listMoveTargets", () => {
  it("offers a shortstop the middle infielders and DHs who fit, grouped in order", async () => {
    await addFreeAgent("SS", 900, "Free Shortstop");
    await addFreeAgent("C", 901, "Free Catcher");
    await addFreeAgent("OF", 902, "Free Outfielder");

    // A natural DH cannot play short, so no DH slot is offered.
    expect(labels(await listMoveTargets(leagueId, teamIds[1], await playerId(1, "SS"), database))).toEqual([
      ["This team", ["2B  T2 2B"]],
      ["Free agents", ["SS  Free Shortstop"]],
      ["Team 1", ["2B  T1 2B", "SS  T1 SS"]],
      ["Team 3 Akron", ["2B  T3 2B", "SS  T3 SS"]],
    ]);
  });

  it("offers a starter the other teams' starters and free agent starters, not teammates", async () => {
    await addFreeAgent("SP", 900, null);
    await addFreeAgent("RP", 901, "Free Reliever");

    const groups = await listMoveTargets(leagueId, teamIds[0], await playerId(0, "SP2"), database);
    expect(groups?.map((group) => group.label)).toEqual(["Free agents", "Team 2 Toledo", "Team 3 Akron"]);
    expect(groups?.[0].targets.map((target) => target.label)).toEqual(["SP  Unnamed"]);
    expect(groups?.[1].targets.map((target) => target.label)).toEqual([
      "SP1  T2 SP1",
      "SP2  T2 SP2",
      "SP3  T2 SP3",
      "SP4  T2 SP4",
      "SP5  T2 SP5",
      "SP6  T2 SP6",
    ]);
  });

  it("labels and orders another team's starters by rank, as their sheet shows them", async () => {
    // Team 2's saved slots are out of order, as on a team rolled before
    // starters were kept best first: its SP4 is the ace and its SP2 the worst.
    const set = (grade: string, where: string) =>
      database.$client.execute({
        sql: `UPDATE players SET grade = ?, hr_tendency = 'neutral', stamina = 6
              WHERE team_id = ? AND natural_position = 'SP' ${where}`,
        args: [grade, teamIds[1]],
      });
    await set("C", "");
    await set("A+", "AND slot = 'SP4'");
    await set("F", "AND slot = 'SP2'");

    const groups = await listMoveTargets(leagueId, teamIds[0], await playerId(0, "SP1"), database);
    const toledo = groups?.find((group) => group.label === "Team 2 Toledo");
    expect(toledo?.targets.map((target) => target.label)).toEqual([
      "SP1  T2 SP4",
      "SP2  T2 SP1",
      "SP3  T2 SP3",
      "SP4  T2 SP5",
      "SP5  T2 SP6",
      "SP6  T2 SP2",
    ]);
    // The ids still belong to the named pitchers, whatever slot is shown.
    expect(toledo?.targets[0].id).toBe(await playerId(1, "SP4"));
    expect(toledo?.targets[5].id).toBe(await playerId(1, "SP2"));
  });

  it("offers a reliever the other relievers on the team and a closer only closers", async () => {
    await addFreeAgent("CL", 900, "Free Closer");

    const reliever = await listMoveTargets(leagueId, teamIds[0], await playerId(0, "RP2"), database);
    expect(reliever?.[0]).toEqual({
      label: "This team",
      targets: [
        { id: await playerId(0, "RP1"), label: "RP1  T1 RP1" },
        { id: await playerId(0, "RP3"), label: "RP3  T1 RP3" },
        { id: await playerId(0, "RP4"), label: "RP4  T1 RP4" },
      ],
    });
    expect(labels(await listMoveTargets(leagueId, teamIds[0], await playerId(0, "CL"), database))).toEqual([
      ["Free agents", ["CL  Free Closer"]],
      ["Team 2 Toledo", ["CL  T2 CL"]],
      ["Team 3 Akron", ["CL  T3 CL"]],
    ]);
  });

  it("shows a target's natural position when their slot does not say it", async () => {
    // The catcher becomes the DH on team 1 and the first baseman moves to third.
    await swapTeamPlayer(leagueId, teamIds[0], await playerId(0, "C"), await playerId(0, "DH"), database)
      .then((result) => expect(result).toMatchObject({ ok: false }));
    await addFreeAgent("C", 900, "Free Catcher");
    const freeCatcher = (await listFreeAgents(leagueId, database)).positionPlayers[0].id;
    const dh = await playerId(0, "DH");
    expect((await swapTeamPlayer(leagueId, teamIds[0], dh, freeCatcher, database)).ok).toBe(true);
    await swapTeamPlayer(leagueId, teamIds[0], await playerId(0, "1B"), await playerId(0, "3B"), database);

    const corner = await listMoveTargets(leagueId, teamIds[1], await playerId(1, "1B"), database);
    expect(corner?.find((group) => group.label === "Team 1")?.targets.map((target) => target.label)).toEqual([
      "1B  T1 3B (3B)",
      "3B  T1 1B (1B)",
    ]);
    const catcher = await listMoveTargets(leagueId, teamIds[1], await playerId(1, "C"), database);
    expect(catcher?.find((group) => group.label === "Team 1")?.targets.map((target) => target.label)).toEqual([
      "C  T1 C",
      "DH  Free Catcher (C)",
    ]);
    // The released natural DH sits in the pool and fits nowhere but DH.
    expect(catcher?.find((group) => group.label === "Free agents")).toBeUndefined();
  });

  it("lists only legal targets", async () => {
    await addFreeAgent("OF", 900, "Free Outfielder");
    const places = await listLeaguePlayerPlaces(leagueId, database);
    for (const slot of ["SP1", "RP1", "CL", "C", "1B", "SS", "CF", "DH"]) {
      const id = await playerId(2, slot);
      const player = places.find((place) => place.id === id);
      if (!player) throw new Error("setup");
      const offered = (await listMoveTargets(leagueId, teamIds[2], id, database))?.flatMap(
        (group) => group.targets.map((target) => target.id),
      );
      const legal = places
        .filter((place) => moveProblem(player, place) === null)
        .map((place) => place.id);
      expect(offered?.sort(), slot).toEqual(legal.sort());
      expect(offered, slot).not.toContain(id);
    }
  });

  it("returns null for a player who is not on that team", async () => {
    const id = await playerId(0, "C");
    expect(await listMoveTargets(leagueId, teamIds[1], id, database)).toBeNull();
    expect(await listMoveTargets(leagueId, teamIds[0], 999999, database)).toBeNull();
    expect(await listMoveTargets(leagueId + 1, teamIds[0], id, database)).toBeNull();
  });
});

describe("swapTeamPlayer", () => {
  it("swaps and names the other player", async () => {
    const ours = await playerId(0, "LF");
    const theirs = await playerId(1, "RF");

    expect(await swapTeamPlayer(leagueId, teamIds[0], ours, theirs, database)).toEqual({
      ok: true,
      message: "Swapped with T2 RF.",
    });
    expect(await playerId(0, "LF")).toBe(theirs);
    expect(await playerId(1, "RF")).toBe(ours);
  });

  it("says who cannot play where", async () => {
    expect(
      await swapTeamPlayer(leagueId, teamIds[0], await playerId(0, "C"), await playerId(1, "SS"), database),
    ).toEqual({
      ok: false,
      reason: "refused",
      error: "T1 C is a natural C and cannot play SS.",
    });
    expect(
      await swapTeamPlayer(leagueId, teamIds[0], await playerId(0, "2B"), await playerId(0, "DH"), database),
    ).toEqual({
      ok: false,
      reason: "refused",
      error: "T1 DH is a natural DH and cannot play 2B.",
    });
  });

  it("explains refused pitcher swaps", async () => {
    const starter = await playerId(0, "SP1");
    expect(await swapTeamPlayer(leagueId, teamIds[0], starter, await playerId(1, "CL"), database)).toEqual({
      ok: false,
      reason: "refused",
      error:
        "T1 SP1 (SP) and T2 CL (CL) have different roles. Pitchers can only swap within their role.",
    });
    expect(await swapTeamPlayer(leagueId, teamIds[0], starter, await playerId(0, "SP2"), database)).toMatchObject({
      ok: false,
      error: expect.stringContaining("kept in order automatically"),
    });
    expect(await swapTeamPlayer(leagueId, teamIds[0], starter, await playerId(0, "C"), database)).toMatchObject({
      ok: false,
      error: "A pitcher and a position player cannot be swapped.",
    });
    expect(await swapTeamPlayer(leagueId, teamIds[0], starter, starter, database)).toMatchObject({
      ok: false,
      error: "Those two players cannot be swapped.",
    });
  });

  it("reports a player who is not on the team, or a target who is not in the league", async () => {
    const notFound = { ok: false, reason: "not-found" };
    const ours = await playerId(0, "C");
    const theirs = await playerId(1, "C");
    // The first player must be on the named team.
    expect(await swapTeamPlayer(leagueId, teamIds[0], theirs, ours, database)).toEqual(notFound);
    expect(await swapTeamPlayer(leagueId, teamIds[0], ours, 999999, database)).toEqual(notFound);
    expect(await playerId(0, "C")).toBe(ours);
    expect(await playerId(1, "C")).toBe(theirs);
  });
});
