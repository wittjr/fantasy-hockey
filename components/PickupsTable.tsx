"use client";

import { useMemo, useState } from "react";

export interface PickupRow {
  key: string;
  name: string;
  /** e.g. "C · NYR" */
  detail: string;
  startCount: number;
  /** W's start days, e.g. "Tue Thu Sat". */
  startDaysLabel: string;
  /** Start days in W+1 beyond W, or null when there's no following week. */
  nextWeekStarts: number | null;
  fpg: number | null;
  fpW: number | null;
  fpW1: number | null;
}

type SortKey = "fpg" | "fpW" | "fpW1";

const SORTABLE: Array<{ key: SortKey; header: string }> = [
  { key: "fpg", header: "FP/G" },
  { key: "fpW", header: "+FP W" },
  { key: "fpW1", header: "+FP W+1" },
];

/**
 * Recommended pickups for one position. Gets more rows than it shows so sorting by a
 * different column surfaces the best players by that measure, not just re-orders the top few.
 */
export function PickupsTable({ rows, visibleRows }: { rows: PickupRow[]; visibleRows: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("fpW");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const shown = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows]
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        // Blanks always sink to the bottom, whichever direction is active.
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      })
      .slice(0, visibleRows);
  }, [rows, sortKey, sortDir, visibleRows]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-neutral-400 dark:text-neutral-500">
          <th className="text-left font-medium">Player</th>
          <th className="text-left font-medium">Days started</th>
          {SORTABLE.map((c) => {
            const active = c.key === sortKey;
            return (
              <th
                key={c.key}
                aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                className="text-right font-medium whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className={`inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 ${
                    active ? "text-neutral-900 dark:text-neutral-100" : ""
                  }`}
                >
                  {c.header}
                  <span aria-hidden className={active ? "" : "invisible"}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.key} className="even:bg-neutral-50 dark:even:bg-neutral-900/40">
            <td className="py-1 pr-2">
              {r.name}
              <span className="ml-1.5 text-xs text-neutral-500">{r.detail}</span>
            </td>
            <td className="py-1 pr-2 text-neutral-500">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{r.startCount}</span>{" "}
              {r.startDaysLabel || "—"}
              {r.nextWeekStarts !== null ? <span className="ml-1.5 text-xs">+{r.nextWeekStarts} next</span> : null}
            </td>
            <td className="py-1 text-right tabular-nums">{r.fpg?.toFixed(2) ?? "—"}</td>
            <td className="py-1 text-right tabular-nums">{r.fpW?.toFixed(1) ?? "—"}</td>
            <td className="py-1 text-right tabular-nums">{r.fpW1?.toFixed(1) ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
