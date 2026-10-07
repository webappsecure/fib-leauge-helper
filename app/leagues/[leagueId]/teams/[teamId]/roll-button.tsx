"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { RollResult } from "./actions";

export function RollButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<RollResult>;
}) {
  const [rolling, startRolling] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function roll() {
    setError(null);
    startRolling(async () => {
      const result = await action();
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
        {rolling ? "Rolling" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
