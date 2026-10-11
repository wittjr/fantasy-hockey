import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeGameLines,
  parseClock,
  regulationSeconds,
  trendSlope,
  uniqueShifts,
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
