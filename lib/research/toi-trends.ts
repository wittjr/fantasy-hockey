import { trendSlope, type GameLines } from "./lines";
import type { ResearchGame, ResearchPlayer } from "./team-games";

// A slope beyond these per-game changes is flagged as a rising/falling role.
export const TOI_TREND_THRESHOLD_SECONDS = 15;
export const PP_SHARE_TREND_THRESHOLD_POINTS = 3;

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
  /** Pooled player PP time over team PP time across the window, 0-100. */
  ppShare: number | null;
  /** Average SH seconds per game. */
  shAvg: number | null;
  toiSlope: number | null;
  /** Percentage points of PP share per game, weighted by each game's team PP time. */
  ppShareSlope: number | null;
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

/** One row per skater who dressed in the window: forwards, then defense, by Avg TOI descending. */
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
    });
  }
  const groupOrder = { F: 0, D: 1, G: 2 };
  return rows.sort(
    (a, b) =>
      groupOrder[a.player.group] - groupOrder[b.player.group] ||
      (a.avgToi === null ? 1 : 0) - (b.avgToi === null ? 1 : 0) ||
      (b.avgToi ?? 0) - (a.avgToi ?? 0),
  );
}
