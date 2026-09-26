/** Roster slot bucket (e.g. "F" / "D" / "G") -> max active players of that bucket. */
export type RosterSlotConstraints = Record<string, number>;

export interface ConsideredPlayer {
  fantraxPlayerId: string;
  /** The league's own active-roster bucket for this player, matching RosterSlotConstraints keys. */
  rosterPosition: string;
  nhlTeamAbbrev: string;
}

export interface ScheduleGame {
  gameDate: string; // "YYYY-MM-DD"
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

export interface DateBucketGap {
  date: string;
  bucket: string;
  slotMax: number;
  playersWithGame: number;
  /** How many bucket slots have no rostered player playing this date. Always > 0. */
  gap: number;
}

export interface DateBucketSurplus {
  date: string;
  bucket: string;
  slotMax: number;
  playersWithGame: number;
  /** How many more considered players have a game than you have active slots for - someone sits. Always > 0. */
  surplus: number;
}

export interface CoverageHistogramRow {
  bucket: string;
  slotMax: number;
  /** How many considered players in this bucket have a game, for the dateCount dates below. */
  playersWithGame: number;
  /** How many dates in the season land on exactly this playersWithGame count. */
  dateCount: number;
}

export interface TeamFitScore {
  teamAbbrev: string;
  bucket: string;
  /** How many of the bucket's gap-days this team plays on. */
  gapDaysCovered: number;
  totalGapDaysForBucket: number;
}
