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
  [key: string]: unknown;
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
