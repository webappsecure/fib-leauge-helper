"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { GenerateLeagueResult } from "./actions";

function summary(result: GenerateLeagueResult) {
  if (!result.ok) return result.error;
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
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`text-sm ${result.ok ? "text-muted" : "text-danger"}`}
        >
          {summary(result)}
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
