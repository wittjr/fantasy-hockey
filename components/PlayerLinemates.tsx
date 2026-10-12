import { PendingLink } from "@/components/PendingLink";
import { ToiStripCell } from "@/components/ToiStripCell";
import { detailText, STRIP_SQUARE_CLASS } from "@/lib/research/game-strip";
import type { Situation } from "@/lib/research/lines";
import {
  buildLinemateView,
  gameColumnLabels,
  linemateDetail,
  linemateOpacity,
  SITUATION_ABBREV,
  type LinemateCellState,
  type LinemateRow,
} from "@/lib/research/linemates";
import type { TeamResearch } from "@/lib/research/team-games";
import { buildTrendRows, researchHref, type SortSpec } from "@/lib/research/toi-trends";

const CELL_BORDER: Record<LinemateCellState, string> = {
  together: "border-neutral-300 dark:border-neutral-700",
  apart: "border-neutral-200 dark:border-neutral-800",
  absent: "border-dashed border-neutral-400 dark:border-neutral-600",
  unknown: "border-dashed border-amber-600 dark:border-amber-400",
};

/**
 * The player detail panel, rendered from `?player`. Shows the linemates (forwards, then defense) the player shared the ice with
 * in each game of the window, as one shaded square per game. Each square's aria-label carries its facts. Server component: only
 * the squares and links are client code.
 */
export function PlayerLinemates({
  research,
  playerId,
  sit,
  team,
  gameCount,
  sort,
}: {
  research: TeamResearch;
  playerId: number;
  sit: Situation;
  team: string;
  gameCount: number;
  sort: SortSpec;
}) {
  // The trend rows are exactly the skaters who dressed in the window, so a goalie or a stranger finds no row.
  const row = buildTrendRows(research.players.values(), research.games).find((r) => r.player.id === playerId);
  const closeHref = researchHref(team, gameCount, sort, { sit });

  if (!row) {
    return (
      <p id="player-detail" className="scroll-mt-4 text-sm text-neutral-500">
        That player didn&apos;t play for {team} in this window.{" "}
        <PendingLink href={closeHref} scroll={false} className="underline">
          Close
        </PendingLink>
      </p>
    );
  }

  const { games } = research;
  const name = row.player.name;
  const abbrev = SITUATION_ABBREV[sit];
  const view = buildLinemateView(games, research.players, playerId, sit);
  const labels = gameColumnLabels(games.map((g) => g.date));

  return (
    <section
      id="player-detail"
      aria-labelledby="player-detail-title"
      className="scroll-mt-4 flex flex-col gap-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <h2 id="player-detail-title" className="font-medium">
          {name}{" "}
          <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
            {row.player.position} {row.gamesPlayed}/{games.length} GP
          </span>
        </h2>
        <PendingLink
          href={closeHref}
          scroll={false}
          aria-label={`Close ${name} detail`}
          className="text-sm text-neutral-500 hover:underline"
        >
          <span aria-hidden>×</span> Close player detail
        </PendingLink>
      </div>

      <div className="overflow-x-auto pb-28 -mb-24">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">Linemate</th>
              <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">
                <span className="sr-only">Games, oldest to newest</span>
                <div className="flex gap-1">
                  {labels.map((label, i) => (
                    <div key={games[i].id} className="w-5 text-center text-xs tabular-nums font-normal">
                      <div className="h-4 leading-4">{label.month}</div>
                      <div className="h-4 leading-4">{label.day}</div>
                    </div>
                  ))}
                </div>
              </th>
              <th
                scope="col"
                title={`Time together as a share of ${name}'s ${abbrev} time in the games they both played`}
                className="py-1 pr-3 text-right font-medium whitespace-nowrap"
              >
                Window share
              </th>
            </tr>
          </thead>
          {(
            [
              ["Forwards", view.forwards, ""],
              ["Defense", view.defense, "border-t-2 border-t-neutral-300 dark:border-t-neutral-700"],
            ] as const
          ).map(([title, rows, divider]) => (
            <tbody key={title}>
              <tr className={divider}>
                <th scope="rowgroup" colSpan={3} className="pt-2 pb-1 text-left text-xs font-medium text-neutral-500">
                  {title}
                </th>
              </tr>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-1 pr-3 text-neutral-500 whitespace-nowrap">
                    None
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <LinemateRowView key={r.player.id} row={r} research={research} playerName={name} sit={sit} team={team} />
                ))
              )}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function LinemateRowView({
  row,
  research,
  playerName,
  sit,
  team,
}: {
  row: LinemateRow;
  research: TeamResearch;
  playerName: string;
  sit: Situation;
  team: string;
}) {
  const linemate = row.player.name;
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-900">
      <td className="py-1 pr-3 whitespace-nowrap">{linemate}</td>
      <td className="py-1 pr-3 whitespace-nowrap">
        <div role="group" aria-label={`Games with ${linemate}, oldest to newest`} className="flex gap-1">
          {research.games.map((game, i) => {
            const cell = row.cells[i];
            const counted = cell.state === "together" || cell.state === "apart";
            const ring = counted && game.overtime !== null ? " ring-1 ring-sky-500" : "";
            const detail = linemateDetail(cell, game, { linemate, player: playerName }, sit, team);
            return (
              <ToiStripCell
                key={game.id}
                state={cell.state}
                label={detailText(detail)}
                className={`${STRIP_SQUARE_CLASS}${ring} ${CELL_BORDER[cell.state]}`}
              >
                {cell.state === "together" && cell.share !== null && (
                  <span
                    className="block h-full w-full bg-neutral-800 dark:bg-neutral-200"
                    style={{ opacity: linemateOpacity(cell.share) }}
                  />
                )}
              </ToiStripCell>
            );
          })}
        </div>
      </td>
      <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">
        {row.windowShare === null ? (
          <span className="text-neutral-400 dark:text-neutral-500">—</span>
        ) : (
          `${Math.round(row.windowShare * 100)}%`
        )}
      </td>
    </tr>
  );
}
