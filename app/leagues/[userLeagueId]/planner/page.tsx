import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserLeagueWithLeague } from "@/lib/fantrax/import-league";
import { loadPlanner } from "@/lib/planner/load-planner";
import { getGamesByTeam } from "@/lib/planner/schedule";
import { PendingLink } from "@/components/PendingLink";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { refreshProjectionsAction } from "@/lib/actions/league-actions";
import { PickupsTable } from "@/components/PickupsTable";
import {
  buildDailyLineups,
  canFillSlot,
  injuredPlayers,
  lineupChange,
  projectionOn,
  planDays,
  planningPositions,
  recommendPlayers,
  scoreTeamFits,
  type DailyLineup,
  type LineupChange,
} from "@/lib/planner/lineup";
import type { GamesByTeam, PlannerData, PlannerRosterPlayer } from "@/lib/planner/types";
import { daysToLoad } from "@/lib/planner/weeks";

const TEAMS_PER_POSITION = 8;
const PLAYERS_PER_POSITION = 10;
// Candidates sent to each pickups table so re-sorting can surface players beyond the visible 10.
const PICKUP_CANDIDATES_PER_POSITION = 150;

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const s = new Date(`${start}T12:00:00Z`).toLocaleDateString("en-US", opts);
  const e = new Date(`${end}T12:00:00Z`).toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

function shortDays(dates: string[]): string {
  return dates.map((d) => formatDay(d).split(",")[0]).join(" ");
}

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ userLeagueId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { userLeagueId } = await params;
  const { week: weekParam } = await searchParams;
  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row || row.user_league.userId !== session.user.id) notFound();
  const { user_league: userLeague, fantrax_league: league } = row;

  const requestedWeek = typeof weekParam === "string" && /^\d+$/.test(weekParam) ? Number(weekParam) : null;

  let data: PlannerData | null = null;
  let gamesByTeam: GamesByTeam = new Map();
  let error: string | null = null;
  try {
    data = await loadPlanner(session.user.id, userLeague, league, requestedWeek);
    gamesByTeam = await getGamesByTeam(daysToLoad(data.week, data.pickupHorizon));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const backLink = (
    <Link href={`/leagues/${userLeagueId}`} className="text-sm text-neutral-500 hover:underline">
      ← {league.name}
    </Link>
  );

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
        {backLink}
        <h1 className="text-2xl font-semibold">Weekly planner</h1>
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          Couldn&apos;t load this league&apos;s week from {league.provider}: {error}
        </p>
      </main>
    );
  }

  const { week, lineupSlots } = data;
  const dayPlans = planDays(week.days, lineupSlots, data.roster, gamesByTeam);
  const positions = planningPositions(lineupSlots);
  const teamFits = scoreTeamFits(positions, dayPlans, lineupSlots, gamesByTeam);
  // Pickups are scored over the displayed week's remaining days (W) plus the week after (W+1).
  const horizon = data.pickupHorizon;
  const thisWeekDays = new Set(horizon.thisWeek.days);
  const recommendations = recommendPlayers(
    data.available,
    [...horizon.thisWeek.days, ...(horizon.nextWeek?.days ?? [])],
    lineupSlots,
    data.roster,
    gamesByTeam
  );
  const totalOpen = dayPlans.reduce((sum, d) => sum + d.openSlots.length, 0);

  const weekIndex = data.weeks.findIndex((w) => w.number === week.number);
  const prevWeek = data.weeks[weekIndex - 1];
  const nextWeek = data.weeks[weekIndex + 1];

  const lineups = buildDailyLineups(week.days, lineupSlots, data.roster, gamesByTeam);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
      {backLink}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Weekly planner</h1>
          <p className="text-sm text-neutral-500">
            Week {week.number} · {formatRange(week.startDate, week.endDate)} · {week.days.length} lineup days ·{" "}
            {Object.entries(lineupSlots)
              .map(([slot, n]) => `${n} ${slot}`)
              .join(" · ")}
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          {prevWeek ? (
            <PendingLink href={`/leagues/${userLeagueId}/planner?week=${prevWeek.number}`} className="hover:underline">
              ← Week {prevWeek.number}
            </PendingLink>
          ) : null}
          {requestedWeek !== null ? (
            <PendingLink href={`/leagues/${userLeagueId}/planner`} className="text-neutral-500 hover:underline">
              Next upcoming week
            </PendingLink>
          ) : null}
          {nextWeek ? (
            <PendingLink href={`/leagues/${userLeagueId}/planner?week=${nextWeek.number}`} className="hover:underline">
              Week {nextWeek.number} →
            </PendingLink>
          ) : null}
          {data.platform === "fantrax" ? (
            <form action={refreshProjectionsAction.bind(null, userLeagueId, requestedWeek)}>
              <PendingSubmitButton className="text-neutral-500 hover:underline">
                <span title="Fantrax projections are cached for up to 24 hours">Refresh projections</span>
              </PendingSubmitButton>
            </form>
          ) : null}
        </nav>
      </div>

      {data.notices.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 rounded-md border border-amber-200 bg-amber-50/60 py-3 pr-4 pl-8 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          {data.notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <RosterGrid
        lineups={lineups}
        injured={injuredPlayers(week.days, lineupSlots, data.roster)}
        roster={data.roster}
        gamesByTeam={gamesByTeam}
        platform={data.platform}
      />

      {totalOpen === 0 ? (
        <p className="text-sm text-neutral-500">
          Every starting slot has a player with a game on every day this week - no open days to fill.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Teams that fit your open days</h2>
            <p className="text-sm text-neutral-500">
              NHL teams ranked by how many of your open-slot days a player of theirs at that position would fill.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((pos) => {
              const fits = (teamFits.get(pos) ?? []).slice(0, TEAMS_PER_POSITION);
              return (
                <div key={pos} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                  <h3 className="mb-2 font-medium">{pos}</h3>
                  {fits.length === 0 ? (
                    <p className="text-sm text-neutral-500">No open {pos} days.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {fits.map((f) => (
                          <tr key={f.teamAbbrev} className="even:bg-neutral-50 dark:even:bg-neutral-900/40">
                            <td className="py-1 pr-2 font-medium">{f.teamAbbrev}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{f.filledDates.length}</td>
                            <td className="py-1 text-neutral-500">{shortDays(f.filledDates)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recommended pickups</h2>
          <p className="text-sm text-neutral-500">
            Available players who&apos;d make your best lineup on at least one day, by filling an empty slot or
            displacing a weaker starter. +FP is how much your lineup&apos;s FP/GP total rises with them added.
            {data.projectionSource === "none" ? ` Ranked by days started, then ${data.rankLabel}.` : ""}
          </p>
          <p className="text-sm text-neutral-500">
            <strong>W</strong> = week {horizon.thisWeek.number} shown above
            {horizon.thisWeek.days.length === 0
              ? " (already over, so +FP W is 0)"
              : horizon.thisWeek.days.length < week.days.length
                ? `, from today on (${formatRange(horizon.thisWeek.days[0], week.endDate)})`
                : ""}
            {horizon.nextWeek ? (
              <>
                ; <strong>W+1</strong> adds week {horizon.nextWeek.number} (
                {formatRange(horizon.nextWeek.days[0], horizon.nextWeek.days[horizon.nextWeek.days.length - 1])}). Days
                started lists W&apos;s days, then how many in W+1.
              </>
            ) : (
              "; it's the last week, so W+1 is the same as W."
            )}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {positions.map((pos) => {
            const recs = recommendations
              .filter((r) => canFillSlot(pos, r.player.eligiblePositions))
              .slice(0, PICKUP_CANDIDATES_PER_POSITION);
            return (
              <div key={pos} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <h3 className="mb-2 font-medium">{pos}</h3>
                {recs.length === 0 ? (
                  <p className="text-sm text-neutral-500">No available {pos} would make your lineup.</p>
                ) : (
                  <PickupsTable
                    visibleRows={PLAYERS_PER_POSITION}
                    rows={recs.map((r) => ({
                      key: r.player.playerId,
                      name: r.player.name,
                      detail: `${r.player.displayPosition} · ${r.player.nhlTeamAbbrev ?? "—"}`,
                      startCount: r.startDates.length,
                      startDaysLabel: shortDays(r.startDates.filter((d) => thisWeekDays.has(d))),
                      nextWeekStarts: horizon.nextWeek ? r.startDates.filter((d) => !thisWeekDays.has(d)).length : null,
                      fpg: r.player.projectedPointsPerGame,
                      fpW:
                        r.projectedAddedPoints !== null
                          ? Object.entries(r.gainByDate)
                              .filter(([d]) => thisWeekDays.has(d))
                              .reduce((sum, [, g]) => sum + g, 0)
                          : null,
                      fpW1: r.projectedAddedPoints,
                    }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

/** Sum of each [player, date]'s projection for that date's game; null if none are projected. */
function sumProjections(entries: Array<[PlannerRosterPlayer | null | undefined, string]>): number | null {
  const values = entries.map(([p, date]) => (p ? projectionOn(p, date) : null)).filter((v): v is number => v != null);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
}

// Green = fine, yellow = check, orange/red = go change something on the platform.
const CHANGE_STYLES: Record<LineupChange, { tone: string; label: string | null }> = {
  agreed: { tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100", label: null },
  start: {
    tone: "bg-orange-100 text-orange-900 ring-1 ring-orange-400 dark:bg-orange-950/60 dark:text-orange-100 dark:ring-orange-700",
    label: "Recommended start",
  },
  bench: {
    tone: "bg-rose-100 text-rose-900 ring-1 ring-rose-400 dark:bg-rose-950/60 dark:text-rose-100 dark:ring-rose-700",
    label: "Recommend benching",
  },
  none: { tone: "bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300", label: null },
};
const EMPTY_TONE = "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-100";
const MISSED_GAME_TONE = "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100";

function RosterGrid({
  lineups,
  injured,
  roster,
  gamesByTeam,
  platform,
}: {
  lineups: DailyLineup[];
  injured: Array<{ slot: string; player: PlannerRosterPlayer }>;
  roster: PlannerRosterPlayer[];
  gamesByTeam: GamesByTeam;
  platform: string;
}) {
  const days = lineups.map((l) => l.date);
  const starterRows = lineups[0]?.starters.map((s, r) => ({ slot: s.slot, cells: lineups.map((l) => l.starters[r].player) })) ?? [];
  // Row r of a side grid holds each day's r-th player in that list.
  const toRows = (pick: (l: DailyLineup) => PlannerRosterPlayer[]) =>
    Array.from({ length: Math.max(0, ...lineups.map((l) => pick(l).length)) }, (_, r) => lineups.map((l) => pick(l)[r] ?? null));
  const benchRows = toRows((l) => l.bench);
  const shown = new Set([
    ...lineups.flatMap((l) => [...l.starters.map((s) => s.player), ...l.bench]).filter((p) => p !== null),
    ...injured.map((i) => i.player),
  ]);
  const gameOn = (p: PlannerRosterPlayer, date: string) => (p.nhlTeamAbbrev ? gamesByTeam.get(p.nhlTeamAbbrev)?.get(date) : undefined);
  const missesGame = (p: PlannerRosterPlayer, date: string) => p.dailySlots[date]?.status === "out" && !!gameOn(p, date);
  const notShown = roster.filter((p) => !shown.has(p));
  const cellBorder = "border-t border-neutral-100 dark:border-neutral-900";
  const stickyCell = "sticky left-0 bg-white pr-3 dark:bg-neutral-950";
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  const changeCount =
    starterRows.reduce((n, row) => n + row.cells.filter((p, i) => p && lineupChange(true, p.dailySlots[days[i]]) === "start").length, 0) +
    benchRows.reduce((n, cells) => n + cells.filter((p, i) => p && lineupChange(false, p.dailySlots[days[i]]) === "bench").length, 0);

  const renderCell = (player: PlannerRosterPlayer | null, date: string, isStarter: boolean) => {
    if (!player) {
      return isStarter ? (
        <div className={`flex h-full items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium ${EMPTY_TONE}`}>
          Empty
        </div>
      ) : null;
    }
    const game = player.nhlTeamAbbrev ? gamesByTeam.get(player.nhlTeamAbbrev)?.get(date) : undefined;
    const current = player.dailySlots[date];
    const { tone, label } = CHANGE_STYLES[lineupChange(isStarter, current)];
    return (
      <div className={`h-full rounded px-1.5 py-0.5 text-xs leading-tight ${tone}`} title={player.name}>
        <div className="max-w-32 truncate font-medium">{player.name}</div>
        <div className="opacity-75">
          {game ? `${game.isHome ? "vs" : "@"} ${game.opponent}` : ""} · {projectionOn(player, date)?.toFixed(2) ?? "—"}
        </div>
        <div className="opacity-60">Slot: {current?.slot ?? "—"}</div>
        {label ? <div className="font-semibold">{label}</div> : null}
      </div>
    );
  };

  const renderRow = (label: string, cells: Array<PlannerRosterPlayer | null>, isStarter: boolean, key: string, groupStart: boolean) => {
    const border = groupStart ? "border-t border-neutral-300 dark:border-neutral-700" : cellBorder;
    return (
      <tr key={key}>
        <td className={`${stickyCell} ${border} py-0.5 text-xs font-medium text-neutral-500`}>{label}</td>
        {cells.map((p, i) => (
          // h-px on the cell lets the h-full child stretch to the row's height (a table-layout quirk).
          <td key={days[i]} className={`${border} h-px p-0.5`}>
            {renderCell(p, days[i], isStarter)}
          </td>
        ))}
        <td className={`${border} px-1 text-right tabular-nums`}>{sumProjections(cells.map((p, i) => [p, days[i]]))?.toFixed(1) ?? "—"}</td>
      </tr>
    );
  };

  const dayHeader = (
    <thead>
      <tr className="text-xs text-neutral-400 dark:text-neutral-500">
        <th className={`${stickyCell} py-1 text-left font-medium`}>Slot</th>
        {days.map((d) => (
          <th key={d} className="px-1 py-1 text-left font-medium whitespace-nowrap">
            {formatDay(d)}
          </th>
        ))}
        <th className="px-1 py-1 text-right font-medium">FP/GP</th>
      </tr>
    </thead>
  );

  const renderSideGrid = (title: string, rowLabel: string, rows: Array<Array<PlannerRosterPlayer | null>>, emptyText: string) => (
    <>
      <h3 className="mt-2 font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            {dayHeader}
            <tbody>{rows.map((cells, r) => renderRow(rowLabel, cells, false, `${rowLabel}-${r}`, false))}</tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Your roster by day</h2>
        <p className="text-sm text-neutral-500">
          The lineup you should set each day: best FP/GP from players with a game who aren&apos;t on IR. Green is
          fine, yellow is worth a check, orange and red need a change on {platformName}. Totals on the right add up FP/GP across the week for
          each row.
        </p>
        <p className={`mt-1 text-sm font-medium ${changeCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-neutral-500"}`}>
          {changeCount > 0
            ? `${changeCount} lineup change${changeCount === 1 ? "" : "s"} needed on ${platformName} this week.`
            : `Your ${platformName} lineup already matches this plan.`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          {dayHeader}
          <tbody>
            {starterRows.map((row, r) =>
              renderRow(row.slot, row.cells, true, `starter-${r}`, r > 0 && starterRows[r - 1].slot !== row.slot)
            )}
            <tr>
              <td className={`${stickyCell} border-t border-neutral-300 py-1 text-xs font-medium dark:border-neutral-700`}>
                Lineup total
              </td>
              {lineups.map((l) => (
                <td
                  key={l.date}
                  className="border-t border-neutral-300 px-1.5 py-1 text-xs tabular-nums dark:border-neutral-700"
                >
                  {sumProjections(l.starters.map((s) => [s.player, l.date]))?.toFixed(1) ?? "—"}
                </td>
              ))}
              <td className="border-t border-neutral-300 px-1 text-right font-medium tabular-nums dark:border-neutral-700">
                {sumProjections(starterRows.flatMap((row) => row.cells.map((p, i): [PlannerRosterPlayer | null, string] => [p, days[i]])))?.toFixed(1) ?? "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {renderSideGrid("Bench", "BN", benchRows, "No one with a game is left out of the lineup this week.")}

      <h3 className="mt-2 font-medium">Injured Reserve</h3>
      {injured.length === 0 ? (
        <p className="text-sm text-neutral-500">No one on IR this week.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            {dayHeader}
            <tbody>
              {injured.map(({ slot, player }, r) => {
                const border = r > 0 && injured[r - 1].slot !== slot ? "border-t border-neutral-300 dark:border-neutral-700" : cellBorder;
                const missedDays = days.filter((d) => missesGame(player, d));
                return (
                  <tr key={player.playerId}>
                    <td className={`${stickyCell} ${border} py-0.5 text-xs font-medium text-neutral-500`}>{slot}</td>
                    {days.map((d) => {
                      const current = player.dailySlots[d];
                      const game = gameOn(player, d);
                      const missed = missesGame(player, d);
                      return (
                        <td key={d} className={`${border} p-0.5`}>
                          {current ? (
                            <div
                              className={`rounded px-1.5 py-0.5 text-xs leading-tight ${
                                missed ? MISSED_GAME_TONE : "text-neutral-400 dark:text-neutral-600"
                              }`}
                              title={player.name}
                            >
                              <div className="max-w-32 truncate font-medium">{player.name}</div>
                              <div className="opacity-75">
                                {game ? `${game.isHome ? "vs" : "@"} ${game.opponent}` : "No game"} ·{" "}
                                {projectionOn(player, d)?.toFixed(2) ?? "—"}
                              </div>
                              <div className="opacity-60">Slot: {current.slot}</div>
                              {current.status !== "out" ? <div className="font-semibold">Off IR</div> : null}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className={`${border} px-1 text-right tabular-nums`}>
                      {missedDays.length > 0
                        ? sumProjections(missedDays.map((d) => [player, d]))?.toFixed(1) ?? "—"
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        <p className="flex flex-wrap gap-3">
          <span className={`rounded px-1.5 ${CHANGE_STYLES.agreed.tone}`}>Agreed: recommended and active</span>
          <span className={`rounded px-1.5 ${EMPTY_TONE}`}>Empty</span>
          <span className={`rounded px-1.5 ${CHANGE_STYLES.start.tone}`}>Recommended start</span>
          <span className={`rounded px-1.5 ${CHANGE_STYLES.bench.tone}`}>Recommend benching</span>
          <span className={`rounded px-1.5 ${MISSED_GAME_TONE}`}>Missing game on IR</span>
          <span>Cells show opponent · FP/GP · current slot</span>
        </p>
        {notShown.length > 0 ? (
          <p>
            Not shown (no games this week): {notShown.map((p) => p.name).join(", ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
