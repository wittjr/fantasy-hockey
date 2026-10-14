import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeGameLines,
  creditsUnit,
  parseClock,
  regulationSeconds,
  trendSlope,
  uniqueShifts,
  unitKey,
  type OnIce,
  type PositionGroup,
  type ShiftInput,
} from "./lines";

// BUF: forwards 1-6, D 11-14, G 20. OPP: skaters 101-105, G 120.
const positions = new Map<number, PositionGroup>([
  ...[1, 2, 3, 4, 5, 6].map((id) => [id, "F"] as [number, PositionGroup]),
  ...[11, 12, 13, 14].map((id) => [id, "D"] as [number, PositionGroup]),
  [20, "G"],
  ...[101, 102, 103, 104, 105].map((id) => [id, "F"] as [number, PositionGroup]),
  [120, "G"],
]);

function shifts(team: string, ids: number[], startSec: number, endSec: number, period = 1): ShiftInput[] {
  return ids.map((playerId) => ({ playerId, team, period, startSec, endSec }));
}

test("parseClock parses MM:SS and rejects junk", () => {
  assert.equal(parseClock("03:30"), 210);
  assert.equal(parseClock("19:59"), 1199);
  assert.equal(parseClock(""), null);
  assert.equal(parseClock(null), null);
});

test("splits time into EV/PP/SH from on-ice counts and groups lines", () => {
  const input = [
    // 0-60s: 5v5, line 1-2-3 with pair 11-12
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
    // 60-90s: BUF on the PP, 5v4
    ...shifts("BUF", [4, 5, 6, 1, 13, 20], 60, 90),
    ...shifts("OPP", [101, 102, 103, 104, 120], 60, 90),
    // 90-120s: BUF short-handed, 4v5
    ...shifts("BUF", [4, 5, 13, 14, 20], 90, 120),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 90, 120),
  ];
  const lines = analyzeGameLines("BUF", input, positions);

  assert.deepEqual(lines.situationSeconds, { ev: 60, pp: 30, sh: 30 });
  assert.deepEqual(lines.units.ev.F, [{ playerIds: [1, 2, 3], seconds: 60, pct: 100 }]);
  assert.deepEqual(lines.units.ev.D, [{ playerIds: [11, 12], seconds: 60, pct: 100 }]);
  assert.deepEqual(lines.units.pp.F[0].playerIds, [1, 4, 5, 6]);
  assert.deepEqual(lines.units.sh.D[0].playerIds, [13, 14]);
  assert.deepEqual(lines.playerSeconds.get(1), { ev: 60, pp: 30, sh: 0 });
  assert.deepEqual(lines.playerSeconds.get(13), { ev: 0, pp: 30, sh: 30 });
});

test("an empty net counts as even strength, not a power play", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 4, 11, 12], 0, 30), // goalie pulled, 6 skaters
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 30),
  ];
  assert.deepEqual(analyzeGameLines("BUF", input, positions).situationSeconds, { ev: 30, pp: 0, sh: 0 });
  // D-22: the pulled-goalie seconds are in no listed unit, but each skater still has his seconds.
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(lines.units.ev.F, []);
  assert.deepEqual(lines.units.ev.D, []);
  assert.deepEqual(lines.playerSeconds.get(11), { ev: 30, pp: 0, sh: 0 });
});

test("ignores momentary combos from line changes and offsets later periods", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 100, 2),
    ...shifts("BUF", [4, 5, 6], 100, 105, 2), // 5s blip during a change
    ...shifts("BUF", [11, 12, 20], 100, 105, 2),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 105, 2),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(
    lines.units.ev.F.map((u) => u.playerIds),
    [[1, 2, 3]],
  );
  assert.equal(lines.situationSeconds.ev, 105);
});

test("trendSlope fits a least-squares line", () => {
  assert.equal(trendSlope([{ x: 0, y: 900 }]), null);
  assert.equal(trendSlope([{ x: 0, y: 900 }, { x: 1, y: 960 }, { x: 2, y: 1020 }]), 60);
  assert.equal(trendSlope([{ x: 0, y: 1000 }, { x: 3, y: 1000 }]), 0);
});

test("trendSlope weights points and drops zero-weight ones", () => {
  // The heavy points sit on a flat line; the light outlier barely tilts it.
  const slope = trendSlope([
    { x: 0, y: 50, w: 300 },
    { x: 1, y: 100, w: 10 },
    { x: 2, y: 50, w: 300 },
  ])!;
  assert.ok(Math.abs(slope) < 1e-9);
  assert.equal(trendSlope([{ x: 0, y: 0, w: 0 }, { x: 1, y: 50, w: 100 }]), null);
});

test("regulationSeconds sums periods 1-3 for the team only, skipping OT and empty shifts", () => {
  const input = [
    ...shifts("BUF", [1, 2], 0, 60),
    ...shifts("BUF", [1], 100, 160, 3),
    ...shifts("BUF", [1], 0, 30, 4), // overtime
    ...shifts("BUF", [2], 50, 50, 2), // zero length
    ...shifts("OPP", [101], 0, 60),
  ];
  assert.deepEqual(
    regulationSeconds("BUF", input),
    new Map([
      [1, 120],
      [2, 60],
    ]),
  );
});

test("regulationSeconds counts a verbatim duplicate shift row once", () => {
  const input = [...shifts("BUF", [1], 0, 60), ...shifts("BUF", [1], 0, 60), ...shifts("BUF", [1], 100, 130)];
  assert.equal(regulationSeconds("BUF", input).get(1), 90);
});

// Same fixture as the EV/PP/SH test; used by the duplicate-row tests below.
function ppFixture(): ShiftInput[] {
  return [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
    ...shifts("BUF", [4, 5, 6, 1, 13, 20], 60, 90),
    ...shifts("OPP", [101, 102, 103, 104, 120], 60, 90),
    ...shifts("BUF", [4, 5, 13, 14, 20], 90, 120),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 90, 120),
  ];
}

test("analyzeGameLines counts a verbatim duplicate shift row once", () => {
  const original = ppFixture();
  const withDuplicate = [...original, ...shifts("BUF", [4], 60, 90)];
  const expected = analyzeGameLines("BUF", original, positions);
  const actual = analyzeGameLines("BUF", withDuplicate, positions);

  assert.deepEqual(actual.situationSeconds, { ev: 60, pp: 30, sh: 30 });
  assert.deepEqual(actual, expected);
});

test("a duplicated skater row does not turn even strength into a power play", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("BUF", [1], 0, 60), // would read as 6 skaters
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(lines.situationSeconds, { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(lines.playerSeconds.get(1), { ev: 60, pp: 0, sh: 0 });
});

test("uniqueShifts keeps the first occurrence in input order", () => {
  const [a] = shifts("BUF", [1], 0, 60);
  const [b] = shifts("BUF", [2], 0, 60);
  assert.deepEqual(uniqueShifts([a, a, b]), [a, b]);
  assert.deepEqual(uniqueShifts([b, a, b, a]), [b, a]);
  assert.deepEqual(uniqueShifts([]), []);
});

test("uniqueShifts only collapses exact (team, player, period, start, end) repeats", () => {
  const [a] = shifts("BUF", [1], 0, 60);
  const rows: ShiftInput[] = [
    a,
    { ...a, endSec: a.endSec + 1 },
    { ...a, startSec: a.startSec - 1 },
    { ...a, period: 2 },
    { ...a, team: "OPP" },
  ];
  assert.deepEqual(uniqueShifts(rows), rows);
});

test("with duplicates, no player's PP or SH seconds exceed the team's", () => {
  const input = [...ppFixture(), ...shifts("BUF", [4, 5], 60, 90), ...shifts("BUF", [13], 90, 120)];
  const lines = analyzeGameLines("BUF", input, positions);
  for (const rec of lines.playerSeconds.values()) {
    assert.ok(rec.pp <= lines.situationSeconds.pp);
    assert.ok(rec.sh <= lines.situationSeconds.sh);
  }
});

test("a player's overlapping differing rows do not inflate the skater count, so 5v5 stays even strength", () => {
  // Counted raw, skater 1's two rows make 6 skaters plus a goalie, which reads as a power play.
  const input = [
    ...shifts("BUF", [1], 0, 60),
    ...shifts("BUF", [1], 30, 60),
    ...shifts("BUF", [2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(lines.situationSeconds, { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(lines.playerSeconds.get(1), { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(lines.units.ev.F, [{ playerIds: [1, 2, 3], seconds: 60, pct: 100 }]);
  assert.deepEqual(lines.units.pp.F, []);
});

test("an opponent's overlapping differing rows do not turn even strength into a short-handed second", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
    ...shifts("OPP", [101], 30, 60),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(lines.situationSeconds, { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(lines.playerSeconds.get(1), { ev: 60, pp: 0, sh: 0 });
});

test("a player's overlapping differing rows on the power play count once in his seconds and in the unit", () => {
  const input = [
    ...shifts("BUF", [4, 5, 6, 1, 13, 20], 0, 30),
    ...shifts("BUF", [4], 10, 30),
    ...shifts("OPP", [101, 102, 103, 104, 120], 0, 30),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(lines.units.pp.F, [{ playerIds: [1, 4, 5, 6], seconds: 30, pct: 100 }]);
  assert.deepEqual(lines.playerSeconds.get(4), { ev: 0, pp: 30, sh: 0 });
});

// Unit seconds follow creditsUnit (D-13, D-21, D-22): these seconds go to Other, never to a listed unit.
function assertNoUnits(lines: ReturnType<typeof analyzeGameLines>) {
  for (const situation of ["ev", "pp", "sh"] as const) {
    assert.deepEqual(lines.units[situation].F, [], `${situation} F`);
    assert.deepEqual(lines.units[situation].D, [], `${situation} D`);
  }
}

test("opponent goalie pulled: the seconds stay even strength for every skater but credit no unit", () => {
  const withSixth = new Map<number, PositionGroup>([...positions, [106, "F"]]);
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 30),
    ...shifts("OPP", [101, 102, 103, 104, 105, 106], 0, 30), // no OPP goalie
  ];
  const lines = analyzeGameLines("BUF", input, withSixth);
  assert.deepEqual(lines.situationSeconds, { ev: 30, pp: 0, sh: 0 });
  assertNoUnits(lines);
  assert.equal(lines.playerSeconds.get(1)?.ev, 30);
});

test("an opponent with no shift rows keeps today's situation seconds but credits no unit", () => {
  const lines = analyzeGameLines("BUF", shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 30), positions);
  assert.deepEqual(lines.situationSeconds, { ev: 0, pp: 30, sh: 0 });
  assert.deepEqual(lines.units.pp.F, []);
  assert.deepEqual(lines.units.pp.D, []);
});

test("4-on-4 stays even strength for situation and player seconds but credits no unit", () => {
  const input = [
    ...shifts("BUF", [1, 2, 11, 12, 20], 0, 40),
    ...shifts("OPP", [101, 102, 103, 104, 120], 0, 40),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.equal(lines.situationSeconds.ev, 40);
  assert.deepEqual(lines.units.ev.D, []);
  assert.deepEqual(lines.playerSeconds.get(11), { ev: 40, pp: 0, sh: 0 });
});

test("3-on-3 overtime seconds credit no unit, so a trio keeps only its 5-on-5 time", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
    ...shifts("BUF", [1, 2, 3, 20], 0, 50, 4),
    ...shifts("OPP", [101, 102, 103, 120], 0, 50, 4),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  assert.equal(lines.situationSeconds.ev, 110);
  assert.deepEqual(lines.units.ev.F, [{ playerIds: [1, 2, 3], seconds: 60, pct: (60 / 110) * 100 }]);
});

test("unitKey sorts a unit's ids and returns null for no unit or a short even-strength unit", () => {
  assert.equal(unitKey("ev", "F", [3, 1, 2], positions), "1,2,3");
  assert.equal(unitKey("ev", "F", [1, 2, 3, 4], positions), null);
  assert.equal(unitKey("pp", "F", [1, 4, 5, 6], positions), "1,4,5,6");
  assert.equal(unitKey("ev", "D", [1, 2, 3], positions), null);
});

test("creditsUnit needs both goalies, and exactly 5 on 5 at even strength", () => {
  const side = (skaters: number, goalie = true): OnIce => ({ skaters: Array.from({ length: skaters }, (_, i) => i + 1), goalie });
  assert.equal(creditsUnit("ev", side(5, false), side(5)), false);
  assert.equal(creditsUnit("ev", side(5), side(5, false)), false);
  assert.equal(creditsUnit("ev", side(4), side(4)), false);
  assert.equal(creditsUnit("ev", side(5), side(5)), true);
  assert.equal(creditsUnit("pp", side(5), side(4)), true);
});
