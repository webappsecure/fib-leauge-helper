import type { ReactNode } from "react";
import { GradeBadge } from "@/components/grade";
import { QualityBadge } from "@/components/quality";
import { Panel } from "@/components/ui";
import type { BullpenQualities, TeamQualities, TeamQuality } from "@/lib/rules/qualities";

type Detail = { available: true; working: string } | { available: false; reason: string };

function Quality({
  name,
  badge,
  detail,
}: {
  name: string;
  badge: ReactNode;
  detail: Detail;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 border-b border-border py-1.5 last:border-b-0">
      <dt className="font-semibold">{name}</dt>
      <dd>{badge ?? <span className="text-faint">Not yet</span>}</dd>
      {detail.available ? (
        // The sum behind the quality hides with the dice.
        <dd className="col-span-2 font-mono text-xs text-muted dice-hidden:hidden">
          {detail.working}
        </dd>
      ) : (
        // Why there is no quality yet is not a calculation, so it stays.
        <dd className="col-span-2 font-mono text-xs text-muted">{detail.reason}</dd>
      )}
    </div>
  );
}

function badgeFor(quality: TeamQuality) {
  return quality.available ? (
    <QualityBadge tone={quality.tone} label={quality.label} />
  ) : null;
}

// The five qualities from handbook section 3, each with the sum behind it.
export function TeamQualitiesPanel({
  team,
  bullpen,
}: {
  team: TeamQualities;
  bullpen: BullpenQualities;
}) {
  return (
    <Panel title="Team qualities">
      <dl className="px-3 py-1.5">
        <Quality name="Scoring" badge={badgeFor(team.scoring)} detail={team.scoring} />
        <Quality name="Power" badge={badgeFor(team.power)} detail={team.power} />
        <Quality name="Defense" badge={badgeFor(team.defense)} detail={team.defense} />
        <Quality
          name="Bullpen grade"
          badge={bullpen.grade.available ? <GradeBadge grade={bullpen.grade.grade} /> : null}
          detail={bullpen.grade}
        />
        <Quality
          name="Bullpen HR tendency"
          badge={badgeFor(bullpen.hrTendency)}
          detail={bullpen.hrTendency}
        />
      </dl>
    </Panel>
  );
}
