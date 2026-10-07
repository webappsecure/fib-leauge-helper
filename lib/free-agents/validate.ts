// The upper limit bounds what one request can create; the handbook suggests
// two or three free agents at each position.
export const PER_POSITION_LIMITS = { min: 1, max: 10, default: 2 } as const;

export const PER_POSITION_ERROR = `Enter a whole number from ${PER_POSITION_LIMITS.min} to ${PER_POSITION_LIMITS.max}.`;

export type PerPositionValidation =
  | { ok: true; value: number }
  | { ok: false; error: string };

// How many free agents each position should have, as typed into the form.
export function parsePerPosition(raw: unknown): PerPositionValidation {
  const text = typeof raw === "string" ? raw.trim() : "";
  const value = /^\d{1,3}$/.test(text) ? Number(text) : null;
  if (
    value === null ||
    value < PER_POSITION_LIMITS.min ||
    value > PER_POSITION_LIMITS.max
  ) {
    return { ok: false, error: PER_POSITION_ERROR };
  }
  return { ok: true, value };
}
