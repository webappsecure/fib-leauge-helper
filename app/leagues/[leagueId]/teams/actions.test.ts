import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ getLeague: vi.fn(), saveTeams: vi.fn() }));
// The real name check runs; only the database read behind it is replaced.
vi.mock("@/lib/rosters/name-pool", async (original) => ({
  ...(await original<typeof import("@/lib/rosters/name-pool")>()),
  listPlayerHolders: vi.fn(),
  drawStaffNames: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { getLeague, saveTeams } from "@/lib/data";
import { listPlayerHolders } from "@/lib/rosters/name-pool";
import { NAME_REQUIRED } from "@/lib/teams/validate";
import { saveTeamsAction } from "./actions";

const league = { id: 3, name: "Great Lakes League", startYear: 2026, teamCount: 2, useDh: true, createdAt: "" };

function row(number: number, gmName: string | null, managerName: string | null) {
  return { number, gmName, managerName };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getLeague).mockResolvedValue(league);
  vi.mocked(listPlayerHolders).mockResolvedValue([
    { name: "Walt Harlow", label: "team 2's SP3", playerId: 40 },
  ]);
});

describe("saveTeamsAction", () => {
  it("saves teams whose GM and manager names are filled in and nobody else's", async () => {
    const rows = [row(1, "Gordon Howland", "Typed Manager"), row(2, "Reed Fortune", "Second Manager")];

    expect(await saveTeamsAction(3, rows)).toEqual({ ok: true });

    expect(saveTeams).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3");
  });

  it("refuses a blank GM or manager name and saves nothing", async () => {
    const rows = [row(1, "Gordon Howland", "  "), row(2, null, "Second Manager")];

    expect(await saveTeamsAction(3, rows)).toEqual({
      ok: false,
      errors: { fields: { 1: { managerName: NAME_REQUIRED }, 2: { gmName: NAME_REQUIRED } } },
    });
    expect(saveTeams).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a name a player holds, in any capitals, and says which player", async () => {
    const rows = [row(1, "walt  HARLOW", "Typed Manager"), row(2, "Reed Fortune", "Second Manager")];

    expect(await saveTeamsAction(3, rows)).toEqual({
      ok: false,
      errors: {
        fields: {
          1: { gmName: "walt  HARLOW is already team 2's SP3. Draw or type another name." },
        },
      },
    });
    expect(saveTeams).not.toHaveBeenCalled();
  });

  it("refuses two typed names that match and names the earlier holder", async () => {
    const rows = [row(1, "Gordon Howland", "Typed Manager"), row(2, "Reed Fortune", "typed manager")];

    expect(await saveTeamsAction(3, rows)).toEqual({
      ok: false,
      errors: {
        fields: {
          2: { managerName: "typed manager is already team 1's manager. Draw or type another name." },
        },
      },
    });
    expect(saveTeams).not.toHaveBeenCalled();
  });
});
