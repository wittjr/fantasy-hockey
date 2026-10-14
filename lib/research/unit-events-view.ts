// View-model for the Last game unit tables: capped rows, Other, Total and formatted stat strings.
// Pure, no React; the component only prints these strings (plan 03-08 adds the notes and legend).
import type { EventCounts, GameEvents } from "./events";
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

export function statCells(counts: EventCounts | null): UnitStats {
  void counts;
  return { gf: "", ga: "", plusMinus: "", sf: "", sa: "", sfPct: "", cf: "", ca: "", cfPct: "" };
}

export function buildUnitTable(
  lines: GameLines,
  events: GameEvents | null,
  situation: Situation,
  group: "F" | "D",
): UnitTableView {
  void lines;
  void events;
  void situation;
  void group;
  return { rows: [], other: null, total: null };
}
