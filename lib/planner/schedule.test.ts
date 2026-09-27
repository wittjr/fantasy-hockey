import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleFetchStarts } from "./schedule";

test("scheduleFetchStarts covers contiguous dates with one call per 7 days", () => {
  assert.deepEqual(scheduleFetchStarts(["2026-10-01", "2026-10-02", "2026-10-07", "2026-10-08"]), ["2026-10-01", "2026-10-08"]);
});

test("scheduleFetchStarts handles gaps and unsorted input", () => {
  assert.deepEqual(scheduleFetchStarts(["2026-12-01", "2026-10-09", "2026-10-10"]), ["2026-10-09", "2026-12-01"]);
});
