"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { buttonClass } from "@/components/ui";
import { LeagueTextField, useFocusFirstInvalid } from "../league-fields";
import { createLeagueAction, type LeagueFormState } from "./actions";

const fields = ["name", "startYear", "teamCount"] as const;

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

  useFocusFirstInvalid(formRef, fields, state);

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

      <LeagueTextField
        name="name"
        label="League name"
        defaultValue={state.values.name}
        error={state.errors.name}
      />
      <LeagueTextField
        name="startYear"
        label="Starting year"
        defaultValue={state.values.startYear}
        error={state.errors.startYear}
        numeric
      />
      <LeagueTextField
        name="teamCount"
        label="Number of teams"
        defaultValue={state.values.teamCount}
        error={state.errors.teamCount}
        numeric
      />

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
