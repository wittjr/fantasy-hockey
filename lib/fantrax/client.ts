// Client for Fantrax's undocumented "fxea" external-API endpoints.
// Verified 2026-09-06 against a real private NHL keeper league: these endpoints
// return full league/roster/player data with NO session cookie required, even
// though the league itself is set to private. If Fantrax ever locks these down,
// swap the fetch base for a cookie-authenticated `fxpa/req` call instead — see
// the plan doc for the fallback design.

const FXEA_BASE = "https://www.fantrax.com/fxea/general";

async function fxeaGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${FXEA_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Fantrax fxea ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Accepts a full league URL or a bare league ID and returns the ID. */
export function extractLeagueId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/league\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
  throw new Error(`Could not extract a Fantrax league ID from "${input}"`);
}

export interface FantraxLeagueInfo {
  leagueName: string;
  seasonYear: string;
  startDate: string;
  endDate: string;
  draftType?: string;
  rosterInfo: {
    positionConstraints: Record<string, { maxActive?: number; maxTotal?: number }>;
    maxTotalPlayers: number;
    maxTotalActivePlayers: number;
  };
  teamInfo: Record<string, { id: string; name: string }>;
  /**
   * Matchup weeks. Timestamps are Eastern with a numeric offset, e.g.
   * "2026-10-05T18:59:59.0-0400"; a period runs until just before the next one's start.
   */
  scoringPeriods?: FantraxPeriod[];
  /** Lineup-lock periods - one per game day in daily-lineup leagues. Same timestamp format. */
  rosterPeriods?: FantraxPeriod[];
  /** Verified 2026-09-27: {"lastRegularSeasonPeriod":23,"numPlayoffTeams":6,"firstPlayoffPeriod":24,"mergePlayoffPeriods":false,"used":true}. */
  playoffs?: { used: boolean; firstPlayoffPeriod: number; lastRegularSeasonPeriod: number; numPlayoffTeams: number };
  /** Every player in the pool: league-specific eligible roster slots ("F", "F,D", ...) and "FA" / "W" / "T" (taken). */
  playerInfo?: Record<string, { eligiblePos: string; status: string }>;
  [key: string]: unknown;
}

export interface FantraxPeriod {
  number: number;
  startDate: string;
  endDate: string;
}

export function getLeagueInfo(leagueId: string) {
  return fxeaGet<FantraxLeagueInfo>("getLeagueInfo", { leagueId });
}

export interface FantraxStandingsEntry {
  teamId: string;
  teamName: string;
  rank: number;
  points: string;
  totalPointsFor: number;
  winPercentage: number;
  gamesBack: number;
}

export function getStandings(leagueId: string) {
  return fxeaGet<FantraxStandingsEntry[]>("getStandings", { leagueId });
}

export interface FantraxRosterItem {
  id: string; // fantraxPlayerId
  position: string;
  status: "ACTIVE" | "RESERVE" | "INJURED_RESERVE" | string;
}

export interface FantraxTeamRosters {
  period: number;
  rosters: Record<string, { teamName: string; rosterItems: FantraxRosterItem[] }>;
}

export function getTeamRosters(leagueId: string, period?: number) {
  const params: Record<string, string> = { leagueId };
  if (period !== undefined) params.period = String(period);
  return fxeaGet<FantraxTeamRosters>("getTeamRosters", params);
}

export interface FantraxPlayer {
  name: string; // "Last, First"
  fantraxId: string;
  team: string; // NHL team abbrev
  position: string; // granular: C / LW / RW / D / G
  statsIncId?: number;
  rotowireId?: number;
  sportRadarId?: string;
}

/** Full league player pool, keyed by fantraxId. ~9k rows for NHL - cache this, don't call per-request. */
export function getPlayerIds(sport: "NHL" | "NFL" | "MLB" | "NBA" = "NHL") {
  return fxeaGet<Record<string, FantraxPlayer>>("getPlayerIds", { sport });
}

export interface FantraxDraftResults {
  draftDate: string;
  draftPicks: Array<{ round: number; pick: number; teamId: string; time: number; pickInRound: number }>;
}

export function getDraftResults(leagueId: string) {
  return fxeaGet<FantraxDraftResults>("getDraftResults", { leagueId });
}

export interface FantraxAdpEntry {
  pos: string;
  name: string;
  id: string; // fantraxPlayerId
  ADP: number;
}

/**
 * Live, cross-league Average Draft Position, keyed directly by fantraxId - no name
 * matching needed. Verified 2026-09-06: 492 NHL players, values consistent with a
 * real pre-season aggregate (MacKinnon 1.29, McDavid 1.84, ...). The endpoint name in
 * Fantrax's own web client is "getAdp" (lowercase "dp") - "getADP"/"getPlayerInfo"
 * (both guessed first) don't exist.
 */
export function getAdp(sport: "NHL" | "NFL" | "MLB" | "NBA" = "NHL") {
  return fxeaGet<FantraxAdpEntry[]>("getAdp", { sport });
}

// --- fxpa: the Fantrax web app's own API ---
// Undocumented; verified 2026-09-27. Like fxea it answers for this private league with NO
// session cookie. It's the only place Fantrax exposes projections: "Projected - Per Game"
// (timeframeTypeCode PROJECTED_WEEKLY), already scored in the league's own settings.

const FXPA_URL = "https://www.fantrax.com/fxpa/req";

async function fxpaReq<T>(leagueId: string, method: string, data: Record<string, string>): Promise<T> {
  const res = await fetch(`${FXPA_URL}?leagueId=${leagueId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ msgs: [{ method, data: { leagueId, ...data } }] }),
  });
  if (!res.ok) throw new Error(`Fantrax fxpa ${method} failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { responses?: Array<{ data?: T; pageError?: unknown }> };
  const response = body.responses?.[0];
  if (!response?.data) {
    throw new Error(`Fantrax fxpa ${method} returned no data: ${JSON.stringify(response?.pageError ?? body).slice(0, 200)}`);
  }
  return response.data;
}

export interface FxpaRow {
  /** Absent on section/total rows. scorerId is the same ID as fxea's player IDs. */
  scorer?: { scorerId: string; name: string };
  cells: Array<{ content: string }>;
}

export interface FxpaSeasonOrProjection {
  code: string; // e.g. "PROJECTION_0_31n_EVENT_PROJECTED_WEEKLY" - the "31n" part is season-specific
  name: string;
  timeframeTypeCode: string; // "PROJECTED_WEEKLY" = per-game projections
}

export interface FxpaPlayerStats {
  tableHeader: { cells: Array<{ shortName: string }> };
  statsTable: FxpaRow[];
  /** The scoring period the projection columns cover - always the current one; no parameter changes it. */
  displayedPeriod: number;
  displayedSeasonOrProjection: FxpaSeasonOrProjection;
  seasonOrProjections: FxpaSeasonOrProjection[];
}

/** The Players page table. positionOrGroup: "HOCKEY_SKATING" (the default) or "POS_201" (goalies). */
export function getPlayerStats(leagueId: string, params: Record<string, string>) {
  return fxpaReq<FxpaPlayerStats>(leagueId, "getPlayerStats", params);
}

export interface FxpaTeamRosterInfo {
  /** [skaters, goalies]. Each row's columns follow that table's header. */
  tables: Array<{ header: { cells: Array<{ shortName: string }> }; rows: FxpaRow[] }>;
  displayedSelections: { displayedPeriod: number; displayedSeasonOrProjection?: FxpaSeasonOrProjection };
}

/**
 * A team's lineup for one roster (lineup-lock) period - one day in daily leagues. With the
 * default per-game projection view, FPts is the projection for that day's game (0 if none),
 * matchup-specific: e.g. Necas 5.19 vs LAK one day, 5.09 vs STL another.
 */
export function getTeamRosterInfo(leagueId: string, teamId: string, period: number) {
  return fxpaReq<FxpaTeamRosterInfo>(leagueId, "getTeamRosterInfo", { teamId, period: String(period) });
}
