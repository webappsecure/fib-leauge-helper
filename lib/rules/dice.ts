export type RandomSource = () => number;

// `random` returns a number in [0, 1), like Math.random. Tests pass a fixed one.
export function rollDie(sides: number, random: RandomSource = Math.random) {
  return Math.min(sides, Math.floor(random() * sides) + 1);
}
