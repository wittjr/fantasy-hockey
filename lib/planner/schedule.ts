import { getScheduleWeek } from "@/lib/nhl/client";
import type { GamesByTeam } from "./types";

const REGULAR_SEASON = 2;
const PLAYOFFS = 3;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Start dates for NHL schedule calls (each returns 7 days) that cover every date given, in any order or gaps. */
export function scheduleFetchStarts(dates: readonly string[]): string[] {
  const starts: string[] = [];
  for (const date of [...new Set(dates)].sort()) {
    const last = starts.at(-1);
    if (!last || date > addDays(last, 6)) starts.push(date);
  }
  return starts;
}

/** Every NHL game on the given dates, by team then date. One NHL API call per 7 days covered. */
export async function getGamesByTeam(dates: readonly string[]): Promise<GamesByTeam> {
  const wanted = new Set(dates);
  const weeks = await Promise.all(scheduleFetchStarts(dates).map(getScheduleWeek));

  const byTeam: GamesByTeam = new Map();
  const add = (team: string, date: string, opponent: string, isHome: boolean) => {
    if (!byTeam.has(team)) byTeam.set(team, new Map());
    byTeam.get(team)!.set(date, { opponent, isHome });
  };
  for (const day of weeks.flat()) {
    if (!wanted.has(day.date)) continue;
    for (const g of day.games) {
      if (g.gameType !== REGULAR_SEASON && g.gameType !== PLAYOFFS) continue;
      add(g.homeTeam.abbrev, day.date, g.awayTeam.abbrev, true);
      add(g.awayTeam.abbrev, day.date, g.homeTeam.abbrev, false);
    }
  }
  return byTeam;
}
