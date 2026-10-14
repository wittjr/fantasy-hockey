import {
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
): Promise<{ game: ResearchGame; players: Map<number, ResearchPlayer> }> {
  // A failed shift chart (null) is not the same as an unpublished one ([]): a regulation game falls back to boxscore
  // TOI with no PP/SH, but an OT/SO game needs the chart for its regulation TOI, so it fails below.
  // A play-by-play failure never fails the game (D-05): its events are null (unknown).
  const [box, shifts, pbp] = await Promise.all([
    getBoxscore(gameId),
    getShiftCharts(gameId).catch((err: unknown) => {
      console.error(`Loading shift chart for game ${gameId} (${team}) failed`, err);
      return null;
    }),
    getPlayByPlay(gameId).catch((err: unknown) => {
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
  return { game, players: gamePlayers };
}

/** The team's last `count` finished regular-season/playoff games this season. */
export async function loadTeamResearch(team: NhlTeamAbbrev, count: number): Promise<TeamResearch> {
  const schedule = await getClubScheduleNow(team);
  const recent = schedule
    .filter((g) => RESEARCH_GAME_TYPES.has(g.gameType) && FINISHED_STATES.has(g.gameState))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate))
    .slice(-count);

  // One failed game must not blank the page: keep the games that loaded and name the ones that did not.
  const settled = await Promise.allSettled(recent.map((g) => loadGame(team, g.id)));
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
