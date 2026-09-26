import { mapPositionToBucket } from "@/lib/fantrax/position-mapping";
import type { TeamFitScore } from "./types";

export interface RankablePlayer {
  id: string;
  name: string;
  position: string | null;
  nhlTeamAbbrev: string | null;
  rank: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
}

export interface RankedPlayer extends RankablePlayer {
  bucket: string;
  gapDaysCovered: number;
  totalGapDaysForBucket: number;
}

/**
 * Flattens the team-fit scores into a player-level draft board: every draftable player,
 * annotated with how many of your gap-days their team covers, ordered by that fit first
 * and by projected rank (RK) as the tiebreaker. A teammate of an already-considered
 * player is still included here - callers are expected to exclude specific players (not
 * whole teams) before calling this, since a second player from the same team can still
 * add value if you have open slot capacity on the days that team plays.
 */
export function rankPlayersByFit(
  players: RankablePlayer[],
  availableBuckets: string[],
  teamFit: TeamFitScore[],
  limitPerBucket = 20
): Map<string, RankedPlayer[]> {
  const fitByTeamBucket = new Map<string, TeamFitScore>();
  for (const score of teamFit) {
    fitByTeamBucket.set(`${score.teamAbbrev}|${score.bucket}`, score);
  }

  const byBucket = new Map<string, RankedPlayer[]>();
  for (const p of players) {
    if (!p.nhlTeamAbbrev || !p.position) continue;
    const bucket = mapPositionToBucket(p.position, availableBuckets);
    if (!bucket) continue;

    const fit = fitByTeamBucket.get(`${p.nhlTeamAbbrev}|${bucket}`);
    if (!fit) continue;

    const list = byBucket.get(bucket) ?? [];
    list.push({ ...p, bucket, gapDaysCovered: fit.gapDaysCovered, totalGapDaysForBucket: fit.totalGapDaysForBucket });
    byBucket.set(bucket, list);
  }

  for (const [bucket, list] of byBucket) {
    list.sort((a, b) => {
      if (b.gapDaysCovered !== a.gapDaysCovered) return b.gapDaysCovered - a.gapDaysCovered;
      return (a.rank ?? Infinity) - (b.rank ?? Infinity);
    });
    byBucket.set(bucket, list.slice(0, limitPerBucket));
  }

  return byBucket;
}
