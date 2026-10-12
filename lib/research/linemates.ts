// View-model for the player detail panel: who a skater shared the ice with, game by game.
// Pure functions over ResearchGame data; the component only renders what these return.
import { formatClock, formatDate, gameLabel, resultLabel } from "./format";
import type { GameDetail, StripGame } from "./game-strip";
import type { Situation } from "./lines";
import type { ResearchGame, ResearchPlayer } from "./team-games";
import { RECENT_GAMES } from "./toi-trends";

// A linemate needs at least this much time together in counted games to be listed. At EV a forward still shares 15-30%
// of his ice with non-linemates through line changes, so the list cap does most of the filtering; this drops the noise.
export const LINEMATE_MIN_SECONDS: Record<Situation, number> = { ev: 120, pp: 30, sh: 30 };
// A cell is darkest when the linemate shared this share of the player's situation time (D-08).
export const LINEMATE_SHADE_SATURATION_SHARE = 0.75;
export const SITUATION_ABBREV: Record<Situation, string> = { ev: "EV", pp: "PP", sh: "SH" };

/** The slice of a ResearchGame the view-model reads; structural so tests can pass plain objects. */
export type LinemateGame = Pick<ResearchGame, "id" | "date" | "home" | "opponent" | "score" | "overtime" | "toi" | "pairs">;

/** together/apart: a counted game. absent: someone did not dress (or the player had no time in the situation). unknown: no shift chart. */
export type LinemateCellState = "together" | "apart" | "absent" | "unknown";
export type AbsentReason = "player-missed" | "no-situation-time" | "linemate-missed";

export interface LinemateCell {
  state: LinemateCellState;
  /** Regulation seconds together; null unless the game is counted (together or apart). */
  seconds: number | null;
  /** seconds over the player's regulation seconds in the situation; null unless counted. */
  share: number | null;
  /** The player's regulation seconds in the situation; null unless counted. */
  selfSeconds: number | null;
  absentReason: AbsentReason | null;
}

export interface LinemateRow {
  player: ResearchPlayer;
  group: "F" | "D";
  /** One entry per game, oldest first. */
  cells: LinemateCell[];
  /** Seconds together over the player's seconds, both summed over counted games; null when there are none (D-25). */
  windowShare: number | null;
  /** Seconds together in counted games of the recent part of the window. */
  recentSeconds: number;
  /** Seconds together in all counted games. */
  totalSeconds: number;
}

export interface LinemateView {
  situation: Situation;
  forwards: LinemateRow[];
  defense: LinemateRow[];
}

/** Index of the first "recent" game: the team's last RECENT_GAMES, or the latest game of a 2-game window; null for 1 game (D-15). */
export function recentStart(windowSize: number): number | null {
  if (windowSize >= 3) return windowSize - RECENT_GAMES;
  return windowSize === 2 ? 1 : null;
}

const NOT_COUNTED = { seconds: null, share: null, selfSeconds: null } as const;

/**
 * The state and numbers for one linemate in one game. The denominator is always the player's regulation seconds from the
 * pair pass, never the whole-game line data (which includes overtime). Absent and unknown games carry no numbers, never 0.
 */
export function linemateCell(
  game: Pick<LinemateGame, "toi" | "pairs">,
  playerId: number,
  linemateId: number,
  situation: Situation,
): LinemateCell {
  const { pairs } = game;
  if (!pairs) return { state: "unknown", ...NOT_COUNTED, absentReason: null };
  const selfSeconds = pairs.self.get(playerId)?.[situation] ?? 0;
  const absentReason: AbsentReason | null = !game.toi.has(playerId)
    ? "player-missed"
    : selfSeconds === 0
      ? "no-situation-time"
      : !game.toi.has(linemateId)
        ? "linemate-missed"
        : null;
  if (absentReason) return { state: "absent", ...NOT_COUNTED, absentReason };
  const seconds = pairs.together.get(playerId)?.get(linemateId)?.[situation] ?? 0;
  return { state: seconds > 0 ? "together" : "apart", seconds, share: seconds / selfSeconds, selfSeconds, absentReason: null };
}

/** The group the linemate played in the most games of the window; a tie goes to the latest game (D-21). */
function dominantGroup(games: readonly LinemateGame[], id: number, fallback: "F" | "D"): "F" | "D" {
  const counts = { F: 0, D: 0 };
  const last = { F: -1, D: -1 };
  games.forEach((g, i) => {
    const group = g.pairs?.groups.get(id);
    if (group === "F" || group === "D") {
      counts[group]++;
      last[group] = i;
    }
  });
  if (counts.F === 0 && counts.D === 0) return fallback;
  if (counts.F !== counts.D) return counts.F > counts.D ? "F" : "D";
  return last.F > last.D ? "F" : "D";
}

/** Linemates of one skater in one situation: forwards and defense, recent time first (D-12, D-13). */
export function buildLinemateView(
  games: readonly LinemateGame[],
  players: ReadonlyMap<number, ResearchPlayer>,
  playerId: number,
  situation: Situation,
): LinemateView {
  const candidates = new Set<number>();
  for (const g of games) {
    for (const id of g.pairs?.together.get(playerId)?.keys() ?? []) candidates.add(id);
  }
  candidates.delete(playerId);

  const start = recentStart(games.length);
  const rows: LinemateRow[] = [];
  for (const id of candidates) {
    const player = players.get(id);
    if (!player || player.group === "G") continue;
    const cells = games.map((g) => linemateCell(g, playerId, id, situation));
    let together = 0;
    let self = 0;
    let recentSeconds = 0;
    cells.forEach((c, i) => {
      if (c.seconds === null || c.selfSeconds === null) return;
      together += c.seconds;
      self += c.selfSeconds;
      if (start !== null && i >= start) recentSeconds += c.seconds;
    });
    if (together < LINEMATE_MIN_SECONDS[situation]) continue;
    rows.push({
      player,
      group: dominantGroup(games, id, player.group),
      cells,
      windowShare: self > 0 ? together / self : null,
      recentSeconds,
      totalSeconds: together,
    });
  }
  rows.sort((a, b) => b.recentSeconds - a.recentSeconds || b.totalSeconds - a.totalSeconds || a.player.id - b.player.id);
  return {
    situation,
    forwards: rows.filter((r) => r.group === "F"),
    defense: rows.filter((r) => r.group === "D"),
  };
}

/** Fill opacity for a together square: 0.2 (little shared time) to 1 (the linemate had LINEMATE_SHADE_SATURATION_SHARE or more). */
export function linemateOpacity(share: number): number {
  return 0.2 + 0.8 * Math.min(1, Math.max(0, share / LINEMATE_SHADE_SATURATION_SHARE));
}

/** Two-line column headers for the games: the month shows on the first game and where it changes. */
export function gameColumnLabels(dates: readonly string[]): { month: string | null; day: string }[] {
  let previous: string | null = null;
  return dates.map((date) => {
    const [month, day] = formatDate(date).split(" ");
    const label = { month: month !== previous ? month : null, day };
    previous = month;
    return label;
  });
}

/** The facts for one heat-strip square. Absent and unknown games say why instead of showing numbers. */
export function linemateDetail(
  cell: LinemateCell,
  game: StripGame,
  names: { linemate: string; player: string },
  situation: Situation,
  team: string,
): GameDetail {
  const result = resultLabel(game);
  const abbrev = SITUATION_ABBREV[situation];
  const detail: GameDetail = {
    heading: names.linemate,
    title: `${formatDate(game.date)} ${gameLabel(game)}${result ? ` · ${result}` : ""}`,
    periodTag: game.overtime,
    rows: [],
    notes: [],
  };
  if (cell.state === "unknown") {
    detail.notes.push("No shift chart for this game", "Left out of shares and tags");
  } else if (cell.state === "absent") {
    detail.notes.push(
      cell.absentReason === "linemate-missed"
        ? `${names.linemate} did not play for ${team}`
        : cell.absentReason === "player-missed"
          ? `${names.player} did not play`
          : `${names.player} had no ${abbrev} time this game`,
    );
  } else {
    detail.rows.push(
      { label: "Together", value: formatClock(cell.seconds ?? 0) },
      { label: `Share of ${abbrev} time`, value: `${Math.round((cell.share ?? 0) * 100)}%` },
      { label: `Player's ${abbrev} time`, value: formatClock(cell.selfSeconds ?? 0) },
    );
  }
  return detail;
}
