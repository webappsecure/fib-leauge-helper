"use client";

import { useActionState, useRef } from "react";
import { buttonClass } from "@/components/ui";
import { LeagueTextField, useFocusFirstInvalid } from "../../league-fields";
import type { LeagueSettingsState } from "./actions";

const fields = ["name", "startYear"] as const;

export function SettingsForm({
  name,
  startYear,
  action,
}: {
  name: string;
  startYear: number;
  action: (
    previous: LeagueSettingsState,
    formData: FormData,
  ) => Promise<LeagueSettingsState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: { name, startYear: String(startYear) },
    errors: {},
    saved: false,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const hasFieldErrors = fields.some((field) => state.errors[field]);
  useFocusFirstInvalid(formRef, fields, state);

  return (
    <form ref={formRef} action={formAction} noValidate className="grid max-w-md gap-3 p-3">
      {hasFieldErrors || state.errors.form ? (
        <p role="alert" className="text-sm text-danger">
          {state.errors.form ?? "Fix the highlighted fields and try again."}
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

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Saving" : "Save"}
        </button>
        {/* Always mounted so screen readers announce the text when it changes. */}
        <span role="status" className="text-sm text-muted">
          {state.saved && !pending ? "Saved." : ""}
        </span>
      </div>
    </form>
  );
}
