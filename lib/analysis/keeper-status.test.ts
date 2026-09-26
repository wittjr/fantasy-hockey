import { test } from "node:test";
import assert from "node:assert/strict";
import { computeKeeperStatuses } from "./keeper-status";

test("defaults to the programmatic guess when there's no override", () => {
  const statuses = computeKeeperStatuses(["p1", "p2"], new Set(["p1"]), new Map());
  assert.deepEqual(statuses, [
    { fantraxPlayerId: "p1", isConsidered: true, isProgrammatic: true },
    { fantraxPlayerId: "p2", isConsidered: false, isProgrammatic: true },
  ]);
});

test("a manual override to false beats a programmatic true", () => {
  const statuses = computeKeeperStatuses(["p1"], new Set(["p1"]), new Map([["p1", false]]));
  assert.deepEqual(statuses, [{ fantraxPlayerId: "p1", isConsidered: false, isProgrammatic: false }]);
});

test("a manual override to true beats a programmatic false", () => {
  const statuses = computeKeeperStatuses(["p1"], new Set(), new Map([["p1", true]]));
  assert.deepEqual(statuses, [{ fantraxPlayerId: "p1", isConsidered: true, isProgrammatic: false }]);
});
