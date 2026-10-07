import type { PitcherRole, PitcherSlot } from "./pitchers";
import type { LineupSlot } from "./positions";

// Roster moves by hand. Every move is a swap of two players, and only moves
// the handbook allows with no change to Defense (1.2.5) are legal.

// A free agent outfielder has no single outfield slot, so their natural
// position is the whole outfield.
export type FieldPosition = LineupSlot | "OF";

export type PlayerPlace = {
  id: number;
  leagueId: number;
  // Both null for a free agent.
  teamId: number | null;
  slot: PitcherSlot | LineupSlot | null;
} & (
  | { kind: "pitcher"; naturalPosition: PitcherRole }
  | { kind: "position"; naturalPosition: FieldPosition }
);

// Positions a player moves between freely. A catcher and a natural DH have
// no partner.
const GROUPS: Record<FieldPosition, string> = {
  C: "C",
  "1B": "corner",
  "3B": "corner",
  "2B": "middle",
  SS: "middle",
  LF: "outfield",
  CF: "outfield",
  RF: "outfield",
  OF: "outfield",
  DH: "DH",
};

// Whether a player with this natural position can take the slot with no
// change to their Defense. Anyone can be the DH.
export function canFill(naturalPosition: FieldPosition, slot: LineupSlot): boolean {
  return slot === "DH" || GROUPS[naturalPosition] === GROUPS[slot];
}

// The natural position to show beside a position player's slot, or null when
// the slot says enough: they are at their natural position, or they are an
// outfielder in an outfield slot.
export function naturalMarker(
  naturalPosition: FieldPosition,
  slot: LineupSlot,
): FieldPosition | null {
  if (naturalPosition === slot) return null;
  return slot !== "DH" && GROUPS[naturalPosition] === "outfield" && GROUPS[slot] === "outfield"
    ? null
    : naturalPosition;
}

// The natural position a player is stored with in the free agent pool, which
// keeps one outfield position.
export function poolPosition<T extends string>(naturalPosition: T): T | "OF" {
  return naturalPosition === "LF" || naturalPosition === "CF" || naturalPosition === "RF"
    ? "OF"
    : naturalPosition;
}

export type MoveProblem =
  | { reason: "same-player" | "different-leagues" | "both-free-agents" }
  | { reason: "different-kinds" | "different-roles" | "same-team-starters" }
  | {
      reason: "cannot-fill";
      playerId: number;
      naturalPosition: FieldPosition;
      slot: LineupSlot;
    };

// The player cannot take the other player's slot. Going to the pool always
// fits.
function cannotFill(player: PlayerPlace, other: PlayerPlace): MoveProblem | null {
  if (player.kind !== "position" || other.slot === null) return null;
  const slot = other.slot as LineupSlot;
  return canFill(player.naturalPosition, slot)
    ? null
    : {
        reason: "cannot-fill",
        playerId: player.id,
        naturalPosition: player.naturalPosition,
        slot,
      };
}

// Why two players cannot trade places, or null when they can.
export function moveProblem(a: PlayerPlace, b: PlayerPlace): MoveProblem | null {
  if (a.id === b.id) return { reason: "same-player" };
  if (a.leagueId !== b.leagueId) return { reason: "different-leagues" };
  if (a.teamId === null && b.teamId === null) return { reason: "both-free-agents" };
  if (a.kind !== b.kind) return { reason: "different-kinds" };

  if (a.kind === "pitcher") {
    if (a.naturalPosition !== b.naturalPosition) return { reason: "different-roles" };
    // Starters are kept best first, so swapping two of them changes nothing.
    if (a.naturalPosition === "SP" && a.teamId === b.teamId) {
      return { reason: "same-team-starters" };
    }
    return null;
  }
  return cannotFill(a, b) ?? cannotFill(b, a);
}
