import type { DateBucketGap, ScheduleGame, TeamFitScore } from "./types";

/** Map of NHL team abbrev -> set of dates that team plays. */
function buildDatesByTeam(games: ScheduleGame[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const g of games) {
    for (const team of [g.homeTeamAbbrev, g.awayTeamAbbrev]) {
      if (!map.has(team)) map.set(team, new Set());
      map.get(team)!.add(g.gameDate);
    }
  }
  return map;
}

/**
 * For each roster-slot bucket with gap days, rank NHL teams by how many of those gap
 * days they play on - i.e. how well a player from that team, at that position, would
 * plug your team's schedule holes. Higher gapDaysCovered = better draft target.
 */
export function scoreTeamsForGaps(
  gaps: DateBucketGap[],
  games: ScheduleGame[],
  excludeTeams: ReadonlySet<string> = new Set()
): TeamFitScore[] {
  const gapDatesByBucket = new Map<string, Set<string>>();
  for (const g of gaps) {
    if (!gapDatesByBucket.has(g.bucket)) gapDatesByBucket.set(g.bucket, new Set());
    gapDatesByBucket.get(g.bucket)!.add(g.date);
  }

  const datesByTeam = buildDatesByTeam(games);

  const results: TeamFitScore[] = [];
  for (const [bucket, gapDates] of gapDatesByBucket) {
    for (const [team, teamDates] of datesByTeam) {
      if (excludeTeams.has(team)) continue;
      let covered = 0;
      for (const date of gapDates) {
        if (teamDates.has(date)) covered++;
      }
      results.push({ teamAbbrev: team, bucket, gapDaysCovered: covered, totalGapDaysForBucket: gapDates.size });
    }
  }

  return results.sort((a, b) => b.gapDaysCovered - a.gapDaysCovered);
}
