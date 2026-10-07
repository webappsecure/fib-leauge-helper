"use client";

import { useEffect, type RefObject } from "react";

const inputClass =
  "h-7 w-full rounded-ui border border-border bg-surface px-1.5 text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger aria-invalid:bg-danger-bg";

// One labelled text box of a league form, with its error tied to it.
export function LeagueTextField({
  name,
  label,
  defaultValue,
  error,
  numeric = false,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-muted">
        {label}
      </label>
      <input
        type="text"
        inputMode={numeric ? "numeric" : undefined}
        autoComplete="off"
        id={name}
        name={name}
        defaultValue={defaultValue}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// After each submit, moves focus to the first field that came back invalid.
// `fields` is in the order the form shows them.
export function useFocusFirstInvalid<Field extends string>(
  form: RefObject<HTMLFormElement | null>,
  fields: readonly Field[],
  state: { errors: Partial<Record<Field, string>> },
) {
  useEffect(() => {
    const firstInvalid = fields.find((field) => state.errors[field]);
    if (firstInvalid) {
      form.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
    }
  }, [form, fields, state]);
}
