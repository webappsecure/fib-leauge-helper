import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  rollFreeAgentPitcher,
  rollFreeAgentPositionPlayer,
} from "../rules/free-agents";
import { GRADES, type Grade } from "../rules/grades";
import {
  orderStarters,
  PITCHER_SLOTS,
  rollPitcher,
  rollPitchingStaff,
  STARTER_SLOTS,
  type RolledPitcher,
} from "../rules/pitchers";
import { rollLineup, rollPositionPlayer } from "../rules/positions";
import { openDatabase, type Database } from "./db";
import { createLeague, deleteLeague } from "./leagues";
import {
  addFreeAgents,
  countFreeAgentsByPosition,
  countPlayersByTeam,
  createPitchingStaff,
  createPositionPlayers,
  getTeamPlayer,
  listFreeAgents,
  listLeaguePlayerNames,
  listLeagueRosterGrades,
  renamePlayer,
  renameTeamPlayers,
  listTeamPitchers,
  listTeamPositionPlayers,
  listUsedNameIds,
  replacePitcherValues,
  replacePositionPlayerValues,
  replaceTeamValues,
  listTeamPlayerIds,
  type NewFreeAgent,
  type NewPitcher,
  type Pitcher,
  type NewPositionPlayer,
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

function namedLineup(firstNameId: number, useDh = true): NewPositionPlayer[] {
  return rollLineup(useDh).map((player, index) => ({
    ...player,
    name: `Hitter ${firstNameId + index}`,
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

describe("position player data", () => {
  it("starts with no position players", async () => {
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual([]);
  });

  it("saves a lineup and reads it back in slot order with its rolls", async () => {
    const lineup = namedLineup(300);
    const result = await createPositionPlayers(
      leagueId,
      teamIds[0],
      [...lineup].reverse(),
      database,
    );
    expect(result).toEqual({ created: true });

    const saved = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    expect(saved.map((player) => player.slot)).toEqual([
      "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH",
    ]);

    saved.forEach((player, index) => {
      const { rolls, ...rolled } = lineup[index];
      expect(player).toMatchObject({
        ...rolled,
        leagueId,
        teamId: teamIds[0],
        naturalPosition: rolled.slot,
        breakthroughUsed: false,
      });
      expect(player.rolls).toHaveLength(rolls.length);
      expect(player.rolls).toEqual(
        expect.arrayContaining(rolls.map((roll) => ({ ...roll, source: "app" }))),
      );
    });
  });

  it("saves eight players for a lineup without a DH", async () => {
    await createPositionPlayers(leagueId, teamIds[0], namedLineup(300, false), database);
    const saved = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    expect(saved).toHaveLength(8);
    expect(saved.some((player) => player.slot === "DH")).toBe(false);
  });

  it("does nothing when the team already has position players", async () => {
    await createPositionPlayers(leagueId, teamIds[0], namedLineup(300), database);
    const before = await listTeamPositionPlayers(leagueId, teamIds[0], database);

    const result = await createPositionPlayers(
      leagueId,
      teamIds[0],
      namedLineup(400),
      database,
    );

    expect(result).toEqual({ created: false });
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual(before);
  });

  it("keeps pitchers and position players on one team apart", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    const pitchersBefore = await listTeamPitchers(leagueId, teamIds[0], database);

    const result = await createPositionPlayers(
      leagueId,
      teamIds[0],
      namedLineup(300),
      database,
    );

    expect(result).toEqual({ created: true });
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(pitchersBefore);
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toHaveLength(9);
    expect(await listUsedNameIds(leagueId, database)).toHaveLength(20);
  });

  it("rejects a name already used by a pitcher and saves none of the lineup", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);

    // Ids 105 to 113 are all held by the pitchers.
    await expect(
      createPositionPlayers(leagueId, teamIds[0], namedLineup(105), database),
    ).rejects.toThrow();
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual([]);
  });
});

describe("countPlayersByTeam", () => {
  it("counts pitchers and position players for each team with players", async () => {
    const other = await addLeague("Sun Belt League");
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    await createPositionPlayers(leagueId, teamIds[0], namedLineup(300), database);
    await createPositionPlayers(leagueId, teamIds[1], namedLineup(400, false), database);
    await createPitchingStaff(other.leagueId, other.teamIds[0], namedStaff(100), database);

    const counts = await countPlayersByTeam(leagueId, database);
    expect(counts).toHaveLength(2);
    expect(counts).toEqual(
      expect.arrayContaining([
        { teamId: teamIds[0], pitchers: 11, positionPlayers: 9 },
        { teamId: teamIds[1], pitchers: 0, positionPlayers: 8 },
      ]),
    );
  });

  it("is empty for a league with no players", async () => {
    expect(await countPlayersByTeam(leagueId, database)).toEqual([]);
  });
});

describe("re-rolling a player", () => {
  const asSaved = (rolls: { attribute: string }[]) =>
    expect.arrayContaining(rolls.map((roll) => ({ ...roll, source: "app" })));

  const isStarter = (pitcher: Pitcher) => pitcher.naturalPosition === "SP";
  // Everything about each pitcher except where they sit, keyed by id, so a
  // change of slot alone does not count as a change to the pitcher.
  const apartFromSlot = (pitchers: Pitcher[]) =>
    Object.fromEntries(
      pitchers.map((pitcher) => [pitcher.id, { ...pitcher, slot: "any" }]),
    );

  // The six starters fill SP1 to SP6 in the order the rules put them in.
  function expectStartersBestFirst(pitchers: Pitcher[]) {
    const starters = pitchers.filter(isStarter);
    expect(starters.map((starter) => starter.slot)).toEqual([...STARTER_SLOTS]);
    expect(orderStarters(starters).map((starter) => starter.id)).toEqual(
      starters.map((starter) => starter.id),
    );
    const grades = starters.map((starter) => GRADES.indexOf(starter.grade));
    expect(grades).toEqual([...grades].sort((a, b) => b - a));
  }

  const starter = (grade: Grade): RolledPitcher => ({
    ...rollPitcher("SP"),
    grade,
    gradeCeiling: grade,
    hrTendency: "neutral",
    stamina: 6,
  });

  // Keeps rolling until the catcher does or does not need an Elite check.
  function catcher(withEliteCheck: boolean) {
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const player = rollPositionPlayer("C");
      const has = player.rolls.some((roll) => roll.attribute === "eliteCheck");
      if (has === withEliteCheck) return player;
    }
    throw new Error("no such catcher rolled");
  }

  beforeEach(async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    await createPositionPlayers(leagueId, teamIds[0], namedLineup(200), database);
    await createPitchingStaff(leagueId, teamIds[1], namedStaff(300), database);
  });

  it("finds a player on its own team and nowhere else", async () => {
    const [sp1] = await listTeamPitchers(leagueId, teamIds[0], database);
    const [catcherRow] = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const other = await addLeague("Sun Belt League");

    expect(await getTeamPlayer(leagueId, teamIds[0], sp1.id, database)).toEqual({
      id: sp1.id,
      kind: "pitcher",
      naturalPosition: "SP",
    });
    expect(await getTeamPlayer(leagueId, teamIds[0], catcherRow.id, database)).toEqual({
      id: catcherRow.id,
      kind: "position",
      naturalPosition: "C",
    });
    expect(await getTeamPlayer(leagueId, teamIds[1], sp1.id, database)).toBeNull();
    expect(await getTeamPlayer(other.leagueId, teamIds[0], sp1.id, database)).toBeNull();
    expect(await getTeamPlayer(leagueId, teamIds[0], 9999, database)).toBeNull();
  });

  it("replaces a pitcher's values and rolls and nothing else", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const otherTeam = await listTeamPitchers(leagueId, teamIds[1], database);
    const hitters = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const target = before[2];
    const rolled = rollPitcher("SP");

    expect(
      await replacePitcherValues(leagueId, teamIds[0], target.id, rolled, database),
    ).toBe(true);

    const after = await listTeamPitchers(leagueId, teamIds[0], database);
    const saved = after.find((pitcher) => pitcher.id === target.id)!;
    expect(saved).toMatchObject({
      id: target.id,
      teamId: teamIds[0],
      naturalPosition: target.naturalPosition,
      name: target.name,
      nameListId: target.nameListId,
      breakthroughUsed: false,
      age: rolled.age,
      grade: rolled.grade,
      gradeCeiling: rolled.gradeCeiling,
      hrTendency: rolled.hrTendency,
      stamina: rolled.stamina,
    });
    expect(saved.rolls).toHaveLength(4);
    expect(saved.rolls).toEqual(asSaved(rolled.rolls));

    // The other pitchers keep everything; starters may only change slot.
    const others = (pitchers: Pitcher[]) =>
      pitchers.filter((pitcher) => pitcher.id !== target.id);
    expect(apartFromSlot(others(after))).toEqual(apartFromSlot(others(before)));
    expect(after.filter((pitcher) => !isStarter(pitcher))).toEqual(
      before.filter((pitcher) => !isStarter(pitcher)),
    );
    expectStartersBestFirst(after);
    expect(await listTeamPitchers(leagueId, teamIds[1], database)).toEqual(otherTeam);
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual(hitters);
  });

  it("saves a reliever with no stamina and no stamina roll", async () => {
    const staff = await listTeamPitchers(leagueId, teamIds[0], database);
    const reliever = staff.find((pitcher) => pitcher.slot === "RP1")!;
    const rolled = rollPitcher("RP");

    await replacePitcherValues(leagueId, teamIds[0], reliever.id, rolled, database);

    const saved = (await listTeamPitchers(leagueId, teamIds[0], database)).find(
      (pitcher) => pitcher.id === reliever.id,
    )!;
    expect(saved.stamina).toBeNull();
    expect(saved.rolls.map((roll) => roll.attribute).sort()).toEqual([
      "age",
      "grade",
      "hrTendency",
    ]);
  });

  it("replaces a position player and drops an Elite check roll that no longer applies", async () => {
    const [target] = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const elite = catcher(true);
    const plain = catcher(false);

    await replacePositionPlayerValues(leagueId, teamIds[0], target.id, elite, database);
    let [saved] = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    expect(saved.rolls).toHaveLength(7);
    expect(saved.rolls).toEqual(asSaved(elite.rolls));

    await replacePositionPlayerValues(leagueId, teamIds[0], target.id, plain, database);
    [saved] = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    expect(saved).toMatchObject({
      id: target.id,
      slot: "C",
      naturalPosition: "C",
      name: target.name,
      nameListId: target.nameListId,
      archetype: plain.archetype,
      age: plain.age,
      hitting: plain.hitting,
      power: plain.power,
      defense: plain.defense,
      clutch: plain.clutch,
      hittingCeiling: plain.hittingCeiling,
      powerCeiling: plain.powerCeiling,
      defenseCeiling: plain.defenseCeiling,
      clutchCeiling: plain.clutchCeiling,
    });
    expect(saved.rolls).toHaveLength(6);
    expect(saved.rolls).toEqual(asSaved(plain.rolls));
  });

  it("keeps the old values and rolls when the save fails part way", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const rolled = rollPitcher("SP");
    // Two rolls for one attribute break the one-roll-per-attribute rule.
    const broken = { ...rolled, rolls: [...rolled.rolls, rolled.rolls[0]] };

    await expect(
      replacePitcherValues(leagueId, teamIds[0], before[0].id, broken, database),
    ).rejects.toThrow();

    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(before);
  });

  it("writes nothing for a player on another team, in another league or of the other kind", async () => {
    const pitchers = await listTeamPitchers(leagueId, teamIds[0], database);
    const hitters = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const other = await addLeague("Sun Belt League");
    const sp = rollPitcher("SP");

    expect(
      await replacePitcherValues(leagueId, teamIds[1], pitchers[0].id, sp, database),
    ).toBe(false);
    expect(
      await replacePitcherValues(other.leagueId, teamIds[0], pitchers[0].id, sp, database),
    ).toBe(false);
    expect(
      await replacePitcherValues(leagueId, teamIds[0], hitters[0].id, sp, database),
    ).toBe(false);
    expect(
      await replacePositionPlayerValues(
        leagueId,
        teamIds[0],
        pitchers[0].id,
        catcher(false),
        database,
      ),
    ).toBe(false);

    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(pitchers);
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual(hitters);
  });

  it("lists every player on a team and none from another team", async () => {
    const ids = await listTeamPlayerIds(leagueId, teamIds[0], database);
    expect(ids).toHaveLength(20);
    expect(ids.filter((player) => player.kind === "pitcher")).toHaveLength(11);
    expect(await listTeamPlayerIds(leagueId, teamIds[1], database)).toHaveLength(11);
    expect(await listTeamPlayerIds(leagueId + 1, teamIds[0], database)).toEqual([]);
  });

  it("replaces several players together, or none when one cannot be written", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const [otherTeamPitcher] = await listTeamPitchers(leagueId, teamIds[1], database);
    const first = rollPitcher("SP");
    const second = rollPitcher("SP");

    await replaceTeamValues(
      leagueId,
      teamIds[0],
      [
        { playerId: before[0].id, kind: "pitcher", rolled: first },
        { playerId: before[1].id, kind: "pitcher", rolled: second },
      ],
      database,
    );
    const after = await listTeamPitchers(leagueId, teamIds[0], database);
    const byId = (id: number) => after.find((pitcher) => pitcher.id === id)!;
    expect(byId(before[0].id).rolls).toEqual(asSaved(first.rolls));
    expect(byId(before[1].id).rolls).toEqual(asSaved(second.rolls));
    const untouched = (pitchers: Pitcher[]) =>
      pitchers.filter((pitcher) => ![before[0].id, before[1].id].includes(pitcher.id));
    expect(apartFromSlot(untouched(after))).toEqual(apartFromSlot(untouched(before)));
    expectStartersBestFirst(after);

    await expect(
      replaceTeamValues(
        leagueId,
        teamIds[0],
        [
          { playerId: before[2].id, kind: "pitcher", rolled: rollPitcher("SP") },
          { playerId: otherTeamPitcher.id, kind: "pitcher", rolled: rollPitcher("SP") },
        ],
        database,
      ),
    ).rejects.toThrow();
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(after);
    expect((await listTeamPitchers(leagueId, teamIds[1], database))[0]).toEqual(
      otherTeamPitcher,
    );
  });

  it("puts the starters back in order, best first, moving only their slots", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const hitters = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const otherTeam = await listTeamPitchers(leagueId, teamIds[1], database);
    const starters = before.filter(isStarter);
    // Worst to best in slot order, so the save has to turn the six round.
    const grades: Grade[] = ["F", "D", "C", "B", "B+", "A"];

    await replaceTeamValues(
      leagueId,
      teamIds[0],
      starters.map((pitcher, index) => ({
        playerId: pitcher.id,
        kind: "pitcher" as const,
        rolled: starter(grades[index]),
      })),
      database,
    );

    const after = await listTeamPitchers(leagueId, teamIds[0], database);
    const newStarters = after.filter(isStarter);
    expect(newStarters.map((pitcher) => pitcher.slot)).toEqual([...STARTER_SLOTS]);
    expect(newStarters.map((pitcher) => pitcher.grade)).toEqual([...grades].reverse());
    expect(newStarters.map((pitcher) => pitcher.id)).toEqual(
      [...starters].reverse().map((pitcher) => pitcher.id),
    );
    // Names stay with their pitcher; relievers, closer and everyone else stay put.
    expect(newStarters.map((pitcher) => pitcher.name)).toEqual(
      [...starters].reverse().map((pitcher) => pitcher.name),
    );
    expect(after.filter((pitcher) => !isStarter(pitcher))).toEqual(
      before.filter((pitcher) => !isStarter(pitcher)),
    );
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual(hitters);
    expect(await listTeamPitchers(leagueId, teamIds[1], database)).toEqual(otherTeam);
  });

  it("moves one re-rolled starter to its place and shifts the rest", async () => {
    const before = (await listTeamPitchers(leagueId, teamIds[0], database)).filter(isStarter);
    const grades: Grade[] = ["A", "B+", "B", "C", "D", "F"];
    await replaceTeamValues(
      leagueId,
      teamIds[0],
      before.map((pitcher, index) => ({
        playerId: pitcher.id,
        kind: "pitcher" as const,
        rolled: starter(grades[index]),
      })),
      database,
    );
    const ids = before.map((pitcher) => pitcher.id);

    // The worst starter becomes the best: SP6 goes to SP1 and the others drop one.
    await replacePitcherValues(leagueId, teamIds[0], ids[5], starter("A+"), database);
    let starters = (await listTeamPitchers(leagueId, teamIds[0], database)).filter(isStarter);
    expect(starters.map((pitcher) => pitcher.id)).toEqual([ids[5], ...ids.slice(0, 5)]);
    expect(starters.map((pitcher) => pitcher.slot)).toEqual([...STARTER_SLOTS]);

    // An equal grade does not jump the queue: the re-rolled B stays behind the B already there.
    await replacePitcherValues(leagueId, teamIds[0], ids[0], starter("B"), database);
    starters = (await listTeamPitchers(leagueId, teamIds[0], database)).filter(isStarter);
    expect(starters.map((pitcher) => pitcher.id)).toEqual([
      ids[5], ids[1], ids[0], ids[2], ids[3], ids[4],
    ]);
  });

  it("moves nobody when a reliever or the closer is re-rolled", async () => {
    const grades: Grade[] = ["A", "B+", "B", "C", "D", "F"];
    const starters = (await listTeamPitchers(leagueId, teamIds[0], database)).filter(isStarter);
    await replaceTeamValues(
      leagueId,
      teamIds[0],
      starters.map((pitcher, index) => ({
        playerId: pitcher.id,
        kind: "pitcher" as const,
        rolled: starter(grades[index]),
      })),
      database,
    );
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const closer = before.find((pitcher) => pitcher.slot === "CL")!;

    await replacePitcherValues(
      leagueId,
      teamIds[0],
      closer.id,
      { ...rollPitcher("CL"), grade: "A+", gradeCeiling: "A+" },
      database,
    );

    const after = await listTeamPitchers(leagueId, teamIds[0], database);
    expect(after.map((pitcher) => [pitcher.id, pitcher.slot])).toEqual(
      before.map((pitcher) => [pitcher.id, pitcher.slot]),
    );
  });

  it("keeps the old order when the save fails", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const worst = before.filter(isStarter)[5];
    const best = starter("A+");
    const broken = { ...best, rolls: [...best.rolls, best.rolls[0]] };

    await expect(
      replacePitcherValues(leagueId, teamIds[0], worst.id, broken, database),
    ).rejects.toThrow();

    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(before);
  });
});

describe("player names", () => {
  beforeEach(async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    await createPositionPlayers(leagueId, teamIds[0], namedLineup(200), database);
    await createPitchingStaff(leagueId, teamIds[1], namedStaff(300), database);
  });

  it("lists every named player in the league with team and slot", async () => {
    const other = await addLeague("Sun Belt League");
    await createPitchingStaff(other.leagueId, other.teamIds[0], namedStaff(100), database);

    const names = await listLeaguePlayerNames(leagueId, database);
    expect(names).toHaveLength(31);
    expect(names).toContainEqual({
      id: expect.any(Number),
      teamId: teamIds[0],
      slot: "SP1",
      name: "Pitcher 100",
    });
    expect(await listLeaguePlayerNames(other.leagueId, database)).toHaveLength(11);
  });

  it("leaves an unnamed player out of the list", async () => {
    const [target] = await listTeamPitchers(leagueId, teamIds[0], database);
    await database.$client.execute({
      sql: "UPDATE players SET name = NULL, name_list_id = NULL WHERE id = ?",
      args: [target.id],
    });
    const names = await listLeaguePlayerNames(leagueId, database);
    expect(names).toHaveLength(30);
    expect(names.some((entry) => entry.id === target.id)).toBe(false);
  });

  it("renames one player and changes nothing else about anyone", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const hitters = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    const target = before[3];
    // A used breakthrough must survive a rename.
    await database.$client.execute({
      sql: "UPDATE players SET breakthrough_used = 1 WHERE id = ?",
      args: [target.id],
    });

    expect(
      await renamePlayer(
        leagueId,
        teamIds[0],
        { playerId: target.id, name: "Walt Harlow", nameListId: 42 },
        database,
      ),
    ).toBe(true);

    const after = await listTeamPitchers(leagueId, teamIds[0], database);
    expect(after[3]).toEqual({
      ...target,
      name: "Walt Harlow",
      nameListId: 42,
      breakthroughUsed: true,
    });
    expect(after.filter((pitcher) => pitcher.id !== target.id)).toEqual(
      before.filter((pitcher) => pitcher.id !== target.id),
    );
    expect(await listTeamPositionPlayers(leagueId, teamIds[0], database)).toEqual(hitters);

    await renamePlayer(
      leagueId,
      teamIds[0],
      { playerId: target.id, name: "Typed By Hand", nameListId: null },
      database,
    );
    const [typed] = (await listTeamPitchers(leagueId, teamIds[0], database)).filter(
      (pitcher) => pitcher.id === target.id,
    );
    expect(typed).toMatchObject({ name: "Typed By Hand", nameListId: null });
  });

  it("renames a position player without touching its values or rolls", async () => {
    const [target] = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    await renamePlayer(
      leagueId,
      teamIds[0],
      { playerId: target.id, name: "New Catcher", nameListId: null },
      database,
    );
    const [after] = await listTeamPositionPlayers(leagueId, teamIds[0], database);
    expect(after).toEqual({ ...target, name: "New Catcher", nameListId: null });
  });

  it("writes nothing for a player on another team or in another league", async () => {
    const pitchers = await listTeamPitchers(leagueId, teamIds[0], database);
    const other = await addLeague("Sun Belt League");
    const entry = { playerId: pitchers[0].id, name: "Nobody", nameListId: null };

    expect(await renamePlayer(leagueId, teamIds[1], entry, database)).toBe(false);
    expect(await renamePlayer(other.leagueId, teamIds[0], entry, database)).toBe(false);
    expect(
      await renamePlayer(leagueId, teamIds[0], { ...entry, playerId: 9999 }, database),
    ).toBe(false);
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(pitchers);
  });

  it("renames several players together, or none when one cannot be written", async () => {
    const before = await listTeamPitchers(leagueId, teamIds[0], database);
    const [otherTeamPitcher] = await listTeamPitchers(leagueId, teamIds[1], database);

    await renameTeamPlayers(
      leagueId,
      teamIds[0],
      [
        { playerId: before[0].id, name: "First New", nameListId: 900 },
        { playerId: before[1].id, name: "Second New", nameListId: null },
      ],
      database,
    );
    const after = await listTeamPitchers(leagueId, teamIds[0], database);
    expect(after[0]).toEqual({ ...before[0], name: "First New", nameListId: 900 });
    expect(after[1]).toEqual({ ...before[1], name: "Second New", nameListId: null });
    expect(after.slice(2)).toEqual(before.slice(2));

    await expect(
      renameTeamPlayers(
        leagueId,
        teamIds[0],
        [
          { playerId: before[2].id, name: "Should Not Stick", nameListId: null },
          { playerId: otherTeamPitcher.id, name: "Wrong Team", nameListId: null },
        ],
        database,
      ),
    ).rejects.toThrow();
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toEqual(after);
    expect((await listTeamPitchers(leagueId, teamIds[1], database))[0]).toEqual(
      otherTeamPitcher,
    );
  });
});

describe("listLeagueRosterGrades", () => {
  it("returns every team's players in the league with the grades qualities need", async () => {
    const staff = namedStaff(100);
    const hitters = namedLineup(200);
    await createPitchingStaff(leagueId, teamIds[0], staff, database);
    await createPositionPlayers(leagueId, teamIds[0], hitters, database);
    await createPitchingStaff(leagueId, teamIds[1], namedStaff(300), database);
    const other = await addLeague("Sun Belt League");
    await createPitchingStaff(other.leagueId, other.teamIds[0], namedStaff(100), database);

    const grades = await listLeagueRosterGrades(leagueId, database);
    expect(grades).toHaveLength(31);
    expect(grades.filter((player) => player.teamId === teamIds[1])).toHaveLength(11);

    const rp2 = staff.find((pitcher) => pitcher.slot === "RP2")!;
    expect(grades).toContainEqual({
      teamId: teamIds[0],
      slot: "RP2",
      kind: "pitcher",
      grade: rp2.grade,
      hrTendency: rp2.hrTendency,
    });
    const shortstop = hitters.find((player) => player.slot === "SS")!;
    expect(grades).toContainEqual({
      teamId: teamIds[0],
      slot: "SS",
      kind: "position",
      hitting: shortstop.hitting,
      power: shortstop.power,
      defense: shortstop.defense,
    });

    expect(await listLeagueRosterGrades(other.leagueId, database)).toHaveLength(11);
  });

  it("leaves out a player with no team or no slot", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(100), database);
    const [first, second] = await listTeamPitchers(leagueId, teamIds[0], database);
    await database.$client.execute({
      sql: "UPDATE players SET team_id = NULL, slot = NULL WHERE id = ?",
      args: [first.id],
    });
    await database.$client.execute({
      sql: "UPDATE players SET slot = NULL WHERE id = ?",
      args: [second.id],
    });

    expect(await listLeagueRosterGrades(leagueId, database)).toHaveLength(9);
  });
});

describe("free agents", () => {
  // One free agent at each of the named positions, named from consecutive
  // name-list ids.
  function agents(firstNameId: number, ...positions: ("SP" | "RP" | "CL" | "C" | "OF")[]) {
    return positions.map((position, index): NewFreeAgent => {
      const named = {
        name: `Free Agent ${firstNameId + index}`,
        nameListId: firstNameId + index,
      };
      return position === "C" || position === "OF"
        ? { ...named, kind: "position", rolled: rollFreeAgentPositionPlayer(position) }
        : { ...named, kind: "pitcher", rolled: rollFreeAgentPitcher(position) };
    });
  }

  it("saves free agents with no team or slot, with their values and rolls", async () => {
    const entries = agents(1, "OF", "SP", "RP");
    expect(await addFreeAgents(leagueId, 2, entries, database)).toEqual({ created: 3 });

    const pool = await listFreeAgents(leagueId, database);
    // Listed in pool position order, not the order they were saved in.
    expect(pool.pitchers.map((pitcher) => pitcher.naturalPosition)).toEqual(["SP", "RP"]);
    expect(pool.positionPlayers).toHaveLength(1);

    const [, starter, reliever] = entries;
    if (starter.kind !== "pitcher" || entries[0].kind !== "position") throw new Error("setup");
    expect(pool.pitchers[0]).toMatchObject({
      leagueId,
      teamId: null,
      slot: null,
      kind: "pitcher",
      name: "Free Agent 2",
      nameListId: 2,
      age: starter.rolled.age,
      grade: starter.rolled.grade,
      gradeCeiling: starter.rolled.grade,
      hrTendency: starter.rolled.hrTendency,
      stamina: starter.rolled.stamina,
      breakthroughUsed: false,
    });
    expect(pool.pitchers[0].rolls).toEqual(
      starter.rolled.rolls.map((roll) => ({ ...roll, source: "app" })),
    );
    expect(pool.pitchers[1].stamina).toBeNull();
    expect(pool.pitchers[1].rolls).toHaveLength(reliever.rolled.rolls.length);

    const outfielder = entries[0].rolled;
    expect(pool.positionPlayers[0]).toMatchObject({
      teamId: null,
      slot: null,
      kind: "position",
      naturalPosition: "OF",
      archetype: outfielder.archetype,
      hitting: outfielder.hitting,
      hittingCeiling: outfielder.hitting,
      power: outfielder.power,
      powerCeiling: outfielder.power,
      defense: outfielder.defense,
      defenseCeiling: outfielder.defense,
      clutch: outfielder.clutch,
      clutchCeiling: outfielder.clutch,
    });
    expect(pool.positionPlayers[0].rolls).toHaveLength(6);
  });

  it("lists free agents at one position in the order they were created", async () => {
    await addFreeAgents(leagueId, 3, agents(1, "CL", "C", "CL", "C", "CL"), database);
    const pool = await listFreeAgents(leagueId, database);
    expect(pool.pitchers.map((pitcher) => pitcher.name)).toEqual([
      "Free Agent 1",
      "Free Agent 3",
      "Free Agent 5",
    ]);
    expect(pool.positionPlayers.map((player) => player.name)).toEqual([
      "Free Agent 2",
      "Free Agent 4",
    ]);
  });

  it("stops at the target, so a repeated request adds nothing", async () => {
    expect(
      await addFreeAgents(leagueId, 2, agents(1, "SP", "SP", "SP", "C"), database),
    ).toEqual({ created: 3 });
    expect(await addFreeAgents(leagueId, 2, agents(10, "SP", "SP", "C"), database)).toEqual({
      created: 1,
    });
    expect(await addFreeAgents(leagueId, 2, agents(20, "SP", "SP", "C"), database)).toEqual({
      created: 0,
    });
    expect(await countFreeAgentsByPosition(leagueId, database)).toEqual(
      new Map([
        ["SP", 2],
        ["C", 2],
      ]),
    );
  });

  it("leaves a position alone that is already over the target", async () => {
    await addFreeAgents(leagueId, 3, agents(1, "RP", "RP", "RP"), database);
    expect(await addFreeAgents(leagueId, 1, agents(10, "RP", "CL"), database)).toEqual({
      created: 1,
    });
    expect(await countFreeAgentsByPosition(leagueId, database)).toEqual(
      new Map([
        ["RP", 3],
        ["CL", 1],
      ]),
    );
  });

  it("keeps each league's pool to itself", async () => {
    const other = await addLeague("Sun Belt League");
    await addFreeAgents(other.leagueId, 2, agents(1, "SP", "SP", "C"), database);

    expect(await countFreeAgentsByPosition(leagueId, database)).toEqual(new Map());
    expect(await listFreeAgents(leagueId, database)).toEqual({
      pitchers: [],
      positionPlayers: [],
    });
    // The other league being full does not stop this one filling up.
    expect(await addFreeAgents(leagueId, 2, agents(1, "SP", "SP"), database)).toEqual({
      created: 2,
    });
    expect((await listFreeAgents(other.leagueId, database)).pitchers).toHaveLength(2);
  });

  it("does not count team players as free agents, or free agents as team players", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(1), database);
    await addFreeAgents(leagueId, 2, agents(100, "SP", "C"), database);

    expect(await countFreeAgentsByPosition(leagueId, database)).toEqual(
      new Map([
        ["SP", 1],
        ["C", 1],
      ]),
    );
    expect(await countPlayersByTeam(leagueId, database)).toEqual([
      { teamId: teamIds[0], pitchers: 11, positionPlayers: 0 },
    ]);
    expect(await listLeagueRosterGrades(leagueId, database)).toHaveLength(11);
    expect(await listTeamPitchers(leagueId, teamIds[0], database)).toHaveLength(11);
    expect(await listUsedNameIds(leagueId, database)).toHaveLength(13);
  });

  it("refuses a name-list id another player in the league holds", async () => {
    await createPitchingStaff(leagueId, teamIds[0], namedStaff(1), database);
    await expect(
      addFreeAgents(leagueId, 2, agents(20, "SP", "C").concat(agents(1, "RP")), database),
    ).rejects.toThrow();
    // All or nothing: the two good ones were not kept either.
    expect(await countFreeAgentsByPosition(leagueId, database)).toEqual(new Map());
  });

  it("is removed with its league, rolls included", async () => {
    await addFreeAgents(leagueId, 2, agents(1, "SP", "OF"), database);
    expect(await deleteLeague(leagueId, database)).toBe(true);

    for (const table of ["players", "rolls"]) {
      const result = await database.$client.execute({
        sql: `SELECT COUNT(*) AS total FROM ${table} WHERE league_id = ?`,
        args: [leagueId],
      });
      expect(Number(result.rows[0].total)).toBe(0);
    }
  });
});
