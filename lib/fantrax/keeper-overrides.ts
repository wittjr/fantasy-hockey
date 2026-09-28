import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { keeperOverrides } from "@/lib/db/schema";
import { computeLikelyKeptPlayers } from "@/lib/analysis/likely-keepers";
import { getAdp, getTeamRosters } from "./client";

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

/** Checks Consider for every player on every other team's current roster, overriding any unchecks. */
export async function selectAllKeepers(userLeagueId: string, fantraxLeagueId: string, myFantraxTeamId: string): Promise<void> {
  const rosters = await getTeamRosters(fantraxLeagueId);
  const ids = Object.entries(rosters.rosters)
    .filter(([teamId]) => teamId !== myFantraxTeamId)
    .flatMap(([, team]) => team.rosterItems.map((i) => i.id));
  if (ids.length === 0) return;
  await db
    .insert(keeperOverrides)
    .values(ids.map((fantraxPlayerId) => ({ userLeagueId, fantraxPlayerId, isKept: true })))
    .onConflictDoUpdate({ target: [keeperOverrides.userLeagueId, keeperOverrides.fantraxPlayerId], set: { isKept: true } });
}

/** Unchecks Consider for every opponent's player, so they're all back in the available pool. */
export async function clearKeeperOverrides(userLeagueId: string): Promise<void> {
  await db.delete(keeperOverrides).where(eq(keeperOverrides.userLeagueId, userLeagueId));
}

/**
 * Checks Consider for each other team's likely keepers: their top 6 by live Fantrax ADP, none
 * over ADP 96 (see likely-keepers.ts). Only runs when the user asks. Players the user already
 * set either way are left alone. Returns how many players it checked.
 */
export async function selectLikelyKeepers(userLeagueId: string, fantraxLeagueId: string, myFantraxTeamId: string): Promise<number> {
  const [rosters, adp, overrides] = await Promise.all([
    getTeamRosters(fantraxLeagueId),
    getAdp("NHL"),
    getKeeperOverrides(userLeagueId),
  ]);

  const candidates = new Map<string, string[]>();
  for (const [teamId, team] of Object.entries(rosters.rosters)) {
    if (teamId === myFantraxTeamId) continue;
    candidates.set(teamId, team.rosterItems.map((i) => i.id));
  }
  const likely = computeLikelyKeptPlayers(candidates, new Map(adp.map((a) => [a.id, a.ADP])));

  const toCheck = [...likely.keys()].filter((id) => !overrides.has(id));
  if (toCheck.length > 0) {
    await db
      .insert(keeperOverrides)
      .values(toCheck.map((fantraxPlayerId) => ({ userLeagueId, fantraxPlayerId, isKept: true })))
      .onConflictDoNothing();
  }
  return toCheck.length;
}
