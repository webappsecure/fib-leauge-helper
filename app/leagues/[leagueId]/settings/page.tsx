import Link from "next/link";
import { Suspense } from "react";
import { Panel, PageTitle } from "@/components/ui";
import { countPlayersByTeam, listTeams } from "@/lib/data";
import { loadLeague } from "../load-league";
import { deleteLeagueAction, saveLeagueSettingsAction } from "./actions";
import { DeleteLeague } from "./delete-league";
import { SettingsForm } from "./settings-form";

async function LeagueSettings({ params }: { params: Promise<{ leagueId: string }> }) {
  const league = await loadLeague(params);
  const teams = await listTeams(league.id);
  const playerCount = (await countPlayersByTeam(league.id)).reduce(
    (total, entry) => total + entry.pitchers + entry.positionPlayers,
    0,
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted">
        <Link href={`/leagues/${league.id}`} className="hover:text-accent-text">
          {league.name}
        </Link>
        {" / "}
        Settings
      </nav>
      <PageTitle title="League settings" />
      <Panel title="Name and starting year">
        <SettingsForm
          name={league.name}
          startYear={league.startYear}
          action={saveLeagueSettingsAction.bind(null, league.id)}
        />
      </Panel>
      <Panel title="Set when the league was created">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-3">
          <dt className="text-muted">Number of teams</dt>
          <dd className="font-mono font-semibold">{league.teamCount}</dd>
          <dt className="text-muted">Designated hitter</dt>
          <dd className="font-semibold">{league.useDh ? "Yes" : "No"}</dd>
        </dl>
        <p className="border-t border-border px-3 py-2 text-xs text-muted">
          These two are fixed when a league is created and cannot be changed here.
        </p>
      </Panel>
      <Panel title="Delete league">
        <DeleteLeague
          leagueName={league.name}
          teamCount={teams.length}
          playerCount={playerCount}
          action={deleteLeagueAction.bind(null, league.id)}
        />
      </Panel>
    </>
  );
}

export default function LeagueSettingsPage({
  params,
}: PageProps<"/leagues/[leagueId]/settings">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading settings</p>}>
      <LeagueSettings params={params} />
    </Suspense>
  );
}
