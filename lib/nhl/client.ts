// Client for the public (unauthenticated) NHL web API. Undocumented but stable;
// see https://github.com/Zmalski/NHL-API-Reference for community reference.

const NHL_BASE = "https://api-web.nhle.com/v1";

// The NHL answers a burst with a 50-60 s ban; waiting that long inside a render is never right (D-04 degrades instead).
export const RETRY_AFTER_CAP_S = 5;
export const MAX_429_RETRIES = 2;

/** Milliseconds to wait before retrying, or null to give up. Only a 429 with a short numeric Retry-After is retried. */
export function retryAfterMs(status: number, retryAfter: string | null, attempt: number): number | null {
  if (status !== 429 || attempt >= MAX_429_RETRIES || retryAfter === null || retryAfter.trim() === "") return null;
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= RETRY_AFTER_CAP_S ? seconds * 1000 : null;
}

async function nhlGet<T>(path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${NHL_BASE}/${path}`, { ...init, headers: { Accept: "application/json" } });
    if (res.ok) return res.json() as Promise<T>;
    const waitMs = retryAfterMs(res.status, res.headers.get("retry-after"), attempt);
    if (waitMs === null) throw new Error(`NHL API ${path} failed: ${res.status} ${res.statusText}`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
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
  /** ISO UTC start time; optional because test stubs omit it. */
  startTimeUTC?: string;
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
  gameOutcome?: { lastPeriodType: "REG" | "OT" | "SO" };
}

export const RECENT_GAME_WINDOW_MS = 48 * 60 * 60 * 1000;
export const RECENT_GAME_REVALIDATE_S = 3600;
export const OLD_GAME_REVALIDATE_S = 30 * 24 * 60 * 60;

/**
 * Cache tier for a finished game's data. Finished games only change for stat corrections; a game under 48 h
 * old may still get them, so it revalidates hourly (also when the start is missing or unparseable). Older data
 * is pinned 30 days because a non-200 is never cached and empty charts or play-by-play are re-requested uncached.
 */
export function finishedGameCache(startTimeUTC: string | undefined, now = Date.now()): { next: { revalidate: number } } {
  const start = startTimeUTC === undefined ? NaN : Date.parse(startTimeUTC);
  const old = Number.isFinite(start) && now - start >= RECENT_GAME_WINDOW_MS;
  return { next: { revalidate: old ? OLD_GAME_REVALIDATE_S : RECENT_GAME_REVALIDATE_S } };
}

export async function getBoxscore(gameId: number, cache = finishedGameCache(undefined)): Promise<NhlBoxscore> {
  return nhlGet<NhlBoxscore>(`gamecenter/${gameId}/boxscore`, cache);
}

/** A play-by-play event. Holds only the fields event attribution reads; `details` is optional because the JSON is untrusted. */
export interface NhlPlay {
  typeDescKey: string;
  timeInPeriod: string; // "MM:SS" elapsed in period
  situationCode?: string; // away goalie, away skaters, home skaters, home goalie
  periodDescriptor: { number: number; periodType: string };
  details?: {
    eventOwnerTeamId?: number; // the shooter's team
    reason?: string;
    shootingPlayerId?: number;
    scoringPlayerId?: number;
    goalieInNetId?: number;
  };
}

/** A game's play-by-play. Holds only the fields event attribution reads. */
export interface NhlPlayByPlay {
  id: number;
  homeTeam: { id: number; abbrev: string };
  awayTeam: { id: number; abbrev: string };
  plays: NhlPlay[];
}

/**
 * A game's play-by-play. Can have no plays for a short while after a game ends, until the league
 * publishes it. An empty cached result is re-requested uncached so it is not pinned;
 * a published play-by-play stays in its cache tier.
 */
export async function getPlayByPlay(gameId: number, cache = finishedGameCache(undefined)): Promise<NhlPlayByPlay> {
  const path = `gamecenter/${gameId}/play-by-play`;
  const pbp = await nhlGet<NhlPlayByPlay>(path, cache);
  return pbp.plays?.length > 0 ? pbp : nhlGet<NhlPlayByPlay>(path, { cache: "no-store" });
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

async function fetchShiftCharts(gameId: number, init: RequestInit): Promise<NhlShift[]> {
  const res = await fetch(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`, {
    ...init,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NHL shift charts ${gameId} failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { data: NhlShift[] };
  return data.data.filter((s) => s.typeCode === SHIFT_TYPE_CODE);
}

/**
 * Every shift in a game, from the separate NHL stats API. Can be empty for a short while after a
 * game ends, until the league publishes shift charts. An empty cached result is re-requested
 * uncached so it is not pinned; a published chart stays in its cache tier.
 */
export async function getShiftCharts(gameId: number, cache = finishedGameCache(undefined)): Promise<NhlShift[]> {
  const shifts = await fetchShiftCharts(gameId, cache);
  return shifts.length > 0 ? shifts : fetchShiftCharts(gameId, { cache: "no-store" });
}
