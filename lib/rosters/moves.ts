import {
  listLeaguePlayerPlaces,
  listTeams,
  swapPlayers,
  type LeaguePlayerPlace,
  type SwapResult,
} from "../data";
import type { Database } from "../data/db";
import { FREE_AGENT_POSITIONS } from "../rules/free-agents";
import { moveProblem, naturalMarker } from "../rules/moves";
import {
  orderStarters,
  PITCHER_SLOTS,
  STARTER_SLOTS,
  type HrTendency,
  type PitcherSlot,
} from "../rules/pitchers";
import type { Grade } from "../rules/grades";
import { LINEUP_SLOTS, type LineupSlot } from "../rules/positions";

export type MoveTarget = { id: number; label: string };
export type MoveTargetGroup = { label: string; targets: MoveTarget[] };

const ROSTER_ORDER: readonly string[] = [...PITCHER_SLOTS, ...LINEUP_SLOTS];
const POOL_ORDER: readonly string[] = FREE_AGENT_POSITIONS;

type Starter = LeaguePlayerPlace & {
  slot: PitcherSlot;
  grade: Grade;
  hrTendency: HrTendency;
};

// The slot each starter is shown in on their own team sheet. The sheet ranks
// starters best first whatever slots are saved, and a team rolled before
// starters were kept in order can have saved slots that differ, so the list
// of targets ranks them the same way.
function shownStarterSlots(places: LeaguePlayerPlace[]) {
  const starters = places.filter(
    (place): place is Starter =>
      place.kind === "pitcher" && place.naturalPosition === "SP" && place.teamId !== null,
  );
  const shown = new Map<number, PitcherSlot>();
  for (const team of Map.groupBy(starters, (starter) => starter.teamId).values()) {
    const saved = team.sort(
      (a, b) => STARTER_SLOTS.indexOf(a.slot) - STARTER_SLOTS.indexOf(b.slot),
    );
    for (const [index, starter] of orderStarters(saved).entries()) {
      shown.set(starter.id, STARTER_SLOTS[index] ?? starter.slot);
    }
  }
  return shown;
}

const nameOf = (place: LeaguePlayerPlace) => place.name ?? "Unnamed";

// Everyone the player may legally swap with: teammates first, then free
// agents, then each other team in number order. Returns null when the player
// is not on that team.
export async function listMoveTargets(
  leagueId: number,
  teamId: number,
  playerId: number,
  database?: Database,
): Promise<MoveTargetGroup[] | null> {
  const places = await listLeaguePlayerPlaces(leagueId, database);
  const player = places.find((place) => place.id === playerId && place.teamId === teamId);
  if (!player) return null;

  const starterSlots = shownStarterSlots(places);
  // The slot a player is shown in, or null for a free agent.
  const shownSlot = (place: LeaguePlayerPlace) => starterSlots.get(place.id) ?? place.slot;
  // Where a player sorts within their team, or within the pool.
  const order = (place: LeaguePlayerPlace) => {
    const slot = shownSlot(place);
    const list = slot === null ? POOL_ORDER : ROSTER_ORDER;
    const index = list.indexOf(slot ?? place.naturalPosition);
    return index === -1 ? list.length : index;
  };
  const targetLabel = (place: LeaguePlayerPlace) => {
    const marker =
      place.kind === "position" && place.slot !== null
        ? naturalMarker(place.naturalPosition, place.slot as LineupSlot)
        : null;
    return `${shownSlot(place) ?? place.naturalPosition}  ${nameOf(place)}${
      marker ? ` (${marker})` : ""
    }`;
  };

  const legal = places
    .filter((place) => moveProblem(player, place) === null)
    .sort((a, b) => order(a) - order(b) || a.id - b.id);
  const group = (label: string, groupTeamId: number | null): MoveTargetGroup => ({
    label,
    targets: legal
      .filter((place) => place.teamId === groupTeamId)
      .map((place) => ({ id: place.id, label: targetLabel(place) })),
  });

  const teams = await listTeams(leagueId, database);
  return [
    group("This team", teamId),
    group("Free agents", null),
    ...teams
      .filter((team) => team.id !== teamId)
      .map((team) => group(`Team ${team.number}${team.city ? ` ${team.city}` : ""}`, team.id)),
  ].filter((entry) => entry.targets.length > 0);
}

export type SwapOutcome =
  | { ok: true; message: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "refused"; error: string };

type Refusal = Extract<SwapResult, { ok: false }>["problem"];

// Says why a swap was refused, naming the players.
function describeProblem(
  problem: Exclude<Refusal, { reason: "not-found" }>,
  player: LeaguePlayerPlace,
  target: LeaguePlayerPlace,
) {
  switch (problem.reason) {
    case "cannot-fill": {
      const who = problem.playerId === player.id ? player : target;
      return `${nameOf(who)} is a natural ${problem.naturalPosition} and cannot play ${problem.slot}.`;
    }
    case "different-roles":
      return `${nameOf(player)} (${player.naturalPosition}) and ${nameOf(target)} (${target.naturalPosition}) have different roles. Pitchers can only swap within their role.`;
    case "different-kinds":
      return "A pitcher and a position player cannot be swapped.";
    case "same-team-starters":
      return "Starting pitchers on one team are kept in order automatically, best first, so they cannot be swapped.";
    default:
      return "Those two players cannot be swapped.";
  }
}

// Swaps a player on the team with another player in the league. The data
// layer checks the move again on the rows as they are when it saves.
export async function swapTeamPlayer(
  leagueId: number,
  teamId: number,
  playerId: number,
  targetId: number,
  database?: Database,
): Promise<SwapOutcome> {
  const places = await listLeaguePlayerPlaces(leagueId, database);
  const player = places.find((place) => place.id === playerId && place.teamId === teamId);
  const target = places.find((place) => place.id === targetId);
  if (!player || !target) return { ok: false, reason: "not-found" };

  const result = await swapPlayers(leagueId, player.id, target.id, database);
  if (result.ok) return { ok: true, message: `Swapped with ${nameOf(target)}.` };
  if (result.problem.reason === "not-found") return { ok: false, reason: "not-found" };
  return {
    ok: false,
    reason: "refused",
    error: describeProblem(result.problem, player, target),
  };
}
