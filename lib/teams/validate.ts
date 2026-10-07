import {
  BALLPARK_QUALITIES,
  DEFAULT_BALLPARK_QUALITY,
  type BallparkQuality,
} from "../rules/ballpark";
import { CITY_ROLL_MAX, cityForRoll, normalizeCity } from "../rules/cities";
import {
  GM_CATEGORIES,
  GM_QUALITIES,
  gmQualityForD6,
  type GmCategory,
  type GmQuality,
} from "../rules/gm";

export const TEAM_TEXT_MAX_LENGTH = 60;

export const TEAM_TEXT_FIELDS = [
  "city",
  "name",
  "gmName",
  "managerName",
  "ballparkName",
] as const;

export type TeamTextField = (typeof TEAM_TEXT_FIELDS)[number];

// Nobody in a league goes unnamed, so a team cannot be saved without these.
const REQUIRED_TEXT_FIELDS: readonly TeamTextField[] = ["gmName", "managerName"];
export const NAME_REQUIRED = "Type a name, or press Random.";

export type TeamInput = {
  number: number;
  city: string | null;
  name: string | null;
  gmName: string | null;
  gmRisk: GmQuality<"gmRisk"> | null;
  gmDevFocus: GmQuality<"gmDevFocus"> | null;
  gmTeamBuilding: GmQuality<"gmTeamBuilding"> | null;
  managerName: string | null;
  ballparkName: string | null;
  ballparkQuality: BallparkQuality;
  cityRoll: number | null;
  gmRiskRoll: number | null;
  gmDevFocusRoll: number | null;
  gmTeamBuildingRoll: number | null;
};

export type TeamFieldErrors = Record<
  number,
  Partial<Record<TeamTextField, string>>
>;

export type TeamErrors = { form?: string; fields: TeamFieldErrors };

export type TeamsValidation =
  | { ok: true; teams: TeamInput[] }
  | { ok: false; errors: TeamErrors };

export const TEAMS_PAGE_ERROR =
  "Something is wrong with this page. Reload and try again.";

const ROLL_FIELD = {
  gmRisk: "gmRiskRoll",
  gmDevFocus: "gmDevFocusRoll",
  gmTeamBuilding: "gmTeamBuildingRoll",
} as const satisfies Record<GmCategory, keyof TeamInput>;

const rejected: TeamsValidation = {
  ok: false,
  errors: { form: TEAMS_PAGE_ERROR, fields: {} },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wholeNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

// A blank GM or manager name can only be left over from before names were
// required; such a team is not complete until it is filled in.
export function isTeamComplete(
  team: Pick<TeamInput, "city" | "gmName" | "managerName" | GmCategory>,
): boolean {
  return Boolean(
    team.city &&
      team.gmName?.trim() &&
      team.managerName?.trim() &&
      team.gmRisk &&
      team.gmDevFocus &&
      team.gmTeamBuilding,
  );
}

export function validateTeams(raw: unknown, teamCount: number): TeamsValidation {
  if (!Array.isArray(raw) || raw.length !== teamCount) return rejected;

  const fields: TeamFieldErrors = {};
  const teams: TeamInput[] = [];
  const seenNumbers = new Set<number>();

  for (const row of raw) {
    if (!isRecord(row)) return rejected;

    const number = wholeNumber(row.number, 1, teamCount);
    if (number === null || seenNumbers.has(number)) return rejected;
    seenNumbers.add(number);

    const text = {} as Record<TeamTextField, string | null>;
    for (const field of TEAM_TEXT_FIELDS) {
      const value = row[field];
      if (value !== null && value !== undefined && typeof value !== "string") {
        return rejected;
      }
      const trimmed = (value ?? "").trim();
      text[field] = trimmed === "" ? null : trimmed;
      if ([...trimmed].length > TEAM_TEXT_MAX_LENGTH) {
        (fields[number] ??= {})[field] =
          field === "city"
            ? `Keep the city to ${TEAM_TEXT_MAX_LENGTH} characters or fewer.`
            : `Keep this to ${TEAM_TEXT_MAX_LENGTH} characters or fewer.`;
      } else if (trimmed === "" && REQUIRED_TEXT_FIELDS.includes(field)) {
        (fields[number] ??= {})[field] = NAME_REQUIRED;
      }
    }

    const gm = {} as { [C in GmCategory]: GmQuality<C> | null };
    const gmRolls = {} as Record<(typeof ROLL_FIELD)[GmCategory], number | null>;
    for (const category of GM_CATEGORIES) {
      const value = row[category] ?? null;
      const allowed: readonly string[] = GM_QUALITIES[category].values;
      if (value !== null && value !== "") {
        if (typeof value !== "string" || !allowed.includes(value)) return rejected;
      }
      const quality = value === "" ? null : (value as GmQuality | null);
      (gm as Record<GmCategory, GmQuality | null>)[category] = quality;

      const roll = wholeNumber(row[ROLL_FIELD[category]], 1, 6);
      gmRolls[ROLL_FIELD[category]] =
        roll !== null && quality !== null && gmQualityForD6(category, roll) === quality
          ? roll
          : null;
    }

    const ballparkQuality = row.ballparkQuality ?? DEFAULT_BALLPARK_QUALITY;
    if (!BALLPARK_QUALITIES.some((quality) => quality.value === ballparkQuality)) {
      return rejected;
    }

    const cityRoll = wholeNumber(row.cityRoll, 1, CITY_ROLL_MAX);
    const cityRollMatches =
      cityRoll !== null &&
      text.city !== null &&
      normalizeCity(cityForRoll(cityRoll).city) === normalizeCity(text.city);

    teams.push({
      number,
      ...text,
      ...gm,
      ballparkQuality: ballparkQuality as BallparkQuality,
      cityRoll: cityRollMatches ? cityRoll : null,
      ...gmRolls,
    });
  }

  teams.sort((a, b) => a.number - b.number);

  const firstTeamByCity = new Map<string, number>();
  for (const team of teams) {
    if (team.city === null) continue;
    const key = normalizeCity(team.city);
    const earlier = firstTeamByCity.get(key);
    if (earlier === undefined) {
      firstTeamByCity.set(key, team.number);
    } else {
      (fields[team.number] ??= {}).city ??=
        `${team.city} is already team ${earlier}. Type another city or roll one.`;
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, errors: { fields } };
  return { ok: true, teams };
}
