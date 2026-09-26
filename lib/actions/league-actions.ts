"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  importFantraxLeague,
  getUserLeagueWithLeague,
  renamePlayer,
  setMyTeam,
  setPlayerFlags,
  syncTeamRoster,
} from "@/lib/fantrax/import-league";
import { addDraftTarget, clearDraftTargets, removeDraftTarget } from "@/lib/fantrax/draft-targets";
import { setKeeperOverride } from "@/lib/fantrax/keeper-overrides";
import { removePlayer, restoreAllPlayers, restorePlayer } from "@/lib/fantrax/removed-players";
import { importNhlSeasonSchedule } from "@/lib/nhl/import-schedule";
import { parseProjectionsSpreadsheet } from "@/lib/import/spreadsheet";
import { importSpreadsheetForUser } from "@/lib/import/projections";

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

export async function setMyTeamAction(userLeagueId: string, formData: FormData): Promise<void> {
  await requireUserId();
  const fantraxTeamId = String(formData.get("fantraxTeamId") ?? "");
  if (!fantraxTeamId) throw new Error("Select a team");

  await setMyTeam(userLeagueId, fantraxTeamId);
  await syncTeamRoster(userLeagueId);
  revalidatePath(`/leagues/${userLeagueId}`);
}

export async function resyncRosterAction(userLeagueId: string): Promise<void> {
  await requireUserId();
  await syncTeamRoster(userLeagueId);
  revalidatePath(`/leagues/${userLeagueId}`);
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

export async function restoreAllPlayersAction(userLeagueId: string): Promise<void> {
  await requireUserId();
  await restoreAllPlayers(userLeagueId);
  revalidatePath(`/leagues/${userLeagueId}/analysis`);
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
