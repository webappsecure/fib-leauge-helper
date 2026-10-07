import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ getLeague: vi.fn(), getTeam: vi.fn() }));
// Mocked whole so the 5,000-name list is not loaded.
vi.mock("@/lib/rosters/generate", () => ({
  generatePitchingStaff: vi.fn(),
  generatePositionPlayers: vi.fn(),
}));
vi.mock("@/lib/rosters/reroll", () => ({ rerollPlayer: vi.fn(), rerollTeam: vi.fn() }));

import { revalidatePath } from "next/cache";
import { getLeague, getTeam } from "@/lib/data";
import { rerollPlayer, rerollTeam } from "@/lib/rosters/reroll";
import { rerollPlayerAction, rerollTeamAction } from "./actions";

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
