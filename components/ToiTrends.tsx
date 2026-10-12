import { PendingLink } from "@/components/PendingLink";
import { ToiGameStrip } from "@/components/ToiGameStrip";
import { formatClock, formatDate, formatSignedClock, formatSignedPoints } from "@/lib/research/format";
import type { TeamResearch } from "@/lib/research/team-games";
import {
  buildTrendRows,
  deltaCrossing,
  effectiveSort,
  MIN_GAMES_FOR_DELTA,
  nextSort,
  PP_MOVER_POINTS,
  PP_SHARE_TREND_THRESHOLD_POINTS,
  researchHref,
  slopeDirection,
  sortRows,
  type SortKey,
  type SortSpec,
  TOI_MOVER_SECONDS,
  TOI_TREND_THRESHOLD_SECONDS,
} from "@/lib/research/toi-trends";

// Sparklines span at least this much TOI so small wobbles don't look like big swings.
const SPARKLINE_MIN_RANGE_SECONDS = 240;

export function ToiTrends({
  research,
  sort: requestedSort,
  team,
  gameCount,
}: {
  research: TeamResearch;
  sort: SortSpec;
  /** The requested team and window, kept in the sort links. */
  team: string;
  gameCount: number;
}) {
  const sort = effectiveSort(requestedSort, research.games.length);
  const rows = sortRows(buildTrendRows(research.players.values(), research.games), sort);
  const showTrend = research.games.length > 1;
  const muted = "text-neutral-400 dark:text-neutral-500";
  const overtime = research.games.map((g) => g.overtime !== null);
  const sortProps = { sort, team, gameCount };
  const noChartDates = research.games.filter((g) => !g.lines).map((g) => formatDate(g.date));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Ice-time trends</h2>
      <p className="text-sm text-neutral-500">
        Average regulation ice time per game played, and how each player&apos;s last 2 games compare with his earlier games in the window.
        Rows tinted green or red moved by 2:00 or more of TOI or 15 or more points of power-play share.
        Click Avg TOI, TOI Δ, PP share or PP share Δ to sort; click, tap or hover a square for exact per-game times.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No skaters played in this window.</p>
      ) : (
        <div className="overflow-x-auto pb-28 -mb-24">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
                <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">Player</th>
                <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">Pos</th>
                <SortHeader label="Avg TOI" title="Average regulation ice time per game played" sortKey="avgToi" {...sortProps} />
                {showTrend && <SortHeader label="TOI Δ" title="Average of the team's last 2 games minus the player's earlier games in the window" sortKey="toiDelta" {...sortProps} />}
                <SortHeader label="PP share" title="Player's share of the team's power-play time in the games he played" sortKey="ppShare" {...sortProps} />
                {showTrend && <SortHeader label="PP share Δ" title="Same comparison, in percentage points" sortKey="ppDelta" {...sortProps} />}
                <th scope="col" className="py-1 pr-3 text-right font-medium whitespace-nowrap">SH</th>
                <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">
                  Per game <span className="font-normal">(click a square)</span>
                </th>
                {showTrend && <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">TOI trend</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.player.id}
                  className={`border-b border-neutral-100 align-top dark:border-neutral-900 ${
                    i > 0 && rows[i - 1].player.group !== row.player.group ? "border-t-2 border-t-neutral-300 dark:border-t-neutral-700" : ""
                  } ${row.mover === "up" ? "bg-green-100 dark:bg-green-900/40" : row.mover === "down" ? "bg-red-100 dark:bg-red-900/40" : ""}`}
                >
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {row.player.name}
                    {row.mover && <span className="sr-only">{row.mover === "up" ? "Moving up" : "Moving down"}</span>}
                    {row.dnpLast2 && (
                      <span className="ml-2 rounded border border-neutral-300 px-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                        DNP last 2
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                    {row.player.position}{" "}
                    <span className="ml-1 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                      {row.gamesPlayed}/{research.games.length} GP
                    </span>
                  </td>
                  <td className="py-1 pr-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {row.avgToi !== null ? formatClock(row.avgToi) : <span className={muted}>—</span>}
                  </td>
                  {showTrend && (
                    <DeltaCell
                      delta={row.toiDelta}
                      format={formatSignedClock}
                      slope={row.toiSlope}
                      slopeThreshold={TOI_TREND_THRESHOLD_SECONDS}
                      moverThreshold={TOI_MOVER_SECONDS}
                    />
                  )}
                  <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">
                    {row.ppShare !== null ? `${Math.round(row.ppShare)}%` : <span className={muted}>—</span>}
                  </td>
                  {showTrend && (
                    <DeltaCell
                      delta={row.ppShareDelta}
                      format={formatSignedPoints}
                      slope={row.ppShareSlope}
                      slopeThreshold={PP_SHARE_TREND_THRESHOLD_POINTS}
                      moverThreshold={PP_MOVER_POINTS}
                    />
                  )}
                  <td className="py-1 pr-3 text-right text-xs tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                    {row.shAvg !== null ? formatClock(row.shAvg) : <span className={muted}>—</span>}
                  </td>
                  <ToiGameStrip row={row} games={research.games} />
                  {showTrend && (
                    <td className="py-1 pr-3 whitespace-nowrap">
                      <Sparkline values={row.perGame.map((cell) => cell?.toi ?? null)} overtime={overtime} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        <p>
          Squares are team games, oldest to newest. Darker means more ice time than that player&apos;s own average. Dashed
          means did not play (or overtime with no shift data). A blue ring means overtime; OT minutes are excluded.
        </p>
        <p>
          {!showTrend ? (
            "Deltas and trends need 2 or more games. Choose Last 3 or more."
          ) : research.games.length < MIN_GAMES_FOR_DELTA ? (
            <>
              Δ needs 3 or more games, and this window has only 2, so every Δ shows —. ▲ ▼ show the direction of the whole-window
              trend.
            </>
          ) : (
            <>
              Δ compares the team&apos;s last 2 games with the player&apos;s earlier games and needs 3 or more games played. ▲ ▼
              show the direction of the whole-window trend and can disagree with Δ.
            </>
          )}
        </p>
        {noChartDates.length > 0 && (
          <p className="text-amber-600 dark:text-amber-400">
            No PP/SH data for {noChartDates.join(", ")}: no shift chart is available for those games (not published yet, or it failed to load).
          </p>
        )}
      </div>
    </section>
  );
}

/** A right-aligned column header that links to its own sort: the active key flips direction, any other starts descending. */
function SortHeader({
  label,
  title,
  sortKey,
  sort,
  team,
  gameCount,
}: {
  label: string;
  title: string;
  sortKey: SortKey;
  sort: SortSpec;
  team: string;
  gameCount: number;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className="py-1 pr-3 text-right font-medium whitespace-nowrap"
    >
      <PendingLink
        href={researchHref(team, gameCount, nextSort(sort, sortKey))}
        title={title}
        scroll={false}
        className={`justify-end ${active ? "font-medium text-neutral-900 dark:text-neutral-100" : "hover:underline"}`}
      >
        {label}
        {active && ` ${sort.dir === "asc" ? "↑" : "↓"}`}
      </PendingLink>
    </th>
  );
}

/** Muted whole-window slope direction; always renders its slot so the delta digits stay aligned. Never green or red. */
function TrendArrow({ direction }: { direction: "up" | "down" | null }) {
  return (
    <span className="ml-1 inline-block w-4 text-center text-xs text-neutral-600 dark:text-neutral-400">
      {direction && (
        <>
          <span aria-hidden>{direction === "up" ? "▲" : "▼"}</span>
          <span className="sr-only">{direction === "up" ? "trend up" : "trend down"}</span>
        </>
      )}
    </span>
  );
}

/** A signed recent-vs-window change followed by the muted slope arrow; "—" when the minimum-games gate fails. Colour follows the delta alone, never the arrow (D-09). */
function DeltaCell({
  delta,
  format,
  slope,
  slopeThreshold,
  moverThreshold,
}: {
  delta: number | null;
  format: (value: number) => string;
  slope: number | null;
  slopeThreshold: number;
  moverThreshold: number;
}) {
  const crossing = deltaCrossing(delta, moverThreshold);
  const tone =
    crossing === 1
      ? "font-medium text-green-700 dark:text-green-400"
      : crossing === -1
        ? "font-medium text-red-700 dark:text-red-400"
        : "";
  return (
    <td className={`py-1 pr-3 text-right whitespace-nowrap tabular-nums ${tone}`}>
      {delta !== null ? format(delta) : <span className="text-neutral-400 dark:text-neutral-500">—</span>}
      <TrendArrow direction={slopeDirection(slope, slopeThreshold)} />
    </td>
  );
}

/** TOI per game as a small line; games the player missed are skipped and OT/SO games get a hollow sky dot. */
function Sparkline({ values, overtime }: { values: Array<number | null>; overtime: boolean[] }) {
  const width = 80;
  const height = 20;
  const played = values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  if (played.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = Math.min(...played.map((p) => p.v));
  const hi = Math.max(...played.map((p) => p.v));
  const pad = Math.max(0, SPARKLINE_MIN_RANGE_SECONDS - (hi - lo)) / 2;
  const [min, max] = [lo - pad, hi + pad];
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 2 - ((v - min) / (max - min)) * (height - 4);
  const pointsAttr = played.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = played[played.length - 1];
  return (
    <svg width={width} height={height} className="text-neutral-500" aria-hidden>
      <polyline points={pointsAttr} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {played.map((p) =>
        overtime[p.i] ? (
          <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3} strokeWidth={1.5} className="fill-background stroke-sky-500" />
        ) : null,
      )}
      {!overtime[last.i] && <circle cx={x(last.i)} cy={y(last.v)} r={2} fill="currentColor" />}
    </svg>
  );
}
