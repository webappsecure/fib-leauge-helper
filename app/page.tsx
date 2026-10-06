import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Panel, PageTitle, buttonClass } from "@/components/ui";
import { listLeagues } from "@/lib/data";

const cell = "h-7 border-b border-border px-2 text-left whitespace-nowrap";
const heading = `${cell} bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase`;

// Leagues change at any time, so the list is read per request, not at build.
async function LeagueList() {
  await connection();
  const leagues = await listLeagues();

  if (leagues.length === 0) {
    return (
      <p className="p-3 text-muted">
        No leagues yet. Create one to get started.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th scope="col" className={heading}>
            League
          </th>
          <th scope="col" className={heading}>
            Starting year
          </th>
          <th scope="col" className={heading}>
            Teams
          </th>
          <th scope="col" className={heading}>
            DH
          </th>
        </tr>
      </thead>
      <tbody>
        {leagues.map((league) => (
          <tr key={league.id} className="hover:bg-surface-2">
            <td className={`${cell} font-semibold`}>
              <Link
                href={`/leagues/${league.id}`}
                className="underline-offset-2 hover:underline"
              >
                {league.name}
              </Link>
            </td>
            <td className={`${cell} font-mono`}>{league.startYear}</td>
            <td className={`${cell} font-mono`}>{league.teamCount}</td>
            <td className={cell}>{league.useDh ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LeagueListPage() {
  return (
    <>
      <PageTitle
        title="Leagues"
        actions={
          <Link href="/leagues/new" className={buttonClass.primary}>
            New league
          </Link>
        }
      />
      <Panel title="Your leagues">
        <Suspense fallback={<p className="p-3 text-muted">Loading leagues</p>}>
          <LeagueList />
        </Suspense>
      </Panel>
    </>
  );
}
