import type {
  ConsideredPlayer,
  CoverageHistogramRow,
  DateBucketGap,
  DateBucketSurplus,
  RosterSlotConstraints,
  ScheduleGame,
} from "./types";

/** Map of gameDate -> set of NHL team abbrevs playing that date. */
export function buildTeamsPlayingByDate(games: ScheduleGame[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const g of games) {
    if (!map.has(g.gameDate)) map.set(g.gameDate, new Set());
    map.get(g.gameDate)!.add(g.homeTeamAbbrev);
    map.get(g.gameDate)!.add(g.awayTeamAbbrev);
  }
  return map;
}

function groupByBucket(players: ConsideredPlayer[]): Map<string, ConsideredPlayer[]> {
  const map = new Map<string, ConsideredPlayer[]>();
  for (const p of players) {
    if (!map.has(p.rosterPosition)) map.set(p.rosterPosition, []);
    map.get(p.rosterPosition)!.push(p);
  }
  return map;
}

interface DateBucketCoverage {
  date: string;
  bucket: string;
  slotMax: number;
  playersWithGame: number;
}

/** For every date/bucket combination, how many considered players in that bucket have a game. */
function computeCoverage(
  players: ConsideredPlayer[],
  slotConstraints: RosterSlotConstraints,
  games: ScheduleGame[]
): DateBucketCoverage[] {
  const teamsPlayingByDate = buildTeamsPlayingByDate(games);
  const playersByBucket = groupByBucket(players);
  const results: DateBucketCoverage[] = [];

  for (const [date, teamsPlaying] of teamsPlayingByDate) {
    for (const [bucket, slotMax] of Object.entries(slotConstraints)) {
      const bucketPlayers = playersByBucket.get(bucket) ?? [];
      const playersWithGame = bucketPlayers.filter((p) => teamsPlaying.has(p.nhlTeamAbbrev)).length;
      results.push({ date, bucket, slotMax, playersWithGame });
    }
  }

  return results;
}

/**
 * For every date in the season and every roster-slot bucket, find how many of that
 * bucket's active slots would go unfilled because none of the considered (kept/rostered,
 * non-omitted) players in that bucket have a game that day.
 *
 * Only dates/buckets with an actual gap (gap > 0) are returned.
 */
export function computeRosterGaps(
  players: ConsideredPlayer[],
  slotConstraints: RosterSlotConstraints,
  games: ScheduleGame[]
): DateBucketGap[] {
  return computeCoverage(players, slotConstraints, games)
    .map(({ date, bucket, slotMax, playersWithGame }) => ({
      date,
      bucket,
      slotMax,
      playersWithGame,
      gap: Math.max(0, slotMax - playersWithGame),
    }))
    .filter((row) => row.gap > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.bucket.localeCompare(b.bucket));
}

/**
 * The flip side of computeRosterGaps: dates/buckets where MORE considered players have a
 * game than you have active slots for, so a player who's playing has to sit on your bench.
 *
 * Only dates/buckets with an actual surplus (surplus > 0) are returned.
 */
export function computeRosterSurplus(
  players: ConsideredPlayer[],
  slotConstraints: RosterSlotConstraints,
  games: ScheduleGame[]
): DateBucketSurplus[] {
  return computeCoverage(players, slotConstraints, games)
    .map(({ date, bucket, slotMax, playersWithGame }) => ({
      date,
      bucket,
      slotMax,
      playersWithGame,
      surplus: Math.max(0, playersWithGame - slotMax),
    }))
    .filter((row) => row.surplus > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.bucket.localeCompare(b.bucket));
}

/**
 * For each bucket, how many dates in the season land on each possible "players with a
 * game" count - e.g. "4 of your 6 D have a game" -> 30 dates. Rows below slotMax are gap
 * days, rows above slotMax are surplus (bench) days, exactly slotMax is a perfect fit.
 */
export function computeCoverageHistogram(
  players: ConsideredPlayer[],
  slotConstraints: RosterSlotConstraints,
  games: ScheduleGame[]
): CoverageHistogramRow[] {
  const counts = new Map<string, number>(); // `${bucket}|${playersWithGame}` -> dateCount

  for (const { bucket, playersWithGame } of computeCoverage(players, slotConstraints, games)) {
    const key = `${bucket}|${playersWithGame}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const results: CoverageHistogramRow[] = [];
  for (const [key, dateCount] of counts) {
    const [bucket, playersWithGameStr] = key.split("|");
    results.push({ bucket, slotMax: slotConstraints[bucket], playersWithGame: Number(playersWithGameStr), dateCount });
  }

  return results.sort((a, b) => a.bucket.localeCompare(b.bucket) || a.playersWithGame - b.playersWithGame);
}
