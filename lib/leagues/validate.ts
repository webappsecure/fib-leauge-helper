export const LEAGUE_LIMITS = {
  nameMaxLength: 80,
  minYear: 1,
  maxYear: 9999,
  minTeams: 2,
  maxTeams: 100,
} as const;

export type LeagueInput = {
  name: string;
  startYear: number;
  teamCount: number;
  useDh: boolean;
};

export type RawLeagueInput = {
  name: unknown;
  startYear: unknown;
  teamCount: unknown;
  useDh: unknown;
};

export type LeagueFieldErrors = Partial<
  Record<"name" | "startYear" | "teamCount", string>
>;

export type LeagueValidation =
  | { ok: true; value: LeagueInput }
  | { ok: false; errors: LeagueFieldErrors };

function parseWholeNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

function inRange(value: number | null, min: number, max: number) {
  return value !== null && value >= min && value <= max;
}

export function validateLeagueInput(raw: RawLeagueInput): LeagueValidation {
  const errors: LeagueFieldErrors = {};

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name === "") {
    errors.name = "Enter a league name.";
  } else if ([...name].length > LEAGUE_LIMITS.nameMaxLength) {
    errors.name = `Keep the name to ${LEAGUE_LIMITS.nameMaxLength} characters or fewer.`;
  }

  const startYear = parseWholeNumber(raw.startYear);
  if (!inRange(startYear, LEAGUE_LIMITS.minYear, LEAGUE_LIMITS.maxYear)) {
    errors.startYear = `Enter a year between ${LEAGUE_LIMITS.minYear} and ${LEAGUE_LIMITS.maxYear}.`;
  }

  const teamCount = parseWholeNumber(raw.teamCount);
  if (!inRange(teamCount, LEAGUE_LIMITS.minTeams, LEAGUE_LIMITS.maxTeams)) {
    errors.teamCount = `Enter a number of teams between ${LEAGUE_LIMITS.minTeams} and ${LEAGUE_LIMITS.maxTeams}.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      startYear: startYear as number,
      teamCount: teamCount as number,
      useDh: raw.useDh === true || raw.useDh === "on" || raw.useDh === "true",
    },
  };
}
