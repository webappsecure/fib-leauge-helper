export type RandomSource = () => number;

// `random` returns a number in [0, 1), like Math.random. Tests pass a fixed one.
export function rollDie(sides: number, random: RandomSource = Math.random) {
  return Math.min(sides, Math.floor(random() * sides) + 1);
}

// The 36 results of a tens die and a ones die, 11 to 66, in order.
export const D66_RESULTS: readonly number[] = [1, 2, 3, 4, 5, 6].flatMap(
  (tens) => [1, 2, 3, 4, 5, 6].map((ones) => tens * 10 + ones),
);

// Handbook 1.6: the first die is the tens digit, the second the ones digit.
export function rollD66(random: RandomSource = Math.random) {
  return rollDie(6, random) * 10 + rollDie(6, random);
}

// A range such as 35-42 covers the d66 results in order: 35, 36, 41, 42.
export type D66Row<T> = { low: number; high: number; value: T };

export function lookupD66<T>(table: readonly D66Row<T>[], roll: number): T {
  const row = D66_RESULTS.includes(roll)
    ? table.find((entry) => roll >= entry.low && roll <= entry.high)
    : undefined;
  if (!row) {
    throw new RangeError("A d66 roll must be two dice read as 11 to 66.");
  }
  return row.value;
}
