import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { getPlayByPlay, getShiftCharts } from "./client";

const shiftRow = (playerId: number, typeCode = 517) => ({
  playerId,
  teamAbbrev: "MTL",
  period: 1,
  startTime: "00:00",
  endTime: "00:40",
  typeCode,
});

/** Stubs global fetch with a queue of responses and records each call's url and init. */
function stubFetch(t: TestContext, queue: Array<{ body: unknown; status?: number }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    assert.ok(next, "unexpected extra fetch call");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
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
