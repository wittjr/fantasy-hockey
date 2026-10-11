import { stripCellState, stripOpacity, type StripGame } from "@/lib/research/game-strip";
import type { TrendRow } from "@/lib/research/toi-trends";

/** One shaded square per team game, oldest left. Dashed = did not play (grey) or OT with no shift data (sky); sky ring = OT/SO. */
export function ToiGameStrip({ row, games }: { row: TrendRow; games: readonly StripGame[] }) {
  return (
    <td className="relative py-1 pr-3">
      <div role="group" aria-label="Per-game ice time, oldest to newest" className="flex gap-px">
        {games.map((game, i) => {
          const cell = row.perGame[i];
          const state = stripCellState(cell);
          const ring = state === "played" && game.overtime !== null ? " ring-1 ring-sky-500" : "";
          const outline =
            state === "dnp"
              ? " border border-dashed border-neutral-400 dark:border-neutral-600"
              : state === "excluded"
                ? " border border-dashed border-sky-500"
                : "";
          return (
            <span key={game.id} data-state={state} className={`block h-4 w-3 rounded-sm${ring}${outline}`}>
              {state === "played" && cell?.toi != null && row.avgToi !== null && (
                <span
                  className="block h-full w-full rounded-sm bg-neutral-800 dark:bg-neutral-200"
                  style={{ opacity: stripOpacity(cell.toi, row.avgToi) }}
                />
              )}
            </span>
          );
        })}
      </div>
    </td>
  );
}
