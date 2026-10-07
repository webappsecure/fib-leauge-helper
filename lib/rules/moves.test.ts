import { describe, expect, it } from "vitest";
import {
  canFill,
  moveProblem,
  naturalMarker,
  poolPosition,
  type FieldPosition,
  type PlayerPlace,
} from "./moves";
import type { PitcherRole, PitcherSlot } from "./pitchers";
import { LINEUP_SLOTS, type LineupSlot } from "./positions";

let nextId = 1;

function hitter(
  naturalPosition: FieldPosition,
  slot: LineupSlot | null,
  teamId: number | null = 1,
): PlayerPlace {
  return { id: nextId++, leagueId: 1, teamId, slot, kind: "position", naturalPosition };
}

function pitcher(
  naturalPosition: PitcherRole,
  slot: PitcherSlot | null,
  teamId: number | null = 1,
): PlayerPlace {
  return { id: nextId++, leagueId: 1, teamId, slot, kind: "pitcher", naturalPosition };
}

const freeAgent = (naturalPosition: FieldPosition) => hitter(naturalPosition, null, null);

describe("canFill", () => {
  const fits: Record<FieldPosition, LineupSlot[]> = {
    C: ["C", "DH"],
    "1B": ["1B", "3B", "DH"],
    "2B": ["2B", "SS", "DH"],
    SS: ["2B", "SS", "DH"],
    "3B": ["1B", "3B", "DH"],
    LF: ["LF", "CF", "RF", "DH"],
    CF: ["LF", "CF", "RF", "DH"],
    RF: ["LF", "CF", "RF", "DH"],
    OF: ["LF", "CF", "RF", "DH"],
    DH: ["DH"],
  };

  it.each(Object.entries(fits) as [FieldPosition, LineupSlot[]][])(
    "a natural %s fits exactly %j",
    (naturalPosition, slots) => {
      expect(LINEUP_SLOTS.filter((slot) => canFill(naturalPosition, slot))).toEqual(slots);
    },
  );
});

describe("naturalMarker", () => {
  it("is shown only when the slot does not say where the player belongs", () => {
    expect(naturalMarker("C", "C")).toBeNull();
    expect(naturalMarker("LF", "RF")).toBeNull();
    expect(naturalMarker("OF", "CF")).toBeNull();
    expect(naturalMarker("DH", "DH")).toBeNull();
    expect(naturalMarker("1B", "3B")).toBe("1B");
    expect(naturalMarker("SS", "2B")).toBe("SS");
    expect(naturalMarker("C", "DH")).toBe("C");
    expect(naturalMarker("OF", "DH")).toBe("OF");
    expect(naturalMarker("LF", "DH")).toBe("LF");
  });
});

describe("poolPosition", () => {
  it("turns the three outfield slots into OF and leaves the rest", () => {
    expect(["LF", "CF", "RF", "OF", "C", "1B", "DH", "SP"].map(poolPosition)).toEqual([
      "OF",
      "OF",
      "OF",
      "OF",
      "C",
      "1B",
      "DH",
      "SP",
    ]);
  });
});

describe("moveProblem", () => {
  it("lets pitchers of one role swap, on one team or two", () => {
    expect(moveProblem(pitcher("RP", "RP1"), pitcher("RP", "RP3"))).toBeNull();
    expect(moveProblem(pitcher("RP", "RP1"), pitcher("RP", "RP1", 2))).toBeNull();
    expect(moveProblem(pitcher("CL", "CL"), pitcher("CL", "CL", 2))).toBeNull();
    expect(moveProblem(pitcher("SP", "SP1"), pitcher("SP", "SP4", 2))).toBeNull();
    expect(moveProblem(pitcher("SP", "SP1"), pitcher("SP", null, null))).toBeNull();
  });

  it("refuses pitchers of different roles", () => {
    expect(moveProblem(pitcher("SP", "SP1"), pitcher("RP", "RP1"))).toEqual({
      reason: "different-roles",
    });
    expect(moveProblem(pitcher("CL", "CL"), pitcher("RP", null, null))).toEqual({
      reason: "different-roles",
    });
  });

  it("refuses two starters on the same team", () => {
    expect(moveProblem(pitcher("SP", "SP1"), pitcher("SP", "SP2"))).toEqual({
      reason: "same-team-starters",
    });
  });

  it("refuses a pitcher with a position player", () => {
    expect(moveProblem(pitcher("SP", "SP1"), hitter("C", "C"))).toEqual({
      reason: "different-kinds",
    });
  });

  it.each([
    ["LF", "CF"],
    ["CF", "RF"],
    ["LF", "RF"],
    ["1B", "3B"],
    ["2B", "SS"],
  ] as const)("lets a %s and a %s swap both ways", (first, second) => {
    expect(moveProblem(hitter(first, first), hitter(second, second))).toBeNull();
    expect(moveProblem(hitter(second, second, 2), hitter(first, first))).toBeNull();
  });

  it("lets anyone but a natural DH swap with the DH slot's holder when both fit", () => {
    // A catcher who has been the DH goes back behind the plate.
    expect(moveProblem(hitter("C", "DH"), hitter("C", "C"))).toBeNull();
    expect(moveProblem(hitter("SS", "DH"), hitter("2B", "SS", 2))).toBeNull();
  });

  it("names the player who does not fit when only one side is legal", () => {
    const catcher = hitter("C", "C");
    const dh = hitter("DH", "DH");
    const problem = {
      reason: "cannot-fill",
      playerId: dh.id,
      naturalPosition: "DH",
      slot: "C",
    };
    expect(moveProblem(catcher, dh)).toEqual(problem);
    expect(moveProblem(dh, catcher)).toEqual(problem);
  });

  it("refuses moves across groups", () => {
    const shortstop = hitter("SS", "SS");
    expect(moveProblem(shortstop, hitter("3B", "3B"))).toEqual({
      reason: "cannot-fill",
      playerId: shortstop.id,
      naturalPosition: "SS",
      slot: "3B",
    });
    expect(moveProblem(hitter("C", "C"), hitter("1B", "1B"))).toMatchObject({
      reason: "cannot-fill",
    });
  });

  it("checks only the free agent's fit when signing", () => {
    expect(moveProblem(hitter("CF", "CF"), freeAgent("OF"))).toBeNull();
    expect(moveProblem(freeAgent("3B"), hitter("1B", "1B"))).toBeNull();
    // Whoever is in the slot can always go to the pool.
    expect(moveProblem(hitter("C", "DH"), freeAgent("SS"))).toBeNull();
    expect(moveProblem(hitter("DH", "DH"), freeAgent("OF"))).toBeNull();

    const outfielder = freeAgent("OF");
    expect(moveProblem(hitter("SS", "SS"), outfielder)).toEqual({
      reason: "cannot-fill",
      playerId: outfielder.id,
      naturalPosition: "OF",
      slot: "SS",
    });
  });

  it("refuses two free agents, a player with themself and players in two leagues", () => {
    expect(moveProblem(freeAgent("C"), freeAgent("C"))).toEqual({ reason: "both-free-agents" });
    const catcher = hitter("C", "C");
    expect(moveProblem(catcher, catcher)).toEqual({ reason: "same-player" });
    expect(moveProblem(catcher, { ...hitter("C", "C", 9), leagueId: 2 })).toEqual({
      reason: "different-leagues",
    });
  });
});
