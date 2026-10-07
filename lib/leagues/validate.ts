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

// The name and starting year follow the same rules when a league is created
// and when its settings are changed.
function checkNameAndYear(
  raw: { name: unknown; startYear: unknown },
  errors: Pick<LeagueFieldErrors, "name" | "startYear">,
) {
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
  return { name, startYear };
}

export type LeagueSettingsInput = { name: string; startYear: number };

export type LeagueSettingsErrors = Pick<LeagueFieldErrors, "name" | "startYear">;

export type LeagueSettingsValidation =
  | { ok: true; value: LeagueSettingsInput }
  | { ok: false; errors: LeagueSettingsErrors };

// The two settings that can be changed after a league is created.
export function validateLeagueSettings(raw: {
  name: unknown;
  startYear: unknown;
}): LeagueSettingsValidation {
  const errors: LeagueSettingsErrors = {};
  const { name, startYear } = checkNameAndYear(raw, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, startYear: startYear as number } };
}

export function validateLeagueInput(raw: RawLeagueInput): LeagueValidation {
  const errors: LeagueFieldErrors = {};
  const { name, startYear } = checkNameAndYear(raw, errors);

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
