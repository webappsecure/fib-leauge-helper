import type { QualityTone } from "@/lib/rules/qualities";

// Written out in full so Tailwind can see every class name.
const toneClass: Record<QualityTone, string> = {
  high: "bg-quality-high-bg text-quality-high-ink font-bold",
  "semi-high": "bg-quality-semi-high-bg text-quality-semi-high-ink font-bold",
  neutral: "bg-quality-neutral-bg text-quality-neutral-ink",
  "semi-low": "bg-quality-semi-low-bg text-quality-semi-low-ink font-bold",
  low: "bg-quality-low-bg text-quality-low-ink font-bold",
};

// A team or bullpen quality. The label always carries the meaning, bullet
// included; the colour only repeats it.
export function QualityBadge({ tone, label }: { tone: QualityTone; label: string }) {
  return (
    <span
      className={`inline-block rounded-ui px-1.5 text-xs leading-5 tracking-wide ${toneClass[tone]}`}
    >
      {label}
    </span>
  );
}
