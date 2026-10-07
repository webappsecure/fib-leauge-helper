import type { ReactNode } from "react";
import { Panel } from "@/components/ui";
import type { Team } from "@/lib/data";
import { ballparkQualityLabel } from "@/lib/rules/ballpark";
import { GM_CATEGORIES, GM_QUALITIES, gmQualityLabel } from "@/lib/rules/gm";

const ROLL_FIELD = {
  gmRisk: "gmRiskRoll",
  gmDevFocus: "gmDevFocusRoll",
  gmTeamBuilding: "gmTeamBuildingRoll",
} as const;

const list = "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-3";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-semibold wrap-anywhere">
        {children ?? <span className="font-normal text-faint">Not set</span>}
      </dd>
    </>
  );
}

// Who runs the team and where it plays. Read only; the team setup screen is
// where these are entered.
export function TeamDetails({ team }: { team: Team }) {
  return (
    <>
      <Panel title="Front office">
        <dl className={list}>
          <Detail label="GM">{team.gmName}</Detail>
          {GM_CATEGORIES.map((category) => {
            const roll = team[ROLL_FIELD[category]];
            const quality = gmQualityLabel(category, team[category]);
            return (
              <Detail key={category} label={GM_QUALITIES[category].label}>
                {quality && (
                  <>
                    {quality}
                    {roll !== null && (
                      <span className="ml-1 font-mono text-xs font-normal text-faint dice-hidden:hidden">
                        <span className="sr-only">rolled </span>
                        d6: {roll}
                      </span>
                    )}
                  </>
                )}
              </Detail>
            );
          })}
          <Detail label="Manager">{team.managerName}</Detail>
        </dl>
      </Panel>
      <Panel title="Ballpark">
        <dl className={list}>
          <Detail label="Name">{team.ballparkName}</Detail>
          <Detail label="Quality">{ballparkQualityLabel(team.ballparkQuality)}</Detail>
        </dl>
      </Panel>
    </>
  );
}
