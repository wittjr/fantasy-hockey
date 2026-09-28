import { getAdp, getPlayerIds } from "@/lib/fantrax/client";
import { fetchAllTeamRosters, getTeamsForLeague } from "@/lib/fantrax/import-league";
import { getKeeperOverrides } from "@/lib/fantrax/keeper-overrides";
import type { MatchableRow } from "@/lib/import/match-players";

export interface OpponentRosterPlayer {
  fantraxPlayerId: string;
  name: string;
  nhlTeamAbbrev: string | null;
  rosterPosition: string;
  isConsidered: boolean;
  rank: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
  fantraxAdp: number | null;
}

export interface OpponentTeam {
  fantraxTeamId: string;
  teamName: string;
  players: OpponentRosterPlayer[];
}

interface ProjectionRowWithId extends MatchableRow {
  id: string;
  rank: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
}

/**
 * Every other team's full roster, each player flagged with whether they're currently
 * considered "kept" (only what the user saved - by hand or with "Select likely keepers";
 * nothing is guessed on load) and enriched with the user's
 * spreadsheet projections where a match exists. Player name/team come straight from
 * Fantrax's live player pool rather than the DB fantrax_player table, so this doesn't need
 * to write ~200 rows on every page load just to look up names.
 */
export async function getOpponentRosters<Row extends ProjectionRowWithId>(
  internalLeagueId: string,
  fantraxLeagueId: string,
  myFantraxTeamId: string,
  userLeagueId: string,
  projections: Row[],
  rowIdToPlayerId: Map<string, string>
): Promise<OpponentTeam[]> {
  const [allRosters, teams, pool, liveAdp, overrides] = await Promise.all([
    fetchAllTeamRosters(fantraxLeagueId),
    getTeamsForLeague(internalLeagueId),
    getPlayerIds("NHL"),
    getAdp("NHL"),
    getKeeperOverrides(userLeagueId),
  ]);

  const teamNameById = new Map(teams.map((t) => [t.fantraxTeamId, t.name]));
  const adpByPlayerId = new Map(liveAdp.map((e) => [e.id, e.ADP]));

  const projectionByPlayerId = new Map<string, Row>();
  const rowsById = new Map(projections.map((r) => [r.id, r]));
  for (const [rowId, playerId] of rowIdToPlayerId) {
    const row = rowsById.get(rowId);
    if (row) projectionByPlayerId.set(playerId, row);
  }

  const otherTeamRosterPlayerIds = new Map<string, string[]>();
  for (const [teamId, roster] of Object.entries(allRosters)) {
    if (teamId === myFantraxTeamId) continue;
    otherTeamRosterPlayerIds.set(
      teamId,
      roster.map((r) => r.fantraxPlayerId)
    );
  }

  const result: OpponentTeam[] = [];
  for (const [teamId, playerIds] of otherTeamRosterPlayerIds) {
    const roster = allRosters[teamId] ?? [];
    const rosterPositionById = new Map(roster.map((r) => [r.fantraxPlayerId, r.rosterPosition]));
    const players: OpponentRosterPlayer[] = playerIds.map((id) => {
      const poolPlayer = pool[id];
      const projection = projectionByPlayerId.get(id);
      return {
        fantraxPlayerId: id,
        name: poolPlayer?.name ?? projection?.name ?? `Unknown player (${id})`,
        nhlTeamAbbrev: poolPlayer?.team ?? projection?.nhlTeamAbbrev ?? null,
        rosterPosition: rosterPositionById.get(id) ?? "?",
        isConsidered: overrides.get(id) ?? false,
        rank: projection?.rank ?? null,
        fantasyPoints: projection?.fantasyPoints ?? null,
        fantasyPointsPerGp: projection?.fantasyPointsPerGp ?? null,
        vorp: projection?.vorp ?? null,
        adp: projection?.adp ?? null,
        fantraxAdp: adpByPlayerId.get(id) ?? null,
      };
    });

    result.push({ fantraxTeamId: teamId, teamName: teamNameById.get(teamId) ?? teamId, players });
  }

  return result;
}
