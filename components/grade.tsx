import type { Grade } from "@/lib/rules/grades";

// Written out in full so Tailwind can see every class name.
const gradeClass: Record<Grade, string> = {
  "A+": "bg-grade-aplus-bg text-grade-aplus-ink",
  A: "bg-grade-a-bg text-grade-a-ink",
  "B+": "bg-grade-bplus-bg text-grade-bplus-ink",
  B: "bg-grade-b-bg text-grade-b-ink",
  C: "bg-grade-c-bg text-grade-c-ink",
  D: "bg-grade-d-bg text-grade-d-ink",
  F: "bg-grade-f-bg text-grade-f-ink",
};

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className={`inline-block min-w-7 rounded-ui px-1 text-center font-mono text-sm font-semibold ${gradeClass[grade]}`}
    >
      {grade}
    </span>
  );
}
