import type { FantraxDraftResults } from "./client";

/** Epoch ms for a Fantrax timestamp like "2026-09-27T20:00:00.0-0400" (offset without a colon). */
export function fantraxTimestampMs(ts: string): number {
  return new Date(ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).getTime();
}

export interface DraftSyncPlan {
  addToMyTeam: string[];
  /** Players you'd added to your team by hand (what-ifs) that another team just drafted. */
  dropFromMyTeam: string[];
  removeFromPool: string[];
}

/** The writes needed to reflect every pick made so far, given what's already recorded. */
export function planDraftSync(
  picks: FantraxDraftResults["draftPicks"],
  myFantraxTeamId: string,
  targetIds: Set<string>,
  removedIds: Set<string>
): DraftSyncPlan {
  const plan: DraftSyncPlan = { addToMyTeam: [], dropFromMyTeam: [], removeFromPool: [] };
  for (const { playerId, teamId } of picks) {
    if (!playerId) continue;
    if (teamId === myFantraxTeamId) {
      if (!targetIds.has(playerId)) plan.addToMyTeam.push(playerId);
    } else {
      if (targetIds.has(playerId)) plan.dropFromMyTeam.push(playerId);
      if (!removedIds.has(playerId)) plan.removeFromPool.push(playerId);
    }
  }
  return plan;
}
