"use server";

import { revalidatePath } from "next/cache";
import {
  createPitchingStaff,
  getLeague,
  getTeam,
  listUsedNameIds,
} from "@/lib/data";
import { pickName } from "@/lib/rules/names";
import { rollPitchingStaff } from "@/lib/rules/pitchers";

export type RollStaffResult = { ok: true } | { ok: false; error: string };

const TEAM_NOT_FOUND =
  "This team could not be found. Go back to the league and open the team again.";

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export async function rollPitchingStaffAction(
  leagueId: unknown,
  teamId: unknown,
): Promise<RollStaffResult> {
  // Both ids come from the browser, so the league and team are reloaded here.
  const league = isId(leagueId) ? await getLeague(leagueId) : null;
  const team = league && isId(teamId) ? await getTeam(league.id, teamId) : null;
  if (!league || !team) return { ok: false, error: TEAM_NOT_FOUND };

  const usedNames = new Set(await listUsedNameIds(league.id));
  const staff = rollPitchingStaff().map((pitcher) => {
    const name = pickName(usedNames);
    if (name) usedNames.add(name.id);
    return {
      ...pitcher,
      name: name?.fullName ?? null,
      nameListId: name?.id ?? null,
    };
  });

  // A team that already has a staff is left as it is, so a double press or a
  // stale tab still ends on the saved staff.
  await createPitchingStaff(league.id, team.id, staff);
  revalidatePath(`/leagues/${league.id}/teams/${team.id}`);
  return { ok: true };
}
