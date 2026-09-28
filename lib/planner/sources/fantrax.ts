import { getAdp, getLeagueInfo, getPlayerIds, getTeamRosters } from "@/lib/fantrax/client";
import { getCachedPeriodProjections, getCachedRosterDayProjections } from "@/lib/fantrax/cached-projections";
import { fantraxDate, toPlanningWeek } from "@/lib/fantrax/periods";
import { getGamesByTeam } from "../schedule";
import type { AvailablePlayer, DailySlot, PlannerData, PlannerRosterPlayer } from "../types";
import { daysToLoad, pickNextWeek, pickupHorizon, todayEastern } from "../weeks";

function toDailySlot(position: string, status: string): DailySlot {
  if (status === "ACTIVE") return { slot: position, status: "active" };
  if (status === "RESERVE") return { slot: "BN", status: "bench" };
  if (status === "INJURED_RESERVE") return { slot: "IR", status: "out" };
  return { slot: status, status: "out" };
}

function splitPositions(value: string | undefined): string[] {
  return (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
}

export async function loadFantraxPlanner(
  fantraxLeagueId: string,
  myTeamId: string,
  requestedWeek: number | null
): Promise<PlannerData> {
  const notices: string[] = [];
  // Projections are best-effort: without them the loader falls back to the user's spreadsheet.
  const periodProjectionsPromise = getCachedPeriodProjections(fantraxLeagueId).catch((e: unknown) =>
    e instanceof Error ? e : new Error(String(e))
  );
  const [info, pool, adp] = await Promise.all([getLeagueInfo(fantraxLeagueId), getPlayerIds("NHL"), getAdp("NHL")]);

  const periods = info.scoringPeriods ?? [];
  if (periods.length === 0) {
    throw new Error("Fantrax didn't return any scoring periods for this league, so there's no week to plan.");
  }
  const weeks = periods.map(toPlanningWeek);
  const today = todayEastern();
  const week = weeks.find((w) => w.number === requestedWeek) ?? pickNextWeek(weeks, today)!;
  const horizon = pickupHorizon(weeks, week, today);
  const rosterDays = daysToLoad(week, horizon);

  // Map each lineup day to the roster (lineup-lock) period covering it: the latest one starting on or before it.
  const rosterPeriods = [...(info.rosterPeriods ?? [])].sort((a, b) => a.number - b.number);
  const periodForDay = new Map<string, number>();
  for (const day of rosterDays) {
    const rp = rosterPeriods.filter((p) => fantraxDate(p.startDate) <= day).at(-1);
    if (rp) periodForDay.set(day, rp.number);
  }
  const distinctPeriods = [...new Set(periodForDay.values())];
  if (distinctPeriods.length === 0) {
    throw new Error("Fantrax didn't return roster periods for this week, so daily lineups can't be read.");
  }
  if (new Set(week.days.map((d) => periodForDay.get(d))).size < week.days.length) {
    notices.push(
      "This league doesn't lock lineups daily - some days share a lineup period, so bench players can't be swapped in on every open day."
    );
  }

  const [current, ...periodRosters] = await Promise.all([
    getTeamRosters(fantraxLeagueId),
    ...distinctPeriods.map((n) => getTeamRosters(fantraxLeagueId, n)),
  ]);
  const rostersByPeriod = new Map(distinctPeriods.map((n, i) => [n, periodRosters[i]] as const));
  // Fantrax only applies adds/drops to the current period - later periods keep an old copy of
  // the roster until they start. When a future period's players don't match the current roster,
  // it's that stale copy, so plan those days from the current roster instead.
  const currentItems = current.rosters[myTeamId]?.rosterItems ?? [];
  const playerSet = (items: Array<{ id: string }>) => items.map((i) => i.id).sort().join();
  for (const [n, rosters] of rostersByPeriod) {
    const mine = rosters.rosters[myTeamId];
    if (n > current.period && mine && playerSet(mine.rosterItems) !== playerSet(currentItems)) {
      mine.rosterItems = currentItems;
    }
  }
  // Per-day projections are cached, keyed by that day's roster so a roster change refetches.
  const [dayProjectionsByPeriod, periodProjections] = await Promise.all([
    Promise.all(
      distinctPeriods.map(async (n) => {
        const rosterIds = (rostersByPeriod.get(n)?.rosters[myTeamId]?.rosterItems ?? []).map((i) => i.id).sort();
        const projections = await getCachedRosterDayProjections(fantraxLeagueId, myTeamId, n, rosterIds).catch(() => null);
        return [n, projections] as const;
      })
    ).then((entries) => new Map(entries)),
    periodProjectionsPromise,
  ]);

  // Per-game rate for players without a per-day projection (free agents): the current
  // period's projected FPts over their team's games that period. Fantrax's own FP/G column
  // divides by expected starts instead, which blows up for backup goalies.
  const projectionWeek = periodProjections instanceof Error ? undefined : weeks.find((w) => w.number === periodProjections.period);
  const projectionWeekGames = projectionWeek ? await getGamesByTeam(projectionWeek.days) : new Map();
  const perGameRate = (id: string, team: string | null | undefined): number | null => {
    if (periodProjections instanceof Error || !team) return null;
    const fpts = periodProjections.fptsById[id];
    const games = projectionWeekGames.get(team)?.size ?? 0;
    return fpts !== undefined && games > 0 ? fpts / games : null;
  };

  const playerInfo = info.playerInfo ?? {};
  const rosterById = new Map<string, PlannerRosterPlayer>();
  for (const day of rosterDays) {
    const period = periodForDay.get(day);
    const items = period !== undefined ? rostersByPeriod.get(period)?.rosters[myTeamId]?.rosterItems ?? [] : [];
    for (const item of items) {
      let player = rosterById.get(item.id);
      if (!player) {
        const p = pool[item.id];
        player = {
          playerId: item.id,
          name: p?.name ?? `Unknown player (${item.id})`,
          nhlTeamAbbrev: p?.team ?? null,
          displayPosition: p?.position ?? item.position,
          eligiblePositions: splitPositions(playerInfo[item.id]?.eligiblePos ?? item.position),
          projectedPointsPerGame: perGameRate(item.id, p?.team),
          dailyProjections: {},
          dailySlots: {},
        };
        rosterById.set(item.id, player);
      }
      player.dailySlots[day] = toDailySlot(item.position, item.status);
      const dayProjection = period !== undefined ? dayProjectionsByPeriod.get(period)?.[item.id] : undefined;
      if (dayProjection !== undefined) player.dailyProjections[day] = dayProjection;
    }
  }

  const lineupSlots: Record<string, number> = {};
  for (const [slot, c] of Object.entries(info.rosterInfo.positionConstraints)) {
    if (c.maxActive) lineupSlots[slot] = c.maxActive;
  }

  const adpById = new Map(adp.map((a) => [a.id, a.ADP]));
  const available: AvailablePlayer[] = [];
  for (const [id, pi] of Object.entries(playerInfo)) {
    if (pi.status !== "FA" && pi.status !== "W") continue;
    const p = pool[id];
    if (!p) continue;
    available.push({
      playerId: id,
      name: p.name,
      nhlTeamAbbrev: p.team || null,
      displayPosition: p.position,
      eligiblePositions: splitPositions(pi.eligiblePos),
      projectedPointsPerGame: perGameRate(id, p.team),
      rank: adpById.get(id) ?? null,
    });
  }

  if (periodProjections instanceof Error) {
    notices.push(`Couldn't load Fantrax's projections (${periodProjections.message}).`);
  } else {
    notices.push(
      `Projections are Fantrax's own, in this league's scoring. Your roster uses Fantrax's projection for each day's ` +
        `game; available players use their week ${periodProjections.period} per-game average (the only week Fantrax ` +
        "projects for players not on a roster) on every day."
    );
    const missingDays = rosterDays.filter((d) => {
      const period = periodForDay.get(d);
      return period === undefined || !dayProjectionsByPeriod.get(period);
    });
    if (missingDays.length > 0) {
      notices.push(
        `Fantrax didn't return per-day projections for ${missingDays.length} day(s); your players use their per-game average there.`
      );
    }
  }

  return {
    platform: "fantrax",
    weeks: weeks.map(({ number, startDate, endDate }) => ({ number, startDate, endDate })),
    week,
    pickupHorizon: horizon,
    lineupSlots,
    roster: [...rosterById.values()],
    available,
    rankLabel: "ADP",
    projectionSource: periodProjections instanceof Error ? "none" : "platform",
    notices,
  };
}
