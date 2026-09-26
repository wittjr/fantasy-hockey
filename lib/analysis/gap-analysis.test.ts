import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCoverageHistogram, computeRosterGaps, computeRosterSurplus } from "./gap-analysis";
import type { ConsideredPlayer, ScheduleGame } from "./types";

const slotConstraints = { F: 2, D: 1, G: 1 };

test("no gap when every bucket is fully covered", () => {
  const players: ConsideredPlayer[] = [
    { fantraxPlayerId: "f1", rosterPosition: "F", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "f2", rosterPosition: "F", nhlTeamAbbrev: "BOS" },
    { fantraxPlayerId: "d1", rosterPosition: "D", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "g1", rosterPosition: "G", nhlTeamAbbrev: "BOS" },
  ];
  const games: ScheduleGame[] = [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }];

  assert.deepEqual(computeRosterGaps(players, slotConstraints, games), []);
});

test("reports a gap when a bucket is short players with a game", () => {
  const players: ConsideredPlayer[] = [
    { fantraxPlayerId: "f1", rosterPosition: "F", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "d1", rosterPosition: "D", nhlTeamAbbrev: "MTL" }, // doesn't play this date
    { fantraxPlayerId: "g1", rosterPosition: "G", nhlTeamAbbrev: "BOS" },
  ];
  const games: ScheduleGame[] = [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }];

  const gaps = computeRosterGaps(players, slotConstraints, games);

  // F: slotMax 2, only 1 has a game -> gap 1. D: slotMax 1, 0 have a game -> gap 1. G: covered.
  assert.deepEqual(gaps, [
    { date: "2026-10-10", bucket: "D", slotMax: 1, playersWithGame: 0, gap: 1 },
    { date: "2026-10-10", bucket: "F", slotMax: 2, playersWithGame: 1, gap: 1 },
  ]);
});

test("a date with no games at all is a full gap for every bucket", () => {
  const players: ConsideredPlayer[] = [{ fantraxPlayerId: "f1", rosterPosition: "F", nhlTeamAbbrev: "TOR" }];
  // No games scheduled on this date for any considered player's team.
  const games: ScheduleGame[] = [{ gameDate: "2026-10-11", homeTeamAbbrev: "MTL", awayTeamAbbrev: "BOS" }];

  const gaps = computeRosterGaps(players, slotConstraints, games);
  assert.deepEqual(gaps, [
    { date: "2026-10-11", bucket: "D", slotMax: 1, playersWithGame: 0, gap: 1 },
    { date: "2026-10-11", bucket: "F", slotMax: 2, playersWithGame: 0, gap: 2 },
    { date: "2026-10-11", bucket: "G", slotMax: 1, playersWithGame: 0, gap: 1 },
  ]);
});

test("having more eligible players with games than slotMax never produces a negative gap", () => {
  const players: ConsideredPlayer[] = [
    { fantraxPlayerId: "f1", rosterPosition: "F", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "f2", rosterPosition: "F", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "f3", rosterPosition: "F", nhlTeamAbbrev: "TOR" },
  ];
  const games: ScheduleGame[] = [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }];

  const gaps = computeRosterGaps(players, { F: 2 }, games);
  assert.deepEqual(gaps, []);
});

test("computeRosterSurplus reports days where a playing player must sit", () => {
  const players: ConsideredPlayer[] = [
    { fantraxPlayerId: "d1", rosterPosition: "D", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "d2", rosterPosition: "D", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "d3", rosterPosition: "D", nhlTeamAbbrev: "BOS" },
  ];
  const games: ScheduleGame[] = [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }];

  // slotMax 1, but all 3 D have a game -> 2 must sit.
  const surplus = computeRosterSurplus(players, { D: 1 }, games);
  assert.deepEqual(surplus, [{ date: "2026-10-10", bucket: "D", slotMax: 1, playersWithGame: 3, surplus: 2 }]);
});

test("computeRosterSurplus is empty when coverage never exceeds slotMax", () => {
  const players: ConsideredPlayer[] = [{ fantraxPlayerId: "d1", rosterPosition: "D", nhlTeamAbbrev: "TOR" }];
  const games: ScheduleGame[] = [{ gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }];

  assert.deepEqual(computeRosterSurplus(players, { D: 4 }, games), []);
});

test("computeCoverageHistogram buckets dates by how many considered players have a game", () => {
  const players: ConsideredPlayer[] = [
    { fantraxPlayerId: "d1", rosterPosition: "D", nhlTeamAbbrev: "TOR" },
    { fantraxPlayerId: "d2", rosterPosition: "D", nhlTeamAbbrev: "BOS" },
  ];
  const games: ScheduleGame[] = [
    { gameDate: "2026-10-10", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" }, // both play -> 2
    { gameDate: "2026-10-11", homeTeamAbbrev: "TOR", awayTeamAbbrev: "MTL" }, // only TOR -> 1
    { gameDate: "2026-10-12", homeTeamAbbrev: "MTL", awayTeamAbbrev: "NYR" }, // neither -> 0
  ];

  const histogram = computeCoverageHistogram(players, { D: 1 }, games);
  assert.deepEqual(histogram, [
    { bucket: "D", slotMax: 1, playersWithGame: 0, dateCount: 1 },
    { bucket: "D", slotMax: 1, playersWithGame: 1, dateCount: 1 },
    { bucket: "D", slotMax: 1, playersWithGame: 2, dateCount: 1 },
  ]);
});
