import type { PlayerRoll } from "@/lib/data";

// The dice behind a rolled value, shown beside it unless dice are hidden. A
// value that took two rolls, such as an archetype with an Elite check, shows
// both in order.
export function Dice({
  rolls,
  attributes,
}: {
  rolls: PlayerRoll[];
  attributes: PlayerRoll["attribute"][];
}) {
  const dice = attributes.flatMap(
    (attribute) => rolls.find((roll) => roll.attribute === attribute)?.dice ?? [],
  );
  if (dice.length === 0) return null;
  return (
    <span className="ml-1 font-mono text-xs text-faint dice-hidden:hidden">
      <span className="sr-only">rolled </span>
      {dice.join(", ")}
    </span>
  );
}
