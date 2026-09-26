import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreTeamsForGaps } from "./team-fit";
import type { DateBucketGap, ScheduleGame } from "./types";

test("ranks teams by how many gap-days they cover", () => {
  const gaps: DateBucketGap[] = [
    { date: "2026-10-10", bucket: "F", slotMax: 2, playersWithGame: 0, gap: 2 },
    { date: "2026-10-11", bucket: "F", slotMax: 2, playersWithGame: 0, gap: 2 },
  ];
  const games: ScheduleGame[] = [
    { gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }, // TOR/BOS cover 1 gap day
    { gameDate: "2026-10-11", homeTeamAbbrev: "TOR", awayTeamAbbrev: "MTL" }, // TOR covers both
  ];

  const scores = scoreTeamsForGaps(gaps, games);
  const tor = scores.find((s) => s.teamAbbrev === "TOR" && s.bucket === "F");
  const bos = scores.find((s) => s.teamAbbrev === "BOS" && s.bucket === "F");

  assert.equal(tor?.gapDaysCovered, 2);
  assert.equal(bos?.gapDaysCovered, 1);
  assert.equal(tor?.totalGapDaysForBucket, 2);
  // Sorted descending by coverage.
  assert.equal(scores[0].teamAbbrev, "TOR");
});

test("excludeTeams removes teams you already draw from (e.g. your own roster's teams)", () => {
  const gaps: DateBucketGap[] = [{ date: "2026-10-10", bucket: "D", slotMax: 1, playersWithGame: 0, gap: 1 }];
  const games: ScheduleGame[] = [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }];

  const scores = scoreTeamsForGaps(gaps, games, new Set(["TOR"]));
  assert.ok(!scores.some((s) => s.teamAbbrev === "TOR"));
  assert.ok(scores.some((s) => s.teamAbbrev === "BOS"));
});

test("a bucket with no gaps produces no scores for that bucket", () => {
  const scores = scoreTeamsForGaps([], [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }]);
  assert.deepEqual(scores, []);
});
