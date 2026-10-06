import { describe, expect, it } from "vitest";
import {
  TEAMS_PAGE_ERROR,
  isTeamComplete,
  validateTeams,
  type TeamInput,
} from "./validate";

function blank(number: number): TeamInput {
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
    ballparkQuality: "neutral",
    cityRoll: null,
    gmRiskRoll: null,
    gmDevFocusRoll: null,
    gmTeamBuildingRoll: null,
  };
}

const milwaukee: TeamInput = {
  number: 1,
  city: "Milwaukee",
  name: "Millers",
  gmName: "Gordon Howland",
  gmRisk: "conservative",
  gmDevFocus: "farm-first",
  gmTeamBuilding: "pitching",
  managerName: "Walt Harlow",
  ballparkName: "Lakefront Yards",
  ballparkQuality: "neutral",
  cityRoll: 244,
  gmRiskRoll: 2,
  gmDevFocusRoll: 1,
  gmTeamBuildingRoll: 2,
};

function fieldErrors(raw: unknown, teamCount: number) {
  const result = validateTeams(raw, teamCount);
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateTeams", () => {
  it("accepts a full team and keeps matching rolls", () => {
    expect(validateTeams([milwaukee, blank(2)], 2)).toEqual({
      ok: true,
      teams: [milwaukee, blank(2)],
    });
  });

  it("accepts partly filled teams, trims text and stores empty text as null", () => {
    const result = validateTeams(
      [{ ...blank(1), city: "  Chicago ", name: "   ", gmRisk: "" }],
      1,
    );
    expect(result).toEqual({
      ok: true,
      teams: [{ ...blank(1), city: "Chicago", name: null, gmRisk: null }],
    });
  });

  it("returns teams in number order and defaults the ballpark quality", () => {
    const withoutPark: Record<string, unknown> = { ...blank(1) };
    delete withoutPark.ballparkQuality;
    const result = validateTeams([blank(2), withoutPark], 2);
    expect(result.ok && result.teams.map((team) => team.number)).toEqual([1, 2]);
    expect(result.ok && result.teams[0].ballparkQuality).toBe("neutral");
  });

  it("rejects the whole save for bad team numbers", () => {
    const rejected = { form: TEAMS_PAGE_ERROR, fields: {} };
    expect(fieldErrors([blank(1)], 2)).toEqual(rejected);
    expect(fieldErrors([blank(1), blank(1)], 2)).toEqual(rejected);
    expect(fieldErrors([blank(1), blank(3)], 2)).toEqual(rejected);
    expect(fieldErrors([blank(1), { ...blank(2), number: 1.5 }], 2)).toEqual(rejected);
    expect(fieldErrors([blank(1), { ...blank(2), number: "2" }], 2)).toEqual(rejected);
    expect(fieldErrors("not a list", 2)).toEqual(rejected);
    expect(fieldErrors([blank(1), null], 2)).toEqual(rejected);
  });

  it("rejects the whole save for unknown qualities or non-text values", () => {
    const rejected = { form: TEAMS_PAGE_ERROR, fields: {} };
    expect(fieldErrors([{ ...blank(1), gmRisk: "reckless" }], 1)).toEqual(rejected);
    expect(fieldErrors([{ ...blank(1), ballparkQuality: "huge" }], 1)).toEqual(rejected);
    expect(fieldErrors([{ ...blank(1), city: 42 }], 1)).toEqual(rejected);
  });

  it("allows 60 characters and reports longer text on its field", () => {
    const sixty = "a".repeat(60);
    expect(validateTeams([{ ...blank(1), city: sixty, name: sixty }], 1).ok).toBe(true);

    const tooLong = "a".repeat(61);
    expect(
      fieldErrors(
        [{ ...blank(1), city: tooLong, name: tooLong, gmName: tooLong, managerName: tooLong, ballparkName: tooLong }],
        1,
      ),
    ).toEqual({
      fields: {
        1: {
          city: "Keep the city to 60 characters or fewer.",
          name: "Keep this to 60 characters or fewer.",
          gmName: "Keep this to 60 characters or fewer.",
          managerName: "Keep this to 60 characters or fewer.",
          ballparkName: "Keep this to 60 characters or fewer.",
        },
      },
    });
  });

  it("reports a duplicate city on the later team, ignoring case and spaces", () => {
    expect(
      fieldErrors(
        [
          { ...blank(3), city: " chicago" },
          { ...blank(1), city: "Chicago" },
          { ...blank(2), city: "Detroit" },
          { ...blank(4), city: "CHICAGO" },
        ],
        4,
      ),
    ).toEqual({
      fields: {
        3: { city: "chicago is already team 1. Type another city or roll one." },
        4: { city: "CHICAGO is already team 1. Type another city or roll one." },
      },
    });
  });

  it("allows several teams with no city", () => {
    expect(validateTeams([blank(1), blank(2), blank(3)], 3).ok).toBe(true);
  });

  it("drops rolls that do not match their value", () => {
    const result = validateTeams(
      [
        {
          ...milwaukee,
          cityRoll: 70,
          gmRiskRoll: 5,
          gmDevFocusRoll: 9,
          gmTeamBuildingRoll: "2",
        },
      ],
      1,
    );
    expect(result).toEqual({
      ok: true,
      teams: [
        {
          ...milwaukee,
          cityRoll: null,
          gmRiskRoll: null,
          gmDevFocusRoll: null,
          gmTeamBuildingRoll: null,
        },
      ],
    });
  });

  it("drops a roll when its value is unset", () => {
    const result = validateTeams([{ ...blank(1), cityRoll: 244, gmRiskRoll: 2 }], 1);
    expect(result.ok && result.teams[0]).toEqual(blank(1));
  });

  it("keeps a city roll when the typed spelling differs only in case", () => {
    const result = validateTeams([{ ...blank(1), city: "milwaukee", cityRoll: 244 }], 1);
    expect(result.ok && result.teams[0].cityRoll).toBe(244);
  });
});

describe("isTeamComplete", () => {
  it("needs a city and all three GM qualities", () => {
    expect(isTeamComplete(milwaukee)).toBe(true);
    const withoutNames: TeamInput = { ...milwaukee, name: null, gmName: null };
    expect(isTeamComplete(withoutNames)).toBe(true);
    expect(isTeamComplete({ ...milwaukee, city: null })).toBe(false);
    expect(isTeamComplete({ ...milwaukee, gmDevFocus: null })).toBe(false);
  });
});
