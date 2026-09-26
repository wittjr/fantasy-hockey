import { getYahooAccessToken } from "./oauth";
import { normalizeYahoo } from "./normalize";

const API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

/** GETs a Fantasy API path (e.g. "/league/465.l.123/settings") as the given app user. */
export async function yahooGet<T = unknown>(userId: string, path: string): Promise<T> {
  const token = await getYahooAccessToken(userId);
  const url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}format=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Yahoo Fantasy API ${path} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { fantasy_content: unknown };
  return normalizeYahoo(body.fantasy_content) as T;
}

export interface YahooLeagueSummary {
  leagueKey: string;
  name: string;
  season: string;
  numTeams: number;
  draftStatus: string;
  url: string;
}

interface RawLeague {
  league_key: string;
  name: string;
  season: string | number;
  num_teams: number;
  draft_status: string;
  url: string;
}

/** The logged-in Yahoo user's NHL leagues for the current Yahoo hockey season. */
export async function listMyNhlLeagues(userId: string): Promise<YahooLeagueSummary[]> {
  const content = await yahooGet<{
    users: Array<{ user: { games?: Array<{ game: { leagues?: Array<{ league: RawLeague }> } }> } }>;
  }>(userId, "/users;use_login=1/games;game_codes=nhl/leagues");

  const leagues: YahooLeagueSummary[] = [];
  for (const { user } of content.users ?? []) {
    for (const { game } of user.games ?? []) {
      for (const { league } of game.leagues ?? []) {
        leagues.push({
          leagueKey: league.league_key,
          name: league.name,
          season: String(league.season),
          numTeams: Number(league.num_teams),
          draftStatus: league.draft_status,
          url: league.url,
        });
      }
    }
  }
  return leagues;
}

export interface YahooRosterPosition {
  position: string;
  count: number;
  isStarting: boolean;
}

export interface YahooLeagueDetails {
  leagueKey: string;
  name: string;
  season: string;
  startDate: string | null;
  endDate: string | null;
  rosterPositions: YahooRosterPosition[];
  teams: Array<{ teamKey: string; name: string }>;
}

interface RawLeagueWithSettings extends RawLeague {
  start_date?: string;
  end_date?: string;
  settings: {
    roster_positions: Array<{
      roster_position: { position: string; count: number | string; is_starting_position?: number | string };
    }>;
  };
  teams: Array<{ team: { team_key: string; name: string } }>;
}

// Slots that never count toward the active lineup, even if Yahoo omits is_starting_position.
const NON_STARTING_POSITIONS = new Set(["BN", "IR", "IR+", "IL", "NA"]);

export async function getLeagueDetails(userId: string, leagueKey: string): Promise<YahooLeagueDetails> {
  const content = await yahooGet<{ league: RawLeagueWithSettings }>(
    userId,
    `/league/${leagueKey};out=settings,teams`
  );
  const league = content.league;

  return {
    leagueKey: league.league_key,
    name: league.name,
    season: String(league.season),
    startDate: league.start_date ?? null,
    endDate: league.end_date ?? null,
    rosterPositions: (league.settings?.roster_positions ?? []).map(({ roster_position: rp }) => ({
      position: rp.position,
      count: Number(rp.count),
      isStarting:
        rp.is_starting_position !== undefined
          ? Number(rp.is_starting_position) === 1
          : !NON_STARTING_POSITIONS.has(rp.position),
    })),
    teams: (league.teams ?? []).map(({ team }) => ({ teamKey: team.team_key, name: team.name })),
  };
}
