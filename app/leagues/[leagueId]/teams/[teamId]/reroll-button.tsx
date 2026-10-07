"use client";

import { useEffect, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { RollResult } from "./actions";

// Rolls one player's values again. There is no confirmation: the point is to
// press it as often as it takes.
export function RerollButton({
  playerId,
  player,
  action,
}: {
  playerId: number;
  player: string;
  action: () => Promise<RollResult>;
}) {
  const [rolling, startRolling] = useTransition();
  const [outcome, setOutcome] = useState<RollResult | null>(null);

  // The row keeps this button when a re-roll or a swap changes who is in it,
  // so focus and the "Re-rolled" note survive a change in the starter order.
  // An error is about the player who was here, so it goes when they do.
  const [shownFor, setShownFor] = useState(playerId);
  if (shownFor !== playerId) {
    setShownFor(playerId);
    if (outcome && !outcome.ok) setOutcome(null);
  }

  // The note is cleared after a moment so it cannot sit beside values that a
  // later whole-team re-roll has since replaced.
  useEffect(() => {
    if (!outcome?.ok) return;
    const timer = setTimeout(() => setOutcome(null), 4000);
    return () => clearTimeout(timer);
  }, [outcome]);

  function reroll() {
    setOutcome(null);
    startRolling(async () => {
      setOutcome(await action());
    });
  }

  const label = rolling ? "Rolling" : "Re-roll";

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Always mounted so screen readers announce the text when it changes. */}
      <span role="status" className="text-xs text-faint">
        {outcome?.ok ? "Re-rolled" : ""}
      </span>
      {outcome && !outcome.ok && (
        <span role="alert" className="text-xs whitespace-normal text-danger">
          {outcome.error}
        </span>
      )}
      <button
        type="button"
        onClick={reroll}
        disabled={rolling}
        aria-label={`${label} ${player}`}
        className={`${buttonClass.secondary} h-6 shrink-0 px-2 py-0`}
      >
        {label}
      </button>
    </div>
  );
}
