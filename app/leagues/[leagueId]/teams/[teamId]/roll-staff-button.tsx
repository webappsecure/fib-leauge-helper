"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { rollPitchingStaffAction } from "./actions";

export function RollStaffButton({
  leagueId,
  teamId,
}: {
  leagueId: number;
  teamId: number;
}) {
  const [rolling, startRolling] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function roll() {
    setError(null);
    startRolling(async () => {
      const result = await rollPitchingStaffAction(leagueId, teamId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={roll}
        disabled={rolling}
        className={buttonClass.primary}
      >
        {rolling ? "Rolling" : "Roll pitching staff"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
