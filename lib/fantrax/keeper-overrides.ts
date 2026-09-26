import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { keeperOverrides } from "@/lib/db/schema";

export async function setKeeperOverride(userLeagueId: string, fantraxPlayerId: string, isKept: boolean): Promise<void> {
  await db
    .insert(keeperOverrides)
    .values({ userLeagueId, fantraxPlayerId, isKept })
    .onConflictDoUpdate({
      target: [keeperOverrides.userLeagueId, keeperOverrides.fantraxPlayerId],
      set: { isKept },
    });
}

export async function getKeeperOverrides(userLeagueId: string): Promise<Map<string, boolean>> {
  const rows = await db.select().from(keeperOverrides).where(eq(keeperOverrides.userLeagueId, userLeagueId));
  return new Map(rows.map((r) => [r.fantraxPlayerId, r.isKept]));
}
