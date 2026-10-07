import Link from "next/link";
import { Suspense } from "react";
import { Panel, PageTitle, buttonClass } from "@/components/ui";
import { countPlayersByTeam, listTeams } from "@/lib/data";
import { GM_CATEGORIES, gmQualityLabel } from "@/lib/rules/gm";
import { rosterSize } from "@/lib/rules/roster";
import { isTeamComplete } from "@/lib/teams/validate";
import { generateLeagueAction } from "./actions";
import { GenerateLeagueButton } from "./generate-league-button";
import { loadLeague } from "./load-league";

const cell = "h-7 border-b border-border px-2 text-left whitespace-nowrap";
const heading = `${cell} bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase`;

async function LeagueHome({ params }: { params: Promise<{ leagueId: string }> }) {
  const league = await loadLeague(params);
  const teams = await listTeams(league.id);
  const playerCounts = new Map(
    (await countPlayersByTeam(league.id)).map((entry) => [
      entry.teamId,
      entry.pitchers + entry.positionPlayers,
    ]),
  );
  const fullRoster = rosterSize(league.useDh);
  const setupHref = `/leagues/${league.id}/teams`;

  return (
    <>
      <PageTitle
        title={league.name}
        meta={`${league.startYear} season · ${league.teamCount} teams · ${
          league.useDh ? "DH league" : "No DH"
        }`}
        actions={
          <>
            {teams.length > 0 && (
              <GenerateLeagueButton
                action={generateLeagueAction.bind(null, league.id)}
              />
            )}
            <Link href={setupHref} className={buttonClass.primary}>
              Set up teams
            </Link>
          </>
        }
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
        {teams.length === 0 ? (
          <p className="p-3 text-muted">No teams set up yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={heading}>
                    #
                  </th>
                  <th scope="col" className={heading}>
                    City
                  </th>
                  <th scope="col" className={heading}>
                    Team
                  </th>
                  <th scope="col" className={heading}>
                    GM style
                  </th>
                  <th scope="col" className={heading}>
                    Status
                  </th>
                  <th scope="col" className={heading}>
                    Roster
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const gmStyle = GM_CATEGORIES.map((category) =>
                    gmQualityLabel(category, team[category]),
                  ).filter(Boolean);
                  return (
                    <tr key={team.id} className="hover:bg-surface-2">
                      <td className={`${cell} font-mono text-muted`}>
                        {team.number}
                      </td>
                      <td className={`${cell} font-semibold`}>
                        <Link
                          href={`/leagues/${league.id}/teams/${team.id}`}
                          className="hover:text-accent-text hover:underline"
                        >
                          {team.city ?? (
                            <span className="font-normal text-faint">
                              City not set
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className={cell}>{team.name}</td>
                      <td className={`${cell} text-muted`}>
                        {gmStyle.length > 0 ? gmStyle.join(" · ") : "GM not set"}
                      </td>
                      <td className={cell}>
                        {isTeamComplete(team) ? "Complete" : "Incomplete"}
                      </td>
                      <td className={`${cell} font-mono`}>
                        {playerCounts.get(team.id) ?? 0} of {fullRoster}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
