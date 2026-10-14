import { formatClock, formatDate, gameLabel, resultLabel } from "./format";
import type { ResearchGame } from "./team-games";
import type { PerGameCell } from "./toi-trends";

// A game this far above or below the player's own average saturates the shade.
export const STRIP_SHADE_RANGE_SECONDS = 120;

/** Fill opacity for a played game: 0.2 (well under average) to 1 (well over). The floor keeps a short game visibly filled, unlike a dashed missed game. */
export function stripOpacity(toi: number, avgToi: number): number {
  const t = (toi - avgToi + STRIP_SHADE_RANGE_SECONDS) / (2 * STRIP_SHADE_RANGE_SECONDS);
  return 0.2 + 0.8 * Math.min(1, Math.max(0, t));
}

/** Shared by the Per game strip and the linemate heat strip so the two squares cannot drift. */
export const STRIP_SQUARE_CLASS =
  "group/cell relative cursor-pointer block h-5 w-5 rounded-xs border outline-offset-2 hover:outline hover:outline-1 hover:outline-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100";

export type StripCellState = "played" | "dnp" | "excluded";

/** dnp: did not dress; excluded: dressed but regulation TOI unknown (OT/SO game with no shift data). */
export function stripCellState(cell: PerGameCell | null): StripCellState {
  if (cell === null) return "dnp";
  return cell.toi === null ? "excluded" : "played";
}

export type StripGame = Pick<ResearchGame, "id" | "date" | "home" | "opponent" | "score" | "overtime">;

export interface GameDetail {
  /** A line above the title, e.g. the linemate's name; absent for the Per game strip. */
  heading?: string;
  title: string;
  periodTag: "OT" | "SO" | null;
  rows: { label: string; value: string; muted?: boolean }[];
  notes: string[];
}

/** The facts shown for one strip cell. Unknown values are dashes and a missed game has no numbers, never 0:00. */
export function gameDetail(cell: PerGameCell | null, game: StripGame): GameDetail {
  const result = resultLabel(game);
  const title = `${formatDate(game.date)} ${gameLabel(game)}${result ? ` · ${result}` : ""}`;
  const detail: GameDetail = { title, periodTag: game.overtime, rows: [], notes: [] };
  if (cell === null) {
    detail.notes.push("Did not play");
    return detail;
  }
  if (cell.toi !== null) {
    detail.rows.push({ label: "TOI", value: formatClock(cell.toi) });
    if (game.overtime) {
      detail.rows.push({ label: "OT excluded", value: `+${formatClock(cell.totalToi - cell.toi)}`, muted: true });
    }
  } else {
    detail.rows.push({ label: "TOI", value: "—" }, { label: "Total (incl. OT)", value: formatClock(cell.totalToi) });
    detail.notes.push("Excluded from averages: no shift data for overtime");
  }
  if (cell.pp === null || cell.sh === null) {
    detail.rows.push({ label: "PP", value: "—" }, { label: "SH", value: "—" });
    detail.notes.push("No PP/SH data (shift chart not published yet, or it failed to load)");
  } else {
    const share = cell.ppShare !== null ? ` (${Math.round(cell.ppShare)}% of team PP)` : "";
    detail.rows.push({ label: "PP", value: `${formatClock(cell.pp)}${share}` }, { label: "SH", value: formatClock(cell.sh) });
  }
  return detail;
}

/** One line for the cell's aria-label. */
export function detailText(detail: GameDetail): string {
  return [detail.heading, detail.title, detail.periodTag, ...detail.rows.map((r) => `${r.label} ${r.value}`), ...detail.notes]
    .filter(Boolean)
    .join(" · ");
}
