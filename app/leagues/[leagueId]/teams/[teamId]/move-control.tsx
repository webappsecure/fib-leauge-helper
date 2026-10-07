"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { MoveTargetsResult, SwapResult } from "./actions";

const smallButton = `${buttonClass.secondary} h-6 shrink-0 px-2 py-0`;

type Groups = Extract<MoveTargetsResult, { ok: true }>["groups"];

// Swaps a player with a teammate, a player on another team or a free agent.
// The server decides who the player may swap with and checks the swap again
// when it is made; this only shows the choices and the answer.
export function MoveControl({
  playerId,
  player,
  loadTargets,
  swap,
}: {
  playerId: number;
  player: string;
  loadTargets: () => Promise<MoveTargetsResult>;
  swap: (targetId: number) => Promise<SwapResult>;
}) {
  const [groups, setGroups] = useState<Groups | null>(null);
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, startLoading] = useTransition();
  const [swapping, startSwapping] = useTransition();
  const select = useRef<HTMLSelectElement>(null);
  const moveButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const selectId = useId();
  const errorId = useId();
  const open = groups !== null;

  // The row keeps this control when a swap puts another player in it, so the
  // status line can report the swap. A list or error loaded for the player
  // who left must not stay open for the one who arrived.
  const [shownFor, setShownFor] = useState(playerId);
  if (shownFor !== playerId) {
    setShownFor(playerId);
    setGroups(null);
    setError(null);
  }

  // Focus follows the control: into it when it opens, back to the Move
  // button when it closes.
  useEffect(() => {
    if (open) {
      (select.current ?? cancelButton.current)?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      moveButton.current?.focus();
    }
  }, [open]);

  // Cleared after a moment so the note cannot sit beside a row that later
  // moves have changed again.
  useEffect(() => {
    if (message === "") return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  function show() {
    setError(null);
    setMessage("");
    startLoading(async () => {
      const result = await loadTargets();
      if (result.ok) {
        // Nobody is chosen to begin with: a swap is saved at once, so it must
        // not take one press to make the first one listed.
        setTargetId("");
        setGroups(result.groups);
      } else {
        setError(result.error);
      }
    });
  }

  function close() {
    returnFocus.current = true;
    setError(null);
    setGroups(null);
  }

  function makeSwap() {
    if (targetId === "") return;
    setError(null);
    startSwapping(async () => {
      const result = await swap(Number(targetId));
      if (result.ok) {
        setMessage(result.message);
        close();
      } else {
        setError(result.error);
      }
    });
  }

  // One root for both states, with the status line always its first child:
  // a status region is only announced reliably when it stays mounted, so it
  // must not move when the control opens or closes.
  return (
    <div className="grid justify-items-end gap-0.5">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span role="status" className="text-xs text-faint">
          {message}
        </span>
        {!open ? (
          <>
            {error && (
              <span role="alert" className="text-xs whitespace-normal text-danger">
                {error}
              </span>
            )}
            <button
              ref={moveButton}
              type="button"
              onClick={show}
              disabled={loading}
              aria-label={`${loading ? "Loading moves for" : "Move"} ${player}`}
              className={smallButton}
            >
              {loading ? "Loading" : "Move"}
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              makeSwap();
            }}
            onKeyDown={(event) => {
              // Not while a swap is running: its answer must still be shown.
              if (event.key === "Escape" && !swapping) close();
            }}
            className="flex flex-wrap items-center justify-end gap-1"
          >
            {groups.length === 0 ? (
              <span className="text-xs text-muted">No one to swap with.</span>
            ) : (
              <>
                <label htmlFor={selectId} className="sr-only">
                  Swap {player} with
                </label>
                <select
                  ref={select}
                  id={selectId}
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  disabled={swapping}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-6 max-w-56 rounded-ui border border-border bg-surface px-1 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger aria-invalid:bg-danger-bg"
                >
                  <option value="" disabled>
                    Choose a player
                  </option>
                  {groups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={swapping || targetId === ""}
                  className={smallButton}
                >
                  {swapping ? "Swapping" : "Swap"}
                </button>
              </>
            )}
            <button
              ref={cancelButton}
              type="button"
              onClick={close}
              disabled={swapping}
              className={smallButton}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
      {open && error && (
        <p id={errorId} role="alert" className="text-xs whitespace-normal text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
