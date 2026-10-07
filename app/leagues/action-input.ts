// Checks shared by the league server actions. Everything a browser sends is
// unknown until one of these has looked at it.

export const LEAGUE_NOT_FOUND =
  "This league could not be found. Go back to the league list and open it again.";

// A database id: a positive whole number, sent as a number.
export function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

// A form field as text; a missing field or an uploaded file reads as blank.
export function formText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}
