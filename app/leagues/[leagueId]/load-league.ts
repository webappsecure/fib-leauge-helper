import { notFound } from "next/navigation";
import { getLeague, type League } from "@/lib/data";

// Reads the league named in the route, or renders the not-found page.
export async function loadLeague(
  params: Promise<{ leagueId: string }>,
): Promise<League> {
  const { leagueId } = await params;
  if (!/^\d+$/.test(leagueId)) notFound();

  const id = Number(leagueId);
  if (!Number.isSafeInteger(id)) notFound();

  const league = await getLeague(id);
  if (!league) notFound();
  return league;
}
