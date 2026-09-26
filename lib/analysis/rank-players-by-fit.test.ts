import { test } from "node:test";
import assert from "node:assert/strict";
import { rankPlayersByFit, type RankablePlayer } from "./rank-players-by-fit";
import type { TeamFitScore } from "./types";

function player(overrides: Partial<RankablePlayer>): RankablePlayer {
  return {
    id: overrides.name ?? "row",
    name: "Player",
    position: "C",
    nhlTeamAbbrev: "TOR",
    rank: null,
    fantasyPoints: null,
    fantasyPointsPerGp: null,
    vorp: null,
    adp: null,
    ...overrides,
  };
}

const teamFit: TeamFitScore[] = [
  { teamAbbrev: "TOR", bucket: "F", gapDaysCovered: 10, totalGapDaysForBucket: 20 },
  { teamAbbrev: "BOS", bucket: "F", gapDaysCovered: 15, totalGapDaysForBucket: 20 },
  { teamAbbrev: "TOR", bucket: "D", gapDaysCovered: 5, totalGapDaysForBucket: 20 },
];

test("orders players by gapDaysCovered first, RK as tiebreaker", () => {
  const players = [
    player({ name: "TOR forward, worse rank", nhlTeamAbbrev: "TOR", position: "C", rank: 50 }),
    player({ name: "BOS forward, best fit", nhlTeamAbbrev: "BOS", position: "LW", rank: 100 }),
    player({ name: "TOR forward, better rank", nhlTeamAbbrev: "TOR", position: "RW", rank: 10 }),
  ];

  const ranked = rankPlayersByFit(players, ["F", "D", "G"], teamFit);
  const names = ranked.get("F")?.map((p) => p.name);
  assert.deepEqual(names, ["BOS forward, best fit", "TOR forward, better rank", "TOR forward, worse rank"]);
});

test("players with no rank sort after ranked players at the same fit level", () => {
  const players = [
    player({ name: "No rank", nhlTeamAbbrev: "TOR", position: "C", rank: null }),
    player({ name: "Ranked", nhlTeamAbbrev: "TOR", position: "C", rank: 5 }),
  ];

  const ranked = rankPlayersByFit(players, ["F", "D", "G"], teamFit);
  assert.deepEqual(
    ranked.get("F")?.map((p) => p.name),
    ["Ranked", "No rank"]
  );
});

test("skips players whose team has no team-fit score at all", () => {
  const players = [player({ name: "Untracked team", nhlTeamAbbrev: "MTL", position: "C" })];
  const ranked = rankPlayersByFit(players, ["F", "D", "G"], teamFit);
  assert.equal(ranked.get("F"), undefined);
});

test("caps each bucket at limitPerBucket", () => {
  const players = Array.from({ length: 5 }, (_, i) => player({ name: `P${i}`, nhlTeamAbbrev: "TOR", rank: i }));
  const ranked = rankPlayersByFit(players, ["F", "D", "G"], teamFit, 2);
  assert.equal(ranked.get("F")?.length, 2);
});
