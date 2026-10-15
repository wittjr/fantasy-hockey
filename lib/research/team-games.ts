import {
  finishedGameCache,
  getBoxscore,
  getClubScheduleNow,
  getPlayByPlay,
  getShiftCharts,
  type NhlBoxscoreTeamStats,
  type NhlTeamAbbrev,
} from "@/lib/nhl/client";
import {
  analyzeGameLines,
  parseClock,
  regulationSeconds,
  type GameLines,
  type PositionGroup,
  type Situation,
} from "./lines";
import { buildGameEvents, type GameEvents } from "./events";
import { pairSeconds, type GamePairs } from "./pair-seconds";

// Regular season and playoffs; preseason deployment isn't representative.
const RESEARCH_GAME_TYPES = new Set([2, 3]);
const FINISHED_STATES = new Set(["OFF", "FINAL"]);

// NHL api-web limits request rate (burst about 50, then a 60 s ban), not concurrency. Each game makes 3 requests
// (boxscore, shift chart, play-by-play), so a start every 1000 ms is about 3 api-web requests per second. Measured by the
// cold Last 20 check (plan 03-09): 500, 600 and 750 ms all hit 429 on the third team; 1000 ms loaded nine teams in a row.
export const MAX_CONCURRENT_GAMES = 3;
export const GAME_START_GAP_MS = 1000;

/**
 * Runs `fn` over `items` with at most `concurrency` in flight, starting items in order at least `gapMs` apart.
 * Results come back in input order; a failed item is a rejected result, so this never rejects.
 */
export async function mapPaced<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  opts: { concurrency: number; gapMs: number },
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  let nextStartAt = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      // Reserve this item's start slot before waiting so concurrent workers stay gapMs apart.
      const startAt = Math.max(Date.now(), nextStartAt);
      nextStartAt = startAt + opts.gapMs;
      const wait = startAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, items.length) }, worker));
  return results;
}

export interface ResearchPlayer {
  id: number;
  name: string;
  position: string; // C/L/R/D
  group: PositionGroup;
}

export interface ResearchGame {
  id: number;
  date: string;
  opponent: string;
  home: boolean;
  score: { for: number; against: number } | null;
  /** Total TOI from the boxscore, seconds, for every skater who dressed. */
  toi: Map<number, number>;
  /** How the game went past regulation; a shootout counts because it includes a real 5-minute OT period. Null for a regulation finish. */
  overtime: "OT" | "SO" | null;
  /**
   * Per-skater seconds in periods 1-3. The same Map instance as `toi` for a regulation finish;
   * null (unknown) for an OT/SO game with no shift data. PP/SH still come from whole-game `lines`,
   * including OT (deliberate).
   */
  regulationToi: Map<number, number> | null;
  /** Null when the league hasn't published shift charts for the game yet. */
  lines: GameLines | null;
  /**
   * Regulation-only (periods 1-3) seconds per situation for each skater and each pair of skaters, for linemate time (D-19).
   * Null when there is no shift chart, like lines.
   */
  pairs: GamePairs | null;
  /**
   * Shots, goals and shot attempts per situation and unit for this team (pulled-goalie and 4-on-4/3-on-3 events only
   * in the situation totals). Null (unknown, never zeros) when there is no shift chart or the play-by-play failed or
   * is unpublished; the game still counts for TOI and linemates (D-05).
   */
  events: GameEvents | null;
}

export interface TeamResearch {
  players: Map<number, ResearchPlayer>;
  games: ResearchGame[]; // oldest first
  /** Dates ("YYYY-MM-DD") of window games whose data could not be loaded; they are left out of `games`. */
  unavailableDates: string[];
}

function addPlayers(stats: NhlBoxscoreTeamStats, into: Map<number, ResearchPlayer>, positions: Map<number, PositionGroup>) {
  const groups: Array<[NhlBoxscoreTeamStats[keyof NhlBoxscoreTeamStats], PositionGroup]> = [
    [stats.forwards, "F"],
    [stats.defense, "D"],
    [stats.goalies, "G"],
  ];
  for (const [list, group] of groups) {
    for (const p of list) {
      positions.set(p.playerId, group);
      into.set(p.playerId, { id: p.playerId, name: p.name.default, position: p.position, group });
    }
  }
}

async function loadGame(
  team: string,
  gameId: number,
  cache: ReturnType<typeof finishedGameCache>,
): Promise<{ game: ResearchGame; players: Map<number, ResearchPlayer>; complete: boolean }> {
  // A failed shift chart (null) is not the same as an unpublished one ([]): a regulation game falls back to boxscore
  // TOI with no PP/SH, but an OT/SO game needs the chart for its regulation TOI, so it fails below.
  // A play-by-play failure never fails the game (D-05): its events are null (unknown).
  const [box, shifts, pbp] = await Promise.all([
    getBoxscore(gameId, cache),
    getShiftCharts(gameId, cache).catch((err: unknown) => {
      console.error(`Loading shift chart for game ${gameId} (${team}) failed`, err);
      return null;
    }),
    getPlayByPlay(gameId, cache).catch((err: unknown) => {
      console.error(`Loading play-by-play for game ${gameId} (${team}) failed`, err);
      return null;
    }),
  ]);
  const home = box.homeTeam.abbrev === team;
  const mine = home ? box.playerByGameStats.homeTeam : box.playerByGameStats.awayTeam;
  const theirs = home ? box.playerByGameStats.awayTeam : box.playerByGameStats.homeTeam;

  const positions = new Map<number, PositionGroup>();
  const gamePlayers = new Map<number, ResearchPlayer>();
  addPlayers(mine, gamePlayers, positions);
  addPlayers(theirs, new Map(), positions);

  const toi = new Map<number, number>();
  for (const p of [...mine.forwards, ...mine.defense]) {
    const secs = parseClock(p.toi);
    if (secs) toi.set(p.playerId, secs);
  }

  const outcome = box.gameOutcome?.lastPeriodType;
  const overtime = outcome === "OT" || outcome === "SO" ? outcome : null;
  if (overtime && shifts === null) throw new Error(`Shift chart for OT/SO game ${gameId} failed to load`);

  const shiftInputs = (shifts ?? []).flatMap((s) => {
    const startSec = parseClock(s.startTime);
    const endSec = parseClock(s.endTime);
    return startSec === null || endSec === null
      ? []
      : [{ playerId: s.playerId, team: s.teamAbbrev, period: s.period, startSec, endSec }];
  });

  const regulationToi = !overtime ? toi : shiftInputs.length > 0 ? regulationSeconds(team, shiftInputs) : null;

  const us = home ? box.homeTeam : box.awayTeam;
  const them = home ? box.awayTeam : box.homeTeam;
  const game: ResearchGame = {
    id: gameId,
    date: box.gameDate,
    opponent: them.abbrev,
    home,
    score: us.score !== undefined && them.score !== undefined ? { for: us.score, against: them.score } : null,
    toi,
    overtime,
    regulationToi,
    lines: shiftInputs.length > 0 ? analyzeGameLines(team, shiftInputs, positions) : null,
    pairs: shiftInputs.length > 0 ? pairSeconds(team, shiftInputs, positions) : null,
    events: buildGameEvents(team, shiftInputs, positions, pbp),
  };
  // Same rule as client.ts: failed (null) or unpublished (empty) data is never pinned, so such a game is loaded again.
  const complete = shifts !== null && shifts.length > 0 && pbp !== null && pbp.plays.length > 0;
  return { game, players: gamePlayers, complete };
}

// Limit for gameCache: 32 teams x Last 20.
export const MAX_CACHED_GAMES = 640;

interface LoadedGame {
  game: ResearchGame;
  players: Map<number, ResearchPlayer>;
}

/**
 * Fully loaded games by team and game id (a game's data is from one team's perspective), so a repeat /research
 * navigation skips the pacing gap and the per-game analysis. Only complete games are stored, each for its
 * finishedGameCache tier. Cached games are shared across requests: consumers must not mutate them. On Vercel this lives
 * per warm instance and resets on cold start or deploy, which is fine because a miss falls back to the paced load.
 */
const gameCache = new Map<string, LoadedGame & { expiresAt: number }>();

/** Empties the game cache (for tests). */
export function clearGameCache() {
  gameCache.clear();
}

function storeGame(key: string, loaded: LoadedGame, revalidateS: number) {
  // Delete first so a re-store moves to the end of insertion order.
  gameCache.delete(key);
  gameCache.set(key, { ...loaded, expiresAt: Date.now() + revalidateS * 1000 });
  while (gameCache.size > MAX_CACHED_GAMES) gameCache.delete(gameCache.keys().next().value!);
}

/** The team's last `count` finished regular-season/playoff games this season. */
export async function loadTeamResearch(
  team: NhlTeamAbbrev,
  count: number,
  options: { gapMs?: number } = {},
): Promise<TeamResearch> {
  const schedule = await getClubScheduleNow(team);
  const recent = schedule
    .filter((g) => RESEARCH_GAME_TYPES.has(g.gameType) && FINISHED_STATES.has(g.gameState))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate))
    .slice(-count);

  // Hits are decided once, up front, so eviction during this load does not change which games are misses.
  const now = Date.now();
  const loaded = new Map<number, PromiseSettledResult<LoadedGame>>();
  const misses: typeof recent = [];
  for (const g of recent) {
    const key = `${team}:${g.id}`;
    const hit = gameCache.get(key);
    if (hit && now < hit.expiresAt) loaded.set(g.id, { status: "fulfilled", value: hit });
    else {
      gameCache.delete(key);
      misses.push(g);
    }
  }

  // One failed game must not blank the page: keep the games that loaded and name the ones that did not.
  // Newest first, so if a ban hits mid-load the games that loaded are the latest ones. Only misses are paced.
  const newestFirst = [...misses].reverse();
  const results = await mapPaced(
    newestFirst,
    async (g) => {
      const tier = finishedGameCache(g.startTimeUTC);
      const result = await loadGame(team, g.id, tier);
      if (result.complete) storeGame(`${team}:${g.id}`, result, tier.next.revalidate);
      return { game: result.game, players: result.players };
    },
    { concurrency: MAX_CONCURRENT_GAMES, gapMs: options.gapMs ?? GAME_START_GAP_MS },
  );
  newestFirst.forEach((g, i) => loaded.set(g.id, results[i]));
  const settled = recent.map((g) => loaded.get(g.id)!);
  // Merge oldest-first so the latest game's name/position wins.
  const players = new Map<number, ResearchPlayer>();
  const games: ResearchGame[] = [];
  const unavailableDates: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      for (const [id, p] of result.value.players) players.set(id, p);
      games.push(result.value.game);
    } else {
      console.error(`Loading game ${recent[i].id} for ${team} failed`, result.reason);
      unavailableDates.push(recent[i].gameDate);
    }
  });
  if (recent.length > 0 && games.length === 0) {
    throw new Error(`Could not load any of ${team}'s last ${recent.length} games`);
  }
  return { players, games, unavailableDates };
}

export function situationSeconds(game: ResearchGame, playerId: number, situation: Situation): number | null {
  if (!game.lines) return null;
  return game.lines.playerSeconds.get(playerId)?.[situation] ?? 0;
}
