import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrendRows, recentDelta, slopeDirection, type TrendGame } from "./toi-trends";
import { formatSignedClock, formatSignedPoints } from "./format";
import type { ResearchPlayer } from "./team-games";

const player = (id: number, group: "F" | "D" | "G", name = `P${id}`): ResearchPlayer => ({
  id,
  name,
  position: group === "D" ? "D" : group === "G" ? "G" : "C",
  group,
});

type Secs = Record<"ev" | "pp" | "sh", number>;

/** A game with a shift chart: teamPp is the team's PP seconds, `secs` each player's situation seconds. */
function game(toi: Record<number, number>, opts: { reg?: Record<number, number> | null; teamPp?: number; secs?: Record<number, Partial<Secs>> | null } = {}): TrendGame {
  const toiMap = new Map(Object.entries(toi).map(([id, t]) => [Number(id), t]));
  const reg = opts.reg === undefined ? toiMap : opts.reg === null ? null : new Map(Object.entries(opts.reg).map(([id, t]) => [Number(id), t]));
  const secs = opts.secs === undefined ? {} : opts.secs;
  return {
    toi: toiMap,
    regulationToi: reg,
    lines:
      secs === null
        ? null
        : {
            situationSeconds: { ev: 0, pp: opts.teamPp ?? 0, sh: 0 },
            playerSeconds: new Map(Object.entries(secs).map(([id, s]) => [Number(id), { ev: 0, pp: 0, sh: 0, ...s }])),
          },
  };
}

const noChart = (toi: Record<number, number>, reg?: Record<number, number> | null) => game(toi, { reg, secs: null });

test("a missed game is null, not 0, and does not pull down the average", () => {
  const [row] = buildTrendRows([player(1, "F")], [game({ 1: 1000 }), game({ 2: 900 }), game({ 1: 1200 })]);
  assert.equal(row.perGame[1], null);
  assert.equal(row.gamesPlayed, 2);
  assert.equal(row.avgToi, 1100);
});

test("an OT game with shifts uses regulation TOI for the average", () => {
  const [row] = buildTrendRows([player(1, "F")], [game({ 1: 1300 }, { reg: { 1: 1200 } })]);
  assert.equal(row.perGame[0]?.totalToi, 1300);
  assert.equal(row.perGame[0]?.toi, 1200);
  assert.equal(row.avgToi, 1200);
});

test("an OT game with no shift data is counted as played but excluded from the average", () => {
  const [row] = buildTrendRows([player(1, "F")], [noChart({ 1: 1000 }), noChart({ 1: 1500 }, null)]);
  assert.equal(row.perGame[1]?.toi, null);
  assert.equal(row.perGame[1]?.pp, null);
  assert.equal(row.gamesPlayed, 2);
  assert.equal(row.includedGames, 1);
  assert.equal(row.avgToi, 1000);
});

test("a player whose only game is an excluded OT game still gets a row with null avgToi", () => {
  const [row] = buildTrendRows([player(1, "F")], [noChart({ 1: 1500 }, null)]);
  assert.equal(row.gamesPlayed, 1);
  assert.equal(row.includedGames, 0);
  assert.equal(row.avgToi, null);
  assert.equal(row.toiSlope, null);
});

test("a regulation game without a shift chart counts toward avgToi but not PP share or SH", () => {
  const [row] = buildTrendRows(
    [player(1, "F")],
    [noChart({ 1: 1000 }), game({ 1: 1200 }, { teamPp: 100, secs: { 1: { pp: 50, sh: 30 } } })],
  );
  assert.equal(row.perGame[0]?.toi, 1000);
  assert.equal(row.perGame[0]?.pp, null);
  assert.equal(row.perGame[0]?.ppShare, null);
  assert.equal(row.perGame[0]?.sh, null);
  assert.equal(row.avgToi, 1100);
  assert.equal(row.ppShare, 50);
  assert.equal(row.shAvg, 30);
});

test("PP share is pooled across games, weighting by team PP time", () => {
  const [row] = buildTrendRows(
    [player(1, "F")],
    [game({ 1: 1000 }, { teamPp: 120, secs: { 1: { pp: 60 } } }), game({ 1: 1000 }, { teamPp: 240, secs: { 1: { pp: 0 } } })],
  );
  assert.ok(row.ppShare !== null && Math.abs(row.ppShare - 16.6667) < 0.001);
});

test("a game with no team PP time has a null ppShare cell and is excluded from PP share", () => {
  const [row] = buildTrendRows(
    [player(1, "F")],
    [game({ 1: 1000 }, { teamPp: 0, secs: { 1: {} } }), game({ 1: 1000 }, { teamPp: 100, secs: { 1: { pp: 40 } } })],
  );
  assert.equal(row.perGame[0]?.ppShare, null);
  assert.equal(row.ppShare, 40);
});

test("PP time is 0, not null, when the chart exists but the player has no playerSeconds entry", () => {
  const [row] = buildTrendRows([player(1, "F")], [game({ 1: 1000 }, { teamPp: 100, secs: {} })]);
  assert.equal(row.perGame[0]?.pp, 0);
  assert.equal(row.perGame[0]?.sh, 0);
  assert.equal(row.ppShare, 0);
});

test("a row with no PP data anywhere has null ppShare and shAvg, not 0", () => {
  const [row] = buildTrendRows([player(1, "F")], [noChart({ 1: 1000 })]);
  assert.equal(row.ppShare, null);
  assert.equal(row.shAvg, null);
});

test("excludes goalies and orders forwards before defense, then by avgToi descending, null last", () => {
  const players = [
    player(1, "D", "D-low"),
    player(2, "F", "F-low"),
    player(3, "G"),
    player(4, "F", "F-high"),
    player(5, "D", "D-high"),
    player(6, "F", "F-null"),
  ];
  const games = [
    game({ 1: 900, 2: 800, 3: 3600, 4: 1100, 5: 1300 }),
    noChart({ 6: 1500 }, null),
  ];
  const rows = buildTrendRows(players, games);
  assert.deepEqual(
    rows.map((r) => r.player.name),
    ["F-high", "F-low", "F-null", "D-high", "D-low"],
  );
});

test("toiSlope is positive for rising regulation TOI and null with one included game", () => {
  const rising = buildTrendRows([player(1, "F")], [game({ 1: 900 }), game({ 1: 1000 }), game({ 1: 1100 })]);
  assert.ok(rising[0].toiSlope !== null && rising[0].toiSlope > 0);
  const single = buildTrendRows([player(1, "F")], [game({ 1: 900 })]);
  assert.equal(single[0].toiSlope, null);
});

test("empty players or empty games give no rows", () => {
  assert.deepEqual(buildTrendRows([], [game({ 1: 900 })]), []);
  assert.deepEqual(buildTrendRows([player(1, "F")], []), []);
});

test("recentDelta compares the team's last 2 games with the earlier games", () => {
  const pts = [100, 100, 100, 200, 200].map((y, x) => ({ x, y }));
  assert.equal(recentDelta(pts, 5, 5), 100);
});

test("recentDelta uses only the recent games the player played", () => {
  const pts = [{ x: 0, y: 100 }, { x: 1, y: 100 }, { x: 2, y: 100 }, { x: 4, y: 220 }];
  assert.equal(recentDelta(pts, 5, 4), 120);
});

test("recentDelta needs 3 included games: 3 shows a delta, 2 does not", () => {
  assert.equal(recentDelta([{ x: 0, y: 100 }, { x: 3, y: 200 }, { x: 4, y: 200 }], 5, 3), 100);
  assert.equal(recentDelta([{ x: 3, y: 100 }, { x: 4, y: 200 }], 5, 2), null);
});

test("recentDelta is null when either part has no included game", () => {
  assert.equal(recentDelta([{ x: 0, y: 100 }, { x: 1, y: 100 }, { x: 2, y: 100 }], 5, 3), null);
  assert.equal(recentDelta([{ x: 3, y: 100 }, { x: 4, y: 100 }, { x: 4, y: 100 }], 5, 3), null);
});

test("recentDelta is null in a window of 2 or 1 because the earlier part is empty", () => {
  assert.equal(recentDelta([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }], 2, 3), null);
  assert.equal(recentDelta([{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }], 1, 3), null);
});

test("recentDelta weights each part by w so PP share matches the pooled share", () => {
  const pts = [
    { x: 0, y: 10, w: 200 },
    { x: 1, y: 10, w: 200 },
    { x: 2, y: 10, w: 200 },
    { x: 3, y: 50, w: 100 },
    { x: 4, y: 20, w: 300 },
  ];
  const d = recentDelta(pts, 5, 5);
  assert.ok(d !== null && Math.abs(d - 17.5) < 1e-9, String(d));
});

test("slopeDirection is inclusive of the threshold and null below it or without a slope", () => {
  assert.equal(slopeDirection(15, 15), "up");
  assert.equal(slopeDirection(14.9, 15), null);
  assert.equal(slopeDirection(-15, 15), "down");
  assert.equal(slopeDirection(null, 15), null);
  assert.equal(slopeDirection(3, 3), "up");
  assert.equal(slopeDirection(2.9, 3), null);
});

test("formatSignedClock signs by rounded magnitude and shows zero unsigned", () => {
  assert.equal(formatSignedClock(72), "+1:12");
  assert.equal(formatSignedClock(-48), "\u22120:48");
  assert.equal(formatSignedClock(0.4), "0:00");
  assert.equal(formatSignedClock(-0.4), "0:00");
  assert.equal(formatSignedClock(119.6), "+2:00");
  assert.equal(formatSignedClock(-119.5), "\u22122:00");
});

test("formatSignedPoints signs by rounded magnitude and shows zero unsigned", () => {
  assert.equal(formatSignedPoints(18.2), "+18");
  assert.equal(formatSignedPoints(-6.5), "\u22127");
  assert.equal(formatSignedPoints(0.3), "0");
  assert.equal(formatSignedPoints(14.5), "+15");
});

test("buildTrendRows sets toiDelta and ppShareDelta for a 5-game window", () => {
  const tois = [1000, 1000, 1000, 1100, 1100];
  const pps = [10, 10, 10, 50, 20];
  const teamPp = [200, 200, 200, 100, 300];
  const games = tois.map((t, i) => game({ 1: t }, { teamPp: teamPp[i], secs: { 1: { pp: (pps[i] / 100) * teamPp[i] } } }));
  const [row] = buildTrendRows([player(1, "F")], games);
  assert.equal(row.toiDelta, 100);
  assert.ok(row.ppShareDelta !== null && Math.abs(row.ppShareDelta - 17.5) < 1e-9, String(row.ppShareDelta));
});

test("a player with 2 included games has no deltas", () => {
  const [row] = buildTrendRows([player(1, "F")], [game({ 2: 900 }), game({ 1: 900 }), game({ 1: 1100 })]);
  assert.equal(row.includedGames, 2);
  assert.equal(row.toiDelta, null);
  assert.equal(row.ppShareDelta, null);
});
