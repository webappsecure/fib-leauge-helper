"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { GenerateLeagueResult } from "./actions";

function summary(result: Extract<GenerateLeagueResult, { ok: true }>) {
  if (result.players === 0) return "Every team already has its players.";
  return `Generated ${result.players} players for ${result.teams} ${
    result.teams === 1 ? "team" : "teams"
  }.`;
}

export function GenerateLeagueButton({
  action,
}: {
  action: () => Promise<GenerateLeagueResult>;
}) {
  const [generating, startGenerating] = useTransition();
  const [result, setResult] = useState<GenerateLeagueResult | null>(null);

  function generate() {
    setResult(null);
    startGenerating(async () => {
      setResult(await action());
    });
  }

  return (
    <>
      {/* Always mounted: a status region is only announced reliably when it
          exists before its text arrives. */}
      <p role="status" className="text-sm text-muted">
        {result?.ok ? summary(result) : ""}
      </p>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-danger">
          {result.error}
        </p>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className={buttonClass.secondary}
      >
        {generating ? "Generating" : "Generate league"}
      </button>
    </>
  );
}
