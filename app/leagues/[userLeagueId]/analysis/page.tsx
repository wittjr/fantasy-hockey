import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserLeagueWithLeague } from "@/lib/fantrax/import-league";
import { searchPlayerPool } from "@/lib/fantrax/draft-targets";
import { seasonHasSchedule } from "@/lib/nhl/import-schedule";
import { getFantasySeasonGames, runGapAnalysis } from "@/lib/analysis/run-analysis";
import { getProjectionsForUser } from "@/lib/import/projections";
import { getOpponentRosters } from "@/lib/analysis/opponent-rosters";
import { matchProjectionsToFantraxIds } from "@/lib/analysis/match-projections";
import { rankPlayersByFit } from "@/lib/analysis/rank-players-by-fit";
import { getRemovedPlayerIds } from "@/lib/fantrax/removed-players";
import {
  addDraftTargetAction,
  importProjectionsAction,
  importScheduleAction,
  removeDraftTargetAction,
  removePlayerAction,
  resetDraftTargetsAction,
  restoreAllPlayersAction,
  restorePlayerAction,
  toggleKeeperOverrideAction,
} from "@/lib/actions/league-actions";
import { PlayerStatsTable } from "@/components/PlayerStatsTable";
import { ProjectionsTable } from "@/components/ProjectionsTable";

export const metadata = { title: "Draft Day Helper" };

function defaultSeason(startDate: string | null, endDate: string | null): string {
  const startYear = startDate?.slice(0, 4);
  const endYear = endDate?.slice(0, 4);
  if (startYear && endYear) return `${startYear}${endYear}`;
  const now = new Date().getFullYear();
  return `${now}${now + 1}`;
}

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ userLeagueId: string }>;
  searchParams: Promise<{ season?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { userLeagueId } = await params;
  const { season: seasonParam, q } = await searchParams;

  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row || row.user_league.userId !== session.user.id) notFound();
  const { user_league: userLeague, fantrax_league: league } = row;

  if (!userLeague.myFantraxTeamId || league.provider !== "fantrax") redirect(`/leagues/${userLeagueId}`);

  const season = seasonParam ?? defaultSeason(league.startDate, league.endDate);
  const hasSchedule = await seasonHasSchedule(season);
  const boundImportSchedule = importScheduleAction.bind(null, userLeagueId);

  if (!hasSchedule) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
        <Link href={`/leagues/${userLeagueId}`} className="text-sm text-neutral-500 hover:underline">
          ← {league.name}
        </Link>
        <h1 className="text-2xl font-semibold">{league.name} — Draft Day Helper</h1>
        <p className="text-neutral-500">
          No cached NHL schedule for season {season} yet. This fetches all 32 teams&apos; schedules (one-time per
          season).
        </p>
        <form action={boundImportSchedule} className="flex gap-2">
          <input
            type="text"
            name="season"
            defaultValue={season}
            pattern="\d{8}"
            title='8 digits, e.g. "20262027"'
            className="w-40 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Import schedule
          </button>
        </form>
      </main>
    );
  }

  const {
    slotConstraints,
    consideredPlayerCount,
    rosterConsidered,
    draftTargets,
    gaps,
    surplus,
    coverageHistogram,
    teamFit,
  } = await runGapAnalysis(userLeagueId, season);

  const searchResults = q ? await searchPlayerPool(q) : [];
  const draftTargetIds = new Set(draftTargets.map((t) => t.fantraxPlayerId));
  const boundAddDraftTarget = addDraftTargetAction.bind(null, userLeagueId);

  const rosterByBucket = new Map<string, typeof rosterConsidered>();
  for (const p of rosterConsidered) {
    if (!rosterByBucket.has(p.rosterPosition)) rosterByBucket.set(p.rosterPosition, []);
    rosterByBucket.get(p.rosterPosition)!.push(p);
  }

  const targetsByBucket = new Map<string, typeof draftTargets>();
  for (const p of draftTargets) {
    if (!targetsByBucket.has(p.rosterPosition)) targetsByBucket.set(p.rosterPosition, []);
    targetsByBucket.get(p.rosterPosition)!.push(p);
  }

  const gapDaysByBucket = new Map<string, number>();
  for (const g of gaps) gapDaysByBucket.set(g.bucket, (gapDaysByBucket.get(g.bucket) ?? 0) + 1);

  const surplusDaysByBucket = new Map<string, number>();
  for (const s of surplus) surplusDaysByBucket.set(s.bucket, (surplusDaysByBucket.get(s.bucket) ?? 0) + 1);

  const histogramByBucket = new Map<string, typeof coverageHistogram>();
  for (const row of coverageHistogram) {
    if (!histogramByBucket.has(row.bucket)) histogramByBucket.set(row.bucket, []);
    histogramByBucket.get(row.bucket)!.push(row);
  }

  const projections = await getProjectionsForUser(session.user.id);
  const rowIdToPlayerId = projections.length > 0 ? await matchProjectionsToFantraxIds(projections) : new Map();
  const opponentTeams = await getOpponentRosters(
    league.id,
    league.fantraxLeagueId,
    userLeague.myFantraxTeamId,
    userLeagueId,
    projections,
    rowIdToPlayerId
  );
  const boundToggleKeeper = (fantraxPlayerId: string) => toggleKeeperOverrideAction.bind(null, userLeagueId, fantraxPlayerId);
  const removedPlayerIds = await getRemovedPlayerIds(userLeagueId);
  const { regularOffNightsByTeam, playoffs } = await getFantasySeasonGames(league.fantraxLeagueId, season);
  const scheduleCounts = (team: string | null) => ({
    playoffGames: playoffs && team ? (playoffs.gamesByTeam.get(team) ?? 0) : null,
    offNightsRegular: team ? (regularOffNightsByTeam.get(team) ?? 0) : null,
    offNightsPlayoff: playoffs && team ? (playoffs.offNightsByTeam.get(team) ?? 0) : null,
  });

  // Exclude the SPECIFIC players already on your team (roster + draft targets), anyone
  // currently considered kept by another team, and anyone manually removed (e.g. drafted by
  // someone else) - not whole teams, since a teammate can still be worth drafting if you
  // have open slot capacity on the days that team plays.
  const myConsideredPlayerIds = new Set([
    ...rosterConsidered.map((p) => p.fantraxPlayerId),
    ...draftTargets.map((p) => p.fantraxPlayerId),
  ]);
  const keptElsewhereIds = new Set(
    opponentTeams.flatMap((t) => t.players.filter((p) => p.isConsidered).map((p) => p.fantraxPlayerId))
  );

  const excludedRowIds = new Set<string>();
  const removedRowsById = new Map<string, (typeof projections)[number]>();
  for (const [rowId, playerId] of rowIdToPlayerId) {
    if (myConsideredPlayerIds.has(playerId) || keptElsewhereIds.has(playerId)) {
      excludedRowIds.add(rowId);
    } else if (removedPlayerIds.has(playerId)) {
      excludedRowIds.add(rowId);
      const row = projections.find((p) => p.id === rowId);
      if (row) removedRowsById.set(playerId, row);
    }
  }

  const draftablePool = projections.filter((p) => !excludedRowIds.has(p.id));
  const rankedPlayersByBucket = rankPlayersByFit(draftablePool, Object.keys(slotConstraints), teamFit, 20);
  const boundImportProjections = importProjectionsAction.bind(null, userLeagueId);
  const boundRemovePlayer = removePlayerAction.bind(null, userLeagueId);
  const boundRestorePlayer = restorePlayerAction.bind(null, userLeagueId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8 lg:max-w-6xl 2xl:max-w-7xl">
      <Link href={`/leagues/${userLeagueId}`} className="text-sm text-neutral-500 hover:underline">
        ← {league.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{league.name} — Draft Day Helper</h1>
        <p className="text-sm text-neutral-500">
          Season {season} · {consideredPlayerCount} considered players · slots{" "}
          {Object.entries(slotConstraints)
            .map(([b, n]) => `${n} ${b}`)
            .join(" / ")}
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Your team for this analysis</h2>
            <p className="text-sm text-neutral-500">
              Your kept/considered roster (fixed - edit on the{" "}
              <Link href={`/leagues/${userLeagueId}`} className="text-indigo-600 underline dark:text-indigo-400">
                league page
              </Link>
              ) plus any draft targets you add below. The analysis below reflects both.
            </p>
          </div>
          {draftTargets.length > 0 && (
            <form action={resetDraftTargetsAction.bind(null, userLeagueId)}>
              <input type="hidden" name="season" value={season} />
              <button
                type="submit"
                className="shrink-0 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Reset ({draftTargets.length})
              </button>
            </form>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(slotConstraints).map((bucket) => {
            const staticPlayers = rosterByBucket.get(bucket) ?? [];
            const addedPlayers = targetsByBucket.get(bucket) ?? [];
            return (
              <div key={bucket} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                  {bucket} ({staticPlayers.length + addedPlayers.length})
                </h3>
                {staticPlayers.length === 0 && addedPlayers.length === 0 ? (
                  <p className="text-sm text-neutral-500">None.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100 text-sm dark:divide-neutral-900">
                    {staticPlayers.map((p) => (
                      <li key={p.fantraxPlayerId} className="flex items-center justify-between gap-4 py-1.5">
                        <span>
                          {p.name} <span className="text-neutral-500">({p.nhlTeamAbbrev ?? "—"})</span>
                        </span>
                      </li>
                    ))}
                    {addedPlayers.map((p) => (
                      <li key={p.fantraxPlayerId} className="flex items-center justify-between gap-4 py-1.5">
                        <span>
                          {p.name}{" "}
                          <span className="rounded bg-emerald-50 px-1 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {p.nhlTeamAbbrev ?? "—"}
                          </span>
                        </span>
                        <form action={removeDraftTargetAction.bind(null, userLeagueId, p.fantraxPlayerId)}>
                          <input type="hidden" name="season" value={season} />
                          <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-medium">Add a player</h3>
          <form className="flex gap-2">
            <input type="hidden" name="season" value={season} />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search player name…"
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Search
            </button>
          </form>
          {q && (
            <ul className="mt-2 flex flex-col divide-y divide-neutral-100 text-sm dark:divide-neutral-900">
              {searchResults.length === 0 ? (
                <li className="py-1.5 text-neutral-500">No matches for &quot;{q}&quot;.</li>
              ) : (
                searchResults.map((p) => (
                  <li key={p.fantraxPlayerId} className="flex items-center justify-between gap-4 py-1.5">
                    <span>
                      {p.name}{" "}
                      <span className="text-neutral-500">
                        ({p.position} · {p.team})
                      </span>
                    </span>
                    {draftTargetIds.has(p.fantraxPlayerId) ? (
                      <span className="text-xs text-neutral-400">Added</span>
                    ) : (
                      <form action={boundAddDraftTarget}>
                        <input type="hidden" name="fantraxPlayerId" value={p.fantraxPlayerId} />
                        <input type="hidden" name="season" value={season} />
                        <button
                          type="submit"
                          className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Add
                        </button>
                      </form>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Available players{" "}
            <span className="font-normal text-neutral-500">
              {projections.length > 0 ? `(${draftablePool.length})` : ""}
            </span>
          </h2>
          <p className="text-sm text-neutral-500">
            Every projected player not already on your team, marked &quot;Consider&quot; in Opponent rosters, or
            removed. &quot;Add&quot; puts them on your team above; &quot;Remove&quot; drops them from the pool (e.g.
            drafted by someone else). Click a column header to sort; click again to reverse.
          </p>
          <p className="text-sm text-neutral-500">
            {playoffs
              ? `PO GP: NHL games each player's team plays during your fantasy playoffs (${playoffs.startDate} to ${playoffs.endDate}). Off Nights: games on nights with fewer than 8 NHL games, as fantasy regular season/playoffs.`
              : "PO GP is blank: this league has no fantasy playoffs in its Fantrax settings. Off Nights: games on nights with fewer than 8 NHL games during the fantasy season."}
          </p>
        </div>
        {projections.length === 0 ? (
          <p className="text-sm text-neutral-500">Import your projections spreadsheet below to see players here.</p>
        ) : (
          <ProjectionsTable
            addAction={boundAddDraftTarget}
            removeAction={boundRemovePlayer}
            season={season}
            players={draftablePool.map((p) => ({
              id: p.id,
              rank: p.rank,
              name: p.name,
              position: p.position,
              nhlTeamAbbrev: p.nhlTeamAbbrev,
              age: p.age,
              fantasyPoints: p.fantasyPoints,
              fantasyPointsPerGp: p.fantasyPointsPerGp,
              vorp: p.vorp,
              adp: p.adp,
              ...scheduleCounts(p.nhlTeamAbbrev),
              fantraxPlayerId: rowIdToPlayerId.get(p.id) ?? null,
            }))}
          />
        )}
      </section>

      <details className="group flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-sm text-amber-700 transition-transform group-open:rotate-90 dark:text-amber-300">▸</span>
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Schedule coverage by position</h2>
        </summary>
        <div>
          <p className="text-sm text-amber-800/80 dark:text-amber-200/70">
            For each position, how many dates land on each &quot;players with a game&quot; count. Rows below your
            slot max are gap days (a slot goes empty); rows above are surplus days (someone playing has to sit).
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {[...histogramByBucket.entries()].map(([bucket, rows]) => {
            const gapDays = gapDaysByBucket.get(bucket) ?? 0;
            const surplusDays = surplusDaysByBucket.get(bucket) ?? 0;
            return (
              <details
                key={bucket}
                className="rounded-md border border-amber-200 bg-white dark:border-amber-900/50 dark:bg-neutral-950"
              >
                <summary className="cursor-pointer select-none p-3 font-medium">
                  {bucket}: {gapDays} gap day{gapDays === 1 ? "" : "s"}, {surplusDays} surplus day
                  {surplusDays === 1 ? "" : "s"}
                </summary>
                <table className="w-full border-t border-amber-100 text-sm dark:border-amber-900/40">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="px-3 py-1.5 font-normal">Players with a game</th>
                      <th className="px-3 py-1.5 font-normal">Dates</th>
                      <th className="px-3 py-1.5 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.playersWithGame} className="border-t border-neutral-100 dark:border-neutral-900">
                        <td className="px-3 py-1.5">{r.playersWithGame}</td>
                        <td className="px-3 py-1.5">{r.dateCount}</td>
                        <td className="px-3 py-1.5">
                          {r.playersWithGame < r.slotMax ? (
                            <span className="text-amber-600 dark:text-amber-500">Gap</span>
                          ) : r.playersWithGame > r.slotMax ? (
                            <span className="text-blue-600 dark:text-blue-400">Surplus</span>
                          ) : (
                            <span className="text-green-600 dark:text-green-500">Exact fit</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })}
        </div>
      </details>

      <details className="group flex flex-col gap-4 rounded-lg border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900/60 dark:bg-violet-950/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-sm text-violet-700 transition-transform group-open:rotate-90 dark:text-violet-300">▸</span>
          <h2 className="text-lg font-semibold text-violet-900 dark:text-violet-200">
            Projections{" "}
            <span className="font-normal text-violet-700/70 dark:text-violet-300/60">
              {projections.length > 0 ? `(${projections.length} imported)` : ""}
            </span>
          </h2>
        </summary>
        <form action={boundImportProjections} className="flex items-center gap-2">
          <input type="hidden" name="season" value={season} />
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="flex-1 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-sm file:text-violet-800 dark:file:bg-violet-900 dark:file:text-violet-100"
          />
          <button
            type="submit"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            {projections.length > 0 ? "Re-import" : "Import"}
          </button>
        </form>
        <p className="text-xs text-violet-800/70 dark:text-violet-200/60">
          Upload your projections spreadsheet (the &quot;The List&quot; tab). Powers the FP/RK/VORP/ADP shown
          throughout this page.
        </p>
      </details>

      <details className="group flex flex-col gap-4 rounded-lg border border-rose-200 bg-rose-50/60 p-5 dark:border-rose-900/60 dark:bg-rose-950/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-sm text-rose-700 transition-transform group-open:rotate-90 dark:text-rose-300">▸</span>
          <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-200">Opponent rosters &amp; keepers</h2>
        </summary>
        <div>
          <p className="text-sm text-rose-800/80 dark:text-rose-200/70">
            Every other team&apos;s full roster. &quot;Consider&quot; checked means that player is treated as kept
            and excluded from your draft targets below. It defaults to the top 6 by live Fantrax ADP per team
            (labeled &quot;Likely&quot;) since Fantrax doesn&apos;t expose real Keeper Admin picks - check or
            uncheck players yourself once real keeper lists are set to override the guess.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {opponentTeams.map((team) => {
            const keptCount = team.players.filter((p) => p.isConsidered).length;
            return (
              <details
                key={team.fantraxTeamId}
                className="rounded-md border border-rose-200 bg-white dark:border-rose-900/50 dark:bg-neutral-950"
              >
                <summary className="cursor-pointer select-none p-3 font-medium">
                  {team.teamName}{" "}
                  <span className="font-normal text-neutral-500">
                    ({keptCount} of {team.players.length} considered kept)
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-rose-100 p-3 dark:border-rose-900/40">
                  <PlayerStatsTable
                    showConsider
                    showPosition
                    players={team.players.map((p) => ({
                      key: p.fantraxPlayerId,
                      name: p.name,
                      position: p.rosterPosition,
                      isConsidered: p.isConsidered,
                      isProgrammatic: p.isProgrammatic,
                      considerAction: boundToggleKeeper(p.fantraxPlayerId),
                      rank: p.rank,
                      fantasyPoints: p.fantasyPoints,
                      fantasyPointsPerGp: p.fantasyPointsPerGp,
                      vorp: p.vorp,
                      adp: p.adp,
                      fantraxAdp: p.fantraxAdp,
                    }))}
                    showFantraxAdp
                  />
                </div>
              </details>
            );
          })}
        </div>
      </details>

      <section className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div>
          <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
            Best-fit players to target in the draft
          </h2>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-200/70">
            Top 20 draftable players per position, ordered by Games Available (how many of your gap-days their team
            plays on) first, then by projected rank (RK). Players from teams already fully represented on your own
            roster, and anyone marked &quot;Consider&quot; in Opponent rosters above, are excluded. Hit
            &quot;Remove&quot; during the draft once a player is taken so they drop off this list.
            {playoffs
              ? " PO GP is the number of games their team plays during your fantasy playoffs. Off Nights is their team's games on nights with fewer than 8 NHL games, as fantasy regular season/playoffs."
              : " Off Nights is their team's games on nights with fewer than 8 NHL games during the fantasy season."}
          </p>
        </div>

        {removedRowsById.size > 0 && (
          <details className="rounded-md border border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-neutral-950">
            <summary className="cursor-pointer select-none p-3 text-sm font-medium">
              Removed players ({removedRowsById.size})
            </summary>
            <div className="flex justify-end border-t border-emerald-100 px-3 pt-3 dark:border-emerald-900/40">
              <form action={restoreAllPlayersAction.bind(null, userLeagueId)}>
                <button
                  type="submit"
                  className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                >
                  Restore all
                </button>
              </form>
            </div>
            <ul className="flex flex-col divide-y divide-neutral-100 p-3 text-sm dark:divide-neutral-900">
              {[...removedRowsById.entries()].map(([playerId, proj]) => (
                <li key={playerId} className="flex items-center justify-between gap-4 py-1.5">
                  <span>
                    {proj.name} <span className="text-neutral-500">({proj.nhlTeamAbbrev ?? "—"})</span>
                  </span>
                  <form action={boundRestorePlayer}>
                    <input type="hidden" name="fantraxPlayerId" value={playerId} />
                    <button type="submit" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                      Restore
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}

        {Object.keys(slotConstraints).map((bucket) => {
          const players = rankedPlayersByBucket.get(bucket) ?? [];
          return (
            <div
              key={bucket}
              className="rounded-md border border-emerald-200 bg-white p-3 dark:border-emerald-900/50 dark:bg-neutral-950"
            >
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                {bucket}
              </h3>
              {players.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  {projections.length === 0
                    ? "Import your projections spreadsheet above to see players here."
                    : "No draftable players found for this position."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <PlayerStatsTable
                    showTeam
                    showGamesAvailable
                    showPlayoffGames={playoffs !== null}
                    showOffNightGames
                    season={season}
                    addAction={boundAddDraftTarget}
                    removeAction={boundRemovePlayer}
                    players={players.map((p) => ({
                      key: p.name,
                      name: p.name,
                      nhlTeamAbbrev: p.nhlTeamAbbrev,
                      gamesAvailable: p.gapDaysCovered,
                      ...scheduleCounts(p.nhlTeamAbbrev),
                      rank: p.rank,
                      fantasyPoints: p.fantasyPoints,
                      fantasyPointsPerGp: p.fantasyPointsPerGp,
                      vorp: p.vorp,
                      adp: p.adp,
                      fantraxPlayerId: rowIdToPlayerId.get(p.id),
                    }))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
