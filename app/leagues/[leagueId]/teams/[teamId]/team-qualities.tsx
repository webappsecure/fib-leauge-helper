import type { ReactNode } from "react";
import { GradeBadge } from "@/components/grade";
import { QualityBadge } from "@/components/quality";
import { Panel } from "@/components/ui";
import type { BullpenQualities, TeamQualities, TeamQuality } from "@/lib/rules/qualities";

function Quality({
  name,
  badge,
  detail,
}: {
  name: string;
  badge: ReactNode;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 border-b border-border py-1.5 last:border-b-0">
      <dt className="font-semibold">{name}</dt>
      <dd>{badge ?? <span className="text-faint">Not yet</span>}</dd>
      <dd className="col-span-2 font-mono text-xs text-muted">{detail}</dd>
    </div>
  );
}

function badgeFor(quality: TeamQuality) {
  return quality.available ? (
    <QualityBadge tone={quality.tone} label={quality.label} />
  ) : null;
}

const detailFor = (quality: { available: true; working: string } | { available: false; reason: string }) =>
  quality.available ? quality.working : quality.reason;

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
        <Quality name="Scoring" badge={badgeFor(team.scoring)} detail={detailFor(team.scoring)} />
        <Quality name="Power" badge={badgeFor(team.power)} detail={detailFor(team.power)} />
        <Quality name="Defense" badge={badgeFor(team.defense)} detail={detailFor(team.defense)} />
        <Quality
          name="Bullpen grade"
          badge={bullpen.grade.available ? <GradeBadge grade={bullpen.grade.grade} /> : null}
          detail={detailFor(bullpen.grade)}
        />
        <Quality
          name="Bullpen HR tendency"
          badge={badgeFor(bullpen.hrTendency)}
          detail={detailFor(bullpen.hrTendency)}
        />
      </dl>
    </Panel>
  );
}
