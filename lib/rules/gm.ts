// GM qualities from handbook 1.3.1. Each list is in d6 order:
// 1-2 is the first value, 3-4 the second, 5-6 the third.
export const GM_QUALITIES = {
  gmRisk: {
    label: "Risk tolerance",
    values: ["conservative", "neutral", "aggressive"],
    labels: {
      conservative: "Conservative",
      neutral: "Neutral",
      aggressive: "Aggressive",
    },
  },
  gmDevFocus: {
    label: "Development focus",
    values: ["farm-first", "mixed", "win-now"],
    labels: {
      "farm-first": "Farm First",
      mixed: "Mixed",
      "win-now": "Win Now",
    },
  },
  gmTeamBuilding: {
    label: "Team building",
    values: ["pitching", "balanced", "offense"],
    labels: {
      pitching: "Pitching Focused",
      balanced: "Balanced",
      offense: "Offense Focused",
    },
  },
} as const;

export type GmCategory = keyof typeof GM_QUALITIES;
export type GmQuality<C extends GmCategory = GmCategory> =
  (typeof GM_QUALITIES)[C]["values"][number];

export const GM_CATEGORIES = Object.keys(GM_QUALITIES) as GmCategory[];

export function gmQualityForD6<C extends GmCategory>(
  category: C,
  face: number,
): GmQuality<C> {
  if (!Number.isInteger(face) || face < 1 || face > 6) {
    throw new RangeError("A d6 roll must be a whole number from 1 to 6.");
  }
  return GM_QUALITIES[category].values[Math.ceil(face / 2) - 1];
}

export function gmQualityLabel(category: GmCategory, value: string | null) {
  const labels: Record<string, string> = GM_QUALITIES[category].labels;
  return value ? (labels[value] ?? value) : null;
}
