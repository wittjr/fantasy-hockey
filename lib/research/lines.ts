// Derives line combinations and situational ice time from NHL shift charts.
// Strength is inferred per second from who is on ice, so no play-by-play is needed.

export type Situation = "ev" | "pp" | "sh";
export type PositionGroup = "F" | "D" | "G";

export interface ShiftInput {
  playerId: number;
  team: string;
  period: number;
  startSec: number; // seconds elapsed in the period
  endSec: number;
}

export const REGULATION_PERIODS = 3;

/**
 * Drops verbatim-repeated shift rows, keeping the first occurrence in input order. The NHL feed
 * sometimes repeats a row (e.g. game 2026020075 has 3), so a repeat is the same shift. Only exact
 * (team, playerId, period, startSec, endSec) repeats collapse; overlapping rows that differ are left alone.
 */
export function uniqueShifts(shifts: readonly ShiftInput[]): ShiftInput[] {
  const seen = new Set<string>();
  return shifts.filter((s) => {
    const key = `${s.team}:${s.playerId}:${s.period}:${s.startSec}:${s.endSec}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Seconds each of `team`'s players was on ice in periods 1-3.
 * Equals boxscore TOI minus OT for a complete shift chart. Identical rows are dropped by `uniqueShifts`, but a player's
 * overlapping rows that are not identical are summed. The line passes (`analyzeGameLines`, `pairSeconds`) count each such
 * second once, so on an anomalous OT/SO chart this can exceed the same player's `playerSeconds` total by the overlap.
 */
export function regulationSeconds(team: string, shifts: ShiftInput[]): Map<number, number> {
  const seconds = new Map<number, number>();
  for (const shift of uniqueShifts(shifts)) {
    if (shift.team !== team || shift.period > REGULATION_PERIODS || shift.endSec <= shift.startSec) continue;
    seconds.set(shift.playerId, (seconds.get(shift.playerId) ?? 0) + shift.endSec - shift.startSec);
  }
  return seconds;
}

export interface Unit {
  playerIds: number[];
  seconds: number;
  pct: number; // share of the team's time in that situation, 0-100
}

export interface GameLines {
  situationSeconds: Record<Situation, number>;
  units: Record<Situation, { F: Unit[]; D: Unit[] }>;
  playerSeconds: Map<number, Record<Situation, number>>;
}

export const PERIOD_SECONDS = 1200;
// Ignore combos that only exist for a moment during line changes.
const MIN_UNIT_SECONDS = 10;
// EV lines must be full lines; PP/SH units vary in shape (4F+1D, 2F+2D, ...).
const EV_UNIT_SIZE = { F: 3, D: 2 } as const;

/** Parses "MM:SS" into seconds, or null if malformed. */
export function parseClock(value: string | null | undefined): number | null {
  const match = value?.match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function situationFor(team: OnIce, opp: OnIce): Situation {
  // A pulled goalie (empty net, delayed penalty) adds a skater without changing strength.
  const strength = (s: OnIce) => (s.goalie ? s.skaters.length : s.skaters.length - 1);
  const diff = strength(team) - strength(opp);
  return diff === 0 ? "ev" : diff > 0 ? "pp" : "sh";
}

export interface OnIce {
  skaters: number[];
  goalie: boolean;
}

/** One entry per player, so overlapping rows for the same player cannot inflate the skater count that decides strength. */
export function dedupeOnIce(onIce: OnIce): OnIce {
  return { skaters: [...new Set(onIce.skaters)], goalie: onIce.goalie };
}

/**
 * Every on-ice second of the game (key: seconds since the start of period 1), per team.
 * A player with overlapping rows that are not identical is listed once per row, so callers that count
 * skaters should pass each OnIce through `dedupeOnIce`.
 */
export function bucketOnIce(
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
): Map<number, Map<string, OnIce>> {
  const seconds = new Map<number, Map<string, OnIce>>();
  for (const shift of uniqueShifts(shifts)) {
    const pos = positions.get(shift.playerId);
    if (!pos || shift.endSec <= shift.startSec) continue;
    const offset = (shift.period - 1) * PERIOD_SECONDS;
    for (let s = shift.startSec; s < shift.endSec; s++) {
      const t = offset + s;
      let byTeam = seconds.get(t);
      if (!byTeam) seconds.set(t, (byTeam = new Map()));
      let onIce = byTeam.get(shift.team);
      if (!onIce) byTeam.set(shift.team, (onIce = { skaters: [], goalie: false }));
      if (pos === "G") onIce.goalie = true;
      else onIce.skaters.push(shift.playerId);
    }
  }
  return seconds;
}

/**
 * The key of the forward or defense unit among `skaters` (their ids of that group, ascending, joined with ","),
 * or null when there is none or an even-strength unit is not a full line. Shared by unit seconds and unit events
 * so both are keyed identically.
 */
export function unitKey(
  situation: Situation,
  group: "F" | "D",
  skaters: readonly number[],
  positions: Map<number, PositionGroup>,
): string | null {
  const ids = skaters.filter((id) => positions.get(id) === group).sort((a, b) => a - b);
  if (ids.length === 0) return null;
  if (situation === "ev" && ids.length !== EV_UNIT_SIZE[group]) return null;
  return ids.join(",");
}

/**
 * Whether a second (or an event) may credit a listed unit. False when either team has no goalie on ice
 * (a pulled goalie, D-21/D-22) and, at even strength, when the skaters are not exactly 5 on 5 (4-on-4 and
 * 3-on-3 go to Other, D-13). An opponent with no shift rows is the no-goalie fallback, so it also returns
 * false: a second with no opposing shifts has no trustworthy strength. Callers pass `dedupeOnIce` results.
 */
export function creditsUnit(situation: Situation, mine: OnIce, opp: OnIce): boolean {
  if (!mine.goalie || !opp.goalie) return false;
  if (situation === "ev" && (mine.skaters.length !== 5 || opp.skaters.length !== 5)) return false;
  return true;
}

/**
 * Per-situation seconds, the EV/PP/SH forward and defense units, and each skater's seconds by situation for `team`.
 * Repeated shift rows are dropped by `uniqueShifts`, and a player with overlapping rows that are not
 * identical counts once per second via `dedupeOnIce`. So neither can inflate the on-ice skater count
 * (which decides EV/PP/SH), double a player's seconds, or put an id in a unit twice.
 */
export function analyzeGameLines(
  team: string,
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
): GameLines {
  const seconds = bucketOnIce(shifts, positions);

  const situationSeconds: Record<Situation, number> = { ev: 0, pp: 0, sh: 0 };
  const unitSeconds: Record<Situation, { F: Map<string, number>; D: Map<string, number> }> = {
    ev: { F: new Map(), D: new Map() },
    pp: { F: new Map(), D: new Map() },
    sh: { F: new Map(), D: new Map() },
  };
  const playerSeconds = new Map<number, Record<Situation, number>>();

  for (const byTeam of seconds.values()) {
    const rawMine = byTeam.get(team);
    if (!rawMine || rawMine.skaters.length === 0) continue;
    const mine = dedupeOnIce(rawMine);
    const opp = dedupeOnIce([...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? { skaters: [], goalie: false });
    const situation = situationFor(mine, opp);
    situationSeconds[situation]++;

    for (const id of mine.skaters) {
      let rec = playerSeconds.get(id);
      if (!rec) playerSeconds.set(id, (rec = { ev: 0, pp: 0, sh: 0 }));
      rec[situation]++;
    }

    // Pulled-goalie, 4-on-4 and 3-on-3 seconds go to Other, the same rule unit events follow.
    if (!creditsUnit(situation, mine, opp)) continue;
    for (const group of ["F", "D"] as const) {
      const key = unitKey(situation, group, mine.skaters, positions);
      if (key === null) continue;
      const map = unitSeconds[situation][group];
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  const toUnits = (map: Map<string, number>, total: number): Unit[] =>
    [...map]
      .filter(([, secs]) => secs >= MIN_UNIT_SECONDS)
      .sort((a, b) => b[1] - a[1])
      .map(([key, secs]) => ({
        playerIds: key.split(",").map(Number),
        seconds: secs,
        pct: total > 0 ? (secs / total) * 100 : 0,
      }));

  const units = {} as GameLines["units"];
  for (const situation of ["ev", "pp", "sh"] as const) {
    units[situation] = {
      F: toUnits(unitSeconds[situation].F, situationSeconds[situation]),
      D: toUnits(unitSeconds[situation].D, situationSeconds[situation]),
    };
  }

  return { situationSeconds, units, playerSeconds };
}

/**
 * Least-squares slope of y over x, or null with fewer than two points.
 * Optional weights let unreliable points (e.g. games with little PP time) count less.
 */
export function trendSlope(points: Array<{ x: number; y: number; w?: number }>): number | null {
  const weighted = points.filter((p) => (p.w ?? 1) > 0);
  if (weighted.length < 2) return null;
  const totalW = weighted.reduce((s, p) => s + (p.w ?? 1), 0);
  const meanX = weighted.reduce((s, p) => s + (p.w ?? 1) * p.x, 0) / totalW;
  const meanY = weighted.reduce((s, p) => s + (p.w ?? 1) * p.y, 0) / totalW;
  let num = 0;
  let den = 0;
  for (const p of weighted) {
    num += (p.w ?? 1) * (p.x - meanX) * (p.y - meanY);
    den += (p.w ?? 1) * (p.x - meanX) ** 2;
  }
  return den === 0 ? null : num / den;
}
