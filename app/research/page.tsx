import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PendingLink } from "@/components/PendingLink";
import { LastGameLines } from "@/components/LastGameLines";
import { PlayerLinemates } from "@/components/PlayerLinemates";
import { ToiTrends } from "@/components/ToiTrends";
import { NHL_TEAM_ABBREVS, type NhlTeamAbbrev } from "@/lib/nhl/client";
import { formatDate } from "@/lib/research/format";
import { loadTeamResearch, type TeamResearch } from "@/lib/research/team-games";
import { parseAll, parsePlayer, parseSit, parseSort, researchHref } from "@/lib/research/toi-trends";

const GAME_COUNTS = [1, 3, 5, 10, 20];
const DEFAULT_GAME_COUNT = 5;

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { team: teamParam, games: gamesParam, sort: sortParam, dir: dirParam, player: playerParam, sit: sitParam, all: allParam } = await searchParams;
  const team = (NHL_TEAM_ABBREVS as readonly string[]).includes(String(teamParam).toUpperCase())
    ? (String(teamParam).toUpperCase() as NhlTeamAbbrev)
    : null;
  const gameCount = GAME_COUNTS.includes(Number(gamesParam)) ? Number(gamesParam) : DEFAULT_GAME_COUNT;

  const sort = parseSort(sortParam, dirParam);
  const player = parsePlayer(playerParam);
  const sit = parseSit(sitParam);
  const all = parseAll(allParam);

  let research: TeamResearch | null = null;
  let loadFailed = false;
  if (team) {
    try {
      research = await loadTeamResearch(team, gameCount);
    } catch (e) {
      // The detail (API path, status) stays in the server log; the page shows fixed copy.
      console.error(`Loading research for ${team} failed`, e);
      loadFailed = true;
    }
  }

  // ISO dates compare lexically. A failed game newer than every loaded one makes "Last game" and the Δ columns describe older games.
  const newestMissing =
    !!research && research.games.length > 0 &&
    research.unavailableDates.some((d) => d > research.games[research.games.length - 1].date);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Your leagues
      </Link>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Line research</h1>
        <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {NHL_TEAM_ABBREVS.map((t) => (
            <PendingLink
              key={t}
              href={researchHref(t, gameCount, sort, { sit })}
              className={t === team ? "font-semibold underline" : "text-neutral-500 hover:underline"}
            >
              {t}
            </PendingLink>
          ))}
        </nav>
        <nav className="flex flex-wrap items-center gap-x-3 text-sm">
          <span className="text-neutral-500">Games:</span>
          {GAME_COUNTS.map((n) =>
            team ? (
              <PendingLink
                key={n}
                href={researchHref(team, n, sort, { player, sit })}
                className={n === gameCount ? "font-semibold underline" : "text-neutral-500 hover:underline"}
              >
                {n === 1 ? "Last game" : `Last ${n}`}
              </PendingLink>
            ) : (
              <span key={n} className={n === gameCount ? "font-semibold" : "text-neutral-400"}>
                {n === 1 ? "Last game" : `Last ${n}`}
              </span>
            )
          )}
        </nav>
      </div>

      {!team ? (
        <p className="text-neutral-500">Pick a team to see its latest line combinations and ice-time trends.</p>
      ) : loadFailed ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          Couldn&apos;t load NHL data for {team} right now. Try again in a minute.
        </p>
      ) : !research || research.games.length === 0 ? (
        <p className="text-neutral-500">{team} hasn&apos;t finished a regular-season game yet this season.</p>
      ) : (
        <>
          {research.unavailableDates.length > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Couldn&apos;t load NHL data for {research.unavailableDates.map(formatDate).join(", ")}, so those games are left out of this window
              {newestMissing && "; Last game and the last-2-games comparison use the newest games that did load"}. Reload to try again.
            </p>
          )}
          {player !== null && (
            <PlayerLinemates research={research} playerId={player} sit={sit} team={team} gameCount={gameCount} sort={sort} />
          )}
          <LastGameLines research={research} />
          <ToiTrends research={research} sort={sort} team={team} gameCount={gameCount} selected={player} sit={sit} all={all} />
        </>
      )}

      <p className="text-xs text-neutral-400">Data from the NHL&apos;s public API. Lines are derived from shift charts.</p>
    </main>
  );
}
