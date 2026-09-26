import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLikelyKeptPlayers } from "./likely-keepers";

test("takes the top N by lowest ADP per team, mapping each player to that team", () => {
  const rosters = new Map([
    ["teamA", ["a1", "a2", "a3"]],
    ["teamB", ["b1", "b2"]],
  ]);
  const adp = new Map([
    ["a1", 5],
    ["a2", 50],
    ["a3", 1],
    ["b1", 10],
    ["b2", 20],
  ]);

  const keptBy = computeLikelyKeptPlayers(rosters, adp, 2);
  assert.deepEqual(
    [...keptBy.entries()].sort(),
    [
      ["a1", "teamA"],
      ["a3", "teamA"],
      ["b1", "teamB"],
      ["b2", "teamB"],
    ].sort()
  );
});

test("ignores players with no known ADP rather than treating them as best", () => {
  const rosters = new Map([["teamA", ["a1", "a2", "a3"]]]);
  const adp = new Map([["a1", 5]]); // a2, a3 unmatched/unknown

  const keptBy = computeLikelyKeptPlayers(rosters, adp, 2);
  assert.deepEqual([...keptBy.entries()], [["a1", "teamA"]]);
});

test("returns an empty map when no rosters are given", () => {
  assert.deepEqual(computeLikelyKeptPlayers(new Map(), new Map(), 6), new Map());
});
