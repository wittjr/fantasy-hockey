import type { ReactNode } from "react";
import { formatOffNights } from "@/lib/analysis/off-nights";
import { PlayerFlagToggle } from "./PlayerFlagToggle";

export interface PlayerStatsRow {
  key: string;
  name: string;
  nhlTeamAbbrev?: string | null;
  position?: string;
  gamesAvailable?: number;
  playoffGames?: number | null;
  offNightsRegular?: number | null;
  offNightsPlayoff?: number | null;
  rank: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
  fantraxRank?: number | null;
  fantraxFpts?: number | null;
  fantraxFpg?: number | null;
  fantraxAdp?: number | null;
  fantraxPlayerId?: string | null;
  isConsidered?: boolean;
  isProgrammatic?: boolean;
  considerAction?: (formData: FormData) => void | Promise<void>;
}

interface Column {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (p: PlayerStatsRow) => ReactNode;
  /** Label on the merged first header row over consecutive columns sharing it. */
  group?: string;
  /** Hover text for a shortened header. */
  title?: string;
}

const CUSTOM = "Custom upload data";
const FANTRAX = "Fantrax data";
const SCHEDULE = "Schedule";
const DIVIDER = "border-neutral-300 dark:border-neutral-700";

export function PlayerStatsTable({
  players,
  showTeam,
  showPosition,
  showConsider,
  showGamesAvailable,
  showPlayoffGames,
  showOffNightGames,
  showFantraxAdp,
  showFantraxData,
  addAction,
  removeAction,
  season,
}: {
  players: PlayerStatsRow[];
  showTeam?: boolean;
  showPosition?: boolean;
  /** Adds a "Consider" checkbox column - each row needs isConsidered/considerAction set. */
  showConsider?: boolean;
  showGamesAvailable?: boolean;
  /** NHL games in the league's fantasy playoff weeks - each row needs playoffGames set. */
  showPlayoffGames?: boolean;
  /** Games on nights with fewer than 8 NHL games, as regular/playoff - each row needs offNightsRegular/offNightsPlayoff set. */
  showOffNightGames?: boolean;
  showFantraxAdp?: boolean;
  /** Fantrax's draft-room Rk / FPts / FP/G / ADP - each row needs fantraxRank/Fpts/Fpg/Adp set. */
  showFantraxData?: boolean;
  /**
   * When provided, adds an "Add" button per row (skipped for rows with no fantraxPlayerId).
   * Takes plain FormData - fantraxPlayerId and season are sent as hidden fields, matching
   * addDraftTargetAction's (userLeagueId, formData) signature.
   */
  addAction?: (formData: FormData) => void | Promise<void>;
  /** Same shape as addAction, for a "Remove" button (e.g. player got drafted by someone else). */
  removeAction?: (formData: FormData) => void | Promise<void>;
  season?: string;
}) {
  const columns: Column[] = [
    ...(showConsider
      ? [
          {
            key: "consider",
            header: "Consider",
            render: (p: PlayerStatsRow) =>
              p.considerAction ? (
                <PlayerFlagToggle action={p.considerAction} name="isKept" label="" defaultChecked={p.isConsidered ?? false} />
              ) : null,
          },
        ]
      : []),
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <>
          {p.name}
          {showConsider && p.isConsidered && p.isProgrammatic && (
            <span className="ml-1.5 rounded bg-neutral-200 px-1 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600 uppercase dark:bg-neutral-800 dark:text-neutral-400">
              Likely
            </span>
          )}
          {showConsider && !p.isProgrammatic && (
            <span
              className={`ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                p.isConsidered
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500"
              }`}
            >
              {p.isConsidered ? "Manually kept" : "Manually excluded"}
            </span>
          )}
        </>
      ),
    },
    ...(showPosition ? [{ key: "position", header: "Pos", render: (p: PlayerStatsRow) => p.position ?? "—" }] : []),
    ...(showTeam
      ? [
          {
            key: "team",
            header: "Team",
            render: (p: PlayerStatsRow) =>
              p.nhlTeamAbbrev ? (
                <span className="rounded bg-teal-50 px-1.5 py-0.5 font-medium text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  {p.nhlTeamAbbrev}
                </span>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    ...(showGamesAvailable
      ? [
          {
            key: "gamesAvailable",
            header: "Games Available",
            align: "right" as const,
            render: (p: PlayerStatsRow) => p.gamesAvailable ?? "—",
          },
        ]
      : []),
    { key: "rank", header: "RK", align: "right", group: CUSTOM, render: (p) => p.rank ?? "—" },
    { key: "fp", header: "FP", align: "right", group: CUSTOM, render: (p) => p.fantasyPoints?.toFixed(0) ?? "—" },
    { key: "gp", header: "/GP", align: "right", group: CUSTOM, render: (p) => p.fantasyPointsPerGp?.toFixed(2) ?? "—" },
    { key: "adp", header: "ADP", align: "right", group: CUSTOM, render: (p) => p.adp?.toFixed(1) ?? "—" },
    { key: "vorp", header: "VORP", align: "right", group: CUSTOM, render: (p) => p.vorp?.toFixed(0) ?? "—" },
    ...(showFantraxData
      ? [
          { key: "fantraxRank", header: "Rk", render: (p: PlayerStatsRow) => p.fantraxRank ?? "—" },
          { key: "fantraxFpts", header: "FPts", render: (p: PlayerStatsRow) => p.fantraxFpts?.toFixed(0) ?? "—" },
          { key: "fantraxFpg", header: "FP/G", render: (p: PlayerStatsRow) => p.fantraxFpg?.toFixed(2) ?? "—" },
        ].map((c) => ({ ...c, align: "right" as const, group: FANTRAX }))
      : []),
    ...(showFantraxData || showFantraxAdp
      ? [
          {
            key: "fantraxAdp",
            header: "ADP",
            align: "right" as const,
            group: FANTRAX,
            render: (p: PlayerStatsRow) => p.fantraxAdp?.toFixed(1) ?? "—",
          },
        ]
      : []),
    ...(showPlayoffGames
      ? [
          {
            key: "playoffGames",
            header: "PO",
            title: "Playoff games: NHL games during your fantasy playoffs",
            align: "right" as const,
            group: SCHEDULE,
            render: (p: PlayerStatsRow) => p.playoffGames ?? "—",
          },
        ]
      : []),
    ...(showOffNightGames
      ? [
          {
            key: "offNightGames",
            header: "Off",
            title: "Off nights: games on nights with fewer than 8 NHL games (fantasy regular season / playoffs)",
            align: "right" as const,
            group: SCHEDULE,
            render: (p: PlayerStatsRow) => formatOffNights(p.offNightsRegular, p.offNightsPlayoff),
          },
        ]
      : []),
    ...(addAction
      ? [
          {
            key: "add",
            header: "",
            align: "right" as const,
            render: (p: PlayerStatsRow) =>
              p.fantraxPlayerId ? (
                <form action={addAction}>
                  <input type="hidden" name="fantraxPlayerId" value={p.fantraxPlayerId} />
                  <input type="hidden" name="season" value={season ?? ""} />
                  <button
                    type="submit"
                    className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Add
                  </button>
                </form>
              ) : null,
          },
        ]
      : []),
    ...(removeAction
      ? [
          {
            key: "remove",
            header: "",
            align: "right" as const,
            render: (p: PlayerStatsRow) =>
              p.fantraxPlayerId ? (
                <form action={removeAction}>
                  <input type="hidden" name="fantraxPlayerId" value={p.fantraxPlayerId} />
                  <input type="hidden" name="season" value={season ?? ""} />
                  <button
                    type="submit"
                    className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  >
                    Remove
                  </button>
                </form>
              ) : null,
          },
        ]
      : []),
  ];

  // First header row: one cell per run of consecutive columns with the same group (blank if none),
  // and vertical bars before and after each group, down the header and every row.
  const groupSpans = columns.reduce<Array<{ group?: string; span: number; key: string }>>((spans, c) => {
    const last = spans[spans.length - 1];
    if (last && last.group === c.group) last.span++;
    else spans.push({ group: c.group, span: 1, key: c.key });
    return spans;
  }, []);
  const dividers = columns.map((c, i) => {
    if (!c.group) return "";
    const start = columns[i - 1]?.group !== c.group ? "border-l" : "";
    const end = columns[i + 1]?.group !== c.group ? "border-r" : "";
    return start || end ? `${start} ${end} ${DIVIDER}` : "";
  });

  return (
    <table className="text-sm text-neutral-700 dark:text-neutral-300">
      <thead>
        <tr>
          {groupSpans.map((g) => (
            <th
              key={g.key}
              colSpan={g.span}
              className={`px-1.5 text-center text-xs font-semibold whitespace-nowrap text-neutral-500 dark:text-neutral-400 ${
                g.group ? `border-x ${DIVIDER}` : ""
              }`}
            >
              {g.group}
            </th>
          ))}
        </tr>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c.key}
              title={c.title}
              className={`px-1.5 pb-1 text-xs font-medium whitespace-nowrap text-neutral-400 dark:text-neutral-500 ${
                c.align === "right" ? "text-right" : "text-left"
              } ${dividers[i]}`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.key} className="even:bg-neutral-50 dark:even:bg-neutral-900/40">
            {columns.map((c, i) => (
              <td
                key={c.key}
                className={`px-1.5 py-1 ${c.align === "right" ? "text-right tabular-nums" : "text-left"} ${dividers[i]}`}
              >
                {c.render(p)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
