import Link from "next/link";
import { Suspense } from "react";
import { Dice } from "@/components/dice";
import { GradeBadge } from "@/components/grade";
import { Panel, PageTitle } from "@/components/ui";
import {
  listFreeAgents,
  type FreeAgentPitcher,
  type FreeAgentPositionPlayer,
} from "@/lib/data";
import { PER_POSITION_LIMITS } from "@/lib/free-agents/validate";
import { hrTendencyLabel } from "@/lib/rules/pitchers";
import { GRADE_ATTRIBUTES } from "@/lib/rules/positions";
import { loadLeague } from "../load-league";
import { generateFreeAgentsAction } from "./actions";
import { GenerateForm } from "./generate-form";

const cell = "h-7 border-b border-border px-2 text-left whitespace-nowrap";
const heading = `${cell} bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase`;
const centered = "text-center";

function PositionCell({ position }: { position: string }) {
  return (
    <th scope="row" className={`${cell} w-11 font-mono text-sm font-normal text-muted`}>
      {position}
    </th>
  );
}

function NameCell({ name }: { name: string | null }) {
  return (
    <td className={`${cell} font-semibold`}>
      {name ?? <span className="font-normal text-faint">Unnamed</span>}
    </td>
  );
}

function Pitchers({ pitchers }: { pitchers: FreeAgentPitcher[] }) {
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
              Grade
            </th>
            <th scope="col" className={heading}>
              <abbr title="Home run tendency" className="no-underline">
                HR tend
              </abbr>
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              Stamina
            </th>
          </tr>
        </thead>
        <tbody>
          {pitchers.map((pitcher) => (
            <tr key={pitcher.id} className="hover:bg-surface-2">
              <PositionCell position={pitcher.naturalPosition} />
              <NameCell name={pitcher.name} />
              <td className={`${cell} ${centered} font-mono`}>
                {pitcher.age}
                <Dice rolls={pitcher.rolls} attributes={["age"]} />
              </td>
              <td className={`${cell} ${centered}`}>
                <GradeBadge grade={pitcher.grade} />
                <Dice rolls={pitcher.rolls} attributes={["grade"]} />
              </td>
              <td className={cell}>
                {hrTendencyLabel(pitcher.hrTendency)}
                <Dice rolls={pitcher.rolls} attributes={["hrTendency"]} />
              </td>
              <td className={`${cell} ${centered} font-mono`}>
                {pitcher.stamina}
                <Dice rolls={pitcher.rolls} attributes={["stamina"]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const gradeHeadings = { hitting: "Hitting", power: "Power", defense: "Defense", clutch: "Clutch" };

function PositionPlayers({ players }: { players: FreeAgentPositionPlayer[] }) {
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
              <abbr title="Archetype" className="no-underline">
                Arch
              </abbr>
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              Age
            </th>
            {GRADE_ATTRIBUTES.map((attribute) => (
              <th key={attribute} scope="col" className={`${heading} ${centered}`}>
                {gradeHeadings[attribute]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="hover:bg-surface-2">
              <PositionCell position={player.naturalPosition} />
              <NameCell name={player.name} />
              <td className={`${cell} ${centered} font-mono`}>
                {player.archetype}
                <Dice rolls={player.rolls} attributes={["archetype"]} />
              </td>
              <td className={`${cell} ${centered} font-mono`}>
                {player.age}
                <Dice rolls={player.rolls} attributes={["age"]} />
              </td>
              {GRADE_ATTRIBUTES.map((attribute) => (
                <td key={attribute} className={`${cell} ${centered}`}>
                  <GradeBadge grade={player[attribute]} />
                  <Dice rolls={player.rolls} attributes={[attribute]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const empty = <p className="p-3 text-muted">No free agents yet.</p>;

async function FreeAgents({ params }: { params: Promise<{ leagueId: string }> }) {
  const league = await loadLeague(params);
  const { pitchers, positionPlayers } = await listFreeAgents(league.id);
  const total = pitchers.length + positionPlayers.length;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted">
        <Link href={`/leagues/${league.id}`} className="hover:text-accent-text">
          {league.name}
        </Link>
        {" / "}
        Free agents
      </nav>
      <PageTitle
        title="Free agents"
        meta={`${total} in the pool · a free agent's grades are also their ceilings`}
      />
      <Panel title="Generate free agents">
        <GenerateForm
          min={PER_POSITION_LIMITS.min}
          max={PER_POSITION_LIMITS.max}
          defaultValue={PER_POSITION_LIMITS.default}
          action={generateFreeAgentsAction.bind(null, league.id)}
        />
        <p className="border-t border-border px-3 py-2 text-xs text-muted">
          Each position is filled up to this number. Free agents already in the pool
          are kept.
        </p>
      </Panel>
      {total === 0 ? (
        <Panel title="Free agent pool">{empty}</Panel>
      ) : (
        <>
          <Panel title="Pitchers">
            {pitchers.length === 0 ? empty : <Pitchers pitchers={pitchers} />}
          </Panel>
          <Panel title="Position players">
            {positionPlayers.length === 0 ? (
              empty
            ) : (
              <PositionPlayers players={positionPlayers} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}

export default function FreeAgentsPage({
  params,
}: PageProps<"/leagues/[leagueId]/free-agents">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading free agents</p>}>
      <FreeAgents params={params} />
    </Suspense>
  );
}
