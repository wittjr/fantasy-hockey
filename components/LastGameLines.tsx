import { Fragment } from "react";
import { PlayerLink } from "@/components/PlayerLink";
import { formatClock, formatDate, gameLabel, resultLabel } from "@/lib/research/format";
import type { Situation, Unit } from "@/lib/research/lines";
import { SITUATION_ABBREV } from "@/lib/research/linemates";
import type { TeamResearch } from "@/lib/research/team-games";
import type { SortSpec } from "@/lib/research/toi-trends";

const UNIT_LIMITS: Record<Situation, { F: number; D: number }> = {
  ev: { F: 4, D: 3 },
  pp: { F: 2, D: 2 },
  sh: { F: 3, D: 3 },
};

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

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">
        Last game: {formatDate(game.date)} {gameLabel(game)}{" "}
        <span className="text-neutral-500">{resultLabel(game)}</span>
      </h2>
      {!game.lines ? (
        <p className="text-sm text-neutral-500">No shift chart is available for this game (not published yet, or it failed to load).</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(["ev", "pp", "sh"] as const).flatMap((situation) =>
            (["F", "D"] as const).map((group) => (
              <UnitTable
                key={`${situation}-${group}`}
                title={`${SITUATION_ABBREV[situation]} - ${group === "F" ? "Forwards" : "Defense"}`}
                units={game.lines!.units[situation][group].slice(0, UNIT_LIMITS[situation][group])}
                name={name}
                situation={situation}
                link={{ team, gameCount, sort, sit, selected }}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function UnitTable({
  title,
  units,
  name,
  situation,
  link,
}: {
  title: string;
  units: Unit[];
  name: (id: number) => string;
  situation: Situation;
  link: { team: string; gameCount: number; sort: SortSpec; sit: Situation; selected: number | null };
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
          <th className="w-10 py-1 font-medium">#</th>
          <th className="w-14 py-1 font-medium">Time</th>
          <th className="w-14 py-1 font-medium">%</th>
          <th className="py-1 font-medium">{title}</th>
        </tr>
      </thead>
      <tbody>
        {units.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-1 text-neutral-400">
              None
            </td>
          </tr>
        ) : (
          units.map((u, i) => (
            <tr key={u.playerIds.join(",")} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-1 text-neutral-500">{i + 1}</td>
              <td className="py-1 tabular-nums">{formatClock(u.seconds)}</td>
              <td className="py-1 tabular-nums text-neutral-500">{u.pct.toFixed(1)}</td>
              <td className="py-1">
                {u.playerIds.map((id, n) => (
                  <Fragment key={id}>
                    {n > 0 && <span aria-hidden> – </span>}
                    <PlayerLink
                      playerId={id}
                      name={name(id)}
                      sit={situation}
                      selectedSit={id === link.selected ? link.sit : null}
                      team={link.team}
                      gameCount={link.gameCount}
                      sort={link.sort}
                      title={`Show who ${name(id)} plays with at ${SITUATION_ABBREV[situation]}`}
                    />
                  </Fragment>
                ))}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
