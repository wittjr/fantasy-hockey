import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PendingLink } from "@/components/PendingLink";
import { NHL_TEAM_ABBREVS, type NhlTeamAbbrev } from "@/lib/nhl/client";
import type { Situation, Unit } from "@/lib/research/lines";
import { loadTeamResearch, type ResearchGame, type TeamResearch } from "@/lib/research/team-games";
import { buildTrendRows } from "@/lib/research/toi-trends";

const GAME_COUNTS = [1, 3, 5, 10, 20];
const DEFAULT_GAME_COUNT = 5;
// Sparklines span at least this much TOI so small wobbles don't look like big swings.
const SPARKLINE_MIN_RANGE_SECONDS = 240;
const UNIT_LIMITS: Record<Situation, { F: number; D: number }> = {
  ev: { F: 4, D: 3 },
  pp: { F: 2, D: 2 },
  sh: { F: 3, D: 3 },
};
const SITUATION_LABELS: Record<Situation, string> = { ev: "EV", pp: "PP", sh: "SH" };

function formatClock(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function gameLabel(game: ResearchGame): string {
  return `${game.home ? "vs" : "@"} ${game.opponent}`;
}

function resultLabel(game: ResearchGame): string {
  if (!game.score) return "";
  const { for: f, against: a } = game.score;
  return `${f > a ? "W" : "L"} ${f}–${a}`;
}

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { team: teamParam, games: gamesParam } = await searchParams;
  const team = (NHL_TEAM_ABBREVS as readonly string[]).includes(String(teamParam).toUpperCase())
    ? (String(teamParam).toUpperCase() as NhlTeamAbbrev)
    : null;
  const gameCount = GAME_COUNTS.includes(Number(gamesParam)) ? Number(gamesParam) : DEFAULT_GAME_COUNT;

  let research: TeamResearch | null = null;
  let error: string | null = null;
  if (team) {
    try {
      research = await loadTeamResearch(team, gameCount);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const href = (t: string, n: number) => `/research?team=${t}&games=${n}`;

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
      ) : error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          Couldn&apos;t load NHL data for {team}: {error}
        </p>
      ) : !research || research.games.length === 0 ? (
        <p className="text-neutral-500">{team} hasn&apos;t finished a regular-season game yet this season.</p>
      ) : (
        <>
          <LastGameLines research={research} />
          <ToiTrends research={research} />
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
        <p className="text-sm text-neutral-500">The NHL hasn&apos;t published shift charts for this game yet.</p>
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

function ToiTrends({ research }: { research: TeamResearch }) {
  const rows = buildTrendRows(research.players.values(), research.games);
  const showTrend = research.games.length > 1;
  const muted = "text-neutral-400 dark:text-neutral-500";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Ice-time trends</h2>
      <p className="text-sm text-neutral-500">Average regulation ice time per game played (overtime minutes excluded).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">Player</th>
              <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">Pos</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium whitespace-nowrap">Avg TOI</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium whitespace-nowrap">PP share</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium whitespace-nowrap">SH</th>
              {showTrend && <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">TOI trend</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.player.id}
                className={`border-b border-neutral-100 align-top dark:border-neutral-900 ${
                  i > 0 && rows[i - 1].player.group !== row.player.group ? "border-t-2 border-t-neutral-300 dark:border-t-neutral-700" : ""
                }`}
              >
                <td className="py-1 pr-3 whitespace-nowrap">{row.player.name}</td>
                <td className="py-1 pr-3 whitespace-nowrap text-neutral-500">
                  {row.player.position}
                  <span className="ml-1 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                    {row.gamesPlayed}/{research.games.length} GP
                  </span>
                </td>
                <td className="py-1 pr-3 text-right font-medium tabular-nums whitespace-nowrap">
                  {row.avgToi !== null ? formatClock(row.avgToi) : <span className={muted}>—</span>}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">
                  {row.ppShare !== null ? `${Math.round(row.ppShare)}%` : <span className={muted}>—</span>}
                </td>
                <td className="py-1 pr-3 text-right text-xs tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                  {row.shAvg !== null ? formatClock(row.shAvg) : <span className={muted}>—</span>}
                </td>
                {showTrend && (
                  <td className="py-1 pr-3 whitespace-nowrap">
                    <Sparkline values={row.perGame.map((cell) => cell?.toi ?? null)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** TOI per game as a small line; games the player missed are skipped. */
function Sparkline({ values }: { values: Array<number | null> }) {
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
      <circle cx={x(last.i)} cy={y(last.v)} r={2} fill="currentColor" />
    </svg>
  );
}
