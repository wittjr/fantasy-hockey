import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fantraxLeagues, fantraxTeams, userLeagues } from "@/lib/db/schema";
import { getLeagueDetails } from "./client";

/**
 * Imports (or re-syncs) a Yahoo league's settings and team list into the same tables
 * Fantrax leagues use, with provider = "yahoo". Roster slots are stored in the same
 * positionConstraints shape the analysis reads, so a Yahoo league's slots (C/LW/RW/D/
 * Util/G) show up there directly. Rosters are not imported yet.
 */
export async function importYahooLeague(userId: string, leagueKey: string): Promise<{ userLeagueId: string }> {
  const details = await getLeagueDetails(userId, leagueKey);

  const positionConstraints: Record<string, { maxActive?: number; maxTotal?: number }> = {};
  for (const rp of details.rosterPositions) {
    positionConstraints[rp.position] = rp.isStarting ? { maxActive: rp.count } : { maxTotal: rp.count };
  }
  const settingsJson = {
    positionConstraints,
    maxTotalPlayers: details.rosterPositions.reduce((sum, rp) => sum + rp.count, 0),
    maxTotalActivePlayers: details.rosterPositions.filter((rp) => rp.isStarting).reduce((sum, rp) => sum + rp.count, 0),
  };

  const fields = {
    name: details.name,
    seasonYear: details.season,
    startDate: details.startDate,
    endDate: details.endDate,
    settingsJson,
    lastSyncedAt: new Date(),
  };
  const [league] = await db
    .insert(fantraxLeagues)
    .values({ provider: "yahoo", fantraxLeagueId: details.leagueKey, sport: "NHL", ...fields })
    .onConflictDoUpdate({ target: fantraxLeagues.fantraxLeagueId, set: fields })
    .returning();

  for (const team of details.teams) {
    await db
      .insert(fantraxTeams)
      .values({ leagueId: league.id, fantraxTeamId: team.teamKey, name: team.name })
      .onConflictDoUpdate({
        target: [fantraxTeams.leagueId, fantraxTeams.fantraxTeamId],
        set: { name: team.name },
      });
  }

  const [existing] = await db
    .select()
    .from(userLeagues)
    .where(and(eq(userLeagues.userId, userId), eq(userLeagues.leagueId, league.id)));
  const userLeague = existing ?? (await db.insert(userLeagues).values({ userId, leagueId: league.id }).returning())[0];

  return { userLeagueId: userLeague.id };
}
