import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { watchedPlayers } from "@/lib/db/schema";

export async function setWatched(userLeagueId: string, fantraxPlayerId: string, watched: boolean): Promise<void> {
  if (watched) {
    await db
      .insert(watchedPlayers)
      .values({ userLeagueId, fantraxPlayerId })
      .onConflictDoNothing({ target: [watchedPlayers.userLeagueId, watchedPlayers.fantraxPlayerId] });
  } else {
    await db
      .delete(watchedPlayers)
      .where(and(eq(watchedPlayers.userLeagueId, userLeagueId), eq(watchedPlayers.fantraxPlayerId, fantraxPlayerId)));
  }
}

export async function clearWatched(userLeagueId: string): Promise<void> {
  await db.delete(watchedPlayers).where(eq(watchedPlayers.userLeagueId, userLeagueId));
}

export async function getWatchedPlayerIds(userLeagueId: string): Promise<Set<string>> {
  const rows = await db
    .select({ fantraxPlayerId: watchedPlayers.fantraxPlayerId })
    .from(watchedPlayers)
    .where(eq(watchedPlayers.userLeagueId, userLeagueId));
  return new Set(rows.map((r) => r.fantraxPlayerId));
}
