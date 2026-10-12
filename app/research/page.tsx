import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PendingLink } from "@/components/PendingLink";
import { ToiTrends } from "@/components/ToiTrends";
import { NHL_TEAM_ABBREVS, type NhlTeamAbbrev } from "@/lib/nhl/client";
import type { Situation, Unit } from "@/lib/research/lines";
import { formatClock, formatDate, gameLabel, resultLabel } from "@/lib/research/format";
import { loadTeamResearch, type TeamResearch } from "@/lib/research/team-games";
import { parseSort, researchHref } from "@/lib/research/toi-trends";

const GAME_COUNTS = [1, 3, 5, 10, 20];
const DEFAULT_GAME_COUNT = 5;
const UNIT_LIMITS: Record<Situation, { F: number; D: number }> = {
  ev: { F: 4, D: 3 },
  pp: { F: 2, D: 2 },
  sh: { F: 3, D: 3 },
};
const SITUATION_LABELS: Record<Situation, string> = { ev: "EV", pp: "PP", sh: "SH" };

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { team: teamParam, games: gamesParam, sort: sortParam, dir: dirParam } = await searchParams;
  const team = (NHL_TEAM_ABBREVS as readonly string[]).includes(String(teamParam).toUpperCase())
    ? (String(teamParam).toUpperCase() as NhlTeamAbbrev)
    : null;
  const gameCount = GAME_COUNTS.includes(Number(gamesParam)) ? Number(gamesParam) : DEFAULT_GAME_COUNT;

  const sort = parseSort(sortParam, dirParam);

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

  const href = (t: string, n: number) => researchHref(t, n, sort);

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
              href={href(t, gameCount)}
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
                href={href(team, n)}
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
              Couldn&apos;t load NHL data for {research.unavailableDates.map(formatDate).join(", ")}, so those games are left out of this window. Reload to try again.
            </p>
          )}
          <LastGameLines research={research} />
          <ToiTrends research={research} sort={sort} team={team} gameCount={gameCount} />
        </>
      )}

      <p className="text-xs text-neutral-400">Data from the NHL&apos;s public API. Lines are derived from shift charts.</p>
    </main>
  );
}

function LastGameLines({ research }: { research: TeamResearch }) {
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
                title={`${SITUATION_LABELS[situation]} - ${group === "F" ? "Forwards" : "Defense"}`}
                units={game.lines!.units[situation][group].slice(0, UNIT_LIMITS[situation][group])}
                name={name}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function UnitTable({ title, units, name }: { title: string; units: Unit[]; name: (id: number) => string }) {
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
              <td className="py-1">{u.playerIds.map(name).join(" – ")}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
