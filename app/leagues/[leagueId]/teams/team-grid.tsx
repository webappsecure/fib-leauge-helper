"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Panel, PageTitle, buttonClass } from "@/components/ui";
import { BALLPARK_QUALITIES } from "@/lib/rules/ballpark";
import { cityForRoll, rollCity } from "@/lib/rules/cities";
import { rollDie } from "@/lib/rules/dice";
import {
  GM_CATEGORIES,
  GM_QUALITIES,
  gmQualityForD6,
  type GmCategory,
} from "@/lib/rules/gm";
import {
  TEAM_TEXT_MAX_LENGTH,
  isTeamComplete,
  type TeamErrors,
  type TeamInput,
  type TeamTextField,
} from "@/lib/teams/validate";
import { drawStaffNamesAction, saveTeamsAction } from "./actions";

const ROLL_FIELD = {
  gmRisk: "gmRiskRoll",
  gmDevFocus: "gmDevFocusRoll",
  gmTeamBuilding: "gmTeamBuildingRoll",
} as const;

const NO_CITIES_LEFT = "All 68 listed cities are in use. Type a city instead.";
const NO_NAMES_LEFT = "No unused names are left on the list. Type a name instead.";

type StaffField = "gmName" | "managerName";
type StaffTarget = { number: number; field: StaffField };

const STAFF_FIELDS: StaffField[] = ["gmName", "managerName"];

const cell = "border-b border-border px-2 py-1 text-left align-top";
const heading =
  "h-7 border-b border-border bg-surface-2 px-2 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase";
const control =
  "h-6 w-full min-w-28 rounded-ui border border-border bg-surface px-1.5 text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger aria-invalid:bg-danger-bg";
const smallButton = `${buttonClass.secondary} h-6 shrink-0 px-2 py-0`;
const hint = "mt-0.5 block font-mono text-xs text-faint";

function takenCities(teams: TeamInput[], exceptNumber?: number) {
  return teams
    .filter((team) => team.number !== exceptNumber && team.city)
    .map((team) => team.city as string);
}

function cityHint(team: TeamInput) {
  if (!team.city?.trim()) return null;
  if (team.cityRoll === null) return "typed";
  const { low, high } = cityForRoll(team.cityRoll);
  return `rolled ${team.cityRoll} (${low === high ? low : `${low}-${high}`})`;
}

export function TeamGrid({
  leagueId,
  leagueName,
  initialTeams,
}: {
  leagueId: number;
  leagueName: string;
  initialTeams: TeamInput[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [errors, setErrors] = useState<TeamErrors>({ fields: {} });
  const [notices, setNotices] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [nameNotice, setNameNotice] = useState("");
  const [drawing, startDrawing] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    tableRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [errors]);

  function change(update: (current: TeamInput[]) => TeamInput[]) {
    setTeams(update);
    setDirty(true);
    setMessage("");
  }

  function updateTeam(number: number, patch: Partial<TeamInput>) {
    change((current) =>
      current.map((team) =>
        team.number === number ? { ...team, ...patch } : team,
      ),
    );
  }

  function setText(number: number, field: TeamTextField, value: string) {
    // Typing over a rolled city makes it a typed city.
    updateTeam(number, field === "city" ? { city: value, cityRoll: null } : { [field]: value });
    if (field === "city") clearNotice(number);
    clearFieldError(number, field);
  }

  // An edited field stops showing its old error; the next save re-checks it.
  function clearFieldError(number: number, field: TeamTextField) {
    setErrors((current) => {
      if (!current.fields[number]?.[field]) return current;
      const row = { ...current.fields[number] };
      delete row[field];
      const fields = { ...current.fields };
      if (Object.keys(row).length > 0) fields[number] = row;
      else delete fields[number];
      return { ...current, fields };
    });
  }

  function setGmQuality(number: number, category: GmCategory, value: string) {
    updateTeam(number, {
      [category]: value === "" ? null : value,
      [ROLL_FIELD[category]]: null,
    });
  }

  function rollGmQuality(number: number, category: GmCategory) {
    const face = rollDie(6);
    updateTeam(number, {
      [category]: gmQualityForD6(category, face),
      [ROLL_FIELD[category]]: face,
    });
  }

  function clearNotice(number: number) {
    setNotices((current) => {
      const next = { ...current };
      delete next[number];
      return next;
    });
  }

  function rollRandomCity(number: number) {
    const rolled = rollCity(takenCities(teams, number));
    if (!rolled) {
      setNotices((current) => ({ ...current, [number]: NO_CITIES_LEFT }));
      return;
    }
    clearNotice(number);
    clearFieldError(number, "city");
    updateTeam(number, { city: rolled.city, cityRoll: rolled.roll });
  }

  function rollCitiesForEmptyRows() {
    const taken = takenCities(teams);
    const nextNotices: Record<number, string> = {};
    const next = teams.map((team) => {
      if (team.city?.trim()) return team;
      const rolled = rollCity(taken);
      if (!rolled) {
        nextNotices[team.number] = NO_CITIES_LEFT;
        return team;
      }
      taken.push(rolled.city);
      return { ...team, city: rolled.city, cityRoll: rolled.roll };
    });
    setNotices(nextNotices);
    change(() => next);
  }

  function rollUnsetGmQualities() {
    change((current) =>
      current.map((team) => {
        const patch: Partial<TeamInput> = {};
        for (const category of GM_CATEGORIES) {
          if (team[category]) continue;
          const face = rollDie(6);
          Object.assign(patch, {
            [category]: gmQualityForD6(category, face),
            [ROLL_FIELD[category]]: face,
          });
        }
        return { ...team, ...patch };
      }),
    );
  }

  // Asks the server for names, because the name list is not sent to the
  // browser. The names now in the grid go along so none of them is repeated.
  // With `onlyBlank`, a field filled in while the request was running keeps
  // what was typed and its drawn name is dropped.
  function drawNames(targets: StaffTarget[], onlyBlank = false) {
    if (targets.length === 0) return;
    const gridNames = teams.flatMap((team) =>
      STAFF_FIELDS.flatMap((field) => {
        const name = team[field]?.trim().slice(0, TEAM_TEXT_MAX_LENGTH);
        return name ? [name] : [];
      }),
    );
    startDrawing(async () => {
      const result = await drawStaffNamesAction(leagueId, targets.length, gridNames);
      if (!result.ok) {
        setErrors((current) => ({ ...current, form: result.error }));
        return;
      }
      setErrors((current) => (current.form ? { fields: current.fields } : current));
      setNameNotice(result.names.length < targets.length ? NO_NAMES_LEFT : "");
      if (result.names.length === 0) return;

      const drawn = targets.slice(0, result.names.length);
      drawn.forEach(({ number, field }) => clearFieldError(number, field));
      change((current) =>
        current.map((team) => {
          const patch: Partial<TeamInput> = {};
          drawn.forEach((target, index) => {
            if (target.number !== team.number) return;
            if (onlyBlank && team[target.field]?.trim()) return;
            patch[target.field] = result.names[index];
          });
          return { ...team, ...patch };
        }),
      );
    });
  }

  function drawBlankNames() {
    drawNames(
      teams.flatMap((team) =>
        STAFF_FIELDS.filter((field) => !team[field]?.trim()).map((field) => ({
          number: team.number,
          field,
        })),
      ),
      true,
    );
  }

  function save() {
    startSaving(async () => {
      const result = await saveTeamsAction(leagueId, teams);
      if (result.ok) {
        setErrors({ fields: {} });
        setDirty(false);
        setMessage(`Saved. All ${teams.length} teams are stored.`);
      } else {
        setErrors(result.errors);
        setMessage("");
      }
    });
  }

  const attentionCount = Object.keys(errors.fields).length;
  const completeCount = teams.filter(isTeamComplete).length;

  function nameInput(team: TeamInput, field: StaffField, label: string) {
    return (
      <div className="flex min-w-48 gap-1">
        <div className="flex-1">{textInput(team, field, label)}</div>
        <button
          type="button"
          onClick={() => drawNames([{ number: team.number, field }])}
          disabled={drawing}
          aria-label={`Random ${label} for team ${team.number}`}
          className={smallButton}
        >
          Random
        </button>
      </div>
    );
  }

  function textInput(team: TeamInput, field: TeamTextField, label: string) {
    const error = errors.fields[team.number]?.[field];
    const id = `team-${team.number}-${field}`;
    return (
      <>
        <input
          id={id}
          type="text"
          autoComplete="off"
          aria-label={`Team ${team.number} ${label}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={team[field] ?? ""}
          onChange={(event) => setText(team.number, field, event.target.value)}
          className={control}
        />
        {error ? (
          <span id={`${id}-error`} className="mt-0.5 block text-xs text-danger">
            {error}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link
          href={`/leagues/${leagueId}`}
          className="underline-offset-2 hover:underline"
        >
          {leagueName}
        </Link>{" "}
        / Set up teams
      </p>
      <PageTitle
        title="Set up teams"
        meta={`${teams.length} teams · ${completeCount} complete${
          attentionCount > 0 ? ` · ${attentionCount} need attention` : ""
        }`}
        actions={
          <>
            <button
              type="button"
              onClick={rollCitiesForEmptyRows}
              className={buttonClass.secondary}
            >
              Random cities for empty rows
            </button>
            <button
              type="button"
              onClick={rollUnsetGmQualities}
              className={buttonClass.secondary}
            >
              Roll all unset GMs
            </button>
            <button
              type="button"
              onClick={drawBlankNames}
              disabled={drawing}
              className={buttonClass.secondary}
            >
              Random names for blank GMs and managers
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={buttonClass.primary}
            >
              {saving ? "Saving teams" : "Save teams"}
            </button>
          </>
        }
      />

      <div role="status">
        {message ? (
          <p className="mb-3 rounded-ui border border-grade-a-ink/40 bg-grade-a-bg px-3 py-2 text-lg font-semibold text-grade-a-ink">
            {message}
          </p>
        ) : dirty ? (
          <p className="mb-3 rounded-ui border border-border bg-surface-2 px-3 py-2 font-semibold text-accent-text">
            Unsaved changes. Save teams to keep them.
          </p>
        ) : null}
      </div>
      <p role="status" className="mb-2 text-sm text-muted empty:mb-0">
        {nameNotice}
      </p>
      {errors.form ? (
        <p role="alert" className="mb-2 text-sm text-danger">
          {errors.form}
        </p>
      ) : attentionCount > 0 ? (
        <p role="alert" className="mb-2 text-sm text-danger">
          Nothing was saved. Fix the highlighted fields and save again.
        </p>
      ) : null}

      <Panel title="Teams">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={heading}>
                  #
                </th>
                <th scope="col" className={heading}>
                  Status
                </th>
                <th scope="col" className={heading}>
                  City
                </th>
                <th scope="col" className={heading}>
                  Team name
                </th>
                <th scope="col" className={heading}>
                  GM name
                </th>
                {GM_CATEGORIES.map((category) => (
                  <th key={category} scope="col" className={heading}>
                    GM {GM_QUALITIES[category].label.toLowerCase()}
                  </th>
                ))}
                <th scope="col" className={heading}>
                  Manager
                </th>
                <th scope="col" className={heading}>
                  Ballpark
                </th>
                <th scope="col" className={heading}>
                  Park quality
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const needsAttention = Boolean(errors.fields[team.number]);
                const status = needsAttention
                  ? "Needs attention"
                  : isTeamComplete(team)
                    ? "Complete"
                    : "Incomplete";
                return (
                  <tr key={team.number}>
                    <td className={`${cell} font-mono text-muted`}>
                      {team.number}
                    </td>
                    <td
                      className={`${cell} text-xs whitespace-nowrap ${
                        needsAttention ? "font-semibold text-danger" : "text-muted"
                      }`}
                    >
                      {status}
                    </td>
                    <td className={cell}>
                      <div className="flex min-w-48 gap-1">
                        <div className="flex-1">
                          {textInput(team, "city", "city")}
                        </div>
                        <button
                          type="button"
                          onClick={() => rollRandomCity(team.number)}
                          aria-label={`Random city for team ${team.number}`}
                          className={smallButton}
                        >
                          Random
                        </button>
                      </div>
                      {notices[team.number] ? (
                        <span role="status" className="mt-0.5 block text-xs text-muted">
                          {notices[team.number]}
                        </span>
                      ) : (
                        <span className={hint}>{cityHint(team)}</span>
                      )}
                    </td>
                    <td className={cell}>{textInput(team, "name", "team name")}</td>
                    <td className={cell}>{nameInput(team, "gmName", "GM name")}</td>
                    {GM_CATEGORIES.map((category) => {
                      const quality = GM_QUALITIES[category];
                      const roll = team[ROLL_FIELD[category]];
                      const label = `team ${team.number} GM ${quality.label.toLowerCase()}`;
                      return (
                        <td key={category} className={cell}>
                          <div className="flex gap-1">
                            <select
                              aria-label={`Team ${team.number} GM ${quality.label.toLowerCase()}`}
                              value={team[category] ?? ""}
                              onChange={(event) =>
                                setGmQuality(team.number, category, event.target.value)
                              }
                              className={control}
                            >
                              <option value="">Not set</option>
                              {quality.values.map((value) => (
                                <option key={value} value={value}>
                                  {quality.labels[value as keyof typeof quality.labels]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => rollGmQuality(team.number, category)}
                              aria-label={`Roll ${label}`}
                              className={smallButton}
                            >
                              Roll
                            </button>
                          </div>
                          <span className={hint}>
                            {roll !== null
                              ? `d6: ${roll}`
                              : team[category]
                                ? "chosen"
                                : null}
                          </span>
                        </td>
                      );
                    })}
                    <td className={cell}>
                      {nameInput(team, "managerName", "manager name")}
                    </td>
                    <td className={cell}>
                      {textInput(team, "ballparkName", "ballpark name")}
                    </td>
                    <td className={cell}>
                      <select
                        aria-label={`Team ${team.number} ballpark quality`}
                        value={team.ballparkQuality}
                        onChange={(event) =>
                          updateTeam(team.number, {
                            ballparkQuality: event.target
                              .value as TeamInput["ballparkQuality"],
                          })
                        }
                        className={control}
                      >
                        {BALLPARK_QUALITIES.map((quality) => (
                          <option key={quality.value} value={quality.value}>
                            {quality.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-3 py-2 text-xs text-muted">
          A team is complete when it has a city and all three GM qualities. Type
          a city or roll one from the weighted list (1 to 348); no city is used
          twice. Random GM and manager names come from the name list and are
          never shared with a player or another team. A bullet means
          &quot;semi&quot;, as in the handbook.
        </p>
      </Panel>
    </>
  );
}
