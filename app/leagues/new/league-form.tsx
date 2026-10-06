"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { buttonClass } from "@/components/ui";
import { createLeagueAction, type LeagueFormState } from "./actions";

const fields = ["name", "startYear", "teamCount"] as const;

const inputClass =
  "h-7 w-full rounded-ui border border-border bg-surface px-1.5 text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger aria-invalid:bg-danger-bg";

export function LeagueForm({ defaultYear }: { defaultYear: number }) {
  const initialState: LeagueFormState = {
    values: {
      name: "",
      startYear: String(defaultYear),
      teamCount: "12",
      useDh: true,
    },
    errors: {},
  };
  const [state, formAction, pending] = useActionState(
    createLeagueAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const hasErrors = Object.keys(state.errors).length > 0;

  useEffect(() => {
    const firstInvalid = fields.find((field) => state.errors[field]);
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)
        ?.focus();
    }
  }, [state]);

  function fieldProps(field: (typeof fields)[number]) {
    const error = state.errors[field];
    return {
      id: field,
      name: field,
      defaultValue: state.values[field],
      className: inputClass,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${field}-error` : undefined,
    };
  }

  function fieldError(field: (typeof fields)[number]) {
    const error = state.errors[field];
    return error ? (
      <p id={`${field}-error`} className="mt-1 text-xs text-danger">
        {error}
      </p>
    ) : null;
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="grid max-w-md gap-3 p-3"
    >
      {hasErrors ? (
        <p role="alert" className="text-sm text-danger">
          Fix the highlighted fields and try again.
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className="mb-1 block text-muted">
          League name
        </label>
        <input type="text" autoComplete="off" {...fieldProps("name")} />
        {fieldError("name")}
      </div>

      <div>
        <label htmlFor="startYear" className="mb-1 block text-muted">
          Starting year
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          {...fieldProps("startYear")}
        />
        {fieldError("startYear")}
      </div>

      <div>
        <label htmlFor="teamCount" className="mb-1 block text-muted">
          Number of teams
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          {...fieldProps("teamCount")}
        />
        {fieldError("teamCount")}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="useDh"
          defaultChecked={state.values.useDh}
          className="accent-accent"
        />
        Use the designated hitter
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Creating league" : "Create league"}
        </button>
        <Link href="/" className={buttonClass.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
