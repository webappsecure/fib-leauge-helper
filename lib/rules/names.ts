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
