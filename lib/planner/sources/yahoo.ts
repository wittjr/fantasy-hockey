import { yahooGet } from "@/lib/yahoo/client";
import { normalizePlatformTeamAbbrev } from "@/lib/nhl/team-abbrev";
import type { AvailablePlayer, DailySlot, PlannerData, PlannerRosterPlayer, PlanningWeek } from "../types";
import { datesBetween, daysToLoad, pickNextWeek, pickupHorizon, todayEastern } from "../weeks";

// Response shapes after normalizeYahoo (see lib/yahoo/normalize.ts). A one-element list
// can come back merged into a single object, so list-ish fields accept both.
type OneOrMany<T> = T | T[];

interface RawPlayer {
  player_key: string;
  name: { full: string };
  editorial_team_abbr?: string;
  display_position?: string;
  eligible_positions?: OneOrMany<{ position: string }>;
  selected_position?: { position: string };
}

interface RawLeagueMeta {
  current_week?: string | number;
  start_week?: string | number;
  end_week?: string | number;
}

const OUT_SLOTS = new Set(["IR", "IR+", "IL", "IL+", "NA"]);
const PAGE_SIZE = 25;

function asArray<T>(value: OneOrMany<T> | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Yahoo nests roster players under a "0" key alongside roster metadata, which normalizeYahoo leaves as-is. */
function rosterPlayers(roster: unknown): RawPlayer[] {
  const r = roster as { players?: Array<{ player: RawPlayer }>; "0"?: { players?: Array<{ player: RawPlayer }> } } | undefined;
  return (r?.players ?? r?.["0"]?.players ?? []).map((p) => p.player);
}

function toDailySlot(position: string | undefined): DailySlot {
  const slot = position ?? "BN";
  if (slot === "BN") return { slot, status: "bench" };
  if (OUT_SLOTS.has(slot)) return { slot, status: "out" };
  return { slot, status: "active" };
}

function eligible(p: RawPlayer): string[] {
  return asArray(p.eligible_positions)
    .map((e) => e.position)
    .filter((pos) => pos !== "BN" && !OUT_SLOTS.has(pos));
}

export async function loadYahooPlanner(
  userId: string,
  leagueKey: string,
  teamKey: string,
  lineupSlots: Record<string, number>,
  requestedWeek: number | null
): Promise<PlannerData> {
  const notices: string[] = [];
  const gameKey = leagueKey.split(".")[0];

  const [{ league }, { game }] = await Promise.all([
    yahooGet<{ league: RawLeagueMeta }>(userId, `/league/${leagueKey}`),
    yahooGet<{ game: { game_weeks?: OneOrMany<{ game_week: { week: string | number; start: string; end: string } }> } }>(
      userId,
      `/game/${gameKey}/game_weeks`
    ),
  ]);

  const startWeek = Number(league.start_week ?? 1);
  const endWeek = Number(league.end_week ?? Infinity);
  const weeks: PlanningWeek[] = asArray(game.game_weeks)
    .map(({ game_week: w }) => ({ number: Number(w.week), startDate: w.start, endDate: w.end, days: datesBetween(w.start, w.end) }))
    .filter((w) => w.number >= startWeek && w.number <= endWeek);
  if (weeks.length === 0) {
    throw new Error("Yahoo didn't return any matchup weeks for this league, so there's no week to plan.");
  }
  const today = todayEastern();
  const week = weeks.find((w) => w.number === requestedWeek) ?? pickNextWeek(weeks, today)!;
  const horizon = pickupHorizon(weeks, week, today);

  const unknownTeams = new Set<string>();
  const team = (abbr: string | undefined) => {
    const normalized = normalizePlatformTeamAbbrev(abbr);
    if (!normalized && abbr) unknownTeams.add(abbr);
    return normalized;
  };

  // Hockey lineups on Yahoo are daily, so read the roster as of each day.
  const dailyRosters = await Promise.all(
    daysToLoad(week, horizon).map(async (day) => {
      const { team: t } = await yahooGet<{ team: { roster?: unknown } }>(userId, `/team/${teamKey}/roster;date=${day}`);
      return [day, rosterPlayers(t.roster)] as const;
    })
  );
  const rosterByKey = new Map<string, PlannerRosterPlayer>();
  for (const [day, players] of dailyRosters) {
    for (const p of players) {
      let player = rosterByKey.get(p.player_key);
      if (!player) {
        player = {
          playerId: p.player_key,
          name: p.name.full,
          nhlTeamAbbrev: team(p.editorial_team_abbr),
          displayPosition: p.display_position ?? "",
          eligiblePositions: eligible(p),
          projectedPointsPerGame: null,
          dailyProjections: {},
          dailySlots: {},
        };
        rosterByKey.set(p.player_key, player);
      }
      player.dailySlots[day] = toDailySlot(p.selected_position?.position);
    }
  }

  // Top available players at each starting position, in Yahoo's own ranking order.
  const positions = [...new Set(Object.keys(lineupSlots).filter((s) => s.toUpperCase() !== "UTIL"))];
  const pages = await Promise.all(
    positions.map((pos) =>
      yahooGet<{ league: { players?: Array<{ player: RawPlayer }> } }>(
        userId,
        `/league/${leagueKey}/players;status=A;position=${encodeURIComponent(pos)};sort=AR;count=${PAGE_SIZE}`
      )
    )
  );
  const availableByKey = new Map<string, AvailablePlayer>();
  for (const page of pages) {
    (page.league.players ?? []).forEach(({ player: p }, i) => {
      if (availableByKey.has(p.player_key)) return;
      availableByKey.set(p.player_key, {
        playerId: p.player_key,
        name: p.name.full,
        nhlTeamAbbrev: team(p.editorial_team_abbr),
        displayPosition: p.display_position ?? "",
        eligiblePositions: eligible(p),
        projectedPointsPerGame: null,
        rank: i + 1,
      });
    });
  }

  if (unknownTeams.size > 0) {
    notices.push(
      `Couldn't match Yahoo team abbreviation(s) ${[...unknownTeams].join(", ")} to the NHL schedule - those players show no games.`
    );
  }
  notices.push(
    `Available players are Yahoo's top ${PAGE_SIZE} by rank at each position, not the full free-agent pool.`,
    "Yahoo's Fantasy API doesn't expose per-player projected points, so projections can't come from the platform."
  );

  return {
    platform: "yahoo",
    weeks: weeks.map(({ number, startDate, endDate }) => ({ number, startDate, endDate })),
    week,
    pickupHorizon: horizon,
    lineupSlots,
    roster: [...rosterByKey.values()],
    available: [...availableByKey.values()],
    rankLabel: "Yahoo rank",
    projectionSource: "none",
    notices,
  };
}
