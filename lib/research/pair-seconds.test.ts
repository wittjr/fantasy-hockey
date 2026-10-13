import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGameLines, type PositionGroup, type ShiftInput, type Situation } from "./lines";
import { pairSeconds } from "./pair-seconds";

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

const SITUATIONS: Situation[] = ["ev", "pp", "sh"];

// The lines.test.ts fixture: 0-60 5v5, 60-90 BUF power play, 90-120 BUF short-handed.
const evPpSh: ShiftInput[] = [
  ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
  ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
  ...shifts("BUF", [4, 5, 6, 1, 13, 20], 60, 90),
  ...shifts("OPP", [101, 102, 103, 104, 120], 60, 90),
  ...shifts("BUF", [4, 5, 13, 14, 20], 90, 120),
  ...shifts("OPP", [101, 102, 103, 104, 105, 120], 90, 120),
];

test("splits each skater's own seconds into EV/PP/SH", () => {
  const { self } = pairSeconds("BUF", evPpSh, positions);
  assert.deepEqual(self.get(1), { ev: 60, pp: 30, sh: 0 });
  assert.deepEqual(self.get(13), { ev: 0, pp: 30, sh: 30 });
});

test("own seconds equal analyzeGameLines' per-skater seconds when the game has no overtime (oracle)", () => {
  const { self } = pairSeconds("BUF", evPpSh, positions);
  const lines = analyzeGameLines("BUF", evPpSh, positions);
  assert.equal(self.size, lines.playerSeconds.size);
  for (const [id, record] of lines.playerSeconds) assert.deepEqual(self.get(id), record, `skater ${id}`);
});

test("time together is symmetric and counts the seconds both skaters were on ice", () => {
  const { together } = pairSeconds("BUF", evPpSh, positions);
  assert.equal(together.get(1)?.get(2)?.ev, 60);
  assert.equal(together.get(2)?.get(1)?.ev, 60);
  assert.equal(together.get(1)?.get(4)?.pp, 30);
  assert.equal(together.get(4)?.get(1)?.pp, 30);
});

test("time together never exceeds either skater's own seconds", () => {
  const { self, together } = pairSeconds("BUF", evPpSh, positions);
  for (const [a, byLinemate] of together) {
    for (const [b, record] of byLinemate) {
      for (const s of SITUATIONS) {
        assert.ok(record[s] <= Math.min(self.get(a)![s], self.get(b)![s]), `${a}/${b} ${s}`);
      }
    }
  }
});

test("overtime periods add nothing to own or pair seconds, while analyzeGameLines counts them", () => {
  const input = [
    ...shifts("BUF", [1, 2, 20], 0, 60),
    ...shifts("OPP", [101, 102, 120], 0, 60),
    ...shifts("BUF", [1, 2, 20], 0, 30, 4), // OT
    ...shifts("OPP", [101, 102, 120], 0, 30, 4),
    ...shifts("BUF", [1, 2, 20], 0, 30, 5), // 2OT
    ...shifts("OPP", [101, 102, 120], 0, 30, 5),
  ];
  const { self, together } = pairSeconds("BUF", input, positions);
  const lines = analyzeGameLines("BUF", input, positions);
  assert.deepEqual(self.get(1), { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(together.get(1)?.get(2), { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(lines.playerSeconds.get(1), { ev: 120, pp: 0, sh: 0 });
});

test("a verbatim-duplicated shift row is counted once", () => {
  const row = shifts("BUF", [1, 2], 0, 60);
  const input = [...row, ...row, ...shifts("BUF", [20], 0, 60), ...shifts("OPP", [101, 102, 120], 0, 60)];
  const { self, together } = pairSeconds("BUF", input, positions);
  assert.deepEqual(self.get(1), { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(together.get(1)?.get(2), { ev: 60, pp: 0, sh: 0 });
});

test("a player's overlapping differing rows do not inflate the skater count, so 5v5 stays even strength", () => {
  // Skater 1 has two differing rows overlapping 30-60; counted raw that is 6 skaters + goalie, which would read as a power play.
  const input = [
    ...shifts("BUF", [1], 0, 60),
    ...shifts("BUF", [1], 30, 60),
    ...shifts("BUF", [2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
  ];
  const { self, together } = pairSeconds("BUF", input, positions);
  assert.deepEqual(self.get(1), { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(together.get(1)?.get(2), { ev: 60, pp: 0, sh: 0 });
});

test("an opponent's overlapping differing rows do not turn even strength into a short-handed second", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
    ...shifts("OPP", [101], 30, 60),
  ];
  const { self } = pairSeconds("BUF", input, positions);
  assert.deepEqual(self.get(1), { ev: 60, pp: 0, sh: 0 });
});

test("the goalie is in neither own seconds, time together nor groups", () => {
  const { self, together, groups } = pairSeconds("BUF", evPpSh, positions);
  assert.equal(self.has(20), false);
  assert.equal(groups.has(20), false);
  assert.equal(together.has(20), false);
  for (const byLinemate of together.values()) assert.equal(byLinemate.has(20), false);
});

test("six skaters with the goalie pulled against five skaters and a goalie count as even strength", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 4, 11, 12], 0, 30),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 30),
  ];
  const { self, together } = pairSeconds("BUF", input, positions);
  assert.deepEqual(self.get(1), { ev: 30, pp: 0, sh: 0 });
  assert.deepEqual(together.get(1)?.get(2), { ev: 30, pp: 0, sh: 0 });
});

test("shifts that only touch (one ends as the other starts) give no time together", () => {
  const input = [...shifts("BUF", [1], 0, 60), ...shifts("BUF", [2], 60, 120), ...shifts("OPP", [101], 0, 120)];
  const { self, together } = pairSeconds("BUF", input, positions);
  assert.equal(self.get(1)?.ev, 60);
  assert.equal(self.get(2)?.ev, 60);
  assert.equal(together.get(1)?.has(2) ?? false, false);
  assert.equal(together.get(2)?.has(1) ?? false, false);
});

test("groups maps forwards to F and defensemen to D", () => {
  const { groups } = pairSeconds("BUF", evPpSh, positions);
  assert.equal(groups.get(1), "F");
  assert.equal(groups.get(13), "D");
});

test("no shifts give empty maps", () => {
  const { self, together, groups } = pairSeconds("BUF", [], positions);
  assert.equal(self.size, 0);
  assert.equal(together.size, 0);
  assert.equal(groups.size, 0);
});
