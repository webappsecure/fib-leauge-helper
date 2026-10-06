"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLeague } from "@/lib/data";
import {
  validateLeagueInput,
  type LeagueFieldErrors,
} from "@/lib/leagues/validate";

export type LeagueFormState = {
  values: { name: string; startYear: string; teamCount: string; useDh: boolean };
  errors: LeagueFieldErrors;
};

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function createLeagueAction(
  _previous: LeagueFormState,
  formData: FormData,
): Promise<LeagueFormState> {
  const raw = {
    name: formData.get("name"),
    startYear: formData.get("startYear"),
    teamCount: formData.get("teamCount"),
    useDh: formData.get("useDh"),
  };

  const result = validateLeagueInput(raw);
  if (!result.ok) {
    return {
      values: {
        name: text(raw.name),
        startYear: text(raw.startYear),
        teamCount: text(raw.teamCount),
        useDh: raw.useDh === "on",
      },
      errors: result.errors,
    };
  }

  const league = await createLeague(result.value);
  revalidatePath("/");
  redirect(`/leagues/${league.id}`);
}
