"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  importFantraxLeague,
  getUserLeagueWithLeague,
  renamePlayer,
  setMyTeam,
  setPlayerFlags,
  syncTeamNames,
  syncTeamRoster,
} from "@/lib/fantrax/import-league";
import { addDraftTarget, clearDraftTargets, removeDraftTarget } from "@/lib/fantrax/draft-targets";
import { setKeeperOverride } from "@/lib/fantrax/keeper-overrides";
import { removePlayer, restoreAllPlayers, restorePlayer } from "@/lib/fantrax/removed-players";
import { syncDraftPicks, type DraftSyncResult } from "@/lib/fantrax/draft-sync";
import { clearWatched, setWatched } from "@/lib/fantrax/watched-players";
import { importNhlSeasonSchedule } from "@/lib/nhl/import-schedule";
import { parseProjectionsSpreadsheet } from "@/lib/import/spreadsheet";
import { importSpreadsheetForUser } from "@/lib/import/projections";
import { importYahooLeague } from "@/lib/yahoo/import-league";
import { disconnectYahoo } from "@/lib/yahoo/oauth";
import { FANTRAX_PROJECTIONS_TAG } from "@/lib/fantrax/cached-projections";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function importLeagueAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const leagueUrl = String(formData.get("leagueUrl") ?? "").trim();
  if (!leagueUrl) throw new Error("League URL or ID is required");

  const result = await importFantraxLeague(userId, leagueUrl);
  revalidatePath("/");
  redirect(`/leagues/${result.userLeagueId}`);
}

export async function importYahooLeagueAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const leagueKey = String(formData.get("leagueKey") ?? "");
  if (!leagueKey) throw new Error("No Yahoo league selected");

  const result = await importYahooLeague(userId, leagueKey);
  revalidatePath("/");
  redirect(`/leagues/${result.userLeagueId}`);
}

export async function disconnectYahooAction(): Promise<void> {
  const userId = await requireUserId();
  await disconnectYahoo(userId);
  revalidatePath("/");
  // Drop any ?yahoo=connected status left in the URL from the last connect, or its
  // "connected" message would keep showing after disconnecting.
  redirect("/");
}

// Roster sync only talks to Fantrax so far - Yahoo leagues skip it until Yahoo rosters are supported.
async function isFantraxLeague(userLeagueId: string): Promise<boolean> {
  const row = await getUserLeagueWithLeague(userLeagueId);
  return row?.fantrax_league.provider === "fantrax";
}

export async function setMyTeamAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const fantraxTeamId = String(formData.get("fantraxTeamId") ?? "");
  if (!fantraxTeamId) throw new Error("Select a team");

  await setMyTeam(userLeagueId, fantraxTeamId);
  if (await isFantraxLeague(userLeagueId)) await syncTeamRoster(userLeagueId);
  revalidatePath(`/leagues/${userLeagueId}`);
}

export async function resyncRosterAction(userLeagueId: string): Promise<void> {
  await requireUserId();
  const row = await getUserLeagueWithLeague(userLeagueId);
  if (row?.fantrax_league.provider === "fantrax") {
    await syncTeamNames(row.fantrax_league.id, row.fantrax_league.fantraxLeagueId);
    await syncTeamRoster(userLeagueId);
  }
  revalidatePath(`/leagues/${userLeagueId}`, "layout");
}

export async function togglePlayerFlagAction(
  userLeagueId: string,
  fantraxPlayerId: string,
  flag: "isKeeper" | "isConsidered",
  formData: FormData
): Promise<void> {
  await requireUserId();
  const value = formData.get(flag) === "on";
  await setPlayerFlags(userLeagueId, fantraxPlayerId, { [flag]: value });
  revalidatePath(`/leagues/${userLeagueId}`);
}

export async function renamePlayerAction(
  userLeagueId: string,
  fantraxPlayerId: string,
  formData: FormData
): Promise<void> {
  await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  await renamePlayer(fantraxPlayerId, name);
  revalidatePath(`/leagues/${userLeagueId}`);
}

function analysisUrl(userLeagueId: string, season: string): string {
  return season ? `/leagues/${userLeagueId}/analysis?season=${season}` : `/leagues/${userLeagueId}/analysis`;
}

export async function addDraftTargetAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const fantraxPlayerId = String(formData.get("fantraxPlayerId") ?? "");
  const season = String(formData.get("season") ?? "");
  if (!fantraxPlayerId) throw new Error("No player selected");

  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row) throw new Error("League not found");
  const rosterInfo = row.fantrax_league.settingsJson as { positionConstraints?: Record<string, unknown> } | null;
  const availableBuckets = Object.keys(rosterInfo?.positionConstraints ?? {});

  await addDraftTarget(userLeagueId, fantraxPlayerId, availableBuckets);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
  redirect(analysisUrl(userLeagueId, season));
}

export async function removeDraftTargetAction(
  userLeagueId: string,
  fantraxPlayerId: string,
  formData: FormData
): Promise<void> {
  await requireUserId();
  const season = String(formData.get("season") ?? "");

  await removeDraftTarget(userLeagueId, fantraxPlayerId);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
  redirect(analysisUrl(userLeagueId, season));
}

export async function resetDraftTargetsAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const season = String(formData.get("season") ?? "");

  await clearDraftTargets(userLeagueId);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
  redirect(analysisUrl(userLeagueId, season));
}

export async function toggleKeeperOverrideAction(
  userLeagueId: string,
  fantraxPlayerId: string,
  formData: FormData
): Promise<void> {
  await requireUserId();
  const isKept = formData.get("isKept") === "on";
  await setKeeperOverride(userLeagueId, fantraxPlayerId, isKept);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
}

export async function removePlayerAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const fantraxPlayerId = String(formData.get("fantraxPlayerId") ?? "");
  if (!fantraxPlayerId) throw new Error("No player selected");

  await removePlayer(userLeagueId, fantraxPlayerId);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
}

export async function restorePlayerAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const fantraxPlayerId = String(formData.get("fantraxPlayerId") ?? "");
  if (!fantraxPlayerId) throw new Error("No player selected");

  await restorePlayer(userLeagueId, fantraxPlayerId);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
}

/**
 * Stars or unstars a player in Available players. The table updates its own star optimistically,
 * so there's no revalidation - re-rendering the whole Draft Day Helper per click would be slow.
 */
export async function setWatchedAction(userLeagueId: string, fantraxPlayerId: string, watched: boolean): Promise<void> {
  await requireUserId();
  await setWatched(userLeagueId, fantraxPlayerId, watched);
}

/** Unstars everyone - also optimistic on the table's side, so no revalidation. */
export async function clearWatchlistAction(userLeagueId: string): Promise<void> {
  await requireUserId();
  await clearWatched(userLeagueId);
}

export async function restoreAllPlayersAction(userLeagueId: string): Promise<void> {
  await requireUserId();
  await restoreAllPlayers(userLeagueId);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
}

/** Called on a timer by DraftPickSync during a live draft. Re-renders the page only when picks changed something. */
export async function syncDraftPicksAction(userLeagueId: string): Promise<DraftSyncResult> {
  const userId = await requireUserId();
  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row || row.user_league.userId !== userId) throw new Error("League not found");
  const { user_league: userLeague, fantrax_league: league } = row;
  if (!userLeague.myFantraxTeamId || league.provider !== "fantrax") throw new Error("Pick your Fantrax team first");

  const rosterInfo = league.settingsJson as { positionConstraints?: Record<string, unknown> } | null;
  const result = await syncDraftPicks(
    userLeagueId,
    league.id,
    league.fantraxLeagueId,
    userLeague.myFantraxTeamId,
    Object.keys(rosterInfo?.positionConstraints ?? {})
  );
  if (result.changed) revalidatePath(`/leagues/${userLeagueId}/analysis`);
  return result;
}

export async function importProjectionsAction(userLeagueId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const season = String(formData.get("season") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a spreadsheet file");

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = await parseProjectionsSpreadsheet(buffer);
  await importSpreadsheetForUser(userId, rows);

  revalidatePath(`/leagues/${userLeagueId}/analysis`);
  redirect(analysisUrl(userLeagueId, season));
}

export async function importScheduleAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const season = String(formData.get("season") ?? "").trim();
  if (!/^\d{8}$/.test(season)) throw new Error('Season must be 8 digits, e.g. "20262027"');

  await importNhlSeasonSchedule(season);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
  redirect(`/leagues/${userLeagueId}/analysis?season=${season}`);
}

/**
 * Drops the cached Fantrax projections (normally kept up to 24 hours) so the planner refetches
 * them now - e.g. right after a new scoring period starts. Clears them for every league; the
 * cache holds only a few small entries, so that's cheap. week is the planner week to return to.
 */
export async function refreshProjectionsAction(userLeagueId: string, week: number | null): Promise<void> {
  await requireUserId();
  updateTag(FANTRAX_PROJECTIONS_TAG);
  redirect(plannerUrl(userLeagueId, week));
}

/**
 * Reloads the planner's roster for the shown week. The planner reads rosters live from the
 * platform on every render, so this only has to drop the rendered page and load it again.
 */
export async function refreshPlannerRosterAction(userLeagueId: string, week: number | null): Promise<void> {
  await requireUserId();
  revalidatePath(`/leagues/${userLeagueId}/planner`);
  redirect(plannerUrl(userLeagueId, week));
}

function plannerUrl(userLeagueId: string, week: number | null): string {
  return week === null ? `/leagues/${userLeagueId}/planner` : `/leagues/${userLeagueId}/planner?week=${week}`;
}
