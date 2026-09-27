// Client for the public (unauthenticated) NHL web API. Undocumented but stable;
// see https://github.com/Zmalski/NHL-API-Reference for community reference.

const NHL_BASE = "https://api-web.nhle.com/v1";

async function nhlGet<T>(path: string): Promise<T> {
  const res = await fetch(`${NHL_BASE}/${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`NHL API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Verified 2026-09-06 via /v1/standings/{date}. Static because roster
// realignment is rare; update if a team relocates/renames/expands.
export const NHL_TEAM_ABBREVS = [
  "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL",
  "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD",
  "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS",
  "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
] as const;

export type NhlTeamAbbrev = (typeof NHL_TEAM_ABBREVS)[number];

const REGULAR_SEASON_GAME_TYPE = 2;

export interface NhlGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string; // "YYYY-MM-DD"
  homeTeam: { abbrev: string };
  awayTeam: { abbrev: string };
}

interface ClubScheduleSeasonResponse {
  games: NhlGame[];
}

/** Full-season schedule for one team. `season` is e.g. "20262027". */
export async function getClubScheduleSeason(team: NhlTeamAbbrev, season: string): Promise<NhlGame[]> {
  const data = await nhlGet<ClubScheduleSeasonResponse>(`club-schedule-season/${team}/${season}`);
  return data.games.filter((g) => g.gameType === REGULAR_SEASON_GAME_TYPE);
}

/** Regular-season games for every NHL team, deduplicated by game id. Makes 32 requests. */
export async function getFullSeasonSchedule(season: string): Promise<NhlGame[]> {
  const perTeam = await Promise.all(NHL_TEAM_ABBREVS.map((team) => getClubScheduleSeason(team, season)));
  const byId = new Map<number, NhlGame>();
  for (const games of perTeam) {
    for (const game of games) byId.set(game.id, game);
  }
  return [...byId.values()];
}

export interface NhlRosterPlayer {
  id: number;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
}

interface RosterResponse {
  forwards: NhlRosterPlayer[];
  defensemen: NhlRosterPlayer[];
  goalies: NhlRosterPlayer[];
}

export async function getCurrentRoster(team: NhlTeamAbbrev): Promise<NhlRosterPlayer[]> {
  const data = await nhlGet<RosterResponse>(`roster/${team}/current`);
  return [...data.forwards, ...data.defensemen, ...data.goalies];
}

interface ScheduleWeekResponse {
  gameWeek: Array<{ date: string; games: NhlGame[] }>;
}

/** The 7 days of games starting at `date` ("YYYY-MM-DD"), keyed by Eastern date. Includes all game types. */
export async function getScheduleWeek(date: string): Promise<Array<{ date: string; games: NhlGame[] }>> {
  const data = await nhlGet<ScheduleWeekResponse>(`schedule/${date}`);
  return data.gameWeek;
}
