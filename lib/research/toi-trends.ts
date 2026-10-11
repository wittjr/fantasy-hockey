import { trendSlope, type GameLines } from "./lines";
import type { ResearchGame, ResearchPlayer } from "./team-games";

// A slope beyond these per-game changes is flagged as a rising/falling role.
export const TOI_TREND_THRESHOLD_SECONDS = 15;
export const PP_SHARE_TREND_THRESHOLD_POINTS = 3;

// Mover thresholds are the user's choice (D-18, superseding RESEARCH's 180 s / 25 points). A Δ crossing one is coloured and
// tints its row; the slope thresholds above still drive only the muted arrow.
export const TOI_MOVER_SECONDS = 120;
export const PP_MOVER_POINTS = 15;

/** "Recent" is the team's last 2 games in the window (D-05). */
export const RECENT_GAMES = 2;
/** A delta needs at least this many included games (D-06). */
export const MIN_GAMES_FOR_DELTA = 3;

/** The slice of a ResearchGame the trend rows read; structural so tests can pass plain objects. */
export type TrendGame = Pick<ResearchGame, "toi" | "regulationToi"> & {
  lines: Pick<GameLines, "situationSeconds" | "playerSeconds"> | null;
};

export interface PerGameCell {
  /** Boxscore TOI, seconds, including any overtime. */
  totalToi: number;
  /** Regulation TOI, seconds; null when the game is excluded (OT/SO game with no shift chart). */
  toi: number | null;
  /** PP seconds; null when the game has no shift chart. */
  pp: number | null;
  /** The team's PP seconds in the game, 0 without a shift chart. */
  teamPp: number;
  /** Player PP time over team PP time, 0-100; null when unknown or the team had no PP time. */
  ppShare: number | null;
  /** SH seconds; null when the game has no shift chart. */
  sh: number | null;
}

export interface TrendRow {
  player: ResearchPlayer;
  /** One entry per game, oldest first; null when the player did not dress (never 0). */
  perGame: (PerGameCell | null)[];
  /** Games the player dressed for. */
  gamesPlayed: number;
  /** Games that count toward Avg TOI, slope and delta (dressed, regulation TOI known). */
  includedGames: number;
  avgToi: number | null;
  /**
   * His PP seconds over the team's PP seconds, pooled over the included games he played that have a shift chart with team PP time; 0-100.
   * Games he missed or that lack a shift chart are not in the denominator, so this is his share while dressed, not of the whole window's team PP (D-02).
   */
  ppShare: number | null;
  /** Average SH seconds per game. */
  shAvg: number | null;
  toiSlope: number | null;
  /** Percentage points of PP share per game, weighted by each game's team PP time. */
  ppShareSlope: number | null;
  /**
   * His mean regulation TOI in the team's last 2 games of the window (by game index, D-05; only the ones he played count)
   * minus his mean over his included earlier games; seconds. This is not his own last 2 games played.
   * Null under the D-06 gates (fewer than 3 included games, or no included game in either part).
   */
  toiDelta: number | null;
  /** Same split for PP share, each part weighted by team PP time; percentage points. */
  ppShareDelta: number | null;
  /** Missed both of the team's last 2 games in a window larger than 2. */
  dnpLast2: boolean;
  /** Direction of a big recent change in TOI or PP share; null when none or the two disagree. */
  mover: "up" | "down" | null;
}

export interface DeltaPoint {
  /** Game index in the window, oldest first. */
  x: number;
  y: number;
  w?: number;
}

/** 1 or -1 when the delta's rounded (displayed) magnitude reaches the threshold, else 0. */
export function deltaCrossing(delta: number | null, threshold: number): -1 | 0 | 1 {
  if (delta === null || Math.round(Math.abs(delta)) < threshold) return 0;
  return delta > 0 ? 1 : -1;
}

/** "up" or "down" when at least one delta crosses its mover threshold and none crosses the other way (D-16, D-19). */
export function moverDirection(toiDelta: number | null, ppShareDelta: number | null): "up" | "down" | null {
  const crossings = [deltaCrossing(toiDelta, TOI_MOVER_SECONDS), deltaCrossing(ppShareDelta, PP_MOVER_POINTS)];
  if (crossings.includes(1) && !crossings.includes(-1)) return "up";
  if (crossings.includes(-1) && !crossings.includes(1)) return "down";
  return null;
}

function weightedMean(points: readonly DeltaPoint[]): number | null {
  const total = points.reduce((s, p) => s + (p.w ?? 1), 0);
  return total > 0 ? points.reduce((s, p) => s + (p.w ?? 1) * p.y, 0) / total : null;
}

/**
 * Recent-part mean minus earlier-part mean. Recent = the team's last RECENT_GAMES games by index, whether or not the
 * player played both. Null below MIN_GAMES_FOR_DELTA included games or when either part has no weight; windows of 1 or 2
 * have an empty earlier part, so they are null too.
 */
export function recentDelta(points: readonly DeltaPoint[], windowSize: number, includedGames: number): number | null {
  if (includedGames < MIN_GAMES_FOR_DELTA) return null;
  const recent = weightedMean(points.filter((p) => p.x >= windowSize - RECENT_GAMES));
  const earlier = weightedMean(points.filter((p) => p.x < windowSize - RECENT_GAMES));
  return recent === null || earlier === null ? null : recent - earlier;
}

/** Direction of the whole-window slope once it reaches the threshold (inclusive); null otherwise. */
export function slopeDirection(slope: number | null, threshold: number): "up" | "down" | null {
  if (slope === null) return null;
  if (slope >= threshold) return "up";
  if (slope <= -threshold) return "down";
  return null;
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function buildCell(playerId: number, game: TrendGame): PerGameCell | null {
  const totalToi = game.toi.get(playerId);
  if (totalToi === undefined) return null;
  const secs = game.lines ? game.lines.playerSeconds.get(playerId) : undefined;
  const pp = game.lines ? (secs?.pp ?? 0) : null;
  const teamPp = game.lines?.situationSeconds.pp ?? 0;
  return {
    totalToi,
    toi: game.regulationToi ? (game.regulationToi.get(playerId) ?? 0) : null,
    pp,
    teamPp,
    ppShare: pp !== null && teamPp > 0 ? (pp / teamPp) * 100 : null,
    sh: game.lines ? (secs?.sh ?? 0) : null,
  };
}

export const SORT_KEYS = ["avgToi", "toiDelta", "ppShare", "ppDelta"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export interface SortSpec {
  key: SortKey;
  dir: SortDir;
}
export const DEFAULT_SORT: SortSpec = { key: "avgToi", dir: "desc" };

/** Validates raw search params (strings, arrays or absent) against the allowlist; anything else is the default. */
export function parseSort(sort: unknown, dir: unknown): SortSpec {
  if (typeof sort !== "string" || !(SORT_KEYS as readonly string[]).includes(sort)) return DEFAULT_SORT;
  return { key: sort as SortKey, dir: dir === "asc" ? "asc" : "desc" };
}

/** Clicking the active key flips the direction; a new key starts descending (biggest risers first). */
export function nextSort(current: SortSpec, key: SortKey): SortSpec {
  return { key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" };
}

/** A 1-game window hides the Δ columns, so a requested Δ sort falls back to the default there (the URL keeps the request). */
export function effectiveSort(spec: SortSpec, windowSize: number): SortSpec {
  return windowSize === 1 && (spec.key === "toiDelta" || spec.key === "ppDelta") ? DEFAULT_SORT : spec;
}

const GROUP_ORDER = { F: 0, D: 1, G: 2 };
const SORT_VALUE: Record<SortKey, (row: TrendRow) => number | null> = {
  avgToi: (r) => r.avgToi,
  toiDelta: (r) => r.toiDelta,
  ppShare: (r) => r.ppShare,
  ppDelta: (r) => r.ppShareDelta,
};

/** Forwards before defense, then the key in the chosen direction with nulls last; ties by Avg TOI desc, name, id. */
export function sortRows(rows: readonly TrendRow[], spec: SortSpec): TrendRow[] {
  const value = SORT_VALUE[spec.key];
  const sign = spec.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const group = GROUP_ORDER[a.player.group] - GROUP_ORDER[b.player.group];
    if (group) return group;
    const [va, vb] = [value(a), value(b)];
    if ((va === null) !== (vb === null)) return va === null ? 1 : -1;
    if (va !== null && vb !== null && va !== vb) return sign * (va - vb);
    if ((a.avgToi === null) !== (b.avgToi === null)) return a.avgToi === null ? 1 : -1;
    return (b.avgToi ?? 0) - (a.avgToi ?? 0) || a.player.name.localeCompare(b.player.name) || a.player.id - b.player.id;
  });
}

/** Built only from validated values, so a request's raw params never reach a link. */
export function researchHref(team: string, games: number, sort: SortSpec): string {
  const params = new URLSearchParams({ team, games: String(games) });
  if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) params.set("sort", sort.key);
  if (sort.dir === "asc") params.set("dir", "asc");
  return `/research?${params}`;
}

/** One row per skater who dressed in the window, in the default order (forwards, then defense, by Avg TOI descending). */
export function buildTrendRows(players: Iterable<ResearchPlayer>, games: readonly TrendGame[]): TrendRow[] {
  const rows: TrendRow[] = [];
  for (const player of players) {
    if (player.group === "G") continue;
    const perGame = games.map((g) => buildCell(player.id, g));
    const gamesPlayed = perGame.filter((c) => c !== null).length;
    if (gamesPlayed === 0) continue;

    const included = perGame.flatMap((c, x) => (c && c.toi !== null ? [{ x, ...c, toi: c.toi }] : []));
    const withPp = included.filter((c) => c.ppShare !== null);
    const teamPpTotal = withPp.reduce((s, c) => s + c.teamPp, 0);
    const toiDelta = recentDelta(included.map((c) => ({ x: c.x, y: c.toi })), games.length, included.length);
    const ppShareDelta = recentDelta(withPp.map((c) => ({ x: c.x, y: c.ppShare!, w: c.teamPp })), games.length, included.length);
    rows.push({
      player,
      perGame,
      gamesPlayed,
      includedGames: included.length,
      avgToi: mean(included.map((c) => c.toi)),
      ppShare: teamPpTotal > 0 ? (withPp.reduce((s, c) => s + c.pp!, 0) / teamPpTotal) * 100 : null,
      shAvg: mean(included.flatMap((c) => (c.sh !== null ? [c.sh] : []))),
      toiSlope: trendSlope(included.map((c) => ({ x: c.x, y: c.toi }))),
      ppShareSlope: trendSlope(withPp.map((c) => ({ x: c.x, y: c.ppShare!, w: c.teamPp }))),
      toiDelta,
      ppShareDelta,
      dnpLast2: games.length > RECENT_GAMES && perGame.slice(-RECENT_GAMES).every((c) => c === null),
      mover: moverDirection(toiDelta, ppShareDelta),
    });
  }
  return sortRows(rows, DEFAULT_SORT);
}
