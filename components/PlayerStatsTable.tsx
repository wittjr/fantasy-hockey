import type { ReactNode } from "react";
import { PlayerFlagToggle } from "./PlayerFlagToggle";

export interface PlayerStatsRow {
  key: string;
  name: string;
  nhlTeamAbbrev?: string | null;
  position?: string;
  gamesAvailable?: number;
  rank: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
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
}

export function PlayerStatsTable({
  players,
  showTeam,
  showPosition,
  showConsider,
  showGamesAvailable,
  showFantraxAdp,
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
  showFantraxAdp?: boolean;
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
    { key: "rank", header: "RK", align: "right", render: (p) => p.rank ?? "—" },
    { key: "fp", header: "FP", align: "right", render: (p) => p.fantasyPoints?.toFixed(0) ?? "—" },
    { key: "gp", header: "/GP", align: "right", render: (p) => p.fantasyPointsPerGp?.toFixed(2) ?? "—" },
    { key: "vorp", header: "VORP", align: "right", render: (p) => p.vorp?.toFixed(0) ?? "—" },
    { key: "adp", header: "ADP", align: "right", render: (p) => p.adp?.toFixed(1) ?? "—" },
    ...(showFantraxAdp
      ? [
          {
            key: "fantraxAdp",
            header: "Fantrax ADP",
            align: "right" as const,
            render: (p: PlayerStatsRow) => p.fantraxAdp?.toFixed(1) ?? "—",
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

  return (
    <table className="border-separate border-spacing-x-3 border-spacing-y-1 text-sm text-neutral-700 dark:text-neutral-300">
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              className={`text-xs font-medium text-neutral-400 dark:text-neutral-500 ${
                c.align === "right" ? "text-right" : "text-left"
              }`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.key} className="even:bg-neutral-50 dark:even:bg-neutral-900/40">
            {columns.map((c) => (
              <td key={c.key} className={`py-1 ${c.align === "right" ? "text-right tabular-nums" : "text-left"}`}>
                {c.render(p)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
