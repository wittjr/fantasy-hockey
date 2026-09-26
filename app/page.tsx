import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserLeaguesForUser } from "@/lib/fantrax/import-league";
import { importLeagueAction } from "@/lib/actions/league-actions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const leagues = await getUserLeaguesForUser(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your leagues</h1>
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
                  {fantrax_league.seasonYear} · {user_league.myFantraxTeamId ? "team set" : "team not set"}
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
    </main>
  );
}
