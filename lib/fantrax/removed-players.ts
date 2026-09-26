import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { removedPlayers } from "@/lib/db/schema";

export async function removePlayer(userLeagueId: string, fantraxPlayerId: string): Promise<void> {
  await db
    .insert(removedPlayers)
    .values({ userLeagueId, fantraxPlayerId })
    .onConflictDoNothing({ target: [removedPlayers.userLeagueId, removedPlayers.fantraxPlayerId] });
}

export async function restorePlayer(userLeagueId: string, fantraxPlayerId: string): Promise<void> {
  await db
    .delete(removedPlayers)
    .where(and(eq(removedPlayers.userLeagueId, userLeagueId), eq(removedPlayers.fantraxPlayerId, fantraxPlayerId)));
}

export async function restoreAllPlayers(userLeagueId: string): Promise<void> {
  await db.delete(removedPlayers).where(eq(removedPlayers.userLeagueId, userLeagueId));
}

export async function getRemovedPlayerIds(userLeagueId: string): Promise<Set<string>> {
  const rows = await db
    .select({ fantraxPlayerId: removedPlayers.fantraxPlayerId })
    .from(removedPlayers)
    .where(eq(removedPlayers.userLeagueId, userLeagueId));
  return new Set(rows.map((r) => r.fantraxPlayerId));
}
