import { getTeamRosterRows, getUserLeagueWithLeague } from "@/lib/fantrax/import-league";
import { getDraftTargetRows } from "@/lib/fantrax/draft-targets";
import { getSeasonSchedule } from "@/lib/nhl/import-schedule";
import { computeCoverageHistogram, computeRosterGaps, computeRosterSurplus } from "./gap-analysis";
import { scoreTeamsForGaps } from "./team-fit";
import type {
  ConsideredPlayer,
  CoverageHistogramRow,
  DateBucketGap,
  DateBucketSurplus,
  RosterSlotConstraints,
  ScheduleGame,
  TeamFitScore,
} from "./types";

interface FantraxRosterInfo {
  positionConstraints: Record<string, { maxActive?: number; maxTotal?: number }>;
  maxTotalPlayers: number;
  maxTotalActivePlayers: number;
}

export interface DisplayPlayer {
  fantraxPlayerId: string;
  name: string;
  rosterPosition: string;
  nhlTeamAbbrev: string | null;
}

export interface GapAnalysisResult {
  slotConstraints: RosterSlotConstraints;
  consideredPlayerCount: number;
  rosterConsidered: DisplayPlayer[];
  draftTargets: DisplayPlayer[];
  gaps: DateBucketGap[];
  surplus: DateBucketSurplus[];
  coverageHistogram: CoverageHistogramRow[];
  teamFit: TeamFitScore[];
}

export async function runGapAnalysis(userLeagueId: string, season: string): Promise<GapAnalysisResult> {
  const row = await getUserLeagueWithLeague(userLeagueId);
  if (!row) throw new Error(`user_league ${userLeagueId} not found`);
  const league = row.fantrax_league;

  const rosterInfo = league.settingsJson as unknown as FantraxRosterInfo | null;
  if (!rosterInfo?.positionConstraints) {
    throw new Error(`League ${league.name} has no roster position constraints on file - re-import the league`);
  }

  const slotConstraints: RosterSlotConstraints = {};
  for (const [bucket, constraint] of Object.entries(rosterInfo.positionConstraints)) {
    if (constraint.maxActive) slotConstraints[bucket] = constraint.maxActive;
  }

  const [rosterRows, draftTargetRows] = await Promise.all([
    getTeamRosterRows(userLeagueId),
    getDraftTargetRows(userLeagueId),
  ]);

  const consideredFromRoster: ConsideredPlayer[] = rosterRows
    .filter((r) => r.team_roster.isConsidered && r.fantrax_player.nhlTeamAbbrev)
    .map((r) => ({
      fantraxPlayerId: r.team_roster.fantraxPlayerId,
      rosterPosition: r.team_roster.rosterPosition,
      nhlTeamAbbrev: r.fantrax_player.nhlTeamAbbrev as string,
    }));

  const consideredFromDraftTargets: ConsideredPlayer[] = draftTargetRows
    .filter((r) => r.fantrax_player.nhlTeamAbbrev)
    .map((r) => ({
      fantraxPlayerId: r.draft_target.fantraxPlayerId,
      rosterPosition: r.draft_target.rosterPosition,
      nhlTeamAbbrev: r.fantrax_player.nhlTeamAbbrev as string,
    }));

  const consideredPlayers = [...consideredFromRoster, ...consideredFromDraftTargets];

  const scheduleRows = await getSeasonSchedule(season);
  const games: ScheduleGame[] = scheduleRows.map((g) => ({
    gameDate: g.gameDate,
    homeTeamAbbrev: g.homeTeamAbbrev,
    awayTeamAbbrev: g.awayTeamAbbrev,
  }));

  const gaps = computeRosterGaps(consideredPlayers, slotConstraints, games);
  const surplus = computeRosterSurplus(consideredPlayers, slotConstraints, games);
  const coverageHistogram = computeCoverageHistogram(consideredPlayers, slotConstraints, games);
  // No team-level exclusion here: a second player from a team you already draw from can
  // still be worth drafting (e.g. you have open slot capacity on the days that team
  // plays). Excluding specific already-considered PLAYERS is handled by the caller,
  // which knows about spreadsheet-row identity in a way this module doesn't.
  const teamFit = scoreTeamsForGaps(gaps, games);

  const rosterConsidered: DisplayPlayer[] = rosterRows
    .filter((r) => r.team_roster.isConsidered)
    .map((r) => ({
      fantraxPlayerId: r.team_roster.fantraxPlayerId,
      name: r.fantrax_player.name,
      rosterPosition: r.team_roster.rosterPosition,
      nhlTeamAbbrev: r.fantrax_player.nhlTeamAbbrev,
    }));

  const draftTargets: DisplayPlayer[] = draftTargetRows.map((r) => ({
    fantraxPlayerId: r.draft_target.fantraxPlayerId,
    name: r.fantrax_player.name,
    rosterPosition: r.draft_target.rosterPosition,
    nhlTeamAbbrev: r.fantrax_player.nhlTeamAbbrev,
  }));

  return {
    slotConstraints,
    consideredPlayerCount: consideredPlayers.length,
    rosterConsidered,
    draftTargets,
    gaps,
    surplus,
    coverageHistogram,
    teamFit,
  };
}
