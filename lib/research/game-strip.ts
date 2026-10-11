import type { ResearchGame } from "./team-games";
import type { PerGameCell } from "./toi-trends";

// A game this far above or below the player's own average saturates the shade.
export const STRIP_SHADE_RANGE_SECONDS = 120;

/** Fill opacity for a played game: 0.2 (well under average) to 1 (well over). The floor keeps a short game visibly filled, unlike a dashed missed game. */
export function stripOpacity(toi: number, avgToi: number): number {
  const t = (toi - avgToi + STRIP_SHADE_RANGE_SECONDS) / (2 * STRIP_SHADE_RANGE_SECONDS);
  return 0.2 + 0.8 * Math.min(1, Math.max(0, t));
}

export type StripCellState = "played" | "dnp" | "excluded";

/** dnp: did not dress; excluded: dressed but regulation TOI unknown (OT/SO game with no shift data). */
export function stripCellState(cell: PerGameCell | null): StripCellState {
  if (cell === null) return "dnp";
  return cell.toi === null ? "excluded" : "played";
}

export type StripGame = Pick<ResearchGame, "id" | "date" | "home" | "opponent" | "score" | "overtime">;
