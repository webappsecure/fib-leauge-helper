import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ getLeague: vi.fn(), getTeam: vi.fn() }));
// Mocked whole so the 5,000-name list is not loaded.
vi.mock("@/lib/rosters/generate", () => ({
  generatePitchingStaff: vi.fn(),
  generatePositionPlayers: vi.fn(),
}));
vi.mock("@/lib/rosters/reroll", () => ({ rerollPlayer: vi.fn(), rerollTeam: vi.fn() }));
vi.mock("@/lib/rosters/moves", () => ({ listMoveTargets: vi.fn(), swapTeamPlayer: vi.fn() }));
vi.mock("@/lib/rosters/rename", () => ({
  drawPlayerName: vi.fn(),
  renameTeam: vi.fn(),
  setPlayerName: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { getLeague, getTeam } from "@/lib/data";
import { listMoveTargets, swapTeamPlayer } from "@/lib/rosters/moves";
import { drawPlayerName, renameTeam, setPlayerName } from "@/lib/rosters/rename";
import { rerollPlayer, rerollTeam } from "@/lib/rosters/reroll";
import {
  moveTargetsAction,
  randomPlayerNameAction,
  renamePlayerAction,
  renameTeamAction,
  rerollPlayerAction,
  rerollTeamAction,
  swapPlayersAction,
} from "./actions";

const league = { id: 3, name: "Great Lakes League", startYear: 2026, teamCount: 2, useDh: true, createdAt: "" };
const team = { id: 7, leagueId: 3, number: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getLeague).mockResolvedValue(league);
  vi.mocked(getTeam).mockResolvedValue(team as Awaited<ReturnType<typeof getTeam>>);
});

describe("rerollPlayerAction", () => {
  it("re-rolls the player on the reloaded team and refreshes the team sheet", async () => {
    vi.mocked(rerollPlayer).mockResolvedValue(true);

    expect(await rerollPlayerAction(3, 7, 12)).toEqual({ ok: true });

    expect(getTeam).toHaveBeenCalledWith(3, 7);
    expect(rerollPlayer).toHaveBeenCalledWith(3, 7, 12);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3/teams/7");
  });

  it("refuses a player id that is not a positive whole number without rolling", async () => {
    for (const playerId of ["12", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, undefined, {}]) {
      const result = await rerollPlayerAction(3, 7, playerId);
      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("player") });
    }
    expect(rerollPlayer).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a player that is not on the team and does not refresh", async () => {
    vi.mocked(rerollPlayer).mockResolvedValue(false);

    expect(await rerollPlayerAction(3, 7, 12)).toMatchObject({
      ok: false,
      error: expect.stringContaining("player"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unknown league or team without rolling", async () => {
    vi.mocked(getTeam).mockResolvedValue(null);
    expect(await rerollPlayerAction(3, 99, 12)).toMatchObject({
      ok: false,
      error: expect.stringContaining("team"),
    });

    vi.mocked(getLeague).mockResolvedValue(null);
    expect(await rerollPlayerAction(99, 7, 12)).toMatchObject({ ok: false });
    expect(await rerollPlayerAction("3", 7, 12)).toMatchObject({ ok: false });

    expect(rerollPlayer).not.toHaveBeenCalled();
  });
});

describe("rerollTeamAction", () => {
  it("re-rolls the reloaded team and refreshes the team sheet", async () => {
    vi.mocked(rerollTeam).mockResolvedValue(20);

    expect(await rerollTeamAction(3, 7)).toEqual({ ok: true });

    expect(rerollTeam).toHaveBeenCalledWith(3, 7);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3/teams/7");
  });

  it("says so when the team has no players", async () => {
    vi.mocked(rerollTeam).mockResolvedValue(0);

    expect(await rerollTeamAction(3, 7)).toMatchObject({
      ok: false,
      error: expect.stringContaining("no players"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unknown team without rolling", async () => {
    vi.mocked(getTeam).mockResolvedValue(null);

    expect(await rerollTeamAction(3, 99)).toMatchObject({
      ok: false,
      error: expect.stringContaining("team"),
    });
    expect(rerollTeam).not.toHaveBeenCalled();
  });
});

const badIds = ["12", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, undefined, {}];

describe("renamePlayerAction", () => {
  it("saves the typed name on the reloaded team and refreshes the team sheet", async () => {
    vi.mocked(setPlayerName).mockResolvedValue({ ok: true, name: "Walt Harlow" });

    expect(await renamePlayerAction(3, 7, 12, " Walt Harlow ")).toEqual({
      ok: true,
      name: "Walt Harlow",
    });

    expect(getTeam).toHaveBeenCalledWith(3, 7);
    expect(setPlayerName).toHaveBeenCalledWith(3, 7, 12, " Walt Harlow ");
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3/teams/7");
  });

  it("passes a refusal through with its message and does not refresh", async () => {
    const error = "Walt Harlow is already team 4's SP2. Type another name or press Random name.";
    vi.mocked(setPlayerName).mockResolvedValue({ ok: false, reason: "refused", error });

    expect(await renamePlayerAction(3, 7, 12, "Walt Harlow")).toEqual({ ok: false, error });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hands a name that is not text to the name rules unchanged", async () => {
    vi.mocked(setPlayerName).mockResolvedValue({
      ok: false,
      reason: "refused",
      error: "Type a name, or press Random name.",
    });

    expect(await renamePlayerAction(3, 7, 12, { name: "x" })).toEqual({
      ok: false,
      error: "Type a name, or press Random name.",
    });
    expect(setPlayerName).toHaveBeenCalledWith(3, 7, 12, { name: "x" });
  });

  it("reports a player that is not on the team", async () => {
    vi.mocked(setPlayerName).mockResolvedValue({ ok: false, reason: "not-found" });

    expect(await renamePlayerAction(3, 7, 12, "Walt Harlow")).toMatchObject({
      ok: false,
      error: expect.stringContaining("player"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a malformed player id, or an unknown league or team, without saving", async () => {
    for (const playerId of badIds) {
      expect(await renamePlayerAction(3, 7, playerId, "Walt Harlow")).toMatchObject({
        ok: false,
        error: expect.stringContaining("player"),
      });
    }
    vi.mocked(getTeam).mockResolvedValue(null);
    expect(await renamePlayerAction(3, 99, 12, "Walt Harlow")).toMatchObject({
      ok: false,
      error: expect.stringContaining("team"),
    });
    vi.mocked(getLeague).mockResolvedValue(null);
    expect(await renamePlayerAction("3", 7, 12, "Walt Harlow")).toMatchObject({ ok: false });

    expect(setPlayerName).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("randomPlayerNameAction", () => {
  it("draws a name on the reloaded team and refreshes the team sheet", async () => {
    vi.mocked(drawPlayerName).mockResolvedValue({ ok: true, name: "Reed Fortune" });

    expect(await randomPlayerNameAction(3, 7, 12)).toEqual({ ok: true, name: "Reed Fortune" });

    expect(drawPlayerName).toHaveBeenCalledWith(3, 7, 12);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3/teams/7");
  });

  it("passes on a used-up list and a missing player without refreshing", async () => {
    const error = "Every name on the list is in use. Type a name instead.";
    vi.mocked(drawPlayerName).mockResolvedValue({ ok: false, reason: "refused", error });
    expect(await randomPlayerNameAction(3, 7, 12)).toEqual({ ok: false, error });

    vi.mocked(drawPlayerName).mockResolvedValue({ ok: false, reason: "not-found" });
    expect(await randomPlayerNameAction(3, 7, 12)).toMatchObject({
      ok: false,
      error: expect.stringContaining("player"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a malformed player id or an unknown team without drawing", async () => {
    for (const playerId of badIds) {
      expect(await randomPlayerNameAction(3, 7, playerId)).toMatchObject({ ok: false });
    }
    vi.mocked(getTeam).mockResolvedValue(null);
    expect(await randomPlayerNameAction(3, 99, 12)).toMatchObject({
      ok: false,
      error: expect.stringContaining("team"),
    });
    expect(drawPlayerName).not.toHaveBeenCalled();
  });
});

describe("renameTeamAction", () => {
  it("renames the reloaded team and refreshes the team sheet", async () => {
    vi.mocked(renameTeam).mockResolvedValue({ ok: true, renamed: 20 });

    expect(await renameTeamAction(3, 7)).toEqual({ ok: true });

    expect(renameTeam).toHaveBeenCalledWith(3, 7);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3/teams/7");
  });

  it("passes on too few names and a team with no players without refreshing", async () => {
    const error = "There are not enough unused names on the list to rename the whole team.";
    vi.mocked(renameTeam).mockResolvedValue({ ok: false, reason: "refused", error });
    expect(await renameTeamAction(3, 7)).toEqual({ ok: false, error });

    vi.mocked(renameTeam).mockResolvedValue({ ok: false, reason: "no-players" });
    expect(await renameTeamAction(3, 7)).toMatchObject({
      ok: false,
      error: expect.stringContaining("no players"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unknown team without renaming", async () => {
    vi.mocked(getTeam).mockResolvedValue(null);

    expect(await renameTeamAction(3, 99)).toMatchObject({
      ok: false,
      error: expect.stringContaining("team"),
    });
    expect(renameTeam).not.toHaveBeenCalled();
  });
});

describe("moveTargetsAction", () => {
  it("lists the targets for a player on the reloaded team", async () => {
    const groups = [{ label: "This team", targets: [{ id: 13, label: "3B  Ray Ortiz" }] }];
    vi.mocked(listMoveTargets).mockResolvedValue(groups);

    expect(await moveTargetsAction(3, 7, 12)).toEqual({ ok: true, groups });
    expect(getTeam).toHaveBeenCalledWith(3, 7);
    expect(listMoveTargets).toHaveBeenCalledWith(3, 7, 12);
  });

  it("refuses bad player ids and a player who is not on the team", async () => {
    for (const playerId of badIds) {
      expect(await moveTargetsAction(3, 7, playerId)).toMatchObject({
        ok: false,
        error: expect.stringContaining("player"),
      });
    }
    expect(listMoveTargets).not.toHaveBeenCalled();

    vi.mocked(listMoveTargets).mockResolvedValue(null);
    expect(await moveTargetsAction(3, 7, 12)).toMatchObject({
      ok: false,
      error: expect.stringContaining("player"),
    });
  });

  it("refuses an unknown league or team without listing", async () => {
    for (const [leagueId, teamId] of [
      ["3", 7],
      [3, "7"],
      [0, 7],
      [3, null],
    ]) {
      expect(await moveTargetsAction(leagueId, teamId, 12)).toMatchObject({
        ok: false,
        error: expect.stringContaining("team"),
      });
    }
    vi.mocked(getTeam).mockResolvedValue(null);
    expect(await moveTargetsAction(3, 99, 12)).toMatchObject({ ok: false });
    vi.mocked(getLeague).mockResolvedValue(null);
    expect(await moveTargetsAction(99, 7, 12)).toMatchObject({ ok: false });
    expect(listMoveTargets).not.toHaveBeenCalled();
  });
});

describe("swapPlayersAction", () => {
  it("swaps on the reloaded team and refreshes every page under the league", async () => {
    vi.mocked(swapTeamPlayer).mockResolvedValue({ ok: true, message: "Swapped with Ray Ortiz." });

    expect(await swapPlayersAction(3, 7, 12, 40)).toEqual({
      ok: true,
      message: "Swapped with Ray Ortiz.",
    });
    expect(getTeam).toHaveBeenCalledWith(3, 7);
    expect(swapTeamPlayer).toHaveBeenCalledWith(3, 7, 12, 40);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/[leagueId]", "layout");
  });

  it("refuses bad player and target ids without swapping", async () => {
    for (const bad of badIds) {
      expect(await swapPlayersAction(3, 7, bad, 40)).toMatchObject({
        ok: false,
        error: expect.stringContaining("player"),
      });
      expect(await swapPlayersAction(3, 7, 12, bad)).toMatchObject({
        ok: false,
        error: expect.stringContaining("players"),
      });
    }
    expect(swapTeamPlayer).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses an unknown league or team without swapping", async () => {
    for (const [leagueId, teamId] of [
      ["3", 7],
      [3, "7"],
      [-1, 7],
      [3, undefined],
    ]) {
      expect(await swapPlayersAction(leagueId, teamId, 12, 40)).toMatchObject({
        ok: false,
        error: expect.stringContaining("team"),
      });
    }
    vi.mocked(getTeam).mockResolvedValue(null);
    expect(await swapPlayersAction(3, 99, 12, 40)).toMatchObject({ ok: false });
    vi.mocked(getLeague).mockResolvedValue(null);
    expect(await swapPlayersAction(99, 7, 12, 40)).toMatchObject({ ok: false });
    expect(swapTeamPlayer).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes on the reason an illegal swap was refused and does not refresh", async () => {
    vi.mocked(swapTeamPlayer).mockResolvedValue({
      ok: false,
      reason: "refused",
      error: "Ray Ortiz is a natural C and cannot play SS.",
    });

    expect(await swapPlayersAction(3, 7, 12, 40)).toEqual({
      ok: false,
      error: "Ray Ortiz is a natural C and cannot play SS.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a player who has moved and does not refresh", async () => {
    vi.mocked(swapTeamPlayer).mockResolvedValue({ ok: false, reason: "not-found" });

    expect(await swapPlayersAction(3, 7, 12, 40)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Reload the page"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
