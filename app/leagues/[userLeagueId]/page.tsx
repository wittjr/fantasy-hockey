import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getTeamRosterRows,
  getTeamsForLeague,
  getUserLeagueWithLeague,
} from "@/lib/fantrax/import-league";
import {
  renamePlayerAction,
  resyncRosterAction,
  setMyTeamAction,
  togglePlayerFlagAction,
} from "@/lib/actions/league-actions";
import { PlayerFlagToggle } from "@/components/PlayerFlagToggle";
import { RenamePlayerForm } from "@/components/RenamePlayerForm";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ userLeagueId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { userLeagueId } = await params;
  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row || row.user_league.userId !== session.user.id) notFound();

  const { user_league: userLeague, fantrax_league: league } = row;

  if (!userLeague.myFantraxTeamId) {
    const teams = await getTeamsForLeague(league.id);
    const boundSetMyTeam = setMyTeamAction.bind(null, userLeagueId);

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← All leagues
        </Link>
        <h1 className="text-2xl font-semibold">{league.name}</h1>
        <p className="text-neutral-500">Which team is yours?</p>
        <form action={boundSetMyTeam} className="flex flex-col gap-3">
          <select
            name="fantraxTeamId"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Select a team…</option>
            {teams.map((t) => (
              <option key={t.fantraxTeamId} value={t.fantraxTeamId}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            This is my team
          </button>
        </form>
      </main>
    );
  }

  const rosterRows = await getTeamRosterRows(userLeagueId);
  const byBucket = new Map<string, typeof rosterRows>();
  for (const r of rosterRows) {
    const bucket = r.team_roster.rosterPosition;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(r);
  }

  const boundResync = resyncRosterAction.bind(null, userLeagueId);
  const keeperCount = rosterRows.filter((r) => r.team_roster.isKeeper).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← All leagues
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{league.name}</h1>
          <p className="text-sm text-neutral-500">
            {keeperCount} keeper{keeperCount === 1 ? "" : "s"} marked · {rosterRows.length} players on roster
          </p>
        </div>
        <div className="flex gap-3">
          <form action={boundResync}>
            <button type="submit" className="text-sm text-neutral-500 hover:underline">
              Re-sync roster
            </button>
          </form>
          <Link href={`/leagues/${userLeagueId}/analysis`} className="text-sm font-medium underline">
            Open Draft Day Helper →
          </Link>
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        Mark your actual keepers (Fantrax&apos;s Keeper Admin page isn&apos;t exposed by their API, so this has to be
        manual) and uncheck &quot;Consider&quot; for anyone you want left out of the Draft Day Helper.
      </p>

      <div className="flex flex-col gap-6">
        {[...byBucket.entries()].map(([bucket, players]) => (
          <div key={bucket}>
            <h2 className="mb-2 font-medium">{bucket}</h2>
            <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
              {players.map((r) => (
                <li key={r.team_roster.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span>
                    {r.fantrax_player.name.startsWith("Unknown player") ? (
                      <RenamePlayerForm
                        action={renamePlayerAction.bind(null, userLeagueId, r.team_roster.fantraxPlayerId)}
                        currentName={r.fantrax_player.name}
                      />
                    ) : (
                      r.fantrax_player.name
                    )}
                    <span className="ml-2 text-neutral-500">
                      {r.fantrax_player.position} · {r.fantrax_player.nhlTeamAbbrev ?? "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <PlayerFlagToggle
                      action={togglePlayerFlagAction.bind(null, userLeagueId, r.team_roster.fantraxPlayerId, "isKeeper")}
                      name="isKeeper"
                      label="Keeper"
                      defaultChecked={r.team_roster.isKeeper}
                    />
                    <PlayerFlagToggle
                      action={togglePlayerFlagAction.bind(
                        null,
                        userLeagueId,
                        r.team_roster.fantraxPlayerId,
                        "isConsidered"
                      )}
                      name="isConsidered"
                      label="Consider"
                      defaultChecked={r.team_roster.isConsidered}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
