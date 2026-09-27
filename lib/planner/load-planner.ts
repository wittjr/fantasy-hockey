import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fantraxLeagues, spreadsheetProjections, userLeagues } from "@/lib/db/schema";
import { normalizeName } from "@/lib/import/match-players";
import { matchProjectionsToFantraxIds } from "@/lib/analysis/match-projections";
import { loadFantraxPlanner } from "./sources/fantrax";
import { loadYahooPlanner } from "./sources/yahoo";
import type { PlannerData } from "./types";

type League = typeof fantraxLeagues.$inferSelect;
type UserLeague = typeof userLeagues.$inferSelect;

/** Starting lineup slots from the imported league settings (entries with maxActive; bench/IR only have maxTotal). */
function lineupSlotsFromSettings(league: League): Record<string, number> {
  const constraints =
    (league.settingsJson as { positionConstraints?: Record<string, { maxActive?: number }> } | null)?.positionConstraints ?? {};
  const slots: Record<string, number> = {};
  for (const [slot, c] of Object.entries(constraints)) {
    if (c.maxActive) slots[slot] = c.maxActive;
  }
  return slots;
}

/**
 * Loads everything the weekly planner needs from the league's own platform, normalized.
 * Neither Fantrax nor Yahoo exposes projected points through its API, so when the platform
 * has none this falls back to the user's uploaded projections spreadsheet (FP/GP), and says so.
 */
export async function loadPlanner(
  userId: string,
  userLeague: UserLeague,
  league: League,
  requestedWeek: number | null
): Promise<PlannerData> {
  if (!userLeague.myFantraxTeamId) throw new Error("Pick your team on the league page first.");

  let data: PlannerData;
  if (league.provider === "yahoo") {
    data = await loadYahooPlanner(
      userId,
      league.fantraxLeagueId,
      userLeague.myFantraxTeamId,
      lineupSlotsFromSettings(league),
      requestedWeek
    );
  } else if (league.provider === "fantrax") {
    data = await loadFantraxPlanner(league.fantraxLeagueId, userLeague.myFantraxTeamId, requestedWeek);
  } else {
    throw new Error(`The weekly planner doesn't support ${league.provider} leagues yet.`);
  }

  if (data.projectionSource === "none") await applySpreadsheetProjections(userId, data);
  return data;
}

async function applySpreadsheetProjections(userId: string, data: PlannerData): Promise<void> {
  const rows = await db
    .select({
      id: spreadsheetProjections.id,
      name: spreadsheetProjections.name,
      nhlTeamAbbrev: spreadsheetProjections.nhlTeamAbbrev,
      position: spreadsheetProjections.position,
      fantasyPointsPerGp: spreadsheetProjections.fantasyPointsPerGp,
    })
    .from(spreadsheetProjections)
    .where(eq(spreadsheetProjections.userId, userId));

  if (rows.length === 0) {
    data.notices.push(
      "No projections spreadsheet uploaded either, so recommendations are ranked by games added, then " +
        `${data.rankLabel}. Upload one from the Draft Day Helper to rank by projected points.`
    );
    return;
  }

  // Fantrax players match by ID via the same matcher the Draft Day Helper uses; other
  // platforms' IDs mean nothing to the sheet, so they match on exact name + team.
  const ppgByKey = new Map<string, number>();
  if (data.platform === "fantrax") {
    const rowIdToFantraxId = await matchProjectionsToFantraxIds(rows);
    for (const r of rows) {
      const fantraxId = rowIdToFantraxId.get(r.id);
      if (fantraxId && r.fantasyPointsPerGp !== null) ppgByKey.set(fantraxId, r.fantasyPointsPerGp);
    }
  } else {
    for (const r of rows) {
      if (r.fantasyPointsPerGp !== null) ppgByKey.set(`${normalizeName(r.name)}|${r.nhlTeamAbbrev ?? ""}`, r.fantasyPointsPerGp);
    }
  }
  const keyFor = (p: { playerId: string; name: string; nhlTeamAbbrev: string | null }) =>
    data.platform === "fantrax" ? p.playerId : `${normalizeName(p.name)}|${p.nhlTeamAbbrev ?? ""}`;

  for (const p of data.roster) p.projectedPointsPerGame = ppgByKey.get(keyFor(p)) ?? null;
  let matched = 0;
  for (const p of data.available) {
    const ppg = ppgByKey.get(keyFor(p));
    if (ppg !== undefined) {
      p.projectedPointsPerGame = ppg;
      matched++;
    }
  }

  data.projectionSource = "spreadsheet";
  data.notices.push(
    `Using FP/GP from your uploaded projections spreadsheet instead (matched ${data.roster.filter((p) => p.projectedPointsPerGame !== null).length}/${data.roster.length} ` +
      `rostered and ${matched} available players). ` +
      "Those are season-long projections from your sheet, not this league's platform."
  );
}
