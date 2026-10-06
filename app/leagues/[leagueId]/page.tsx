import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Panel, PageTitle } from "@/components/ui";
import { getLeague } from "@/lib/data";

async function LeagueHome({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  if (!/^\d+$/.test(leagueId)) notFound();

  const id = Number(leagueId);
  if (!Number.isSafeInteger(id)) notFound();

  const league = await getLeague(id);
  if (!league) notFound();

  return (
    <>
      <PageTitle
        title={league.name}
        meta={`${league.startYear} season · ${league.teamCount} teams · ${
          league.useDh ? "DH league" : "No DH"
        }`}
      />
      <Panel title="League settings">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-3">
          <dt className="text-muted">Name</dt>
          <dd className="font-semibold">{league.name}</dd>
          <dt className="text-muted">Starting year</dt>
          <dd className="font-mono font-semibold">{league.startYear}</dd>
          <dt className="text-muted">Teams</dt>
          <dd className="font-mono font-semibold">{league.teamCount}</dd>
          <dt className="text-muted">Designated hitter</dt>
          <dd className="font-semibold">{league.useDh ? "Yes" : "No"}</dd>
        </dl>
      </Panel>
      <Panel title="Teams">
        <p className="p-3 text-muted">No teams set up yet.</p>
      </Panel>
    </>
  );
}

export default function LeagueHomePage({
  params,
}: PageProps<"/leagues/[leagueId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading league</p>}>
      <LeagueHome params={params} />
    </Suspense>
  );
}
