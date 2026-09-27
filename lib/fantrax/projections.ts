import { getAdp, getPlayerStats, getTeamRosterInfo, type FxpaRow, type FxpaSeasonOrProjection } from "./client";

const PER_GAME = "PROJECTED_WEEKLY";

/** scorerId -> numeric value of one column (by header short name) for every player row. */
export function columnByPlayer(header: Array<{ shortName: string }>, rows: FxpaRow[], column: string): Map<string, number> {
  const i = header.findIndex((c) => c.shortName === column);
  const out = new Map<string, number>();
  if (i === -1) return out;
  for (const row of rows) {
    const value = Number(row.cells[i]?.content);
    if (row.scorer && Number.isFinite(value)) out.set(row.scorer.scorerId, value);
  }
  return out;
}

const isPerGame = (p: FxpaSeasonOrProjection | undefined) => p?.timeframeTypeCode === PER_GAME;

/**
 * Every player's projected fantasy points for the current scoring period (skaters and
 * goalies), from Fantrax's "Projected - Per Game" view: each is the sum of that player's
 * per-game projections for the period. Only players with a projection above 0. Plain
 * objects rather than Maps so results can go in Next's JSON data cache.
 */
export async function getPeriodProjections(leagueId: string): Promise<{ period: number; fptsById: Record<string, number> }> {
  const fetchGroup = async (positionOrGroup: string) => {
    const params = { statusOrTeamFilter: "ALL", positionOrGroup, sortType: "SCORE", pageNumber: "1", maxResultsPerPage: "1000" };
    let data = await getPlayerStats(leagueId, params);
    if (!isPerGame(data.displayedSeasonOrProjection)) {
      const perGame = data.seasonOrProjections.find(isPerGame);
      if (!perGame) throw new Error("Fantrax no longer offers a per-game projection view");
      data = await getPlayerStats(leagueId, { ...params, seasonOrProjection: perGame.code, timeframeTypeCode: PER_GAME });
    }
    return data;
  };
  const [skaters, goalies] = await Promise.all([fetchGroup("HOCKEY_SKATING"), fetchGroup("POS_201")]);

  const fptsById: Record<string, number> = {};
  for (const data of [skaters, goalies]) {
    for (const [id, fpts] of columnByPlayer(data.tableHeader.cells, data.statsTable, "FPts")) {
      if (fpts > 0) fptsById[id] = fpts;
    }
  }
  return { period: skaters.displayedPeriod, fptsById };
}

/**
 * A team's per-game projections for one roster period (a day, in daily leagues): scorerId ->
 * projected fantasy points for that day's game, 0 when the player has no game. Throws (so
 * nothing gets cached) if Fantrax didn't return the per-game projection view.
 */
export async function getRosterDayProjections(leagueId: string, teamId: string, period: number): Promise<Record<string, number>> {
  const data = await getTeamRosterInfo(leagueId, teamId, period);
  if (!isPerGame(data.displayedSelections.displayedSeasonOrProjection)) {
    throw new Error(`Fantrax returned ${data.displayedSelections.displayedSeasonOrProjection?.name ?? "no"} projections for period ${period}`);
  }
  const out: Record<string, number> = {};
  for (const table of data.tables) {
    for (const [id, fpts] of columnByPlayer(table.header.cells, table.rows, "FPts")) out[id] = fpts;
  }
  return out;
}

const SEASON = "PROJECTED_SEASON";

export interface FantraxSeasonProjection {
  /** Position in Fantrax's ADP order - what the draft room's Rk shows. Null without an ADP. */
  rank: number | null;
  fpts: number | null;
  fpg: number | null;
  adp: number | null;
  /** From the projection table; null for players only in the ADP feed. */
  age: number | null;
}

/**
 * The draft room's Rk / FPts / FP/G / ADP for every player that has a projection or an ADP.
 * FPts and FP/G come from Fantrax's "Projected - Season" view in the league's own scoring;
 * only ~1,000 of the ~8,700 players are projected above 0 and rows are sorted by FPts, so the
 * first page of 1,500 holds them all. Rk and ADP come from the cross-league ADP feed: the
 * Players page's own Rk is just the row number for its sort (FPts), which doesn't match the
 * draft room - e.g. Jason Robertson is 6th by FPts but 9th in the draft room and by ADP
 * (checked 2026-09-27).
 */
export async function getSeasonProjections(leagueId: string): Promise<Record<string, FantraxSeasonProjection>> {
  const params = { statusOrTeamFilter: "ALL", positionOrGroup: "ALL", sortType: "SCORE", pageNumber: "1" };
  // The default view is per-game; a one-row request is the cheap way to learn this season's code.
  const [probe, adpList] = await Promise.all([getPlayerStats(leagueId, { ...params, maxResultsPerPage: "1" }), getAdp("NHL")]);
  const season = probe.seasonOrProjections.find((p) => p.timeframeTypeCode === SEASON);
  if (!season) throw new Error("Fantrax no longer offers a season projection view");
  const data = await getPlayerStats(leagueId, {
    ...params,
    maxResultsPerPage: "1500",
    seasonOrProjection: season.code,
    timeframeTypeCode: SEASON,
  });
  if (data.displayedSeasonOrProjection.timeframeTypeCode !== SEASON) {
    throw new Error(`Fantrax returned ${data.displayedSeasonOrProjection.name} instead of season projections`);
  }

  const fpts = columnByPlayer(data.tableHeader.cells, data.statsTable, "FPts");
  const fpg = columnByPlayer(data.tableHeader.cells, data.statsTable, "FP/G");
  const age = columnByPlayer(data.tableHeader.cells, data.statsTable, "Age");
  const out: Record<string, FantraxSeasonProjection> = {};
  for (const [id, points] of fpts) {
    if (points > 0) out[id] = { rank: null, fpts: points, fpg: fpg.get(id) ?? null, adp: null, age: age.get(id) ?? null };
  }
  [...adpList].sort((a, b) => a.ADP - b.ADP).forEach((entry, i) => {
    out[entry.id] = { ...(out[entry.id] ?? { fpts: null, fpg: null, age: null }), rank: i + 1, adp: entry.ADP };
  });
  return out;
}
