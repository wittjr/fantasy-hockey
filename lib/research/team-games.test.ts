import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { loadTeamResearch } from "./team-games";

interface Stub {
  /** Schedule entries; defaults to three finished games plus one future game. */
  games?: Array<{ id: number; gameDate: string; gameState: string }>;
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
  pbpRequests.clear();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
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
  const research = await loadTeamResearch("MTL", 5);
  assert.deepEqual(research.games.map((g) => g.id), [1, 3]);
  assert.deepEqual(research.unavailableDates, ["2026-10-03"]);
  assert.equal(research.players.get(8)?.name, "Alpha Forward");
});

test("a left-out game is never kept as a game nobody played in", async (t) => {
  stubNhl(t, { boxscoreFails: [2] });
  const research = await loadTeamResearch("MTL", 5);
  assert.equal(research.games.some((g) => g.id === 2), false);
  assert.equal(research.games.length, 2);
});

test("a failed game is logged server-side with its id", async (t) => {
  const errorLog = stubNhl(t, { boxscoreFails: [2] });
  await loadTeamResearch("MTL", 5);
  assert.ok(mentions(errorLog.mock.calls, "game 2"));
});

test("rejects when every game in the window fails", async (t) => {
  stubNhl(t, { boxscoreFails: [1, 2, 3] });
  await assert.rejects(loadTeamResearch("MTL", 5), /MTL/);
});

test("a team with no finished games loads empty without throwing", async (t) => {
  stubNhl(t, { games: [{ id: 4, gameDate: "2026-10-07", gameState: "FUT" }] });
  const research = await loadTeamResearch("MTL", 5);
  assert.deepEqual(research.games, []);
  assert.deepEqual(research.unavailableDates, []);
});

test("a failed shift chart keeps the game with boxscore TOI and no line data", async (t) => {
  stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5);
  assert.deepEqual(research.unavailableDates, []);
  const [first, , third] = research.games;
  assert.notEqual(first.lines, null);
  assert.equal(third.lines, null);
  assert.equal(third.regulationToi, third.toi);
  assert.equal(third.toi.get(8), 900);
});

test("an OT game with a failed shift chart is left out and reported as unavailable", async (t) => {
  stubNhl(t, { shiftChartFails: [3], lastPeriod: { 3: "OT" } });
  const research = await loadTeamResearch("MTL", 5);
  assert.equal(research.games.length, 2);
  assert.deepEqual(research.unavailableDates, ["2026-10-05"]);
});

test("a failed shift chart is logged server-side with its game id", async (t) => {
  const errorLog = stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5);
  assert.equal(research.games.length, 3);
  assert.ok(mentions(errorLog.mock.calls, "game 3"));
});

test("every loaded game carries events with its attributed shot", async (t) => {
  stubNhl(t);
  const research = await loadTeamResearch("MTL", 5);
  assert.equal(research.games.length, 3);
  for (const game of research.games) {
    assert.notEqual(game.events, null);
    const { total } = game.events!;
    assert.equal(total.ev.sf + total.pp.sf + total.sh.sf, 1);
  }
});

test("a failed play-by-play keeps the game with unknown events and is logged with its game id", async (t) => {
  const errorLog = stubNhl(t, { pbpFails: [3] });
  const research = await loadTeamResearch("MTL", 5);
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
  const research = await loadTeamResearch("MTL", 5);
  assert.deepEqual(research.unavailableDates, []);
  assert.equal(research.games[2].events, null);
  assert.equal(pbpRequests.get(3), 2);
  assert.equal(pbpRequests.get(1), 1);
});

test("a missing shift chart gives unknown events even when the play-by-play loaded", async (t) => {
  stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5);
  const third = research.games[2];
  assert.equal(third.lines, null);
  assert.equal(third.events, null);
  assert.equal(pbpRequests.get(3), 1);
  assert.notEqual(research.games[0].events, null);
});
