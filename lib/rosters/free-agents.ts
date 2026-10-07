import { addFreeAgents, countFreeAgentsByPosition } from "../data";
import type { Database } from "../data/db";
import type { RandomSource } from "../rules/dice";
import {
  FREE_AGENT_POSITIONS,
  isPitcherRole,
  rollFreeAgentPitcher,
  rollFreeAgentPositionPlayer,
} from "../rules/free-agents";
import { withNames } from "./generate";
import { usedNameIds } from "./name-pool";

// Server-side only: this pulls in the 5,000-name list.

// Tops the league's free agent pool up to `perPosition` at every position,
// leaving the free agents already there alone. Returns how many were created.
export async function generateFreeAgents(
  leagueId: number,
  perPosition: number,
  random: RandomSource = Math.random,
  database?: Database,
): Promise<number> {
  const counts = await countFreeAgentsByPosition(leagueId, database);
  const rolled = FREE_AGENT_POSITIONS.flatMap((position) =>
    Array.from(
      { length: Math.max(0, perPosition - (counts.get(position) ?? 0)) },
      () =>
        isPitcherRole(position)
          ? { kind: "pitcher" as const, rolled: rollFreeAgentPitcher(position, random) }
          : {
              kind: "position" as const,
              rolled: rollFreeAgentPositionPlayer(position, random),
            },
    ),
  );
  if (rolled.length === 0) return 0;

  const used = await usedNameIds(leagueId, database);
  const { created } = await addFreeAgents(
    leagueId,
    perPosition,
    withNames(rolled, used, random),
    database,
  );
  return created;
}
