import { GRADES, gradeValue, type Grade } from "./grades";
import { HR_TENDENCIES, type HrTendency } from "./pitchers";
import { lineupSlots } from "./positions";

// Team and bullpen qualities from handbook section 3. Nothing here is stored:
// every quality is worked out from the roster each time it is needed.

// Worst to best. A "semi" tone carries a bullet in its label.
export const QUALITY_TONES = ["low", "semi-low", "neutral", "semi-high", "high"] as const;

export type QualityTone = (typeof QUALITY_TONES)[number];

export type Unavailable = { available: false; reason: string };

export type TeamQuality =
  | { available: true; tone: QualityTone; label: string; sum: number; working: string }
  | Unavailable;

export type BullpenGrade =
  | { available: true; grade: Grade; sum: number; working: string }
  | Unavailable;

// `floors` are the lowest sums for WEAK•, neutral, STRONG• and STRONG (and
// their Scoring and Defense counterparts); anything below the first is the
// lowest quality. `labels` run worst to best.
type Scale = { labels: readonly string[]; floors: readonly number[] };

const POWER: Scale = {
  labels: ["WEAK", "WEAK•", "neutral", "STRONG•", "STRONG"],
  floors: [27, 30, 34, 37],
};
const SCORING: Scale = {
  labels: ["LOW", "LOW•", "neutral", "HIGH•", "HIGH"],
  floors: [27, 30, 40, 43],
};
const DEFENSE: Scale = {
  labels: ["POROUS", "POROUS•", "neutral", "SOLID•", "SOLID"],
  floors: [25, 28, 37, 40],
};

// A league with no DH has one fewer bat, so the Power and Scoring ranges all
// drop by this much (3.5). Defense never counted the DH, so it does not move.
const NO_DH_DROP = 3;

function rate(scale: Scale, sum: number, drop = 0) {
  const step = scale.floors.filter((floor) => sum >= floor - drop).length;
  return { tone: QUALITY_TONES[step], label: scale.labels[step] };
}

export type LineupGrades = {
  slot: string;
  hitting: Grade;
  power: Grade;
  defense: Grade;
};

export type TeamQualities = {
  scoring: TeamQuality;
  power: TeamQuality;
  defense: TeamQuality;
};

// Players count by the slot they are in now. Anyone outside the league's
// lineup slots is ignored, and a missing slot means no quality can be given.
export function teamQualities(lineup: LineupGrades[], useDh: boolean): TeamQualities {
  const players = lineupSlots(useDh).map((slot) =>
    lineup.find((player) => player.slot === slot),
  );
  if (players.some((player) => player === undefined)) {
    const missing: Unavailable = { available: false, reason: "Needs a full lineup" };
    return { scoring: missing, power: missing, defense: missing };
  }
  const full = players as LineupGrades[];
  const total = (grades: Grade[]) =>
    grades.reduce((sum, grade) => sum + gradeValue(grade), 0);
  const drop = useDh ? 0 : NO_DH_DROP;

  const powerSum = total(full.map((player) => player.power));
  const power = rate(POWER, powerSum, drop);
  const bonus = power.tone === "high" ? 6 : power.tone === "semi-high" ? 3 : 0;

  const hittingSum = total(full.map((player) => player.hitting));
  const scoringSum = hittingSum + bonus;

  const defenseSum = total(
    full.filter((player) => player.slot !== "DH").map((player) => player.defense),
  );

  return {
    scoring: {
      available: true,
      ...rate(SCORING, scoringSum, drop),
      sum: scoringSum,
      working:
        bonus === 0
          ? `Hitting ${hittingSum}`
          : `Hitting ${hittingSum} + Power bonus ${bonus} = ${scoringSum}`,
    },
    power: {
      available: true,
      ...power,
      sum: powerSum,
      working: `Power ${powerSum}`,
    },
    defense: {
      available: true,
      ...rate(DEFENSE, defenseSum),
      sum: defenseSum,
      working: useDh ? `Defense ${defenseSum}, DH excluded` : `Defense ${defenseSum}`,
    },
  };
}

export type BullpenPitcher = { slot: string; grade: Grade; hrTendency: HrTendency };

// HR_TENDENCIES runs SHAKY to TOUGH, the same worst-to-best order as the
// tones, so a tendency's place in it (1 to 5) picks its tone and label.
function tendencyQuality(value: number) {
  return { tone: QUALITY_TONES[value - 1], label: HR_TENDENCIES[value - 1].label };
}

const tendencyValue = (tendency: HrTendency) =>
  HR_TENDENCIES.findIndex((entry) => entry.value === tendency) + 1;

export type CloserQualities = {
  grade: Grade;
  hrTendency: { tone: QualityTone; label: string };
};

// The pitcher in the CL slot now, or null when nobody is. The closer stands
// alone: it never counts toward the bullpen qualities.
export function closerQualities(pitchers: BullpenPitcher[]): CloserQualities | null {
  const closer = pitchers.find((pitcher) => pitcher.slot === "CL");
  return closer
    ? {
        grade: closer.grade,
        hrTendency: tendencyQuality(tendencyValue(closer.hrTendency)),
      }
    : null;
}

export type BullpenQualities = { grade: BullpenGrade; hrTendency: TeamQuality };

const RELIEF_SLOTS = ["RP1", "RP2", "RP3", "RP4"];

// An exact half rounds up, which is what Math.round does for these sums.
function average(sum: number) {
  const mean = sum / RELIEF_SLOTS.length;
  return {
    rounded: Math.round(mean),
    working: `RP average ${sum} / ${RELIEF_SLOTS.length} = ${mean.toFixed(2).replace(/0$/, "")}`,
  };
}

// The four relief pitchers only; the closer is never counted (3.4).
export function bullpenQualities(pitchers: BullpenPitcher[]): BullpenQualities {
  const relievers = RELIEF_SLOTS.map((slot) =>
    pitchers.find((pitcher) => pitcher.slot === slot),
  );
  if (relievers.some((pitcher) => pitcher === undefined)) {
    const missing: Unavailable = { available: false, reason: "Needs four relief pitchers" };
    return { grade: missing, hrTendency: missing };
  }
  const full = relievers as BullpenPitcher[];

  const gradeSum = full.reduce((sum, pitcher) => sum + gradeValue(pitcher.grade), 0);
  const grade = average(gradeSum);

  const tendencySum = full.reduce(
    (sum, pitcher) => sum + tendencyValue(pitcher.hrTendency),
    0,
  );
  const tendency = average(tendencySum);

  return {
    grade: {
      available: true,
      grade: GRADES[grade.rounded - 1],
      sum: gradeSum,
      working: grade.working,
    },
    hrTendency: {
      available: true,
      ...tendencyQuality(tendency.rounded),
      sum: tendencySum,
      working: tendency.working,
    },
  };
}
