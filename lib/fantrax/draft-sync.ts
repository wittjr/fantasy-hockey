import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { draftTargets, userLeagues } from "@/lib/db/schema";
import { fantraxNameToFirstLast } from "@/lib/import/match-players";
import { getDraftResults, getPlayerIds } from "./client";
import { planDraftSync } from "./draft-plan";
import { addDraftTarget, removeDraftTarget } from "./draft-targets";
import { getTeamsForLeague } from "./import-league";
import { getRemovedPlayerIds, removePlayer } from "./removed-players";

export interface DraftSyncResult {
  /** Fantrax's draftState, e.g. "running" or "completed". */
  state: string;
  draftDate: string;
  picksMade: number;
  totalPicks: number;
  /** True if this sync added or removed anything, i.e. the page needs to re-render. */
  changed: boolean;
  /** One line per pick this sync applied, in draft order, e.g. "Sandmonsters is proud to select Connor McDavid - C - EDM with pick 1 in round 1". */
  changes: string[];
  errors: string[];
}

/** Records that this completed draft is fully synced, so the page stops catching up on every load. */
export async function markDraftSynced(userLeagueId: string, draftDate: string): Promise<void> {
  await db.update(userLeagues).set({ draftSyncedFor: draftDate }).where(eq(userLeagues.id, userLeagueId));
}

/**
 * Mirrors the live Fantrax draft into the Draft Day Helper: players another team drafts are
 * removed from the available pool (and from your team, if you'd added them by hand as a
 * what-if), and players you draft are added to your team as draft targets. Idempotent - only picks not
 * already reflected are written, so it's safe to call every few seconds.
 *
 * Relies on fxea getDraftResults adding a playerId to each pick once it's made - verified
 * 2026-09-27 against last season's completed draft (keepers are not part of draftPicks).
 */
export async function syncDraftPicks(
  userLeagueId: string,
  leagueId: string,
  fantraxLeagueId: string,
  myFantraxTeamId: string,
  availableBuckets: string[]
): Promise<DraftSyncResult> {
  const draft = await getDraftResults(fantraxLeagueId);
  const picksMade = draft.draftPicks.filter((p) => p.playerId).length;

  const removedIds = await getRemovedPlayerIds(userLeagueId);
  const targetRows = await db
    .select({ fantraxPlayerId: draftTargets.fantraxPlayerId })
    .from(draftTargets)
    .where(eq(draftTargets.userLeagueId, userLeagueId));
  const targetIds = new Set(targetRows.map((r) => r.fantraxPlayerId));

  const plan = planDraftSync(draft.draftPicks, myFantraxTeamId, targetIds, removedIds);
  const errors: string[] = [];
  const failed = new Set<string>();
  const attempt = async (playerId: string, write: () => Promise<void>) => {
    try {
      await write();
    } catch (err) {
      failed.add(playerId);
      errors.push(`${playerId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  for (const id of plan.addToMyTeam) await attempt(id, () => addDraftTarget(userLeagueId, id, availableBuckets));
  for (const id of plan.dropFromMyTeam) await attempt(id, () => removeDraftTarget(userLeagueId, id));
  for (const id of plan.removeFromPool) await attempt(id, () => removePlayer(userLeagueId, id));

  const applied = new Set([...plan.addToMyTeam, ...plan.dropFromMyTeam, ...plan.removeFromPool].filter((id) => !failed.has(id)));
  const changes: string[] = [];
  if (applied.size > 0) {
    const [pool, teams] = await Promise.all([getPlayerIds("NHL"), getTeamsForLeague(leagueId)]);
    const teamNames = new Map(teams.map((t) => [t.fantraxTeamId, t.name]));
    const dropped = new Set(plan.dropFromMyTeam);
    for (const { round, pickInRound, teamId, playerId } of draft.draftPicks) {
      if (!playerId || !applied.has(playerId)) continue;
      const player = pool[playerId];
      const who = player ? `${fantraxNameToFirstLast(player.name)} - ${player.position} - ${player.team}` : playerId;
      const note = teamId === myFantraxTeamId ? " (added to your team)" : dropped.has(playerId) ? " (removed from your team)" : "";
      changes.push(`${teamNames.get(teamId) ?? teamId} is proud to select ${who} with pick ${pickInRound} in round ${round}${note}`);
    }
  }

  return { state: draft.draftState, draftDate: draft.draftDate, picksMade, totalPicks: draft.draftPicks.length, changed: applied.size > 0, changes, errors };
}
