import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The real redirect throws to stop the action; the stand-in does the same.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/data", () => ({ deleteLeague: vi.fn(), updateLeagueSettings: vi.fn() }));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteLeague, updateLeagueSettings } from "@/lib/data";
import {
  deleteLeagueAction,
  saveLeagueSettingsAction,
  type LeagueSettingsState,
} from "./actions";

const previous: LeagueSettingsState = {
  values: { name: "Great Lakes League", startYear: "2026" },
  errors: {},
  saved: false,
};
const league = { id: 3, name: "Rust Belt League", startYear: 1975, teamCount: 12, useDh: true, createdAt: "" };
const badIds = ["3", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, undefined, {}];

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveLeagueSettingsAction", () => {
  it("saves cleaned values, refreshes the league's pages and the list, and reports saved", async () => {
    vi.mocked(updateLeagueSettings).mockResolvedValue(league);

    const state = await saveLeagueSettingsAction(
      3,
      previous,
      form({ name: "  Rust Belt League ", startYear: "1975" }),
    );

    expect(updateLeagueSettings).toHaveBeenCalledWith(3, {
      name: "Rust Belt League",
      startYear: 1975,
    });
    expect(state).toEqual({
      values: { name: "Rust Belt League", startYear: "1975" },
      errors: {},
      saved: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/[leagueId]", "layout");
  });

  it("returns each field error with what was typed and writes nothing", async () => {
    const state = await saveLeagueSettingsAction(
      3,
      previous,
      form({ name: "   ", startYear: "soon" }),
    );

    expect(state).toEqual({
      values: { name: "   ", startYear: "soon" },
      errors: {
        name: "Enter a league name.",
        startYear: "Enter a year between 1 and 9999.",
      },
      saved: false,
    });
    expect(updateLeagueSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats missing fields as blank", async () => {
    const state = await saveLeagueSettingsAction(3, previous, new FormData());
    expect(state.errors).toMatchObject({ name: "Enter a league name." });
    expect(state.saved).toBe(false);
  });

  it("reports a league that is gone without refreshing", async () => {
    vi.mocked(updateLeagueSettings).mockResolvedValue(null);

    const state = await saveLeagueSettingsAction(
      3,
      previous,
      form({ name: "Rust Belt League", startYear: "1975" }),
    );

    expect(state.saved).toBe(false);
    expect(state.errors.form).toContain("could not be found");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a malformed league id without touching the database", async () => {
    for (const leagueId of badIds) {
      const state = await saveLeagueSettingsAction(
        leagueId,
        previous,
        form({ name: "Rust Belt League", startYear: "1975" }),
      );
      expect(state.saved).toBe(false);
      expect(state.errors.form).toContain("could not be found");
    }
    expect(updateLeagueSettings).not.toHaveBeenCalled();
  });
});

describe("deleteLeagueAction", () => {
  it("deletes the league once, refreshes, and goes to the league list", async () => {
    vi.mocked(deleteLeague).mockResolvedValue(true);

    await expect(deleteLeagueAction(3)).rejects.toThrow("redirect:/");

    expect(deleteLeague).toHaveBeenCalledTimes(1);
    expect(deleteLeague).toHaveBeenCalledWith(3);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/[leagueId]", "layout");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("ends on the league list when the league is already gone", async () => {
    vi.mocked(deleteLeague).mockResolvedValue(false);
    await expect(deleteLeagueAction(3)).rejects.toThrow("redirect:/");
  });

  it("refuses a malformed league id without deleting or redirecting", async () => {
    for (const leagueId of badIds) {
      expect(await deleteLeagueAction(leagueId)).toMatchObject({
        ok: false,
        error: expect.stringContaining("could not be found"),
      });
    }
    expect(deleteLeague).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not redirect when the delete fails", async () => {
    vi.mocked(deleteLeague).mockRejectedValue(new Error("database is locked"));

    await expect(deleteLeagueAction(3)).rejects.toThrow("database is locked");
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
