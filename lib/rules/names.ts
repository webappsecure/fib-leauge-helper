import { rollDie, type RandomSource } from "./dice";
import { NAME_LIST, type NameEntry } from "./name-list";

// Import this from server code only, so the 5,000 names stay out of the
// browser bundle.

// Picks one entry at random from those whose id is not in `used`. Returns
// null without rolling when every name is used.
export function pickName(
  used: ReadonlySet<number>,
  random: RandomSource = Math.random,
): NameEntry | null {
  const unused = NAME_LIST.filter((entry) => !used.has(entry.id));
  if (unused.length === 0) return null;
  return unused[rollDie(unused.length, random) - 1];
}

// The form two names are compared in: capitals, leading and trailing spaces
// and extra spaces between words do not make a different name. Blank gives
// an empty key. Every name comparison in the app goes through this.
export function nameKey(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

let idsByKey: Map<string, number> | undefined;

// The list id to store for a name, or null when the name is not on the list.
// No name appears on the list twice, so a name has at most one id.
export function nameIdFor(name: string | null | undefined): number | null {
  idsByKey ??= new Map(NAME_LIST.map((entry) => [nameKey(entry.fullName), entry.id]));
  return idsByKey.get(nameKey(name)) ?? null;
}
