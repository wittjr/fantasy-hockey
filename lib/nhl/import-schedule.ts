import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nhlGames, nhlTeams } from "@/lib/db/schema";
import { getFullSeasonSchedule, NHL_TEAM_ABBREVS } from "./client";

// Static reference data - conference/division, informational only (not used by the
// gap-analysis algorithms). Verified 2026-09-06 via /v1/standings/{date}.
const TEAM_INFO: Record<string, { name: string; conference: string; division: string }> = {
  ANA: { name: "Anaheim Ducks", conference: "Western", division: "Pacific" },
  BOS: { name: "Boston Bruins", conference: "Eastern", division: "Atlantic" },
  BUF: { name: "Buffalo Sabres", conference: "Eastern", division: "Atlantic" },
  CAR: { name: "Carolina Hurricanes", conference: "Eastern", division: "Metropolitan" },
  CBJ: { name: "Columbus Blue Jackets", conference: "Eastern", division: "Metropolitan" },
  CGY: { name: "Calgary Flames", conference: "Western", division: "Pacific" },
  CHI: { name: "Chicago Blackhawks", conference: "Western", division: "Central" },
  COL: { name: "Colorado Avalanche", conference: "Western", division: "Central" },
  DAL: { name: "Dallas Stars", conference: "Western", division: "Central" },
  DET: { name: "Detroit Red Wings", conference: "Eastern", division: "Atlantic" },
  EDM: { name: "Edmonton Oilers", conference: "Western", division: "Pacific" },
  FLA: { name: "Florida Panthers", conference: "Eastern", division: "Atlantic" },
  LAK: { name: "Los Angeles Kings", conference: "Western", division: "Pacific" },
  MIN: { name: "Minnesota Wild", conference: "Western", division: "Central" },
  MTL: { name: "Montréal Canadiens", conference: "Eastern", division: "Atlantic" },
  NJD: { name: "New Jersey Devils", conference: "Eastern", division: "Metropolitan" },
  NSH: { name: "Nashville Predators", conference: "Western", division: "Central" },
  NYI: { name: "New York Islanders", conference: "Eastern", division: "Metropolitan" },
  NYR: { name: "New York Rangers", conference: "Eastern", division: "Metropolitan" },
  OTT: { name: "Ottawa Senators", conference: "Eastern", division: "Atlantic" },
  PHI: { name: "Philadelphia Flyers", conference: "Eastern", division: "Metropolitan" },
  PIT: { name: "Pittsburgh Penguins", conference: "Eastern", division: "Metropolitan" },
  SEA: { name: "Seattle Kraken", conference: "Western", division: "Pacific" },
  SJS: { name: "San Jose Sharks", conference: "Western", division: "Pacific" },
  STL: { name: "St. Louis Blues", conference: "Western", division: "Central" },
  TBL: { name: "Tampa Bay Lightning", conference: "Eastern", division: "Atlantic" },
  TOR: { name: "Toronto Maple Leafs", conference: "Eastern", division: "Atlantic" },
  UTA: { name: "Utah Mammoth", conference: "Western", division: "Central" },
  VAN: { name: "Vancouver Canucks", conference: "Western", division: "Pacific" },
  VGK: { name: "Vegas Golden Knights", conference: "Western", division: "Pacific" },
  WPG: { name: "Winnipeg Jets", conference: "Western", division: "Central" },
  WSH: { name: "Washington Capitals", conference: "Eastern", division: "Metropolitan" },
};

export async function ensureNhlTeamsSeeded(): Promise<void> {
  for (const abbrev of NHL_TEAM_ABBREVS) {
    const info = TEAM_INFO[abbrev];
    await db
      .insert(nhlTeams)
      .values({ abbrev, name: info.name, conference: info.conference, division: info.division })
      .onConflictDoNothing({ target: nhlTeams.abbrev });
  }
}

/** Fetches and caches the full regular-season schedule for a season (e.g. "20262027"). */
export async function importNhlSeasonSchedule(season: string): Promise<{ gameCount: number }> {
  await ensureNhlTeamsSeeded();
  const games = await getFullSeasonSchedule(season);

  for (const game of games) {
    await db
      .insert(nhlGames)
      .values({
        nhlGameId: String(game.id),
        season,
        gameDate: game.gameDate,
        homeTeamAbbrev: game.homeTeam.abbrev,
        awayTeamAbbrev: game.awayTeam.abbrev,
      })
      .onConflictDoUpdate({
        target: nhlGames.nhlGameId,
        set: { gameDate: game.gameDate, homeTeamAbbrev: game.homeTeam.abbrev, awayTeamAbbrev: game.awayTeam.abbrev },
      });
  }

  return { gameCount: games.length };
}

export async function getSeasonSchedule(season: string) {
  return db.select().from(nhlGames).where(eq(nhlGames.season, season));
}

export async function seasonHasSchedule(season: string): Promise<boolean> {
  const rows = await db.select({ id: nhlGames.id }).from(nhlGames).where(eq(nhlGames.season, season)).limit(1);
  return rows.length > 0;
}
