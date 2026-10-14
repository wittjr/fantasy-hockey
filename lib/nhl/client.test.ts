import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  OLD_GAME_REVALIDATE_S,
  RECENT_GAME_REVALIDATE_S,
  RECENT_GAME_WINDOW_MS,
  finishedGameCache,
  getBoxscore,
  getPlayByPlay,
  getShiftCharts,
  retryAfterMs,
} from "./client";

const shiftRow = (playerId: number, typeCode = 517) => ({
  playerId,
  teamAbbrev: "MTL",
  period: 1,
  startTime: "00:00",
  endTime: "00:40",
  typeCode,
});

/** Stubs global fetch with a queue of responses and records each call's url and init. */
function stubFetch(t: TestContext, queue: Array<{ body: unknown; status?: number; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    assert.ok(next, "unexpected extra fetch call");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: next.headers });
  });
  return calls;
}

test("getShiftCharts serves a published chart from the hour cache with one request", async (t) => {
  const calls = stubFetch(t, [{ body: { data: [shiftRow(1), shiftRow(2)] } }]);
  const rows = await getShiftCharts(2026020075);
  assert.deepEqual(
    rows.map((r) => r.playerId),
    [1, 2],
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.next?.revalidate, 3600);
});

test("getShiftCharts re-requests an empty chart uncached and returns the published rows", async (t) => {
  const calls = stubFetch(t, [{ body: { data: [] } }, { body: { data: [shiftRow(7)] } }]);
  const rows = await getShiftCharts(2026020075);
  assert.deepEqual(
    rows.map((r) => r.playerId),
    [7],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.cache, "no-store");
  assert.equal("next" in calls[1].init, false);
});

test("getShiftCharts returns [] when the chart is still unpublished on the second request", async (t) => {
  const calls = stubFetch(t, [{ body: { data: [] } }, { body: { data: [] } }]);
  assert.deepEqual(await getShiftCharts(2026020075), []);
  assert.equal(calls.length, 2);
});

test("getShiftCharts rejects on a non-2xx response without a second request", async (t) => {
  const calls = stubFetch(t, [{ body: {}, status: 503 }]);
  await assert.rejects(getShiftCharts(2026020075), /shift charts.*2026020075/);
  assert.equal(calls.length, 1);
});

test("getShiftCharts drops goal markers (typeCode 505)", async (t) => {
  stubFetch(t, [{ body: { data: [shiftRow(1), shiftRow(2, 505)] } }]);
  const rows = await getShiftCharts(2026020075);
  assert.deepEqual(
    rows.map((r) => r.playerId),
    [1],
  );
});

const playByPlay = (plays: unknown[]) => ({
  id: 2026020075,
  homeTeam: { id: 8, abbrev: "MTL" },
  awayTeam: { id: 6, abbrev: "BOS" },
  plays,
});

const shotPlay = { typeDescKey: "shot-on-goal", timeInPeriod: "00:30", periodDescriptor: { number: 1, periodType: "REG" } };

test("getPlayByPlay serves a published play-by-play from the hour cache with one request", async (t) => {
  const calls = stubFetch(t, [{ body: playByPlay([shotPlay]) }]);
  const pbp = await getPlayByPlay(2026020075);
  assert.equal(pbp.plays.length, 1);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("gamecenter/2026020075/play-by-play"));
  assert.equal(calls[0].init.next?.revalidate, 3600);
});

test("getPlayByPlay re-requests an empty play-by-play uncached and returns the published plays", async (t) => {
  const calls = stubFetch(t, [{ body: playByPlay([]) }, { body: playByPlay([shotPlay]) }]);
  const pbp = await getPlayByPlay(2026020075);
  assert.equal(pbp.plays.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.cache, "no-store");
  assert.equal("next" in calls[1].init, false);
});

test("getPlayByPlay returns the empty plays after exactly 2 requests when still unpublished", async (t) => {
  const calls = stubFetch(t, [{ body: playByPlay([]) }, { body: playByPlay([]) }]);
  const pbp = await getPlayByPlay(2026020075);
  assert.deepEqual(pbp.plays, []);
  assert.equal(calls.length, 2);
});

test("getPlayByPlay rejects on a non-2xx response without a second request", async (t) => {
  const calls = stubFetch(t, [{ body: {}, status: 503 }]);
  await assert.rejects(getPlayByPlay(2026020075), /play-by-play/);
  assert.equal(calls.length, 1);
});

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.parse("2026-10-14T12:00:00Z");
const startAgo = (ms: number) => new Date(NOW - ms).toISOString();

test("finishedGameCache uses the hour tier for a game under 48 hours old", () => {
  assert.equal(RECENT_GAME_REVALIDATE_S, 3600);
  assert.equal(finishedGameCache(startAgo(HOUR_MS), NOW).next.revalidate, 3600);
  assert.equal(finishedGameCache(startAgo(47 * HOUR_MS), NOW).next.revalidate, 3600);
});

test("finishedGameCache uses the 30 day tier from exactly 48 hours old", () => {
  assert.equal(OLD_GAME_REVALIDATE_S, 2592000);
  assert.equal(RECENT_GAME_WINDOW_MS, 48 * HOUR_MS);
  assert.equal(finishedGameCache(startAgo(48 * HOUR_MS), NOW).next.revalidate, 2592000);
  assert.equal(finishedGameCache(startAgo(49 * HOUR_MS), NOW).next.revalidate, 2592000);
});

test("finishedGameCache uses the hour tier for a missing or unparseable start", () => {
  assert.equal(finishedGameCache(undefined, NOW).next.revalidate, 3600);
  assert.equal(finishedGameCache("not a date", NOW).next.revalidate, 3600);
});

test("getBoxscore, getPlayByPlay and getShiftCharts send the cache they are given", async (t) => {
  const old = finishedGameCache(startAgo(30 * 24 * HOUR_MS), NOW);
  const calls = stubFetch(t, [
    { body: { id: 1 } },
    { body: playByPlay([shotPlay]) },
    { body: { data: [shiftRow(1)] } },
  ]);
  await getBoxscore(2026020075, old);
  await getPlayByPlay(2026020075, old);
  await getShiftCharts(2026020075, old);
  assert.deepEqual(
    calls.map((c) => c.init.next?.revalidate),
    [2592000, 2592000, 2592000],
  );
});

test("getBoxscore with no cache argument sends the hour tier", async (t) => {
  const calls = stubFetch(t, [{ body: { id: 1 } }]);
  await getBoxscore(2026020075);
  assert.equal(calls[0].init.next?.revalidate, 3600);
});

test("the uncached re-requests stay uncached when given the old tier", async (t) => {
  const old = finishedGameCache(startAgo(30 * 24 * HOUR_MS), NOW);
  const calls = stubFetch(t, [
    { body: playByPlay([]) },
    { body: playByPlay([shotPlay]) },
    { body: { data: [] } },
    { body: { data: [shiftRow(7)] } },
  ]);
  await getPlayByPlay(2026020075, old);
  await getShiftCharts(2026020075, old);
  for (const i of [1, 3]) {
    assert.equal(calls[i].init.cache, "no-store");
    assert.equal("next" in calls[i].init, false);
  }
});

test("retryAfterMs retries only a 429 with a Retry-After of at most 5 seconds", () => {
  assert.equal(retryAfterMs(429, "0", 0), 0);
  assert.equal(retryAfterMs(429, "5", 1), 5000);
  assert.equal(retryAfterMs(429, "6", 0), null);
  assert.equal(retryAfterMs(429, null, 0), null);
  assert.equal(retryAfterMs(429, "Wed, 21 Oct 2026 07:28:00 GMT", 0), null);
  assert.equal(retryAfterMs(429, "1", 2), null);
  assert.equal(retryAfterMs(503, "1", 0), null);
});

test("a 429 with a short Retry-After is retried and the next response is used", async (t) => {
  const calls = stubFetch(t, [{ body: {}, status: 429, headers: { "Retry-After": "0" } }, { body: { id: 9 } }]);
  const box = await getBoxscore(2026020075);
  assert.equal(box.id, 9);
  assert.equal(calls.length, 2);
});

test("a 429 with a long Retry-After fails at once without a second request", async (t) => {
  const calls = stubFetch(t, [{ body: {}, status: 429, headers: { "Retry-After": "60" } }]);
  await assert.rejects(getBoxscore(2026020075), /429/);
  assert.equal(calls.length, 1);
});

test("repeated 429s are retried twice and then fail", async (t) => {
  const calls = stubFetch(t, [
    { body: {}, status: 429, headers: { "Retry-After": "0" } },
    { body: {}, status: 429, headers: { "Retry-After": "0" } },
    { body: {}, status: 429, headers: { "Retry-After": "0" } },
  ]);
  await assert.rejects(getBoxscore(2026020075), /429/);
  assert.equal(calls.length, 3);
});
