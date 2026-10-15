import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mapPaced, loadTeamResearch, clearGameCache, MAX_CACHED_GAMES } from "./team-games";

interface Stub {
  /** Schedule entries; defaults to three finished games plus one future game. */
  games?: Array<{ id: number; gameDate: string; gameState: string; startTimeUTC?: string }>;
  /** Games whose boxscore answers 503. */
  boxscoreFails?: number[];
  /** Games whose shift chart answers 503. */
  shiftChartFails?: number[];
  /** Games whose play-by-play answers 503. */
  pbpFails?: number[];
  /** Games whose play-by-play is published with no plays yet. */
  pbpEmpty?: number[];
  /** Games that ended past regulation, keyed by game id. */
  lastPeriod?: Record<number, "OT" | "SO">;
  /** Filled with every request's url and init, in request order. */
  calls?: Array<{ url: string; init: RequestInit | undefined }>;
}

const DEFAULT_GAMES = [
  { id: 1, gameDate: "2026-10-01", gameState: "OFF" },
  { id: 2, gameDate: "2026-10-03", gameState: "OFF" },
  { id: 3, gameDate: "2026-10-05", gameState: "FINAL" },
  { id: 4, gameDate: "2026-10-07", gameState: "FUT" },
];

const skater = (playerId: number, name: string) => ({ playerId, name: { default: name }, position: "C", toi: "15:00" });

function boxscore(id: number, lastPeriodType: "REG" | "OT" | "SO") {
  return {
    id,
    gameDate: "2026-10-01",
    awayTeam: { abbrev: "BOS", score: 2 },
    homeTeam: { abbrev: "MTL", score: 3 },
    playerByGameStats: {
      homeTeam: {
        forwards: [skater(8, "Alpha Forward")],
        defense: [],
        goalies: [{ ...skater(30, "Golf Goalie"), position: "G" }],
      },
      awayTeam: { forwards: [], defense: [], goalies: [] },
    },
    gameOutcome: { lastPeriodType },
  };
}

const SHIFT_ROWS = [{ playerId: 8, teamAbbrev: "MTL", period: 1, startTime: "00:00", endTime: "00:45", typeCode: 517 }];

/** One MTL shot on goal at P1 00:30, while player 8 is on the ice. */
function playByPlay(id: number, plays: boolean) {
  return {
    id,
    homeTeam: { id: 8, abbrev: "MTL" },
    awayTeam: { id: 6, abbrev: "BOS" },
    plays: plays
      ? [
          {
            typeDescKey: "shot-on-goal",
            timeInPeriod: "00:30",
            situationCode: "1551",
            periodDescriptor: { number: 1, periodType: "REG" },
            details: { eventOwnerTeamId: 8 },
          },
        ]
      : [],
  };
}

/** Play-by-play requests per game id, filled by stubNhl. */
const pbpRequests = new Map<number, number>();

/** Replaces global fetch with canned NHL responses and silences (but records) console.error. */
function stubNhl(t: TestContext, stub: Stub = {}) {
  clearGameCache();
  pbpRequests.clear();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    stub.calls?.push({ url, init });
    if (url.includes("club-schedule-season/MTL/now")) {
      return json({ games: (stub.games ?? DEFAULT_GAMES).map((g) => ({ ...g, season: 20262027, gameType: 2 })) });
    }
    const box = url.match(/gamecenter\/(\d+)\/boxscore/);
    if (box) {
      const id = Number(box[1]);
      return stub.boxscoreFails?.includes(id) ? json({}, 503) : json(boxscore(id, stub.lastPeriod?.[id] ?? "REG"));
    }
    const chart = url.match(/shiftcharts\?cayenneExp=gameId=(\d+)/);
    if (chart) {
      return stub.shiftChartFails?.includes(Number(chart[1])) ? json({}, 503) : json({ data: SHIFT_ROWS });
    }
    const pbp = url.match(/gamecenter\/(\d+)\/play-by-play/);
    if (pbp) {
      const id = Number(pbp[1]);
      pbpRequests.set(id, (pbpRequests.get(id) ?? 0) + 1);
      return stub.pbpFails?.includes(id) ? json({}, 503) : json(playByPlay(id, !stub.pbpEmpty?.includes(id)));
    }
    throw new Error(`unexpected request: ${url}`);
  });
  return t.mock.method(console, "error", () => {});
}

const mentions = (calls: Array<{ arguments: unknown[] }>, text: string) =>
  calls.some((c) => c.arguments.some((a) => String(a).includes(text)));

test("a failed boxscore leaves only that game out and names its date", async (t) => {
  stubNhl(t, { boxscoreFails: [2] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(research.games.map((g) => g.id), [1, 3]);
  assert.deepEqual(research.unavailableDates, ["2026-10-03"]);
  assert.equal(research.players.get(8)?.name, "Alpha Forward");
});

test("a left-out game is never kept as a game nobody played in", async (t) => {
  stubNhl(t, { boxscoreFails: [2] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(research.games.some((g) => g.id === 2), false);
  assert.equal(research.games.length, 2);
});

test("a failed game is logged server-side with its id", async (t) => {
  const errorLog = stubNhl(t, { boxscoreFails: [2] });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.ok(mentions(errorLog.mock.calls, "game 2"));
});

test("rejects when every game in the window fails", async (t) => {
  stubNhl(t, { boxscoreFails: [1, 2, 3] });
  await assert.rejects(loadTeamResearch("MTL", 5, { gapMs: 0 }), /MTL/);
});

test("a team with no finished games loads empty without throwing", async (t) => {
  stubNhl(t, { games: [{ id: 4, gameDate: "2026-10-07", gameState: "FUT" }] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(research.games, []);
  assert.deepEqual(research.unavailableDates, []);
});

test("a failed shift chart keeps the game with boxscore TOI and no line data", async (t) => {
  stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(research.unavailableDates, []);
  const [first, , third] = research.games;
  assert.notEqual(first.lines, null);
  assert.equal(third.lines, null);
  assert.equal(third.regulationToi, third.toi);
  assert.equal(third.toi.get(8), 900);
});

test("an OT game with a failed shift chart is left out and reported as unavailable", async (t) => {
  stubNhl(t, { shiftChartFails: [3], lastPeriod: { 3: "OT" } });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(research.games.length, 2);
  assert.deepEqual(research.unavailableDates, ["2026-10-05"]);
});

test("a failed shift chart is logged server-side with its game id", async (t) => {
  const errorLog = stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(research.games.length, 3);
  assert.ok(mentions(errorLog.mock.calls, "game 3"));
});

test("every loaded game carries events with its attributed shot", async (t) => {
  stubNhl(t);
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(research.games.length, 3);
  for (const game of research.games) {
    assert.notEqual(game.events, null);
    const { total } = game.events!;
    assert.equal(total.ev.sf + total.pp.sf + total.sh.sf, 1);
  }
});

test("a failed play-by-play keeps the game with unknown events and is logged with its game id", async (t) => {
  const errorLog = stubNhl(t, { pbpFails: [3] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(research.unavailableDates, []);
  const third = research.games[2];
  assert.equal(third.id, 3);
  assert.notEqual(third.lines, null);
  assert.notEqual(third.regulationToi, null);
  assert.equal(third.toi.get(8), 900);
  assert.equal(third.events, null);
  assert.notEqual(research.games[0].events, null);
  assert.ok(mentions(errorLog.mock.calls, "play-by-play for game 3"));
});

test("an unpublished play-by-play is requested twice and leaves the game's events unknown", async (t) => {
  stubNhl(t, { pbpEmpty: [3] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(research.unavailableDates, []);
  assert.equal(research.games[2].events, null);
  assert.equal(pbpRequests.get(3), 2);
  assert.equal(pbpRequests.get(1), 1);
});

test("a missing shift chart gives unknown events even when the play-by-play loaded", async (t) => {
  stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  const third = research.games[2];
  assert.equal(third.lines, null);
  assert.equal(third.events, null);
  assert.equal(pbpRequests.get(3), 1);
  assert.notEqual(research.games[0].events, null);
});

test("mapPaced never has more than the concurrency limit in flight", async () => {
  let inFlight = 0;
  let peak = 0;
  const results = await mapPaced(
    [1, 2, 3, 4, 5],
    async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return n;
    },
    { concurrency: 2, gapMs: 0 },
  );
  assert.equal(peak, 2);
  assert.equal(results.length, 5);
});

test("mapPaced returns results in input order and marks a rejected item without failing the rest", async () => {
  const results = await mapPaced(
    [30, 20, 10],
    async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      if (ms === 20) throw new Error("boom");
      return ms;
    },
    { concurrency: 3, gapMs: 0 },
  );
  assert.deepEqual(
    results.map((r) => r.status),
    ["fulfilled", "rejected", "fulfilled"],
  );
  assert.equal((results[0] as PromiseFulfilledResult<number>).value, 30);
  assert.equal((results[2] as PromiseFulfilledResult<number>).value, 10);
});

test("mapPaced starts items in input order, at least gapMs apart", async () => {
  const starts: Array<{ item: number; at: number }> = [];
  await mapPaced(
    [1, 2, 3, 4],
    async (item) => {
      starts.push({ item, at: Date.now() });
    },
    { concurrency: 3, gapMs: 20 },
  );
  assert.deepEqual(
    starts.map((s) => s.item),
    [1, 2, 3, 4],
  );
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i].at - starts[i - 1].at >= 15);
});

test("loadTeamResearch starts with the newest game and still returns games oldest first", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  stubNhl(t, { calls });
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  const boxscoreIds = calls.flatMap((c) => c.url.match(/gamecenter\/(\d+)\/boxscore/)?.[1] ?? []).map(Number);
  assert.equal(boxscoreIds[0], 3);
  assert.deepEqual(boxscoreIds, [3, 2, 1]);
  assert.deepEqual(
    research.games.map((g) => g.id),
    [1, 2, 3],
  );
});

test("a game that started 30 days ago uses the 30 day cache on all three game requests", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  stubNhl(t, { calls, games: [{ id: 1, gameDate: "2026-09-14", gameState: "OFF", startTimeUTC: old }] });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  const gameCalls = calls.filter((c) => !c.url.includes("club-schedule-season"));
  assert.equal(gameCalls.length, 3);
  for (const c of gameCalls) assert.equal((c.init as { next?: { revalidate?: number } }).next?.revalidate, 2592000);
});

test("a game with no startTimeUTC uses the hour cache", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  stubNhl(t, { calls, games: [{ id: 1, gameDate: "2026-10-01", gameState: "OFF" }] });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  const gameCalls = calls.filter((c) => !c.url.includes("club-schedule-season"));
  assert.equal(gameCalls.length, 3);
  for (const c of gameCalls) assert.equal((c.init as { next?: { revalidate?: number } }).next?.revalidate, 3600);
});

const boxscoreIds = (calls: NonNullable<Stub["calls"]>) =>
  calls.flatMap((c) => c.url.match(/gamecenter\/(\d+)\/boxscore/)?.[1] ?? []).map(Number);

test("a second load of the same team makes no game requests and returns the same games", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  stubNhl(t, { calls });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  calls.length = 0;
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes("club-schedule-season"));
  assert.deepEqual(research.games.map((g) => g.id), [1, 2, 3]);
  assert.equal(research.players.get(8)?.name, "Alpha Forward");
});

test("cached games skip the pacing gap", async (t) => {
  stubNhl(t);
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  const started = Date.now();
  await loadTeamResearch("MTL", 5, { gapMs: 1000 });
  assert.ok(Date.now() - started < 300);
});

test("games with an unpublished play-by-play or a failed shift chart are requested again", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  stubNhl(t, { calls, pbpEmpty: [3], shiftChartFails: [2] });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  calls.length = 0;
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(boxscoreIds(calls), [3, 2]);
  assert.deepEqual(research.games.map((g) => g.id), [1, 2, 3]);
});

test("a game whose boxscore failed is not cached and stays unavailable", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  stubNhl(t, { calls, boxscoreFails: [2] });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  calls.length = 0;
  const research = await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(research.unavailableDates, ["2026-10-03"]);
  assert.deepEqual(boxscoreIds(calls), [2]);
});

const gamecenterCalls = (calls: NonNullable<Stub["calls"]>) => calls.filter((c) => c.url.includes("gamecenter"));

test("a cached game with no start time expires after an hour", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  stubNhl(t, { calls });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-15T12:00:00Z") });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  t.mock.timers.tick(3_599_000);
  calls.length = 0;
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(gamecenterCalls(calls).length, 0);
  t.mock.timers.tick(2_000);
  calls.length = 0;
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(boxscoreIds(calls), [3, 2, 1]);
});

test("a cached game that started 30 days ago keeps for 30 days", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  const now = Date.parse("2026-10-15T12:00:00Z");
  const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  stubNhl(t, { calls, games: [{ id: 1, gameDate: "2026-09-15", gameState: "OFF", startTimeUTC: old }] });
  t.mock.timers.enable({ apis: ["Date"], now });
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  t.mock.timers.tick(2 * 60 * 60 * 1000);
  calls.length = 0;
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.equal(gamecenterCalls(calls).length, 0);
  t.mock.timers.tick(30 * 24 * 60 * 60 * 1000);
  calls.length = 0;
  await loadTeamResearch("MTL", 5, { gapMs: 0 });
  assert.deepEqual(boxscoreIds(calls), [1]);
});

test("the game cache drops the oldest stored game past MAX_CACHED_GAMES", async (t) => {
  const calls: NonNullable<Stub["calls"]> = [];
  const total = MAX_CACHED_GAMES + 1;
  const games = Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    gameDate: `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    gameState: "OFF",
  }));
  stubNhl(t, { calls, games });
  await loadTeamResearch("MTL", total, { gapMs: 0 });
  calls.length = 0;
  await loadTeamResearch("MTL", total, { gapMs: 0 });
  assert.equal(boxscoreIds(calls).length, 1);
});
