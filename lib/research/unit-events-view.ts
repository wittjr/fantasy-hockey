// View-model for the Last game unit tables: capped rows, Other, Total and formatted stat strings.
// Pure, no React; the component only prints these strings (plan 03-08 adds the notes and legend).
import { emptyCounts, type EventCounts, type GameEvents } from "./events";
import { formatClock, formatSignedPoints } from "./format";
import type { GameLines, Situation } from "./lines";

export const UNIT_LIMITS: Record<Situation, { F: number; D: number }> = {
  ev: { F: 4, D: 3 },
  pp: { F: 2, D: 2 },
  sh: { F: 3, D: 3 },
};

/** Shown for an unknown value; never 0 (DATA-02). */
export const DASH = "—";

export interface UnitStats {
  gf: string;
  ga: string;
  plusMinus: string;
  sf: string;
  sa: string;
  sfPct: string;
  cf: string;
  ca: string;
  cfPct: string;
}

export interface UnitRow {
  playerIds: number[];
  time: string;
  pct: string;
  stats: UnitStats;
}

export interface UnitSummaryRow {
  time: string;
  pct: string;
  stats: UnitStats;
}

export interface UnitTableView {
  rows: UnitRow[];
  other: UnitSummaryRow | null;
  total: UnitSummaryRow | null;
}

function share(forCount: number, againstCount: number): string {
  const sum = forCount + againstCount;
  return sum === 0 ? DASH : ((forCount / sum) * 100).toFixed(1);
}

/** Formats one row's counts; null (events unknown) gives a dash everywhere, never 0. */
export function statCells(counts: EventCounts | null): UnitStats {
  if (!counts) return { gf: DASH, ga: DASH, plusMinus: DASH, sf: DASH, sa: DASH, sfPct: DASH, cf: DASH, ca: DASH, cfPct: DASH };
  return {
    gf: String(counts.gf),
    ga: String(counts.ga),
    // D-20: attempts without goals is a real 0; no events at all has nothing to subtract, so a dash.
    plusMinus: counts.cf + counts.ca === 0 ? DASH : formatSignedPoints(counts.gf - counts.ga),
    sf: String(counts.sf),
    sa: String(counts.sa),
    sfPct: share(counts.sf, counts.sa),
    cf: String(counts.cf),
    ca: String(counts.ca),
    cfPct: share(counts.cf, counts.ca),
  };
}

/**
 * Listed units (capped by UNIT_LIMITS, in lines.units order) with their formatted stats, then Other (the situation
 * total minus the listed rows, from raw seconds and counts) and Total. Both are null when the situation had no time
 * and no events (D-12).
 */
export function buildUnitTable(
  lines: GameLines,
  events: GameEvents | null,
  situation: Situation,
  group: "F" | "D",
): UnitTableView {
  const listed = lines.units[situation][group].slice(0, UNIT_LIMITS[situation][group]);
  const byUnit = events?.byUnit[situation][group];
  const listedCounts = listed.map((u) => byUnit?.get(u.playerIds.join(",")) ?? emptyCounts());
  const rows = listed.map((u, i) => ({
    playerIds: u.playerIds,
    time: formatClock(u.seconds),
    pct: u.pct.toFixed(1),
    stats: statCells(events ? listedCounts[i] : null),
  }));

  const seconds = lines.situationSeconds[situation];
  const totalCounts = events ? events.total[situation] : null;
  if (seconds === 0 && (!totalCounts || totalCounts.cf + totalCounts.ca === 0)) return { rows, other: null, total: null };

  const otherSeconds = seconds - listed.reduce((sum, u) => sum + u.seconds, 0);
  const otherCounts = totalCounts && listedCounts.reduce(subtract, totalCounts);
  return {
    rows,
    other: {
      time: formatClock(otherSeconds),
      pct: seconds === 0 ? DASH : ((otherSeconds / seconds) * 100).toFixed(1),
      stats: statCells(otherCounts),
    },
    total: { time: formatClock(seconds), pct: "100.0", stats: statCells(totalCounts) },
  };
}

function subtract(a: EventCounts, b: EventCounts): EventCounts {
  return { gf: a.gf - b.gf, ga: a.ga - b.ga, sf: a.sf - b.sf, sa: a.sa - b.sa, cf: a.cf - b.cf, ca: a.ca - b.ca };
}
