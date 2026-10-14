// View-model for the Last game unit tables: capped rows, Other, Total and formatted stat strings.
// Pure, no React; the component only prints these strings, including the notes and legend.
import { emptyCounts, matchIsLow, matchRatio, type EventCounts, type GameEvents } from "./events";
import { formatClock, formatDate, formatSignedInt } from "./format";
import type { GameLines, Situation } from "./lines";
import type { ResearchGame } from "./team-games";

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
    plusMinus: counts.cf + counts.ca === 0 ? DASH : formatSignedInt(counts.gf - counts.ga),
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

/** D-14: what was left out of every count; only non-zero kinds, singular for 1, null when nothing was excluded. */
export function exclusionsNote(events: GameEvents | null): string | null {
  if (!events) return null;
  const { shootout, penaltyShot } = events.excluded;
  const kinds: [number, string][] = [
    [shootout, "shootout attempt"],
    [penaltyShot, "penalty shot"],
  ];
  const items = kinds
    .filter(([n]) => n !== 0)
    .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`);
  return items.length === 0 ? null : `Excluded from these tables: ${items.join(", ")}.`;
}

/** The three legend lines under the tables (03-UI-SPEC Copywriting Contract; D-06, D-07, D-15, D-21). */
export const UNIT_LEGEND: readonly string[] = [
  "GF and GA are goals for and against. SF and SA are shots on goal for and against, goals included. CF and CA are shot attempts for and against: shots on goal, misses and blocks, credited to the team that shot. SF% is SF ÷ (SF + SA) and CF% is CF ÷ (CF + CA); both show — when for plus against is 0.",
  "+/- is GF − GA in that situation, so it is not the NHL's official plus-minus, which ignores power-play goals for and short-handed goals against. It shows 0 when a line had shot attempts but no goals, and — when it had no events at all. Power-play and penalty-kill percentages are lopsided by nature.",
  "Other is everything in that situation not on a listed line: lines below the cut-off, partial lines during changes, 4-on-4 and 3-on-3 play (counted as even strength), and all time and events while either goalie was pulled. Total is the team's total, so the listed lines plus Other equal Total. Forwards and defense show the same Total. Overtime counts; shootout attempts and penalty shots are left out.",
];

/**
 * Amber notes above the tables, only those that apply, in the order D-18 (no play-by-play), D-23 (corrupted chart),
 * D-16 (shift data disagrees). Fixed 03-UI-SPEC copy: no API path, status or error text reaches the page.
 */
export function topNotes(game: Pick<ResearchGame, "lines" | "events">): string[] {
  const { lines, events } = game;
  if (!lines) return [];
  if (!events) {
    return [
      "No play-by-play for this game yet (not published, or it failed to load), so all goal, shot and Corsi columns show —. Reload the page to retry.",
    ];
  }
  const notes: string[] = [];
  if (events.chartSuspect) {
    notes.push("This game's shift chart looks corrupted (players from other teams or repeated shifts); counts may be off.");
  }
  const ratio = matchRatio(events.quality);
  if (ratio !== null && matchIsLow(events.quality)) {
    const percent = Math.max(1, Math.round(100 - ratio * 100));
    notes.push(`Shift data disagrees with play-by-play on ${percent}% of events in this game; counts may be off.`);
  }
  return notes;
}

/** D-05: older window games (every game but the last) that have a shift chart and no play-by-play; null when none. */
export function missingPlayByPlayNote(games: readonly Pick<ResearchGame, "date" | "lines" | "events">[]): string | null {
  const dates = games
    .slice(0, -1)
    .filter((g) => g.lines && !g.events)
    .map((g) => formatDate(g.date));
  if (dates.length === 0) return null;
  return `No play-by-play for ${dates.join(", ")}: not published yet, or it failed to load. Those games keep their ice-time data. Reload the page to retry.`;
}

function subtract(a: EventCounts, b: EventCounts): EventCounts {
  return { gf: a.gf - b.gf, ga: a.ga - b.ga, sf: a.sf - b.sf, sa: a.sa - b.sa, cf: a.cf - b.cf, ca: a.ca - b.ca };
}
