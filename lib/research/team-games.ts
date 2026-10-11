import {
  getBoxscore,
  getClubScheduleNow,
  getShiftCharts,
  type NhlBoxscoreTeamStats,
  type NhlTeamAbbrev,
} from "@/lib/nhl/client";
import { analyzeGameLines, parseClock, type GameLines, type PositionGroup, type Situation } from "./lines";

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
  /** Null when the league hasn't published shift charts for the game yet. */
  lines: GameLines | null;
}

export interface TeamResearch {
  players: Map<number, ResearchPlayer>;
  games: ResearchGame[]; // oldest first
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
  const [box, shifts] = await Promise.all([getBoxscore(gameId), getShiftCharts(gameId)]);
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

  const shiftInputs = shifts.flatMap((s) => {
    const startSec = parseClock(s.startTime);
    const endSec = parseClock(s.endTime);
    return startSec === null || endSec === null
      ? []
      : [{ playerId: s.playerId, team: s.teamAbbrev, period: s.period, startSec, endSec }];
  });

  const us = home ? box.homeTeam : box.awayTeam;
  const them = home ? box.awayTeam : box.homeTeam;
  const game: ResearchGame = {
    id: gameId,
    date: box.gameDate,
    opponent: them.abbrev,
    home,
    score: us.score !== undefined && them.score !== undefined ? { for: us.score, against: them.score } : null,
    toi,
    lines: shiftInputs.length > 0 ? analyzeGameLines(team, shiftInputs, positions) : null,
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

  const loaded = await Promise.all(recent.map((g) => loadGame(team, g.id)));
  // Merge oldest-first so the latest game's name/position wins.
  const players = new Map<number, ResearchPlayer>();
  for (const l of loaded) for (const [id, p] of l.players) players.set(id, p);
  return { players, games: loaded.map((l) => l.game) };
}

export function situationSeconds(game: ResearchGame, playerId: number, situation: Situation): number | null {
  if (!game.lines) return null;
  return game.lines.playerSeconds.get(playerId)?.[situation] ?? 0;
}
