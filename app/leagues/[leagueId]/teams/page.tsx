import { Suspense } from "react";
import { listTeams } from "@/lib/data";
import { DEFAULT_BALLPARK_QUALITY } from "@/lib/rules/ballpark";
import type { TeamInput } from "@/lib/teams/validate";
import { loadLeague } from "../load-league";
import { TeamGrid } from "./team-grid";

function blankTeam(number: number): TeamInput {
  return {
    number,
    city: null,
    name: null,
    gmName: null,
    gmRisk: null,
    gmDevFocus: null,
    gmTeamBuilding: null,
    managerName: null,
    ballparkName: null,
    ballparkQuality: DEFAULT_BALLPARK_QUALITY,
    cityRoll: null,
    gmRiskRoll: null,
    gmDevFocusRoll: null,
    gmTeamBuildingRoll: null,
  };
}

async function TeamSetup({ params }: { params: Promise<{ leagueId: string }> }) {
  const league = await loadLeague(params);
  const saved = new Map<number, TeamInput>(
    (await listTeams(league.id)).map((team) => [team.number, team]),
  );
  const teams = Array.from(
    { length: league.teamCount },
    (_, index) => saved.get(index + 1) ?? blankTeam(index + 1),
  );

  return (
    <TeamGrid
      leagueId={league.id}
      leagueName={league.name}
      initialTeams={teams}
    />
  );
}

export default function TeamSetupPage({
  params,
}: PageProps<"/leagues/[leagueId]/teams">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading teams</p>}>
      <TeamSetup params={params} />
    </Suspense>
  );
}
