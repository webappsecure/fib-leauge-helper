import { D66_RESULTS } from "./dice";
import { gradeValue, type Grade } from "./grades";
import { lineupSlots } from "./positions";

// Finder ranges from handbook 1.7, 2.1.5 and 2.1.6. A finder shares out the
// 36 dice results from 11 to 66. Nothing here is stored: every range is
// worked out from the roster each time it is needed.

const FINDER_TOTAL = D66_RESULTS.length;

// Turns values into dice ranges, each starting where the last one ended. A
// value of 0 gets no range. Results count 11 to 16, then 21 to 26, and so on.
export function finderRanges(values: readonly number[]): (string | null)[] {
  let next = 0;
  return values.map((value) => {
    if (value === 0) return null;
    const first = D66_RESULTS[next];
    const last = D66_RESULTS[next + value - 1];
    if (first === undefined || last === undefined) {
      throw new RangeError("Finder values cannot add up to more than 36.");
    }
    next += value;
    return first === last ? String(first) : `${first}-${last}`;
  });
}

// The handbook's standard template (2.1.5). It does not depend on grades.
export const SP_FINDER_RANGES: Readonly<Record<string, string>> = {
  SP1: "11-21",
  SP2: "22-32",
  SP3: "33-43",
  SP4: "44-53",
  SP5: "54-63",
  SP6: "64-66",
};

// HR finder values by Power grade, F to A+ (2.1.6). The clutch finder uses
// the ordinary grade value, F 1 to A+ 7.
const HR_VALUES: Record<Grade, number> = { F: 0, D: 1, C: 2, B: 3, "B+": 4, A: 5, "A+": 6 };

export type FinderRow = { slot: string; value: number; range: string | null };

// How far smoothing moved one player: positive gained, negative gave up.
export type FinderChange = { slot: string; by: number };

export type Finder = {
  rows: FinderRow[];
  // The total of the grade values before any smoothing.
  baseTotal: number;
  changes: FinderChange[];
  // HR results left for non-starters; 0 when there is no "Other" row.
  other: number;
};

export type PositionFinders =
  | { available: true; clutch: Finder; homeRun: Finder }
  | { available: false };

export type FinderPlayer = { slot: string; hitting: Grade; power: Grade };

// Moves the total to 36 one point at a time, going round `order` (indexes
// into `values`) as often as needed. Trimming never takes a value below 1.
function smooth(values: number[], order: number[]) {
  const result = [...values];
  let total = result.reduce((sum, value) => sum + value, 0);
  const step = total < FINDER_TOTAL ? 1 : -1;

  while (total !== FINDER_TOTAL) {
    let moved = false;
    for (const index of order) {
      if (total === FINDER_TOTAL) break;
      if (step < 0 && result[index] <= 1) continue;
      result[index] += step;
      total += step;
      moved = true;
    }
    if (!moved) throw new RangeError("These finder values cannot be made to total 36.");
  }
  return result;
}

function build(
  slots: string[],
  base: number[],
  final: number[],
  order: number[],
  other = 0,
): Finder {
  const ranges = finderRanges(other > 0 ? [...final, other] : final);
  const rows = slots.map((slot, index) => ({
    slot,
    value: final[index],
    range: ranges[index],
  }));
  if (other > 0) rows.push({ slot: "Other", value: other, range: ranges[slots.length] });
  return {
    rows,
    baseTotal: base.reduce((sum, value) => sum + value, 0),
    // Listed in the order the points were taken or given.
    changes: order
      .filter((index) => final[index] !== base[index])
      .map((index) => ({ slot: slots[index], by: final[index] - base[index] })),
    other,
  };
}

// Players count by the slot they are in now. Without a full lineup for the
// league there are no finders: nothing is worked out from a partial roster.
export function positionFinders(lineup: FinderPlayer[], useDh: boolean): PositionFinders {
  const slots = lineupSlots(useDh);
  const found = slots.map((slot) => lineup.find((player) => player.slot === slot));
  if (found.some((player) => player === undefined)) return { available: false };
  const players = found as FinderPlayer[];
  const indexes = players.map((_, index) => index);
  // Stable sorts, so players with the same grade stay in lineup order.
  const byGrade = (grade: (player: FinderPlayer) => Grade, direction: 1 | -1) =>
    [...indexes].sort(
      (a, b) => direction * (gradeValue(grade(players[a])) - gradeValue(grade(players[b]))),
    );

  const clutchBase = players.map((player) => gradeValue(player.hitting));
  const clutchTotal = clutchBase.reduce((sum, value) => sum + value, 0);
  // Short: best hitters gain first. Over: worst hitters give up first.
  const clutchOrder = byGrade((player) => player.hitting, clutchTotal < FINDER_TOTAL ? -1 : 1);
  const clutch = build(slots, clutchBase, smooth(clutchBase, clutchOrder), clutchOrder);

  const hrBase = players.map((player) => HR_VALUES[player.power]);
  const hrTotal = hrBase.reduce((sum, value) => sum + value, 0);
  const hrOrder = byGrade((player) => player.power, 1);
  // Short: the whole shortfall goes to "Other". Over: lowest power gives up
  // first.
  const homeRun =
    hrTotal <= FINDER_TOTAL
      ? build(slots, hrBase, hrBase, hrOrder, FINDER_TOTAL - hrTotal)
      : build(slots, hrBase, smooth(hrBase, hrOrder), hrOrder);

  return { available: true, clutch, homeRun };
}

function list(items: string[]) {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// One sentence saying what smoothing did to a finder, or null when the grade
// values already totalled 36.
export function finderNote(name: string, finder: Finder): string | null {
  if (finder.other > 0) {
    return `${name} finder: ${finder.other} of ${FINDER_TOTAL} left over went to Other.`;
  }
  if (finder.changes.length === 0) return null;

  const raised = finder.baseTotal < FINDER_TOTAL;
  const verb = raised ? "gained" : "gave up";
  const amounts = finder.changes.map((change) => Math.abs(change.by));
  const slots = finder.changes.map((change) => change.slot);
  const who =
    new Set(amounts).size === 1
      ? `${list(slots)}${slots.length > 1 ? " each" : ""} ${verb} ${amounts[0]}`
      : list(finder.changes.map((change, index) => `${change.slot} ${verb} ${amounts[index]}`));
  return `${name} finder ${raised ? "raised" : "trimmed"} from ${finder.baseTotal} to ${FINDER_TOTAL}: ${who}.`;
}
