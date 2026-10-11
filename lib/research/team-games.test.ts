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

/** Replaces global fetch with canned NHL responses and silences (but records) console.error. */
function stubNhl(t: TestContext, stub: Stub = {}) {
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

test("an OT game with a failed shift chart is kept but has unknown regulation TOI", async (t) => {
  stubNhl(t, { shiftChartFails: [3], lastPeriod: { 3: "OT" } });
  const research = await loadTeamResearch("MTL", 5);
  const third = research.games[2];
  assert.equal(third.overtime, "OT");
  assert.equal(third.lines, null);
  assert.equal(third.regulationToi, null);
});

test("a failed shift chart is logged server-side with its game id", async (t) => {
  const errorLog = stubNhl(t, { shiftChartFails: [3] });
  const research = await loadTeamResearch("MTL", 5);
  assert.equal(research.games.length, 3);
  assert.ok(mentions(errorLog.mock.calls, "game 3"));
});
