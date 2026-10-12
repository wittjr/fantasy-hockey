import { ToiStripCell } from "@/components/ToiStripCell";
import { detailText, gameDetail, stripCellState, stripOpacity, type StripGame } from "@/lib/research/game-strip";
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
              className={`group/cell relative cursor-pointer block h-5 w-5 rounded-xs border outline-offset-2 hover:outline hover:outline-1 hover:outline-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100${ring}${outline}`}
            >
              {state === "played" && cell?.toi != null && row.avgToi !== null && (
                <span
                  className="block h-full w-full bg-neutral-800 dark:bg-neutral-200"
                  style={{ opacity: stripOpacity(cell.toi, row.avgToi) }}
                />
              )}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-max max-w-xs rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-900 shadow-md group-hover/cell:block group-focus-visible/cell:block group-data-[open]/cell:block dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <span className="grid grid-cols-[auto_auto] gap-x-3">
                  <span className="col-span-2 font-medium">
                    {detail.title}
                    {detail.periodTag && <span className="ml-1 rounded border border-sky-500 px-1">{detail.periodTag}</span>}
                  </span>
                  {detail.rows.map((r) => (
                    <PopoverRow key={r.label} label={r.label} value={r.value} muted={r.muted} />
                  ))}
                  {detail.notes.map((n) => (
                    <span key={n} className="col-span-2 text-neutral-600 dark:text-neutral-400">
                      {n}
                    </span>
                  ))}
                </span>
              </span>
            </ToiStripCell>
          );
        })}
      </div>
    </td>
  );
}

function PopoverRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  const tone = muted ? "text-neutral-500" : "text-neutral-600 dark:text-neutral-400";
  return (
    <>
      <span className={tone}>{label}</span>
      <span className={`text-right tabular-nums ${muted ? "text-neutral-500" : ""}`}>{value}</span>
    </>
  );
}
