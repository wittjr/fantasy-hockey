import { StripPopover } from "@/components/StripPopover";
import { ToiStripCell } from "@/components/ToiStripCell";
import { detailText, gameDetail, STRIP_SQUARE_CLASS, stripCellState, stripOpacity, type StripGame } from "@/lib/research/game-strip";
import type { TrendRow } from "@/lib/research/toi-trends";

/**
 * One shaded, bordered 20x20 square per team game, oldest left. Dashed = did not play (grey) or OT with no shift data (sky); sky ring = OT/SO.
 * The popover opens on click or tap (ToiStripCell), mouse hover or keyboard focus, under the square and right-aligned to it,
 * so it grows left over the table's own columns and never runs past the scroll wrapper's right edge. It takes no pointer
 * events, so it never blocks the squares under it. This file stays a server component; only the square is client code.
 */
export function ToiGameStrip({ row, games }: { row: TrendRow; games: readonly StripGame[] }) {
  return (
    <td className="py-1 pr-3">
      <div role="group" aria-label="Per-game ice time, oldest to newest" className="flex gap-1">
        {games.map((game, i) => {
          const cell = row.perGame[i];
          const state = stripCellState(cell);
          const ring = state === "played" && game.overtime !== null ? " ring-1 ring-sky-500" : "";
          const outline =
            state === "dnp"
              ? " border-dashed border-neutral-400 dark:border-neutral-600"
              : state === "excluded"
                ? " border-dashed border-sky-500"
                : " border-neutral-300 dark:border-neutral-700";
          const detail = gameDetail(cell, game);
          return (
            <ToiStripCell
              key={game.id}
              state={state}
              label={detailText(detail)}
              className={`${STRIP_SQUARE_CLASS}${ring}${outline}`}
            >
              {state === "played" && cell?.toi != null && row.avgToi !== null && (
                <span
                  className="block h-full w-full bg-neutral-800 dark:bg-neutral-200"
                  style={{ opacity: stripOpacity(cell.toi, row.avgToi) }}
                />
              )}
              <StripPopover detail={detail} />
            </ToiStripCell>
          );
        })}
      </div>
    </td>
  );
}
