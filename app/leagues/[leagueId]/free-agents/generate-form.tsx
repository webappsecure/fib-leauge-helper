"use client";

import { useId, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { GenerateFreeAgentsResult } from "./actions";

function summary({ created, perPosition }: Extract<GenerateFreeAgentsResult, { ok: true }>) {
  if (created === 0) {
    return `Every position already has ${perPosition} or more free agents.`;
  }
  return `Added ${created} ${created === 1 ? "free agent" : "free agents"}.`;
}

// Asks how many free agents each position should have and tops the pool up
// to that number. The server checks the number; this only shows the answer.
export function GenerateForm({
  min,
  max,
  defaultValue,
  action,
}: {
  min: number;
  max: number;
  defaultValue: number;
  action: (formData: FormData) => Promise<GenerateFreeAgentsResult>;
}) {
  const [generating, startGenerating] = useTransition();
  const [result, setResult] = useState<GenerateFreeAgentsResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const error = result && !result.ok ? result.error : null;

  function generate(formData: FormData) {
    setResult(null);
    startGenerating(async () => {
      const answer = await action(formData);
      setResult(answer);
      if (!answer.ok) input.current?.focus();
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        generate(new FormData(event.currentTarget));
      }}
      className="grid gap-1 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-muted">
          Free agents per position
        </label>
        <input
          ref={input}
          id={inputId}
          name="perPosition"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          defaultValue={defaultValue}
          readOnly={generating}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-7 w-16 rounded-ui border border-border bg-surface px-1.5 font-mono text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger aria-invalid:bg-danger-bg"
        />
        <button type="submit" disabled={generating} className={buttonClass.primary}>
          {generating ? "Generating" : "Generate"}
        </button>
        {/* Always mounted: a status region is only announced reliably when it
            exists before its text arrives. */}
        <span role="status" className="text-sm text-muted">
          {result?.ok ? summary(result) : ""}
        </span>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
