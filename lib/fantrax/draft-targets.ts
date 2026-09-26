import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { draftTargets, fantraxPlayers } from "@/lib/db/schema";
import { getPlayerIds, type FantraxPlayer } from "./client";
import { ensurePlayersImported } from "./import-league";
import { mapPositionToBucket } from "./position-mapping";

export { mapPositionToBucket };

export interface PlayerSearchResult {
  fantraxPlayerId: string;
  name: string;
  team: string;
  position: string;
}

/** Searches Fantrax's full NHL player pool by name substring (case-insensitive). */
export async function searchPlayerPool(query: string, limit = 20): Promise<PlayerSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const pool = await getPlayerIds("NHL");
  const results: PlayerSearchResult[] = [];

  for (const [fantraxPlayerId, player] of Object.entries(pool) as [string, FantraxPlayer][]) {
    if (player.name.toLowerCase().includes(trimmed)) {
      results.push({ fantraxPlayerId, name: player.name, team: player.team, position: player.position });
      if (results.length >= limit) break;
    }
  }

  return results;
}

export async function addDraftTarget(
  userLeagueId: string,
  fantraxPlayerId: string,
  availableBuckets: string[]
): Promise<void> {
  await ensurePlayersImported([fantraxPlayerId]);

  const [player] = await db
    .select()
    .from(fantraxPlayers)
    .where(eq(fantraxPlayers.fantraxPlayerId, fantraxPlayerId));
  if (!player?.position) {
    throw new Error(`Could not determine a position for player ${fantraxPlayerId}`);
  }

  const bucket = mapPositionToBucket(player.position, availableBuckets);
  if (!bucket) {
    throw new Error(`Position "${player.position}" doesn't map to any of this league's roster slots (${availableBuckets.join(", ")})`);
  }

  await db
    .insert(draftTargets)
    .values({ userLeagueId, fantraxPlayerId, rosterPosition: bucket })
    .onConflictDoNothing({ target: [draftTargets.userLeagueId, draftTargets.fantraxPlayerId] });
}

export async function removeDraftTarget(userLeagueId: string, fantraxPlayerId: string): Promise<void> {
  await db
    .delete(draftTargets)
    .where(and(eq(draftTargets.userLeagueId, userLeagueId), eq(draftTargets.fantraxPlayerId, fantraxPlayerId)));
}

export async function clearDraftTargets(userLeagueId: string): Promise<void> {
  await db.delete(draftTargets).where(eq(draftTargets.userLeagueId, userLeagueId));
}

export async function getDraftTargetRows(userLeagueId: string) {
  return db
    .select()
    .from(draftTargets)
    .innerJoin(fantraxPlayers, eq(draftTargets.fantraxPlayerId, fantraxPlayers.fantraxPlayerId))
    .where(eq(draftTargets.userLeagueId, userLeagueId));
}
