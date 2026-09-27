import { test } from "node:test";
import assert from "node:assert/strict";
import { fantraxTimestampMs, planDraftSync } from "./draft-plan";

const pick = (pickNo: number, teamId: string, playerId?: string) => ({
  round: 1,
  pick: pickNo,
  pickInRound: pickNo,
  teamId,
  time: 0,
  ...(playerId ? { playerId } : {}),
});

test("fantraxTimestampMs handles Fantrax's colon-less offset", () => {
  assert.equal(fantraxTimestampMs("2026-09-27T20:00:00.0-0400"), Date.UTC(2026, 8, 28, 0, 0, 0));
});

test("planDraftSync adds my picks, removes others' picks, and skips unmade picks", () => {
  const plan = planDraftSync([pick(1, "them", "a"), pick(2, "me", "b"), pick(3, "them")], "me", new Set(), new Set());
  assert.deepEqual(plan, { addToMyTeam: ["b"], dropFromMyTeam: [], removeFromPool: ["a"] });
});

test("planDraftSync is idempotent and drops my what-if players that another team drafted", () => {
  const picks = [pick(1, "them", "a"), pick(2, "me", "b"), pick(3, "them", "c")];
  const plan = planDraftSync(picks, "me", new Set(["b", "c"]), new Set(["a"]));
  assert.deepEqual(plan, { addToMyTeam: [], dropFromMyTeam: ["c"], removeFromPool: ["c"] });
});
