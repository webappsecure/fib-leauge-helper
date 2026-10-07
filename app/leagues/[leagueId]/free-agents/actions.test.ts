import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ getLeague: vi.fn() }));
vi.mock("@/lib/rosters/free-agents", () => ({ generateFreeAgents: vi.fn() }));

import { revalidatePath } from "next/cache";
import { getLeague } from "@/lib/data";
import { PER_POSITION_ERROR } from "@/lib/free-agents/validate";
import { generateFreeAgents } from "@/lib/rosters/free-agents";
import { LEAGUE_NOT_FOUND } from "../../action-input";
import { generateFreeAgentsAction } from "./actions";

const league = { id: 3, name: "Rust Belt League", startYear: 1975, teamCount: 12, useDh: true, createdAt: "" };
const badIds = ["3", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, undefined, {}];

function form(perPosition?: string) {
  const data = new FormData();
  if (perPosition !== undefined) data.set("perPosition", perPosition);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateFreeAgentsAction", () => {
  it("tops up the pool, refreshes the screen and reports what was added", async () => {
    vi.mocked(getLeague).mockResolvedValue(league);
    vi.mocked(generateFreeAgents).mockResolvedValue(18);

    expect(await generateFreeAgentsAction(3, form(" 2 "))).toEqual({
      ok: true,
      created: 18,
      perPosition: 2,
    });
    expect(generateFreeAgents).toHaveBeenCalledWith(3, 2);
    expect(revalidatePath).toHaveBeenCalledWith("/leagues/3/free-agents");
  });

  it.each(badIds)("creates nothing for the league id %j", async (leagueId) => {
    expect(await generateFreeAgentsAction(leagueId, form("2"))).toEqual({
      ok: false,
      error: LEAGUE_NOT_FOUND,
    });
    expect(getLeague).not.toHaveBeenCalled();
    expect(generateFreeAgents).not.toHaveBeenCalled();
  });

  it("creates nothing for a league that does not exist", async () => {
    vi.mocked(getLeague).mockResolvedValue(null);

    expect(await generateFreeAgentsAction(9, form("2"))).toEqual({
      ok: false,
      error: LEAGUE_NOT_FOUND,
    });
    expect(generateFreeAgents).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "0", "11", "2.5", "-1", "abc"])(
    "creates nothing for the number %j",
    async (perPosition) => {
      vi.mocked(getLeague).mockResolvedValue(league);

      expect(await generateFreeAgentsAction(3, form(perPosition))).toEqual({
        ok: false,
        error: PER_POSITION_ERROR,
      });
      expect(generateFreeAgents).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );
});
