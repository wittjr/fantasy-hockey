import { test } from "node:test";
import assert from "node:assert/strict";
import { stripCellState, stripOpacity } from "./game-strip";
import type { PerGameCell } from "./toi-trends";

const AVG = 1000;
const cell = (toi: number | null): PerGameCell => ({ totalToi: 1000, toi, pp: null, teamPp: 0, ppShare: null, sh: null });

test("stripOpacity is 0.6 at the player's own average", () => {
  assert.ok(Math.abs(stripOpacity(AVG, AVG) - 0.6) < 1e-9);
});

test("stripOpacity saturates at +/-2:00 around the average", () => {
  assert.equal(stripOpacity(AVG + 120, AVG), 1);
  assert.equal(stripOpacity(AVG - 120, AVG), 0.2);
});

test("stripOpacity is linear between the extremes", () => {
  assert.ok(Math.abs(stripOpacity(AVG + 60, AVG) - 0.8) < 1e-9);
  assert.ok(Math.abs(stripOpacity(AVG - 60, AVG) - 0.4) < 1e-9);
});

test("stripOpacity is clamped beyond the range", () => {
  assert.equal(stripOpacity(AVG + 600, AVG), 1);
  assert.equal(stripOpacity(AVG - 600, AVG), 0.2);
});

test("stripCellState: null is dnp, null toi is excluded, numeric toi is played", () => {
  assert.equal(stripCellState(null), "dnp");
  assert.equal(stripCellState(cell(null)), "excluded");
  assert.equal(stripCellState(cell(900)), "played");
  assert.equal(stripCellState(cell(0)), "played");
});
