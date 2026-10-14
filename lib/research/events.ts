// A second consumer of the same on-ice timeline and strength rule as analyzeGameLines:
// each shot or goal is credited to the situation and units on ice at its second.
import {
  bucketOnIce,
  creditsUnit,
  dedupeOnIce,
  PERIOD_SECONDS,
  situationFor,
  unitKey,
  type OnIce,
  type PositionGroup,
  type ShiftInput,
  type Situation,
} from "./lines";
import { toGameEvents, type GameEvent } from "./play-events";
import type { NhlPlayByPlay } from "@/lib/nhl/client";

export interface EventCounts {
  gf: number;
  ga: number;
  sf: number;
  sa: number;
  cf: number;
  ca: number;
}

export function emptyCounts(): EventCounts {
  return { gf: 0, ga: 0, sf: 0, sa: 0, cf: 0, ca: 0 };
}

export interface GameEvents {
  /** Every included event per situation for the team: listed units plus Other. */
  total: Record<Situation, EventCounts>;
  /** Events on a unit key that creditsUnit allowed, before any time or cap filter. */
  byUnit: Record<Situation, { F: Map<string, EventCounts>; D: Map<string, EventCounts> }>;
  /** Game-wide counts of events left out of every count, both teams. */
  excluded: { shootout: number; penaltyShot: number; teammateBlocked: number };
  /** Included events whose second had no shift data for the team; they are in no table. */
  unattributed: number;
}

const NO_ONE: OnIce = { skaters: [], goalie: false };

/** Skaters on ice for an event at elapsed second `t`: the second [t-1, t), i.e. shifts with start < t <= end. */
export function onIceAt(buckets: Map<number, Map<string, OnIce>>, period: number, t: number) {
  // 00:00 would otherwise read the previous period's last second.
  if (t <= 0) return undefined;
  return buckets.get((period - 1) * PERIOD_SECONDS + t - 1);
}

// SF = goal + shot-on-goal; CF = all four kinds; GF = goal. Direction comes from the shooter's team.
function add(counts: EventCounts, event: GameEvent, own: boolean) {
  const isGoal = event.kind === "goal";
  const isShot = isGoal || event.kind === "shot-on-goal";
  if (own) {
    counts.cf++;
    if (isShot) counts.sf++;
    if (isGoal) counts.gf++;
  } else {
    counts.ca++;
    if (isShot) counts.sa++;
    if (isGoal) counts.ga++;
  }
}

/** Credits each event to `team`'s situation total and, when creditsUnit allows, to its forward and defense units. */
export function attributeEvents(
  team: string,
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
  events: readonly GameEvent[],
): GameEvents {
  const buckets = bucketOnIce(shifts, positions);
  const result: GameEvents = {
    total: { ev: emptyCounts(), pp: emptyCounts(), sh: emptyCounts() },
    byUnit: {
      ev: { F: new Map(), D: new Map() },
      pp: { F: new Map(), D: new Map() },
      sh: { F: new Map(), D: new Map() },
    },
    excluded: { shootout: 0, penaltyShot: 0, teammateBlocked: 0 },
    unattributed: 0,
  };

  for (const event of events) {
    if (event.exclusion === "shootout") result.excluded.shootout++;
    else if (event.exclusion === "penalty-shot") result.excluded.penaltyShot++;
    else if (event.exclusion === "teammate-blocked") result.excluded.teammateBlocked++;
    if (event.exclusion) continue;

    const byTeam = onIceAt(buckets, event.period, event.t);
    const rawMine = byTeam?.get(team);
    if (!byTeam || !rawMine || rawMine.skaters.length === 0) {
      result.unattributed++;
      continue;
    }
    const mine = dedupeOnIce(rawMine);
    const opp = dedupeOnIce([...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? NO_ONE);
    const situation = situationFor(mine, opp);
    const own = event.team === team;

    add(result.total[situation], event, own);
    if (event.pulledGoalie || !creditsUnit(situation, mine, opp)) continue;
    for (const group of ["F", "D"] as const) {
      const key = unitKey(situation, group, mine.skaters, positions);
      if (key === null) continue;
      const map = result.byUnit[situation][group];
      let counts = map.get(key);
      if (!counts) map.set(key, (counts = emptyCounts()));
      add(counts, event, own);
    }
  }
  return result;
}

/** Events for `team`, or null when the shift chart or play-by-play is missing: unknown, never zeros. */
export function buildGameEvents(
  team: string,
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
  pbp: NhlPlayByPlay | null,
): GameEvents | null {
  if (shifts.length === 0 || !pbp || pbp.plays.length === 0) return null;
  return attributeEvents(team, shifts, positions, toGameEvents(pbp));
}
