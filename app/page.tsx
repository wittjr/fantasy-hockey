import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserLeaguesForUser } from "@/lib/fantrax/import-league";
import { disconnectYahooAction, importLeagueAction, importYahooLeagueAction } from "@/lib/actions/league-actions";
import { getYahooConnection } from "@/lib/yahoo/oauth";
import { diagnoseYahooAccess, listMyNhlLeagues, type YahooLeagueSummary } from "@/lib/yahoo/client";

const YAHOO_STATUS_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Yahoo account connected.", ok: true },
  denied: { text: "Yahoo access wasn't granted.", ok: false },
  invalid: { text: "Yahoo sign-in expired or didn't match - try connecting again.", ok: false },
  error: { text: "Couldn't finish connecting to Yahoo.", ok: false },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ yahoo?: string; yahooDetail?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { yahoo: yahooStatus, yahooDetail } = await searchParams;
  const [leagues, yahooConnection] = await Promise.all([
    getUserLeaguesForUser(session.user.id),
    getYahooConnection(session.user.id),
  ]);

  let yahooLeagues: YahooLeagueSummary[] = [];
  let yahooError: string | null = null;
  let yahooDiagnostics: Awaited<ReturnType<typeof diagnoseYahooAccess>> = [];
  if (yahooConnection) {
    try {
      yahooLeagues = await listMyNhlLeagues(session.user.id);
    } catch (err) {
      console.error("Listing Yahoo leagues failed", err);
      yahooError = err instanceof Error ? err.message : String(err);
      yahooDiagnostics = await diagnoseYahooAccess(session.user.id).catch(() => []);
    }
  }
  const importedKeys = new Set(leagues.map((l) => l.fantrax_league.fantraxLeagueId));
  const statusMessage = yahooStatus ? YAHOO_STATUS_MESSAGES[yahooStatus] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your leagues</h1>
        <Link href="/research" className="ml-auto mr-4 text-sm hover:underline">
          Line research
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm text-neutral-500 hover:underline">
            Sign out ({session.user.name})
          </button>
        </form>
      </header>

      {leagues.length === 0 ? (
        <p className="text-neutral-500">No leagues imported yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leagues.map(({ user_league, fantrax_league }) => (
            <li key={user_league.id}>
              <Link
                href={`/leagues/${user_league.id}`}
                className="block rounded-md border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <div className="font-medium">{fantrax_league.name}</div>
                <div className="text-sm text-neutral-500">
                  {fantrax_league.provider === "yahoo" ? "Yahoo" : "Fantrax"} · {fantrax_league.seasonYear} ·{" "}
                  {user_league.myFantraxTeamId ? "team set" : "team not set"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Import a Fantrax league</h2>
        <form action={importLeagueAction} className="flex gap-2">
          <input
            type="text"
            name="leagueUrl"
            placeholder="https://www.fantrax.com/fantasy/league/XXXXXXXX/..."
            required
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Import
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Yahoo leagues</h2>
          {yahooConnection && (
            <form action={disconnectYahooAction}>
              <button type="submit" className="text-sm text-neutral-500 hover:underline">
                Disconnect Yahoo
              </button>
            </form>
          )}
        </div>
        {statusMessage && (
          <p className={`text-sm ${statusMessage.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {statusMessage.text}
            {!statusMessage.ok && yahooDetail && <span className="block text-xs opacity-80">Details: {yahooDetail}</span>}
          </p>
        )}
        {!yahooConnection ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-neutral-500">
              Connect your Yahoo account to import a Yahoo Fantasy hockey league. This only grants read access to
              your leagues - you still sign in to this app with Discord.
            </p>
            {/* Plain <a>, not <Link>: this route redirects off-site to Yahoo. */}
            <a
              href="/api/yahoo/connect"
              className="rounded-md bg-[#6001D2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4d01a8]"
            >
              Connect Yahoo
            </a>
          </div>
        ) : yahooError ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-red-600 dark:text-red-400">Couldn&apos;t load your Yahoo leagues: {yahooError}</p>
            {yahooDiagnostics.length > 0 && (
              <table className="text-xs">
                <tbody>
                  {yahooDiagnostics.map((d) => (
                    <tr key={d.path} className="align-top">
                      <td className="pr-3 font-mono">{d.path}</td>
                      <td className={`pr-3 ${d.status < 300 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {d.status}
                      </td>
                      <td className="text-neutral-500">{d.description ?? "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : yahooLeagues.length === 0 ? (
          <p className="text-sm text-neutral-500">No Yahoo hockey leagues found for this season.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {yahooLeagues.map((l) => (
              <li key={l.leagueKey} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span>
                  {l.name}{" "}
                  <span className="text-neutral-500">
                    ({l.season} · {l.numTeams} teams)
                  </span>
                </span>
                {importedKeys.has(l.leagueKey) ? (
                  <span className="text-xs text-neutral-400">Imported</span>
                ) : (
                  <form action={importYahooLeagueAction}>
                    <input type="hidden" name="leagueKey" value={l.leagueKey} />
                    <button
                      type="submit"
                      className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      Import
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-400">
          Fantasy data provided by{" "}
          <a href="https://sports.yahoo.com/fantasy/" className="underline">
            Yahoo Fantasy
          </a>
          .
        </p>
      </section>
    </main>
  );
}
