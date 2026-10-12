import type { GameDetail } from "@/lib/research/game-strip";

/**
 * The popover for one strip square, shared by the Per game strip and the linemate heat strip so the two cannot drift.
 * It opens under the square and right-aligned to it, so it grows left over the table's own columns and never runs past
 * the scroll wrapper's right edge. It takes no pointer events, so it never blocks the squares under it. The square
 * (ToiStripCell) shows it on hover, keyboard focus or while it carries data-open; assistive tech reads the square's
 * aria-label instead. Server component.
 */
export function StripPopover({ detail }: { detail: GameDetail }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-max max-w-xs rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-900 shadow-md group-hover/cell:block group-focus-visible/cell:block group-data-[open]/cell:block dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
    >
      <span className="grid grid-cols-[auto_auto] gap-x-3">
        {detail.heading && <span className="col-span-2 font-medium">{detail.heading}</span>}
        <span className={detail.heading ? "col-span-2 text-neutral-600 dark:text-neutral-400" : "col-span-2 font-medium"}>
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
