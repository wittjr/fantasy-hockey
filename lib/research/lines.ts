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
 * Equals boxscore TOI minus OT for a complete shift chart. Identical rows are dropped by `uniqueShifts`.
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

/** Every on-ice second of the game (key: seconds since the start of period 1), per team. */
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
 * Repeated shift rows are counted once (see `uniqueShifts`), so a duplicate can neither inflate the
 * on-ice skater count (which decides EV/PP/SH) nor double-count a player's seconds.
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
    const mine = byTeam.get(team);
    if (!mine || mine.skaters.length === 0) continue;
    const opp = [...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? { skaters: [], goalie: false };
    const situation = situationFor(mine, opp);
    situationSeconds[situation]++;

    for (const id of mine.skaters) {
      let rec = playerSeconds.get(id);
      if (!rec) playerSeconds.set(id, (rec = { ev: 0, pp: 0, sh: 0 }));
      rec[situation]++;
    }

    for (const group of ["F", "D"] as const) {
      const ids = mine.skaters.filter((id) => positions.get(id) === group).sort((a, b) => a - b);
      if (ids.length === 0) continue;
      if (situation === "ev" && ids.length !== EV_UNIT_SIZE[group]) continue;
      const key = ids.join(",");
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
