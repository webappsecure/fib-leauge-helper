import { PITCHER_SLOTS } from "./pitchers";
import { lineupSlots } from "./positions";

// Handbook 2.1: 20 players with a DH, 19 without.
export function rosterSize(useDh: boolean) {
  return PITCHER_SLOTS.length + lineupSlots(useDh).length;
}
