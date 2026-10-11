import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { getShiftCharts } from "./client";

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
  const calls: Array<{ url: string; init: RequestInit & { next?: { revalidate?: number } } }> = [];
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
