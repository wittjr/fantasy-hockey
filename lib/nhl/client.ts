// Client for the public (unauthenticated) NHL web API. Undocumented but stable;
// see https://github.com/Zmalski/NHL-API-Reference for community reference.

const NHL_BASE = "https://api-web.nhle.com/v1";

async function nhlGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NHL_BASE}/${path}`, { ...init, headers: { Accept: "application/json" } });
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

export interface NhlClubGame extends NhlGame {
  gameState: string; // "FUT" | "PRE" | "LIVE" | "CRIT" | "FINAL" | "OFF"
}

/** Current-season schedule for one team, all game types, cached for 10 minutes. */
export async function getClubScheduleNow(team: NhlTeamAbbrev): Promise<NhlClubGame[]> {
  const data = await nhlGet<{ games: NhlClubGame[] }>(`club-schedule-season/${team}/now`, { next: { revalidate: 600 } });
  return data.games;
}

export interface NhlBoxscoreSkater {
  playerId: number;
  name: { default: string };
  position: string;
  toi: string; // "MM:SS"
}

export interface NhlBoxscoreTeamStats {
  forwards: NhlBoxscoreSkater[];
  defense: NhlBoxscoreSkater[];
  goalies: NhlBoxscoreSkater[];
}

export interface NhlBoxscore {
  id: number;
  gameDate: string;
  awayTeam: { abbrev: string; score?: number };
  homeTeam: { abbrev: string; score?: number };
  playerByGameStats: { awayTeam: NhlBoxscoreTeamStats; homeTeam: NhlBoxscoreTeamStats };
}

// Finished games only change for stat corrections; an hour keeps them fresh enough.
const FINISHED_GAME_CACHE = { next: { revalidate: 3600 } };

export async function getBoxscore(gameId: number): Promise<NhlBoxscore> {
  return nhlGet<NhlBoxscore>(`gamecenter/${gameId}/boxscore`, FINISHED_GAME_CACHE);
}

export interface NhlShift {
  playerId: number;
  teamAbbrev: string;
  period: number;
  startTime: string; // "MM:SS" elapsed in period
  endTime: string | null;
  typeCode: number; // 517 = shift; 505 = goal marker
}

const SHIFT_TYPE_CODE = 517;

/**
 * Every shift in a game, from the separate NHL stats API. Can be empty for a
 * short while after a game ends, until the league publishes shift charts.
 */
export async function getShiftCharts(gameId: number): Promise<NhlShift[]> {
  const res = await fetch(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`, {
    ...FINISHED_GAME_CACHE,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NHL shift charts ${gameId} failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { data: NhlShift[] };
  return data.data.filter((s) => s.typeCode === SHIFT_TYPE_CODE);
}
