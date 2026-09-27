import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDailyLineups, canFillSlot, projectionOn, datesFilledByAddition, injuredPlayers, lineupChange, orderSlotTypes, planDays, recommendPlayers, scoreTeamFits, solveLineup } from "./lineup";
import type { AvailablePlayer, GamesByTeam, PlannerRosterPlayer } from "./types";

function games(schedule: Record<string, string[]>): GamesByTeam {
  const map: GamesByTeam = new Map();
  for (const [team, dates] of Object.entries(schedule)) {
    map.set(team, new Map(dates.map((d) => [d, { opponent: "OPP", isHome: true }])));
  }
  return map;
}

function rostered(
  playerId: string,
  team: string,
  eligiblePositions: string[],
  out: string[] = [],
  ppg: number | null = null
): PlannerRosterPlayer {
  const dailySlots = Object.fromEntries(
    ["d1", "d2", "d3"].map((d) => [d, out.includes(d) ? { slot: "IR", status: "out" as const } : { slot: "BN", status: "bench" as const }])
  );
  return { playerId, name: playerId, nhlTeamAbbrev: team, displayPosition: eligiblePositions[0], eligiblePositions, projectedPointsPerGame: ppg, dailyProjections: {}, dailySlots };
}

function available(playerId: string, team: string, eligiblePositions: string[], ppg: number | null, rank: number | null = null): AvailablePlayer {
  return { playerId, name: playerId, nhlTeamAbbrev: team, displayPosition: eligiblePositions[0], eligiblePositions, projectedPointsPerGame: ppg, rank };
}

test("canFillSlot handles exact, forward-bucket and Util slots", () => {
  assert.equal(canFillSlot("C", ["C"]), true);
  assert.equal(canFillSlot("C", ["LW"]), false);
  assert.equal(canFillSlot("F", ["LW"]), true);
  assert.equal(canFillSlot("F", ["D"]), false);
  assert.equal(canFillSlot("Util", ["D"]), true);
  assert.equal(canFillSlot("Util", ["G"]), false);
  assert.equal(canFillSlot("W", ["RW"]), true);
});

test("solveLineup finds the optimal assignment, not a greedy one", () => {
  // Greedy would put the C/LW player in C and leave LW empty; optimal fills both.
  const result = solveLineup([["C", "LW"], ["C"]], ["C", "LW"]);
  assert.equal(result.filled, 2);
  assert.deepEqual(result.openSlots, []);
});

test("solveLineup leaves the flexible slot open when it can", () => {
  const result = solveLineup([["C"]], ["C", "Util"]);
  assert.deepEqual(result.openSlots, ["Util"]);
});

test("planDays counts only players with a game who aren't out", () => {
  const schedule = games({ TOR: ["d1", "d2"], BOS: ["d1"] });
  const roster = [rostered("a", "TOR", ["F"], ["d2"]), rostered("b", "BOS", ["F"])];
  const [d1, d2] = planDays(["d1", "d2"], { F: 2 }, roster, schedule);
  assert.equal(d1.startersWithGame, 2);
  assert.deepEqual(d1.openSlots, []);
  assert.equal(d2.startersWithGame, 0); // TOR player is on IR, BOS has no game
  assert.deepEqual(d2.openSlots, ["F", "F"]);
});

test("datesFilledByAddition only counts days the addition can actually start", () => {
  const schedule = games({ TOR: ["d1", "d2"], NYR: ["d1", "d2"] });
  // D slot open on both days, F slot full on both.
  const plans = planDays(["d1", "d2"], { F: 1, D: 1 }, [rostered("a", "TOR", ["F"])], schedule);
  assert.deepEqual(datesFilledByAddition(["F"], "NYR", plans, { F: 1, D: 1 }, schedule), []);
  assert.deepEqual(datesFilledByAddition(["D"], "NYR", plans, { F: 1, D: 1 }, schedule), ["d1", "d2"]);
});

test("scoreTeamFits ranks teams by open days covered", () => {
  const schedule = games({ TOR: ["d1"], NYR: ["d1", "d2"], BOS: ["d3"] });
  const plans = planDays(["d1", "d2", "d3"], { D: 1 }, [], schedule);
  const fits = scoreTeamFits(["D"], plans, { D: 1 }, schedule).get("D")!;
  assert.deepEqual(
    fits.map((f) => [f.teamAbbrev, f.filledDates.length]),
    [["NYR", 2], ["BOS", 1], ["TOR", 1]]
  );
});

test("recommendPlayers sorts by projected added points, then starts, then rank", () => {
  const schedule = games({ TOR: ["d1"], NYR: ["d1", "d2"] });
  const recs = recommendPlayers(
    [
      available("noProj", "NYR", ["F"], null, 1),
      available("twoGames", "NYR", ["F"], 1.0),
      available("oneGameStar", "TOR", ["F"], 3.0),
      available("goalie", "NYR", ["G"], 5.0),
    ],
    ["d1", "d2"],
    { F: 1 },
    [],
    schedule
  );
  assert.deepEqual(
    recs.map((r) => r.player.playerId),
    ["oneGameStar", "twoGames", "noProj"]
  );
});

test("recommendPlayers counts upgrades over a weaker starter, not just empty slots", () => {
  const schedule = games({ TOR: ["d1", "d2"], NYR: ["d1", "d2"] });
  const roster = [rostered("weak", "TOR", ["F"], [], 2)];
  const recs = recommendPlayers(
    [available("upgrade", "NYR", ["F"], 5), available("worse", "NYR", ["F"], 1)],
    ["d1", "d2"],
    { F: 1 },
    roster,
    schedule
  );
  // Full lineup both days: "upgrade" displaces "weak" for +3/day; "worse" never starts.
  assert.deepEqual(
    recs.map((r) => [r.player.playerId, r.startDates, r.projectedAddedPoints]),
    [["upgrade", ["d1", "d2"], 6]]
  );
});

test("orderSlotTypes puts forwards first, then D, then G", () => {
  assert.deepEqual(orderSlotTypes({ G: 1, D: 4, F: 6 }), ["F", "D", "G"]);
  assert.deepEqual(orderSlotTypes({ G: 2, Util: 1, D: 4, RW: 2, C: 2, LW: 2 }), ["C", "LW", "RW", "D", "Util", "G"]);
});

test("buildDailyLineups starts the best FP/GP players, best first, and benches the rest", () => {
  const schedule = games({ TOR: ["d1"], BOS: ["d1"] });
  const roster = [
    rostered("low", "TOR", ["F"], [], 1),
    rostered("high", "TOR", ["F"], [], 3),
    rostered("mid", "BOS", ["F"], [], 2),
    rostered("none", "BOS", ["F"], [], null),
    rostered("injured", "BOS", ["F"], ["d1"], 9),
    rostered("d", "TOR", ["D"], [], 0.5),
  ];
  const [day] = buildDailyLineups(["d1"], { G: 1, D: 1, F: 2 }, roster, schedule);
  assert.deepEqual(
    day.starters.map((s) => [s.slot, s.player?.playerId ?? null]),
    [["F", "high"], ["F", "mid"], ["D", "d"], ["G", null]]
  );
  assert.deepEqual(day.bench.map((p) => p.playerId), ["low", "none"]);
});

test("buildDailyLineups shuffles multi-position players to fit the best set", () => {
  // Greedy by FP/GP would put "flex" in C and leave "c" out; the lineup should start both.
  const schedule = games({ TOR: ["d1"] });
  const roster = [rostered("flex", "TOR", ["C", "LW"], [], 5), rostered("c", "TOR", ["C"], [], 4)];
  const [day] = buildDailyLineups(["d1"], { C: 1, LW: 1 }, roster, schedule);
  assert.deepEqual(day.starters.map((s) => s.player?.playerId), ["c", "flex"]);
  assert.deepEqual(day.bench, []);
});

test("lineupChange compares only active vs not, ignoring which slot", () => {
  assert.equal(lineupChange(true, { slot: "F", status: "active" }), "agreed");
  assert.equal(lineupChange(true, { slot: "LW", status: "active" }), "agreed");
  assert.equal(lineupChange(true, { slot: "BN", status: "bench" }), "start");
  assert.equal(lineupChange(true, { slot: "IR", status: "out" }), "start");
  assert.equal(lineupChange(false, { slot: "F", status: "active" }), "bench");
  assert.equal(lineupChange(false, { slot: "BN", status: "bench" }), "none");
});

test("injuredPlayers lists anyone out during the week, ordered by slot then FP/GP", () => {
  const roster = [
    rostered("d", "TOR", ["D"], ["d2"], 5),
    rostered("f-low", "TOR", ["F"], ["d1", "d2"], 2),
    rostered("f-high", "TOR", ["F"], ["d3"], 4),
    rostered("healthy", "TOR", ["F"], [], 9),
  ];
  assert.deepEqual(
    injuredPlayers(["d1", "d2", "d3"], { G: 1, D: 2, F: 2 }, roster).map(({ slot, player }) => [slot, player.playerId]),
    [["F", "f-high"], ["F", "f-low"], ["D", "d"]]
  );
});

test("per-day projections override FP/GP for lineup order and pickup gains", () => {
  const schedule = games({ TOR: ["d1", "d2"], NYR: ["d1", "d2"] });
  // Same 3.0 FP/GP, but "matchup" is projected 5 on d1 and 1 on d2.
  const matchup = { ...rostered("matchup", "TOR", ["F"], [], 3), dailyProjections: { d1: 5, d2: 1 } };
  const steady = rostered("steady", "NYR", ["F"], [], 3);
  assert.equal(projectionOn(matchup, "d1"), 5);
  assert.equal(projectionOn(matchup, "d3"), 3);
  const [d1, d2] = buildDailyLineups(["d1", "d2"], { F: 1 }, [matchup, steady], schedule);
  assert.equal(d1.starters[0].player?.playerId, "matchup");
  assert.equal(d2.starters[0].player?.playerId, "steady");
  // A 4.0 pickup only beats the d2 starter (3.0) and the d1 starter (5.0) never: +1 total.
  const [rec] = recommendPlayers([available("pickup", "NYR", ["F"], 4)], ["d1", "d2"], { F: 1 }, [matchup, steady], schedule);
  assert.deepEqual([rec.startDates, rec.projectedAddedPoints], [["d2"], 1]);
});
