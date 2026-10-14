import { Fragment } from "react";
import { PlayerLink } from "@/components/PlayerLink";
import { formatDate, gameLabel, resultLabel } from "@/lib/research/format";
import type { Situation } from "@/lib/research/lines";
import { SITUATION_ABBREV } from "@/lib/research/linemates";
import type { TeamResearch } from "@/lib/research/team-games";
import type { SortSpec } from "@/lib/research/toi-trends";
import {
  buildUnitTable,
  DASH,
  exclusionsNote,
  missingPlayByPlayNote,
  topNotes,
  UNIT_LEGEND,
  type UnitStats,
  type UnitSummaryRow,
  type UnitTableView,
} from "@/lib/research/unit-events-view";

const DIVIDER = "border-l border-neutral-200 dark:border-neutral-800";

/** The nine stat columns in display order; `start` columns open a Goals, Shots or Corsi group and carry its divider. */
const STAT_COLUMNS: { key: keyof UnitStats; label: string; title: string; width: string; start?: boolean; derived?: boolean }[] = [
  { key: "gf", label: "GF", title: "Goals for", width: "w-12", start: true },
  { key: "ga", label: "GA", title: "Goals against", width: "w-12" },
  { key: "plusMinus", label: "+/-", title: "Goals for minus goals against", width: "w-12" },
  { key: "sf", label: "SF", title: "Shots on goal for", width: "w-12", start: true },
  { key: "sa", label: "SA", title: "Shots on goal against", width: "w-12" },
  { key: "sfPct", label: "SF%", title: "Share of shots on goal", width: "w-14", derived: true },
  { key: "cf", label: "CF", title: "Shot attempts for", width: "w-12", start: true },
  { key: "ca", label: "CA", title: "Shot attempts against", width: "w-12" },
  { key: "cfPct", label: "CF%", title: "Share of shot attempts", width: "w-14", derived: true },
];

/** Each name links to that player's panel on the table's own situation tab, so a PP name opens the PP tab. */
export function LastGameLines({
  research,
  team,
  gameCount,
  sort,
  sit,
  selected,
}: {
  research: TeamResearch;
  /** The requested team and window, kept in the name links. */
  team: string;
  gameCount: number;
  sort: SortSpec;
  /** The panel's situation and the selected player, if any. */
  sit: Situation;
  selected: number | null;
}) {
  const game = research.games[research.games.length - 1];
  const name = (id: number) => research.players.get(id)?.name ?? String(id);
  const exclusions = exclusionsNote(game.events);
  const olderDates = missingPlayByPlayNote(research.games);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">
        Last game: {formatDate(game.date)} {gameLabel(game)}{" "}
        <span className="text-neutral-500">{resultLabel(game)}</span>
      </h2>
      {!game.lines ? (
        <p className="text-sm text-neutral-500">No shift chart is available for this game (not published yet, or it failed to load).</p>
      ) : (
        <>
          {topNotes(game).map((note) => (
            <p key={note} className="text-xs text-amber-600 dark:text-amber-400">
              {note}
            </p>
          ))}
          <div className="flex flex-col gap-6">
            {(["ev", "pp", "sh"] as const).flatMap((situation) =>
              (["F", "D"] as const).map((group) => (
                <div key={`${situation}-${group}`} className="overflow-x-auto">
                  <UnitTable
                    title={`${SITUATION_ABBREV[situation]} - ${group === "F" ? "Forwards" : "Defense"}`}
                    view={buildUnitTable(game.lines!, game.events, situation, group)}
                    name={name}
                    situation={situation}
                    link={{ team, gameCount, sort, sit, selected }}
                  />
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-neutral-500">
            {exclusions && <p>{exclusions}</p>}
            {UNIT_LEGEND.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {olderDates && <p className="text-xs text-amber-600 dark:text-amber-400">{olderDates}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function StatCells({ stats }: { stats: UnitStats }) {
  return STAT_COLUMNS.map((c) => {
    const value = stats[c.key];
    const tone = value === DASH ? "text-neutral-400 dark:text-neutral-500" : c.derived ? "text-neutral-500" : "";
    return (
      <td key={c.key} className={`py-1 pl-3 text-right tabular-nums whitespace-nowrap ${tone} ${c.start ? DIVIDER : ""}`}>
        {value}
      </td>
    );
  });
}

/** The Other and Total rows: no number, the label sits in the line column. */
function SummaryRow({ row, label, className }: { row: UnitSummaryRow; label: string; className: string }) {
  return (
    <tr className={className}>
      <td className="py-1" />
      <td className="py-1 tabular-nums">{row.time}</td>
      <td className="py-1 tabular-nums text-neutral-500">{row.pct}</td>
      <td className="py-1">{label}</td>
      <StatCells stats={row.stats} />
    </tr>
  );
}

function UnitTable({
  title,
  view,
  name,
  situation,
  link,
}: {
  title: string;
  view: UnitTableView;
  name: (id: number) => string;
  situation: Situation;
  link: { team: string; gameCount: number; sort: SortSpec; sit: Situation; selected: number | null };
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <td colSpan={4} />
          {["Goals", "Shots", "Corsi"].map((group) => (
            <th key={group} scope="colgroup" colSpan={3} className={`${DIVIDER} pl-3 pt-1 text-left text-xs font-medium text-neutral-500`}>
              {group}
            </th>
          ))}
        </tr>
        <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
          <th scope="col" className="w-10 py-1 font-medium">#</th>
          <th scope="col" className="w-14 py-1 font-medium">Time</th>
          <th scope="col" className="w-14 py-1 font-medium">%</th>
          <th scope="col" className="py-1 font-medium">{title}</th>
          {STAT_COLUMNS.map((c) => (
            <th key={c.key} scope="col" title={c.title} className={`${c.width} py-1 pl-3 text-right font-medium ${c.start ? DIVIDER : ""}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {view.rows.length === 0 ? (
          <tr>
            <td colSpan={13} className="py-1 text-neutral-400">
              None
            </td>
          </tr>
        ) : (
          view.rows.map((u, i) => (
            <tr key={u.playerIds.join(",")} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-1 text-neutral-500">{i + 1}</td>
              <td className="py-1 tabular-nums">{u.time}</td>
              <td className="py-1 tabular-nums text-neutral-500">{u.pct}</td>
              <td className="py-1">
                {u.playerIds.map((id, n) => (
                  <Fragment key={id}>
                    {n > 0 && (
                      <span aria-hidden className="mx-1">
                        –
                      </span>
                    )}
                    <PlayerLink
                      playerId={id}
                      name={name(id)}
                      sit={situation}
                      selectedSit={id === link.selected ? link.sit : null}
                      team={link.team}
                      gameCount={link.gameCount}
                      sort={link.sort}
                      title={`Show who ${name(id)} plays with at ${SITUATION_ABBREV[situation]}`}
                      overlaySpinner
                    />
                  </Fragment>
                ))}
              </td>
              <StatCells stats={u.stats} />
            </tr>
          ))
        )}
        {view.other && (
          <SummaryRow
            row={view.other}
            label="Other"
            className="border-b border-neutral-100 text-neutral-600 dark:border-neutral-900 dark:text-neutral-400"
          />
        )}
        {view.total && <SummaryRow row={view.total} label="Total" className="border-t border-neutral-300 font-medium dark:border-neutral-700" />}
      </tbody>
    </table>
  );
}
