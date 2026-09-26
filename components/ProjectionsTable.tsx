"use client";

import { useMemo, useState } from "react";

export interface ProjectionRow {
  id: string;
  rank: number | null;
  name: string;
  position: string | null;
  nhlTeamAbbrev: string | null;
  age: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
  /** Null when the spreadsheet row couldn't be matched to a Fantrax player - no Add/Remove then. */
  fantraxPlayerId: string | null;
}

type SortKey = Exclude<keyof ProjectionRow, "id" | "fantraxPlayerId">;

interface Column {
  key: SortKey;
  header: string;
  numeric?: boolean;
  format?: (v: number) => string;
  /** Direction used on first click - "higher is better" stats start descending. */
  defaultDir?: "asc" | "desc";
}

const COLUMNS: Column[] = [
  { key: "rank", header: "RK", numeric: true },
  { key: "name", header: "Name" },
  { key: "position", header: "Pos" },
  { key: "nhlTeamAbbrev", header: "Team" },
  { key: "age", header: "Age", numeric: true },
  { key: "fantasyPoints", header: "FP", numeric: true, format: (v) => v.toFixed(0), defaultDir: "desc" },
  { key: "fantasyPointsPerGp", header: "/GP", numeric: true, format: (v) => v.toFixed(2), defaultDir: "desc" },
  { key: "vorp", header: "VORP", numeric: true, format: (v) => v.toFixed(0), defaultDir: "desc" },
  { key: "adp", header: "ADP", numeric: true, format: (v) => v.toFixed(1) },
];

const VISIBLE_ROWS = 25;
const ROW_HEIGHT_REM = 2;

type FormAction = (formData: FormData) => void | Promise<void>;

export function ProjectionsTable({
  players,
  addAction,
  removeAction,
  season,
}: {
  players: ProjectionRow[];
  /** Same (formData) shape as PlayerStatsTable's addAction/removeAction - fantraxPlayerId + season as hidden fields. */
  addAction: FormAction;
  removeAction: FormAction;
  season: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...players].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Blanks always sink to the bottom, whichever direction is active.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [players, sortKey, sortDir]);

  function onSort(col: Column) {
    if (col.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir(col.defaultDir ?? "asc");
    }
  }

  return (
    // relative + isolate: without its own positioning/stacking context, Safari doesn't clip the
    // table (with its sticky header) to this rounded scroll box, so rows spill out over the page.
    <div
      className="relative isolate overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800"
      style={{ maxHeight: `${(VISIBLE_ROWS + 1) * ROW_HEIGHT_REM}rem` }}
    >
      <table className="w-full text-sm text-neutral-700 dark:text-neutral-300">
        <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
          <tr style={{ height: `${ROW_HEIGHT_REM}rem` }}>
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className={`px-3 text-xs font-medium whitespace-nowrap ${c.numeric ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c)}
                    className={`inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 ${
                      active ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500"
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
            <th className="px-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.id}
              style={{ height: `${ROW_HEIGHT_REM}rem` }}
              className="border-t border-neutral-100 even:bg-neutral-50 dark:border-neutral-900 dark:even:bg-neutral-900/40"
            >
              {COLUMNS.map((c) => {
                const v = p[c.key];
                const text = v == null ? "—" : typeof v === "number" && c.format ? c.format(v) : String(v);
                return (
                  <td
                    key={c.key}
                    className={`px-3 whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : "text-left"}`}
                  >
                    {text}
                  </td>
                );
              })}
              <td className="px-3 text-right whitespace-nowrap">
                {p.fantraxPlayerId && (
                  <div className="inline-flex gap-1.5">
                    <form action={addAction}>
                      <input type="hidden" name="fantraxPlayerId" value={p.fantraxPlayerId} />
                      <input type="hidden" name="season" value={season} />
                      <button
                        type="submit"
                        className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Add
                      </button>
                    </form>
                    <form action={removeAction}>
                      <input type="hidden" name="fantraxPlayerId" value={p.fantraxPlayerId} />
                      <input type="hidden" name="season" value={season} />
                      <button
                        type="submit"
                        className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
