"use server";

import { revalidatePath } from "next/cache";
import { getLeague } from "@/lib/data";
import { parsePerPosition } from "@/lib/free-agents/validate";
import { generateFreeAgents } from "@/lib/rosters/free-agents";
import { isId, LEAGUE_NOT_FOUND } from "../../action-input";

export type GenerateFreeAgentsResult =
  | { ok: true; created: number; perPosition: number }
  | { ok: false; error: string };

export async function generateFreeAgentsAction(
  leagueId: unknown,
  formData: FormData,
): Promise<GenerateFreeAgentsResult> {
  const perPosition = parsePerPosition(formData.get("perPosition"));
  if (!perPosition.ok) return perPosition;

  // The id comes from the browser, so the league is reloaded here.
  const league = isId(leagueId) ? await getLeague(leagueId) : null;
  if (!league) return { ok: false, error: LEAGUE_NOT_FOUND };

  const created = await generateFreeAgents(league.id, perPosition.value);
  revalidatePath(`/leagues/${league.id}/free-agents`);
  return { ok: true, created, perPosition: perPosition.value };
}
