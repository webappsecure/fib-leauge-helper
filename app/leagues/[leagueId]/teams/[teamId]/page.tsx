import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GradeBadge } from "@/components/grade";
import { Panel, PageTitle } from "@/components/ui";
import { getTeam, listTeamPitchers, type Pitcher } from "@/lib/data";
import { hrTendencyLabel, type PitcherAttribute } from "@/lib/rules/pitchers";
import { loadLeague } from "../../load-league";
import { RollStaffButton } from "./roll-staff-button";

type Params = Promise<{ leagueId: string; teamId: string }>;

const cell = "h-7 border-b border-border px-2 text-left whitespace-nowrap";
const heading = `${cell} bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase`;
const centered = "text-center";

// The dice behind a rolled value, shown beside it.
function Dice({ pitcher, attribute }: { pitcher: Pitcher; attribute: PitcherAttribute }) {
  const roll = pitcher.rolls.find((entry) => entry.attribute === attribute);
  if (!roll) return null;
  return (
    <span className="ml-1 font-mono text-xs text-faint">
      <span className="sr-only">rolled </span>
      {roll.dice}
    </span>
  );
}

function PitcherRow({ pitcher }: { pitcher: Pitcher }) {
  return (
    <tr className="hover:bg-surface-2">
      <th scope="row" className={`${cell} w-11 font-mono text-sm font-normal text-muted`}>
        {pitcher.slot}
      </th>
      <td className={`${cell} font-semibold`}>
        {pitcher.name ?? <span className="font-normal text-faint">Unnamed</span>}
      </td>
      <td className={`${cell} ${centered} font-mono`}>
        {pitcher.age}
        <Dice pitcher={pitcher} attribute="age" />
      </td>
      <td className={`${cell} ${centered}`}>
        <GradeBadge grade={pitcher.grade} />
        <Dice pitcher={pitcher} attribute="grade" />
      </td>
      <td className={`${cell} ${centered} font-mono text-sm text-faint`}>
        {pitcher.gradeCeiling}
      </td>
      <td className={cell}>
        {hrTendencyLabel(pitcher.hrTendency)}
        <Dice pitcher={pitcher} attribute="hrTendency" />
      </td>
      <td className={`${cell} ${centered} font-mono`}>
        {pitcher.stamina}
        <Dice pitcher={pitcher} attribute="stamina" />
      </td>
    </tr>
  );
}

function PitchingStaff({ pitchers }: { pitchers: Pitcher[] }) {
  const starters = pitchers.filter((pitcher) => pitcher.naturalPosition === "SP");
  const bullpen = pitchers.filter((pitcher) => pitcher.naturalPosition !== "SP");

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={heading}>
              Pos
            </th>
            <th scope="col" className={heading}>
              Name
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              Age
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              <abbr title="Grade" className="no-underline">
                GR
              </abbr>
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              <abbr title="Grade ceiling" className="no-underline">
                Ceil
              </abbr>
            </th>
            <th scope="col" className={heading}>
              HR control
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              <abbr title="Stamina" className="no-underline">
                ST
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {starters.map((pitcher) => (
            <PitcherRow key={pitcher.id} pitcher={pitcher} />
          ))}
        </tbody>
        <tbody>
          <tr>
            <th scope="rowgroup" colSpan={7} className={heading}>
              Bullpen
            </th>
          </tr>
          {bullpen.map((pitcher) => (
            <PitcherRow key={pitcher.id} pitcher={pitcher} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function TeamSheet({ params }: { params: Params }) {
  const league = await loadLeague(params);
  const { teamId } = await params;
  if (!/^\d+$/.test(teamId)) notFound();

  const id = Number(teamId);
  const team = Number.isSafeInteger(id) ? await getTeam(league.id, id) : null;
  if (!team) notFound();

  const pitchers = await listTeamPitchers(league.id, team.id);
  const title =
    [team.city, team.name].filter(Boolean).join(" ") || `Team ${team.number}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted">
        <Link href={`/leagues/${league.id}`} className="hover:text-accent-text">
          {league.name}
        </Link>
        {" / "}
        {title}
      </nav>
      <PageTitle
        title={title}
        meta={`${league.startYear} season · ${league.useDh ? "DH league" : "No DH"}`}
      />
      <Panel title="Pitching staff">
        {pitchers.length === 0 ? (
          <div className="grid justify-items-start gap-3 p-3">
            <p className="text-muted">
              No pitchers have been rolled for this team yet.
            </p>
            <RollStaffButton leagueId={league.id} teamId={team.id} />
          </div>
        ) : (
          <PitchingStaff pitchers={pitchers} />
        )}
      </Panel>
    </>
  );
}

export default function TeamSheetPage({
  params,
}: PageProps<"/leagues/[leagueId]/teams/[teamId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading team sheet</p>}>
      <TeamSheet params={params} />
    </Suspense>
  );
}
