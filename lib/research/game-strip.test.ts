import { test } from "node:test";
import assert from "node:assert/strict";
import { detailText, gameDetail, stripCellState, stripOpacity, type StripGame } from "./game-strip";
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

const game = (over: Partial<StripGame> = {}): StripGame => ({
  id: 1,
  date: "2026-10-08",
  home: true,
  opponent: "TOR",
  score: { for: 3, against: 2 },
  overtime: null,
  ...over,
});
const full = (over: Partial<PerGameCell> = {}): PerGameCell => ({
  totalToi: 980,
  toi: 980,
  pp: 130,
  teamPp: 289,
  ppShare: 44.98,
  sh: 45,
  ...over,
});
const text = (c: PerGameCell | null, g: StripGame) => detailText(gameDetail(c, g));

test("detailText for a regulation game lists TOI, PP with share of team PP, and SH", () => {
  assert.equal(text(full(), game()), "Oct 8 vs TOR · W 3–2 · TOI 16:20 · PP 2:10 (45% of team PP) · SH 0:45");
});

test("detailText for an OT game tags it and shows the excluded OT minutes", () => {
  const c = full({ totalToi: 1045 });
  assert.equal(
    text(c, game({ overtime: "OT" })),
    "Oct 8 vs TOR · W 3–2 · OT · TOI 16:20 · OT excluded +1:05 · PP 2:10 (45% of team PP) · SH 0:45",
  );
  assert.ok(text(c, game({ overtime: "SO" })).includes(" · SO · "));
});

test("detailText for an OT game with no shift data says it is excluded and shows the total", () => {
  const c: PerGameCell = { totalToi: 1265, toi: null, pp: null, teamPp: 0, ppShare: null, sh: null };
  const g = game({ date: "2026-10-03", home: false, opponent: "BOS", score: { for: 2, against: 3 }, overtime: "OT" });
  assert.equal(
    text(c, g),
    "Oct 3 @ BOS · L 2–3 · OT · TOI — · Total (incl. OT) 21:05 · PP — · SH — · Excluded from averages: no shift data for overtime · No PP/SH data (shift chart not published)",
  );
});

test("detailText for a regulation game with no shift chart shows dashes for PP and SH", () => {
  const c = full({ totalToi: 900, toi: 900, pp: null, sh: null, teamPp: 0, ppShare: null });
  assert.equal(text(c, game()), "Oct 8 vs TOR · W 3–2 · TOI 15:00 · PP — · SH — · No PP/SH data (shift chart not published)");
});

test("detailText shows plain PP time when the team had no power play", () => {
  const out = text(full({ pp: 0, teamPp: 0, ppShare: null, sh: 30 }), game());
  assert.ok(out.includes("PP 0:00 · SH 0:30"));
  assert.ok(!out.includes("%"));
});

test("detailText for a missed game says Did not play and never shows 0:00", () => {
  const out = text(null, game());
  assert.equal(out, "Oct 8 vs TOR · W 3–2 · Did not play");
  assert.ok(!out.includes("0:00"));
});

test("the title has no result when the score is unknown", () => {
  assert.equal(gameDetail(null, game({ score: null })).title, "Oct 8 vs TOR");
});

test("gameDetail exposes the period tag and flags the OT excluded row as muted", () => {
  assert.equal(gameDetail(full(), game()).periodTag, null);
  assert.equal(gameDetail(full(), game({ overtime: "OT" })).periodTag, "OT");
  assert.equal(gameDetail(full(), game({ overtime: "SO" })).periodTag, "SO");
  const rows = gameDetail(full({ totalToi: 1045 }), game({ overtime: "OT" })).rows;
  assert.equal(rows.find((r) => r.label === "OT excluded")?.muted, true);
  assert.ok(!gameDetail(full(), game()).rows.some((r) => r.label === "OT excluded"));
});
