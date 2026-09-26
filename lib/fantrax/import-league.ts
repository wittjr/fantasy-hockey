import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { fantraxLeagues, fantraxPlayers, fantraxTeams, teamRosters, userLeagues } from "@/lib/db/schema";
import { extractLeagueId, getLeagueInfo, getPlayerIds, getTeamRosters } from "./client";

export interface ImportLeagueResult {
  userLeagueId: string;
  leagueId: string;
  leagueName: string;
  teams: Array<{ fantraxTeamId: string; name: string }>;
}

/**
 * Imports (or re-syncs) a Fantrax league for a user: pulls league settings and the
 * team list, and records that this user has this league. Does NOT set which team is
 * "theirs" or import a roster yet - see setMyTeam/syncTeamRoster.
 */
export async function importFantraxLeague(userId: string, leagueUrlOrId: string): Promise<ImportLeagueResult> {
  const fantraxLeagueId = extractLeagueId(leagueUrlOrId);
  const info = await getLeagueInfo(fantraxLeagueId);

  const [league] = await db
    .insert(fantraxLeagues)
    .values({
      fantraxLeagueId,
      name: info.leagueName,
      sport: "NHL",
      seasonYear: info.seasonYear,
      startDate: info.startDate,
      endDate: info.endDate,
      settingsJson: info.rosterInfo,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fantraxLeagues.fantraxLeagueId,
      set: {
        name: info.leagueName,
        seasonYear: info.seasonYear,
        startDate: info.startDate,
        endDate: info.endDate,
        settingsJson: info.rosterInfo,
        lastSyncedAt: new Date(),
      },
    })
    .returning();

  const teamEntries = Object.values(info.teamInfo);
  for (const team of teamEntries) {
    await db
      .insert(fantraxTeams)
      .values({ leagueId: league.id, fantraxTeamId: team.id, name: team.name })
      .onConflictDoUpdate({
        target: [fantraxTeams.leagueId, fantraxTeams.fantraxTeamId],
        set: { name: team.name },
      });
  }

  const existingUserLeague = await db
    .select()
    .from(userLeagues)
    .where(and(eq(userLeagues.userId, userId), eq(userLeagues.leagueId, league.id)));

  const userLeague =
    existingUserLeague[0] ??
    (await db.insert(userLeagues).values({ userId, leagueId: league.id }).returning())[0];

  return {
    userLeagueId: userLeague.id,
    leagueId: fantraxLeagueId,
    leagueName: info.leagueName,
    teams: teamEntries.map((t) => ({ fantraxTeamId: t.id, name: t.name })),
  };
}

export async function setMyTeam(userLeagueId: string, fantraxTeamId: string): Promise<void> {
  await db.update(userLeagues).set({ myFantraxTeamId: fantraxTeamId }).where(eq(userLeagues.id, userLeagueId));
}

/**
 * Ensures fantraxPlayers rows exist (with name/position/team) for the given IDs.
 * team_roster has a FK to this table, so every rostered player must get a row here -
 * even ones Fantrax's own getPlayerIds pool doesn't know about (observed in practice:
 * a handful of IDs on real rosters aren't in the pool response at all, likely stale/
 * inactive players). Those get a placeholder row rather than breaking the import.
 */
export async function ensurePlayersImported(fantraxPlayerIds: string[]): Promise<void> {
  if (fantraxPlayerIds.length === 0) return;
  const pool = await getPlayerIds("NHL");
  const idSet = new Set(fantraxPlayerIds);

  for (const id of idSet) {
    const player = pool[id];
    const values = player
      ? { fantraxPlayerId: id, name: player.name, position: player.position, nhlTeamAbbrev: player.team }
      : { fantraxPlayerId: id, name: `Unknown player (${id})`, position: null, nhlTeamAbbrev: null };

    await db
      .insert(fantraxPlayers)
      .values(values)
      .onConflictDoUpdate({
        target: fantraxPlayers.fantraxPlayerId,
        set: { name: values.name, position: values.position, nhlTeamAbbrev: values.nhlTeamAbbrev },
      });
  }
}

export interface TeamRosterEntry {
  fantraxPlayerId: string;
  rosterPosition: string;
  status: string;
}

/** Fetches a specific team's current roster from Fantrax (not yet written to the DB). */
export async function fetchTeamRoster(fantraxLeagueId: string, fantraxTeamId: string): Promise<TeamRosterEntry[]> {
  const rosters = await getTeamRosters(fantraxLeagueId);
  const teamRoster = rosters.rosters[fantraxTeamId];
  if (!teamRoster) throw new Error(`Team ${fantraxTeamId} not found in league ${fantraxLeagueId} rosters`);
  return teamRoster.rosterItems.map((item) => ({
    fantraxPlayerId: item.id,
    rosterPosition: item.position,
    status: item.status,
  }));
}

/** Fetches every team's roster in the league in one call - the fxea endpoint already returns all of them. */
export async function fetchAllTeamRosters(fantraxLeagueId: string): Promise<Record<string, TeamRosterEntry[]>> {
  const rosters = await getTeamRosters(fantraxLeagueId);
  const result: Record<string, TeamRosterEntry[]> = {};
  for (const [teamId, teamRoster] of Object.entries(rosters.rosters)) {
    result[teamId] = teamRoster.rosterItems.map((item) => ({
      fantraxPlayerId: item.id,
      rosterPosition: item.position,
      status: item.status,
    }));
  }
  return result;
}

export async function getUserLeagueWithLeague(userLeagueId: string) {
  const [row] = await db
    .select()
    .from(userLeagues)
    .innerJoin(fantraxLeagues, eq(userLeagues.leagueId, fantraxLeagues.id))
    .where(eq(userLeagues.id, userLeagueId));
  return row;
}

export async function getUserLeaguesForUser(userId: string) {
  return db
    .select()
    .from(userLeagues)
    .innerJoin(fantraxLeagues, eq(userLeagues.leagueId, fantraxLeagues.id))
    .where(eq(userLeagues.userId, userId));
}

export async function getTeamsForLeague(leagueId: string) {
  return db.select().from(fantraxTeams).where(eq(fantraxTeams.leagueId, leagueId));
}

/**
 * Pulls the designated team's live roster from Fantrax and mirrors it into team_roster.
 * Preserves isKeeper/isConsidered for players already tracked (those are user edits, not
 * something Fantrax tells us) - only rosterPosition is refreshed from the live data.
 * Players no longer on the live roster (dropped/traded) are removed.
 */
export async function syncTeamRoster(userLeagueId: string): Promise<{ playerCount: number }> {
  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row) throw new Error(`user_league ${userLeagueId} not found`);
  const { user_league: userLeague, fantrax_league: league } = row;
  if (!userLeague.myFantraxTeamId) {
    throw new Error("No team designated for this league yet - call setMyTeam first");
  }

  const rosterEntries = await fetchTeamRoster(league.fantraxLeagueId, userLeague.myFantraxTeamId);
  const livePlayerIds = rosterEntries.map((e) => e.fantraxPlayerId);
  await ensurePlayersImported(livePlayerIds);

  // An empty response is more likely a Fantrax hiccup than a truly empty roster - don't wipe on it.
  if (livePlayerIds.length > 0) {
    await db
      .delete(teamRosters)
      .where(and(eq(teamRosters.userLeagueId, userLeagueId), notInArray(teamRosters.fantraxPlayerId, livePlayerIds)));
  }

  for (const entry of rosterEntries) {
    await db
      .insert(teamRosters)
      .values({
        userLeagueId,
        fantraxPlayerId: entry.fantraxPlayerId,
        rosterPosition: entry.rosterPosition,
      })
      .onConflictDoUpdate({
        target: [teamRosters.userLeagueId, teamRosters.fantraxPlayerId],
        set: { rosterPosition: entry.rosterPosition },
      });
  }

  return { playerCount: rosterEntries.length };
}

export async function getTeamRosterRows(userLeagueId: string) {
  return db
    .select()
    .from(teamRosters)
    .innerJoin(fantraxPlayers, eq(teamRosters.fantraxPlayerId, fantraxPlayers.fantraxPlayerId))
    .where(eq(teamRosters.userLeagueId, userLeagueId));
}

/**
 * Manual override for a player's display name - needed for players Fantrax's fxea
 * pool doesn't know about (e.g. retired players still sitting on a roster from a
 * prior season) but that a real name is known for anyway.
 */
export async function renamePlayer(fantraxPlayerId: string, name: string): Promise<void> {
  await db.update(fantraxPlayers).set({ name }).where(eq(fantraxPlayers.fantraxPlayerId, fantraxPlayerId));
}

export async function setPlayerFlags(
  userLeagueId: string,
  fantraxPlayerId: string,
  flags: { isKeeper?: boolean; isConsidered?: boolean }
): Promise<void> {
  await db
    .update(teamRosters)
    .set(flags)
    .where(and(eq(teamRosters.userLeagueId, userLeagueId), eq(teamRosters.fantraxPlayerId, fantraxPlayerId)));
}
