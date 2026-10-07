"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { DeleteLeagueResult } from "./actions";

const count = (total: number, word: string) => `${total} ${word}${total === 1 ? "" : "s"}`;

// Deleting takes two presses: the first only shows what will be lost.
export function DeleteLeague({
  leagueName,
  teamCount,
  playerCount,
  action,
}: {
  leagueName: string;
  teamCount: number;
  playerCount: number;
  action: () => Promise<DeleteLeagueResult>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // Focus lands on Cancel, so a stray Enter cannot delete the league.
  useEffect(() => {
    if (confirming) {
      cancelButton.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      deleteButton.current?.focus();
    }
  }, [confirming]);

  function cancel() {
    returnFocus.current = true;
    setError(null);
    setConfirming(false);
  }

  function confirm() {
    setError(null);
    startDeleting(async () => {
      // A successful delete redirects, so anything returned is a refusal.
      const result = await action();
      if (result) setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <div className="grid justify-items-start gap-2 p-3">
        <p className="text-muted">
          Deleting a league removes its teams, players and rolls for good.
        </p>
        <button
          ref={deleteButton}
          type="button"
          onClick={() => setConfirming(true)}
          className={buttonClass.secondary}
        >
          Delete league
        </button>
      </div>
    );
  }

  return (
    <div role="group" aria-label="Confirm deleting this league" className="grid justify-items-start gap-2 p-3">
      <p className="font-semibold wrap-anywhere">
        Delete {leagueName}? Its {count(teamCount, "team")} and{" "}
        {count(playerCount, "player")}, with every roll, will be removed for good.
        This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={cancelButton}
          type="button"
          onClick={cancel}
          disabled={deleting}
          className={buttonClass.secondary}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={deleting}
          className={buttonClass.danger}
        >
          {deleting ? "Deleting" : "Yes, delete this league"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
