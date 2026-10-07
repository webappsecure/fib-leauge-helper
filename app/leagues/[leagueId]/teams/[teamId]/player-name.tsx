"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { NameResult } from "./actions";

const smallButton = `${buttonClass.secondary} h-6 shrink-0 px-2 py-0`;

// A player's name with its editor. The server decides whether a name is
// allowed; this only shows the answer.
export function PlayerName({
  slot,
  name,
  rename,
  random,
}: {
  slot: string;
  name: string | null;
  rename: (name: string) => Promise<NameResult>;
  random: () => Promise<NameResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const errorId = useId();

  // Focus follows the editor: into the text box when it opens, back to the
  // Rename button when it closes.
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      renameButton.current?.focus();
    }
  }, [editing]);

  function open() {
    setValue(name ?? "");
    setError(null);
    setEditing(true);
  }

  function close() {
    returnFocus.current = true;
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await rename(value);
      if (result.ok) close();
      else setError(result.error);
    });
  }

  function drawRandom() {
    setError(null);
    startSaving(async () => {
      const result = await random();
      // The editor stays open so another name can be drawn straight away.
      if (result.ok) setValue(result.name);
      else setError(result.error);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {name ?? <span className="font-normal text-faint">Unnamed</span>}
        <button
          ref={renameButton}
          type="button"
          onClick={open}
          aria-label={`Rename ${slot} ${name ?? "unnamed player"}`}
          className={`${smallButton} font-normal`}
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        // Not while a request is running: its answer must still be shown.
        if (event.key === "Escape" && !saving) close();
      }}
      className="py-0.5 font-normal"
    >
      <div className="flex flex-wrap items-center gap-1">
        <input
          ref={input}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          readOnly={saving}
          aria-label={`Name for ${slot}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          className="h-6 w-44 rounded-ui border border-border bg-surface px-1.5 text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger aria-invalid:bg-danger-bg"
        />
        <button type="submit" disabled={saving} className={smallButton}>
          Save
        </button>
        <button type="button" onClick={drawRandom} disabled={saving} className={smallButton}>
          Random name
        </button>
        <button type="button" onClick={close} disabled={saving} className={smallButton}>
          Cancel
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-0.5 text-xs whitespace-normal text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
