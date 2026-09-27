"use client";

import { useCallback, useMemo, useState } from "react";
import { formatOffNights } from "@/lib/analysis/off-nights";
import { mapPositionToBucket } from "@/lib/fantrax/position-mapping";

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
  /** NHL games in the league's fantasy playoff weeks; null when the league has no playoffs or the team is unknown. */
  playoffGames: number | null;
  /** Games on nights with fewer than 8 NHL games in the fantasy regular season / playoffs; null when unknown or no playoffs. */
  offNightsRegular: number | null;
  offNightsPlayoff: number | null;
  /** Null when the spreadsheet row couldn't be matched to a Fantrax player - no Add/Hide then. */
  fantraxPlayerId: string | null;
  /** Fantrax's draft-room Rk / FPts / FP/G / ADP; null where Fantrax has none. */
  fantraxRank: number | null;
  fantraxFpts: number | null;
  fantraxFpg: number | null;
  fantraxAdp: number | null;
  /** On the user's watchlist (starred). */
  watched: boolean;
}

type SortKey = Exclude<keyof ProjectionRow, "id" | "fantraxPlayerId" | "offNightsPlayoff" | "watched">;

interface Column {
  key: SortKey;
  header: string;
  numeric?: boolean;
  format?: (v: number) => string;
  /** Overrides the cell text; the column still sorts by `key`. */
  render?: (p: ProjectionRow) => string;
  /** Direction used on first click - "higher is better" stats start descending. */
  defaultDir?: "asc" | "desc";
  /** Label on the merged first header row over consecutive columns sharing it. */
  group?: string;
  /** Plain header with no sort button or arrow space - saves width. */
  unsortable?: boolean;
  /** Hover text for a shortened header. */
  title?: string;
}

const CUSTOM = "Custom upload data";
const FANTRAX = "Fantrax data";
const SCHEDULE = "Schedule";

const COLUMNS: Column[] = [
  { key: "name", header: "Name", unsortable: true },
  { key: "position", header: "Pos", unsortable: true },
  { key: "nhlTeamAbbrev", header: "Team", unsortable: true },
  { key: "age", header: "Age", numeric: true, unsortable: true },
  { key: "rank", header: "RK", numeric: true, group: CUSTOM },
  { key: "fantasyPoints", header: "FP", numeric: true, format: (v) => v.toFixed(0), defaultDir: "desc", group: CUSTOM },
  { key: "fantasyPointsPerGp", header: "/GP", numeric: true, format: (v) => v.toFixed(2), defaultDir: "desc", group: CUSTOM },
  { key: "adp", header: "ADP", numeric: true, format: (v) => v.toFixed(1), group: CUSTOM },
  { key: "vorp", header: "VORP", numeric: true, format: (v) => v.toFixed(0), defaultDir: "desc", group: CUSTOM },
  { key: "fantraxRank", header: "Rk", numeric: true, group: FANTRAX },
  { key: "fantraxFpts", header: "FPts", numeric: true, format: (v) => v.toFixed(0), defaultDir: "desc", group: FANTRAX },
  { key: "fantraxFpg", header: "FP/G", numeric: true, format: (v) => v.toFixed(2), defaultDir: "desc", group: FANTRAX },
  { key: "fantraxAdp", header: "ADP", numeric: true, format: (v) => v.toFixed(1), group: FANTRAX },
  {
    key: "playoffGames",
    header: "PO",
    title: "Playoff games: NHL games during your fantasy playoffs",
    numeric: true,
    defaultDir: "desc",
    group: SCHEDULE,
  },
  {
    key: "offNightsRegular",
    header: "Off",
    title: "Off nights: games on nights with fewer than 8 NHL games (fantasy regular season / playoffs)",
    numeric: true,
    defaultDir: "desc",
    render: (p) => formatOffNights(p.offNightsRegular, p.offNightsPlayoff),
    group: SCHEDULE,
  },
];

// First header row: one cell per run of consecutive columns with the same group (blank if none).
const GROUP_SPANS = COLUMNS.reduce<Array<{ group?: string; span: number; key: string }>>((spans, c) => {
  const last = spans[spans.length - 1];
  if (last && last.group === c.group) last.span++;
  else spans.push({ group: c.group, span: 1, key: c.key });
  return spans;
}, []);

/** Vertical bars before and after each column group, down the header and every row. */
const EDGES = COLUMNS.map((c, i) => ({
  start: !!c.group && COLUMNS[i - 1]?.group !== c.group,
  end: !!c.group && COLUMNS[i + 1]?.group !== c.group,
}));
const DIVIDER = "border-neutral-300 dark:border-neutral-700";
const bodyDivider = ({ start, end }: { start: boolean; end: boolean }) =>
  start || end ? `${start ? "border-l" : ""} ${end ? "border-r" : ""} ${DIVIDER}` : "";
// Collapsed table borders are painted by the table, underneath the sticky header's background,
// so header cells draw their lines as inset shadows instead (color from --divider on <thead>).
const headerLines = (left: boolean, right: boolean) => {
  const shadows = [left && "inset 1px 0 0 var(--divider)", right && "inset -1px 0 0 var(--divider)"].filter(Boolean);
  return shadows.length ? { boxShadow: shadows.join(", ") } : undefined;
};

const VISIBLE_ROWS = 25;
const ROW_HEIGHT_REM = 2;
const GROUP_ROW_HEIGHT_REM = 1.5;

type FormAction = (formData: FormData) => void | Promise<void>;

export function ProjectionsTable({
  players,
  addAction,
  removeAction,
  season,
  positionBuckets,
  watchAction,
  clearWatchlistAction,
}: {
  players: ProjectionRow[];
  /** Same (formData) shape as PlayerStatsTable's addAction/removeAction - fantraxPlayerId + season as hidden fields. */
  addAction: FormAction;
  removeAction: FormAction;
  season: string;
  /** The league's roster slots (e.g. F/D/G) - the position filter's options. */
  positionBuckets: string[];
  /** Saves a star toggle. The star flips immediately; a failed save flips it back. */
  watchAction: (fantraxPlayerId: string, watched: boolean) => Promise<void>;
  /** Unstars every player; same optimistic handling as watchAction. */
  clearWatchlistAction: () => Promise<void>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [teamFilter, setTeamFilter] = useState("");
  const [bucketFilter, setBucketFilter] = useState("");
  const [watchFilter, setWatchFilter] = useState<"" | "watched" | "unwatched">("");
  // Star toggles made on this page, until the next server render brings them back in `players`.
  const [watchOverrides, setWatchOverrides] = useState<Map<string, boolean>>(new Map());
  const isWatched = useCallback(
    (p: ProjectionRow) => (p.fantraxPlayerId ? watchOverrides.get(p.fantraxPlayerId) : undefined) ?? p.watched,
    [watchOverrides]
  );

  function toggleWatch(p: ProjectionRow) {
    const id = p.fantraxPlayerId;
    if (!id) return;
    const next = !isWatched(p);
    const set = (value: boolean) => setWatchOverrides((m) => new Map(m).set(id, value));
    set(next);
    watchAction(id, next).catch(() => set(!next));
  }

  const watchedIds = players.filter(isWatched).flatMap((p) => (p.fantraxPlayerId ? [p.fantraxPlayerId] : []));

  function clearWatchlist() {
    if (!window.confirm(`Clear all ${watchedIds.length} players from your watchlist?`)) return;
    const before = watchOverrides;
    setWatchOverrides(new Map([...before, ...watchedIds.map((id) => [id, false] as const)]));
    clearWatchlistAction().catch(() => setWatchOverrides(before));
  }

  const teams = useMemo(
    () => [...new Set(players.map((p) => p.nhlTeamAbbrev).filter((t): t is string => !!t))].sort(),
    [players],
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    // A player fits a slot if any of their positions maps to it - C, LW, RW, F or "C,LW" all fill F.
    const fitsBucket = (position: string | null) =>
      !!position && position.split(",").some((pos) => mapPositionToBucket(pos, positionBuckets) === bucketFilter);
    return players
      .filter(
        (p) =>
          (!teamFilter || p.nhlTeamAbbrev === teamFilter) &&
          (!bucketFilter || fitsBucket(p.position)) &&
          (!watchFilter || isWatched(p) === (watchFilter === "watched"))
      )
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        // Blanks always sink to the bottom, whichever direction is active.
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
  }, [players, sortKey, sortDir, teamFilter, bucketFilter, watchFilter, isWatched, positionBuckets]);

  function onSort(col: Column) {
    if (col.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir(col.defaultDir ?? "asc");
    }
  }

  const selectClass =
    "rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          Position
          <select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)} className={selectClass}>
            <option value="">All</option>
            {positionBuckets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Team
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={selectClass}>
            <option value="">All</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Watchlist
          <select
            value={watchFilter}
            onChange={(e) => setWatchFilter(e.target.value as typeof watchFilter)}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="watched">On watchlist</option>
            <option value="unwatched">Not on watchlist</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setTeamFilter("");
            setBucketFilter("");
            setWatchFilter("");
          }}
          disabled={!teamFilter && !bucketFilter && !watchFilter}
          className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={clearWatchlist}
          disabled={watchedIds.length === 0}
          className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Clear watchlist
        </button>
        {(teamFilter || bucketFilter || watchFilter) && (
          <span className="text-neutral-500">
            Showing {sorted.length} of {players.length}
          </span>
        )}
      </div>
      {/* relative + isolate: without its own positioning/stacking context, Safari doesn't clip the
          table (with its sticky header) to this rounded scroll box, so rows spill out over the page. */}
      <div
        className="relative isolate overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800"
        style={{ maxHeight: `${GROUP_ROW_HEIGHT_REM + (VISIBLE_ROWS + 1) * ROW_HEIGHT_REM}rem` }}
      >
        <table className="w-full text-sm text-neutral-700 dark:text-neutral-300">
          <thead className="sticky top-0 z-10 bg-neutral-100 [--divider:var(--color-neutral-300)] dark:bg-neutral-900 dark:[--divider:var(--color-neutral-700)]">
            <tr style={{ height: `${GROUP_ROW_HEIGHT_REM}rem` }}>
              <th />
              <th />
              {GROUP_SPANS.map((g) => (
                <th
                  key={g.key}
                  colSpan={g.span}
                  style={g.group ? headerLines(true, true) : undefined}
                  className="px-3 text-center text-xs font-semibold whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                >
                  {g.group}
                </th>
              ))}
              <th />
            </tr>
            <tr style={{ height: `${ROW_HEIGHT_REM}rem` }}>
              <th className="pl-3 text-right text-xs font-medium text-neutral-500">#</th>
              <th className="pl-2">
                <span className="sr-only">Watchlist</span>
              </th>
              {COLUMNS.map((c, i) => {
                const active = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    aria-sort={
                      c.unsortable ? undefined : active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                    }
                    title={c.title}
                    style={headerLines(EDGES[i].start, EDGES[i].end)}
                    className={`px-3 text-xs font-medium whitespace-nowrap ${c.numeric ? "text-right" : "text-left"}`}
                  >
                    {c.unsortable ? (
                      <span className="text-neutral-500">{c.header}</span>
                    ) : (
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
                    )}
                  </th>
                );
              })}
              <th className="px-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, rowIndex) => (
              <tr
                key={p.id}
                style={{ height: `${ROW_HEIGHT_REM}rem` }}
                className="border-t border-neutral-100 even:bg-neutral-50 dark:border-neutral-900 dark:even:bg-neutral-900/40"
              >
                {/* Row number in the current filtered/sorted view - not a rank. */}
                <td className="pl-3 text-right text-xs text-neutral-400 tabular-nums dark:text-neutral-500">{rowIndex + 1}</td>
                <td className="pl-2">
                  {p.fantraxPlayerId && (
                    <WatchStar watched={isWatched(p)} onClick={() => toggleWatch(p)} />
                  )}
                </td>
                {COLUMNS.map((c, i) => {
                  const v = p[c.key];
                  const text = c.render
                    ? c.render(p)
                    : v == null
                      ? "—"
                      : typeof v === "number" && c.format
                        ? c.format(v)
                        : String(v);
                  return (
                    <td
                      key={c.key}
                      className={`px-3 whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : "text-left"} ${bodyDivider(EDGES[i])}`}
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
                          Hide
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
    </div>
  );
}

function WatchStar({ watched, onClick }: { watched: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={watched}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      className={`flex items-center ${watched ? "text-amber-400" : "text-neutral-400 hover:text-amber-400 dark:text-neutral-600"}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={watched ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinejoin="round"
          d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.49l-5.87 3.09 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z"
        />
      </svg>
      <span className="sr-only">{watched ? "Remove from watchlist" : "Add to watchlist"}</span>
    </button>
  );
}
