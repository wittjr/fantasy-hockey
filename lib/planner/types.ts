// Platform-agnostic shapes for the weekly planner. Each league platform (Fantrax, Yahoo, ...)
// has an adapter in ./sources that fills these in; everything downstream of that - lineup
// solving, schedule fit, recommendations, the page - only sees these types.

import type { PickupHorizon } from "./weeks";

export type Platform = "fantrax" | "yahoo";

/** A league scoring period ("week"), with the calendar dates lineups are set for. */
export interface PlanningWeek {
  number: number;
  /** "YYYY-MM-DD", inclusive. */
  startDate: string;
  endDate: string;
  /** Every lineup day in the week, in order. */
  days: string[];
}

export type DailyStatus = "active" | "bench" | "out";

export interface DailySlot {
  /** The platform's own slot label for the day, e.g. "C", "F", "Util", "BN", "IR+". */
  slot: string;
  /** active = in the starting lineup, bench = could be started, out = IR/minors/etc - can't play. */
  status: DailyStatus;
}

export interface PlannerRosterPlayer {
  playerId: string;
  name: string;
  nhlTeamAbbrev: string | null;
  /** Granular position for display, e.g. "C" or "LW,RW". */
  displayPosition: string;
  /** League lineup slots this player may occupy, e.g. ["F"] or ["C", "LW", "Util"]. */
  eligiblePositions: string[];
  /** Projected fantasy points per game, if known (see PlannerData.projectionSource). */
  projectedPointsPerGame: number | null;
  /**
   * Per-date, matchup-specific projection for that day's game, when the platform provides
   * one (Fantrax does). Takes precedence over projectedPointsPerGame for that date.
   */
  dailyProjections: Record<string, number>;
  /**
   * Keyed by date, covering the displayed week and the pickup horizon. A date missing here
   * means the player wasn't on the roster that day.
   */
  dailySlots: Record<string, DailySlot>;
}

export interface AvailablePlayer {
  playerId: string;
  name: string;
  nhlTeamAbbrev: string | null;
  displayPosition: string;
  eligiblePositions: string[];
  /** Projected fantasy points per game, if known (see PlannerData.projectionSource). */
  projectedPointsPerGame: number | null;
  /** Platform quality ranking (lower = better), e.g. Fantrax ADP or Yahoo's actual rank. */
  rank: number | null;
}

export interface PlannerData {
  platform: Platform;
  /** All weeks of the season, for navigation. */
  weeks: Array<Pick<PlanningWeek, "number" | "startDate" | "endDate">>;
  week: PlanningWeek;
  /** Days pickups are scored over: the displayed week (from today on) and the week after. */
  pickupHorizon: PickupHorizon;
  /** Starting lineup slots -> count, e.g. { F: 6, D: 4, G: 1 }. Bench/IR excluded. */
  lineupSlots: Record<string, number>;
  roster: PlannerRosterPlayer[];
  available: AvailablePlayer[];
  /** Column header for AvailablePlayer.rank, e.g. "ADP". */
  rankLabel: string;
  /** Where AvailablePlayer.projectedPointsPerGame came from. */
  projectionSource: "platform" | "spreadsheet" | "none";
  /** Things the user should know the planner couldn't get from the platform. */
  notices: string[];
}

export interface TeamGame {
  opponent: string;
  isHome: boolean;
}

/** NHL team abbrev -> date -> that day's game. */
export type GamesByTeam = Map<string, Map<string, TeamGame>>;
