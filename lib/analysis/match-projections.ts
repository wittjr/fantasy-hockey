import { getPlayerIds } from "@/lib/fantrax/client";
import { buildFantraxPlayerIndex, matchSpreadsheetRow, type MatchableRow } from "@/lib/import/match-players";

export interface ProjectionRowForMatching extends MatchableRow {
  id: string;
}

/**
 * Matches each projection row to a Fantrax player ID where possible. Pulled out on its
 * own so the one Fantrax player-pool fetch + matching pass can be shared by both the
 * likely-kept-elsewhere detection and the "already on my team" exclusion, instead of
 * each redoing it.
 */
export async function matchProjectionsToFantraxIds(projections: ProjectionRowForMatching[]): Promise<Map<string, string>> {
  const pool = await getPlayerIds("NHL");
  const index = buildFantraxPlayerIndex(pool);

  const rowIdToPlayerId = new Map<string, string>();
  for (const row of projections) {
    const match = matchSpreadsheetRow(row, index);
    if (match) rowIdToPlayerId.set(row.id, match.fantraxPlayerId);
  }
  return rowIdToPlayerId;
}
