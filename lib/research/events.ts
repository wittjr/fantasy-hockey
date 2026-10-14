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
  uniqueShifts,
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
  /** Shift-chart versus situationCode agreement for this game, both teams (D-16). */
  quality: { checked: number; matched: number };
  /** D-23: the shift chart looks corrupted (foreign-team rows or many repeated rows); counts are still shown, with a warning. */
  chartSuspect: boolean;
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
    quality: { checked: 0, matched: 0 },
    chartSuspect: false,
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

/**
 * Share of events that must agree with play-by-play situationCode before a game is trusted (D-17).
 * Starting value; measured good games match 98.9-100% (research), so 95% only fires on a real
 * disagreement such as a missing period. Do not lower it to make a fixture pass.
 */
export const EVENT_MATCH_THRESHOLD = 0.95;

/**
 * Counts events whose shift-derived on-ice state (goalie flag and skater count per team) agrees with the
 * event's situationCode. Shootout and penalty-shot events are skipped (expected mismatches, D-17); an event
 * with no shift data at its second is checked and not matched.
 */
export function matchQuality(
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
  events: readonly GameEvent[],
  teams: { home: string; away: string },
): { checked: number; matched: number } {
  const buckets = bucketOnIce(shifts, positions);
  let checked = 0;
  let matched = 0;
  for (const event of events) {
    if (event.exclusion === "shootout" || event.exclusion === "penalty-shot" || event.situationCode.length !== 4) continue;
    checked++;
    const byTeam = onIceAt(buckets, event.period, event.t);
    if (!byTeam) continue;
    const away = dedupeOnIce(byTeam.get(teams.away) ?? NO_ONE);
    const home = dedupeOnIce(byTeam.get(teams.home) ?? NO_ONE);
    const [awayGoalie, awaySkaters, homeSkaters, homeGoalie] = event.situationCode;
    if (
      awayGoalie === (away.goalie ? "1" : "0") &&
      awaySkaters === String(away.skaters.length) &&
      homeSkaters === String(home.skaters.length) &&
      homeGoalie === (home.goalie ? "1" : "0")
    ) {
      matched++;
    }
  }
  return { checked, matched };
}

/** matched / checked, or null when nothing was checked. */
export function matchRatio(q: { checked: number; matched: number }): number | null {
  return q.checked === 0 ? null : q.matched / q.checked;
}

/** True when the game's shift chart disagrees with situationCode more than EVENT_MATCH_THRESHOLD allows. */
export function matchIsLow(q: { checked: number; matched: number }): boolean {
  const ratio = matchRatio(q);
  return ratio !== null && ratio < EVENT_MATCH_THRESHOLD;
}

/**
 * Largest share of repeated shift rows (repeated rows / all rows) a trustworthy chart may have (D-23).
 * Measured: the six gate fixtures repeat 0% of rows (2026020075 repeats 3 of 756, 0.4%); the corrupted
 * chart 2025020565 repeats 750 of 2,166 (34.6%) and also lists VGK and SJS players. 5% sits between them.
 */
export const MAX_REPEATED_SHIFT_SHARE = 0.05;

/**
 * D-23: true when the chart lists a team that is not in the game, or repeats identical rows beyond
 * MAX_REPEATED_SHIFT_SHARE. Takes the raw list, before bucketOnIce drops ids it has no position for.
 */
export function isShiftChartSuspect(shifts: readonly ShiftInput[], teams: { home: string; away: string }): boolean {
  if (shifts.length === 0) return false;
  if (shifts.some((s) => s.team !== teams.home && s.team !== teams.away)) return true;
  return (shifts.length - uniqueShifts(shifts).length) / shifts.length > MAX_REPEATED_SHIFT_SHARE;
}

/** Events for `team`, or null when the shift chart or play-by-play is missing: unknown, never zeros. */
export function buildGameEvents(
  team: string,
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
  pbp: NhlPlayByPlay | null,
): GameEvents | null {
  if (shifts.length === 0 || !pbp || pbp.plays.length === 0) return null;
  const events = toGameEvents(pbp);
  const teams = { home: pbp.homeTeam.abbrev, away: pbp.awayTeam.abbrev };
  return {
    ...attributeEvents(team, shifts, positions, events),
    quality: matchQuality(shifts, positions, events, teams),
    chartSuspect: isShiftChartSuspect(shifts, teams),
  };
}
