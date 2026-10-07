"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteLeague, updateLeagueSettings } from "@/lib/data";
import {
  validateLeagueSettings,
  type LeagueSettingsErrors,
} from "@/lib/leagues/validate";
import { formText, isId, LEAGUE_NOT_FOUND } from "../../action-input";

export type LeagueSettingsState = {
  values: { name: string; startYear: string };
  errors: LeagueSettingsErrors & { form?: string };
  saved: boolean;
};

export type DeleteLeagueResult = { ok: false; error: string };

// The league list and every page under a league show its name or year. The
// route pattern with "layout" covers the league home and all pages below it.
function refreshLeaguePages() {
  revalidatePath("/");
  revalidatePath("/leagues/[leagueId]", "layout");
}

// The league id comes from the browser, so nothing is trusted until the
// update finds the league.
export async function saveLeagueSettingsAction(
  leagueId: unknown,
  _previous: LeagueSettingsState,
  formData: FormData,
): Promise<LeagueSettingsState> {
  const raw = { name: formData.get("name"), startYear: formData.get("startYear") };
  const values = { name: formText(raw.name), startYear: formText(raw.startYear) };

  const result = validateLeagueSettings(raw);
  if (!result.ok) return { values, errors: result.errors, saved: false };

  const league = isId(leagueId)
    ? await updateLeagueSettings(leagueId, result.value)
    : null;
  if (!league) return { values, errors: { form: LEAGUE_NOT_FOUND }, saved: false };

  refreshLeaguePages();
  return {
    values: { name: league.name, startYear: String(league.startYear) },
    errors: {},
    saved: true,
  };
}

// Removes the league with its teams, players and rolls, then goes to the
// league list. A league that is already gone ends in the same place.
export async function deleteLeagueAction(leagueId: unknown): Promise<DeleteLeagueResult> {
  if (!isId(leagueId)) return { ok: false, error: LEAGUE_NOT_FOUND };

  await deleteLeague(leagueId);
  refreshLeaguePages();
  redirect("/");
}
