import type { FantraxPeriod } from "@/lib/fantrax/client";
import { toPlanningWeek } from "@/lib/fantrax/periods";
import type { ScheduleGame } from "./types";

/**
 * The league's lineup days, split at the first playoff period. Days after the last scoring
 * period aren't included. playoffs is null when the league has no playoffs.
 */
export function fantasySeasonDays(
  playoffs: { used: boolean; firstPlayoffPeriod: number } | undefined,
  scoringPeriods: readonly FantraxPeriod[]
): { regular: string[]; playoffs: string[] | null } {
  const firstPlayoffPeriod = playoffs?.used ? playoffs.firstPlayoffPeriod : Infinity;
  const days = (periods: readonly FantraxPeriod[]) => periods.flatMap((p) => toPlanningWeek(p).days);
  const playoffDays = days(scoringPeriods.filter((p) => p.number >= firstPlayoffPeriod));
  return {
    regular: days(scoringPeriods.filter((p) => p.number < firstPlayoffPeriod)),
    playoffs: playoffDays.length > 0 ? playoffDays : null,
  };
}

/** NHL team abbrev -> number of games that team plays on the given days. */
export function countGamesByTeam(games: readonly ScheduleGame[], days: readonly string[]): Map<string, number> {
  const wanted = new Set(days);
  const counts = new Map<string, number>();
  for (const g of games) {
    if (!wanted.has(g.gameDate)) continue;
    for (const team of [g.homeTeamAbbrev, g.awayTeamAbbrev]) counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  return counts;
}
