import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Dice } from "@/components/dice";
import { GradeBadge } from "@/components/grade";
import { Panel, PageTitle, buttonClass } from "@/components/ui";
import {
  getTeam,
  listTeamPitchers,
  listTeamPositionPlayers,
  type Pitcher,
  type PositionPlayer,
} from "@/lib/data";
import { hrTendencyLabel } from "@/lib/rules/pitchers";
import { GRADE_ATTRIBUTES } from "@/lib/rules/positions";
import { bullpenQualities, teamQualities } from "@/lib/rules/qualities";
import { rosterSize } from "@/lib/rules/roster";
import { loadLeague } from "../../load-league";
import {
  randomPlayerNameAction,
  renamePlayerAction,
  renameTeamAction,
  rerollPlayerAction,
  rerollTeamAction,
  rollPitchingStaffAction,
  rollPositionPlayersAction,
} from "./actions";
import { PlayerName } from "./player-name";
import { RerollButton } from "./reroll-button";
import { RollButton } from "./roll-button";
import { TeamDetails } from "./team-details";
import { TeamQualitiesPanel } from "./team-qualities";

type Params = Promise<{ leagueId: string; teamId: string }>;

const cell = "h-7 border-b border-border px-2 text-left whitespace-nowrap";
const heading = `${cell} bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase`;
const centered = "text-center";

function NameCell({ player }: { player: Pitcher | PositionPlayer }) {
  const ids = [player.leagueId, player.teamId, player.id] as const;
  return (
    <td className={`${cell} font-semibold`}>
      <PlayerName
        slot={player.slot}
        name={player.name}
        rename={renamePlayerAction.bind(null, ...ids)}
        random={randomPlayerNameAction.bind(null, ...ids)}
      />
    </td>
  );
}

function RerollCell({ player }: { player: Pitcher | PositionPlayer }) {
  return (
    <td className={`${cell} text-right`}>
      <RerollButton
        player={`${player.slot} ${player.name ?? "unnamed player"}`}
        action={rerollPlayerAction.bind(null, player.leagueId, player.teamId, player.id)}
      />
    </td>
  );
}

const rerollHeading = (
  <th scope="col" className={heading}>
    <span className="sr-only">Re-roll</span>
  </th>
);

function PitcherRow({ pitcher }: { pitcher: Pitcher }) {
  return (
    <tr className="hover:bg-surface-2">
      <th scope="row" className={`${cell} w-11 font-mono text-sm font-normal text-muted`}>
        {pitcher.slot}
      </th>
      <NameCell player={pitcher} />
      <td className={`${cell} ${centered} font-mono`}>
        {pitcher.age}
        <Dice rolls={pitcher.rolls} attributes={["age"]} />
      </td>
      <td className={`${cell} ${centered}`}>
        <GradeBadge grade={pitcher.grade} />
        <Dice rolls={pitcher.rolls} attributes={["grade"]} />
      </td>
      <td className={`${cell} ${centered} font-mono text-sm text-faint`}>
        {pitcher.gradeCeiling}
      </td>
      <td className={cell}>
        {hrTendencyLabel(pitcher.hrTendency)}
        <Dice rolls={pitcher.rolls} attributes={["hrTendency"]} />
      </td>
      <td className={`${cell} ${centered} font-mono`}>
        {pitcher.stamina}
        <Dice rolls={pitcher.rolls} attributes={["stamina"]} />
      </td>
      <RerollCell player={pitcher} />
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
            {rerollHeading}
          </tr>
        </thead>
        <tbody>
          {starters.map((pitcher) => (
            <PitcherRow key={pitcher.id} pitcher={pitcher} />
          ))}
        </tbody>
        <tbody>
          <tr>
            <th scope="rowgroup" colSpan={8} className={heading}>
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

const shortHeadings = [
  { label: "H", title: "Hitting" },
  { label: "P", title: "Power" },
  { label: "D", title: "Defense" },
  { label: "CL", title: "Clutch" },
];

function Lineup({ players }: { players: PositionPlayer[] }) {
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
                Arc
              </abbr>
            </th>
            <th scope="col" className={`${heading} ${centered}`}>
              Age
            </th>
            {shortHeadings.map(({ label, title }) => (
              <th key={label} scope="col" className={`${heading} ${centered}`}>
                <abbr title={title} className="no-underline">
                  {label}
                </abbr>
              </th>
            ))}
            {rerollHeading}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="hover:bg-surface-2">
              <th
                scope="row"
                className={`${cell} w-11 font-mono text-sm font-normal text-muted`}
              >
                {player.slot}
              </th>
              <NameCell player={player} />
              <td className={`${cell} ${centered} font-mono`}>
                {player.archetype}
                <Dice rolls={player.rolls} attributes={["archetype", "eliteCheck"]} />
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
              <RerollCell player={player} />
            </tr>
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
  const positionPlayers = await listTeamPositionPlayers(league.id, team.id);
  const playerCount = pitchers.length + positionPlayers.length;
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
        meta={`${league.startYear} season · ${playerCount} of ${rosterSize(league.useDh)} players · ${
          league.useDh ? "DH league" : "No DH"
        }`}
        actions={
          <>
            {playerCount > 0 && (
              <>
                <RollButton
                  label="Re-roll all players"
                  action={rerollTeamAction.bind(null, league.id, team.id)}
                />
                <RollButton
                  label="New names for all players"
                  pendingLabel="Renaming"
                  action={renameTeamAction.bind(null, league.id, team.id)}
                />
              </>
            )}
            <Link href={`/leagues/${league.id}/teams`} className={buttonClass.secondary}>
              Team setup
            </Link>
          </>
        }
      />
      <div className="grid gap-x-4 md:grid-cols-3">
        <TeamQualitiesPanel
          team={teamQualities(positionPlayers, league.useDh)}
          bullpen={bullpenQualities(pitchers)}
        />
        <TeamDetails team={team} />
      </div>
      <Panel title="Pitching staff">
        {pitchers.length === 0 ? (
          <div className="grid justify-items-start gap-3 p-3">
            <p className="text-muted">
              No pitchers have been rolled for this team yet.
            </p>
            <RollButton
              label="Roll pitching staff"
              action={rollPitchingStaffAction.bind(null, league.id, team.id)}
            />
          </div>
        ) : (
          <PitchingStaff pitchers={pitchers} />
        )}
      </Panel>
      <Panel title="Position players">
        {positionPlayers.length === 0 ? (
          <div className="grid justify-items-start gap-3 p-3">
            <p className="text-muted">
              No position players have been rolled for this team yet.
            </p>
            <RollButton
              label="Roll position players"
              action={rollPositionPlayersAction.bind(null, league.id, team.id)}
            />
          </div>
        ) : (
          <Lineup players={positionPlayers} />
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
