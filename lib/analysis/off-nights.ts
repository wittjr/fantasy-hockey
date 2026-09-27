import type { ScheduleGame } from "./types";

/** A night with fewer than this many NHL games - fewer teams competing for your lineup slots league-wide. */
export const OFF_NIGHT_MAX_GAMES = 7;

/**
 * NHL team abbrev -> number of its games that fall on off nights among the given days.
 * `games` must be the full schedule, since whether a night is "off" depends on every game that date.
 */
export function countOffNightGamesByTeam(games: readonly ScheduleGame[], days: readonly string[]): Map<string, number> {
  const wanted = new Set(days);
  const gamesPerDate = new Map<string, number>();
  for (const g of games) gamesPerDate.set(g.gameDate, (gamesPerDate.get(g.gameDate) ?? 0) + 1);

  const counts = new Map<string, number>();
  for (const g of games) {
    if (!wanted.has(g.gameDate) || gamesPerDate.get(g.gameDate)! > OFF_NIGHT_MAX_GAMES) continue;
    for (const team of [g.homeTeamAbbrev, g.awayTeamAbbrev]) counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  return counts;
}

/** "regular/playoff", or just the regular count when the league has no playoffs. */
export function formatOffNights(regular: number | null | undefined, playoff: number | null | undefined): string {
  if (regular == null) return "—";
  return playoff == null ? String(regular) : `${regular}/${playoff}`;
}
