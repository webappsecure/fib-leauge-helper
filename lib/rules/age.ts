import type { D66Row } from "./dice";

// Age for a player created for a new team. Handbook 2.1.1 and 2.1.2 print the
// same table for pitchers and position players.
export const NEW_TEAM_AGE_TABLE: readonly D66Row<number>[] = [
  { low: 11, high: 11, value: 21 },
  { low: 12, high: 12, value: 22 },
  { low: 13, high: 14, value: 23 },
  { low: 15, high: 16, value: 24 },
  { low: 21, high: 23, value: 25 },
  { low: 24, high: 26, value: 26 },
  { low: 31, high: 34, value: 27 },
  { low: 35, high: 42, value: 28 },
  { low: 43, high: 46, value: 29 },
  { low: 51, high: 53, value: 30 },
  { low: 54, high: 56, value: 31 },
  { low: 61, high: 62, value: 32 },
  { low: 63, high: 64, value: 33 },
  { low: 65, high: 65, value: 34 },
  { low: 66, high: 66, value: 35 },
];
