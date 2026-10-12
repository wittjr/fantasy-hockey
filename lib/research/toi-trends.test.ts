import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTrendRows,
  DEFAULT_SORT,
  deltaCrossing,
  effectiveSort,
  moverDirection,
  nextSort,
  parsePlayer,
  parseSit,
  parseSort,
  recentDelta,
  researchHref,
  slopeDirection,
  sortRows,
  SORT_KEYS,
  type SortKey,
  type TrendGame,
  type TrendRow,
} from "./toi-trends";
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

test("deltaCrossing compares the rounded magnitude with the threshold, inclusive", () => {
  assert.equal(deltaCrossing(120, 120), 1);
  assert.equal(deltaCrossing(119.4, 120), 0);
  assert.equal(deltaCrossing(119.5, 120), 1);
  assert.equal(deltaCrossing(-120, 120), -1);
  assert.equal(deltaCrossing(null, 120), 0);
  assert.equal(deltaCrossing(15, 15), 1);
  assert.equal(deltaCrossing(14.4, 15), 0);
  assert.equal(deltaCrossing(-14.5, 15), -1);
});

test("moverDirection follows the crossing deltas and ignores mixed signs", () => {
  assert.equal(moverDirection(150, null), "up");
  assert.equal(moverDirection(130, 10), "up");
  assert.equal(moverDirection(150, 20), "up");
  assert.equal(moverDirection(-130, -16), "down");
  assert.equal(moverDirection(150, -20), null);
  assert.equal(moverDirection(100, 10), null);
  assert.equal(moverDirection(null, null), null);
});

test("a player absent from the team's last 2 games in a 5-game window is dnpLast2 with no deltas or mover", () => {
  const games = [1000, 1000, 1000, 0, 0].map((t, i) => (i < 3 ? game({ 1: t, 2: 900 }) : game({ 2: 900 })));
  const row = buildTrendRows([player(1, "F")], games)[0];
  assert.equal(row.dnpLast2, true);
  assert.equal(row.toiDelta, null);
  assert.equal(row.ppShareDelta, null);
  assert.equal(row.mover, null);
});

test("missing only the latest game, or playing in a window of 2, is not dnpLast2", () => {
  const missedLast = buildTrendRows([player(1, "F")], [game({ 1: 900 }), game({ 1: 900 }), game({ 1: 900 }), game({ 1: 900 }), game({ 2: 900 })]);
  assert.equal(missedLast[0].dnpLast2, false);
  const short = buildTrendRows([player(1, "F")], [game({ 1: 900 }), game({ 2: 900 })]);
  assert.equal(short[0].dnpLast2, false);
  assert.deepEqual(buildTrendRows([player(1, "F")], [game({ 2: 900 }), game({ 2: 900 })]), []);
});

test("buildTrendRows marks an up mover and leaves a flat player unmarked", () => {
  const games = [1000, 1000, 1000, 1200, 1200].map((t) => game({ 1: t, 2: 1000 }));
  const rows = buildTrendRows([player(1, "F"), player(2, "F")], games);
  assert.equal(rows.find((r) => r.player.id === 1)?.mover, "up");
  assert.equal(rows.find((r) => r.player.id === 2)?.mover, null);
});

test("parseSort defaults when params are missing", () => {
  assert.deepEqual(parseSort(undefined, undefined), { key: "avgToi", dir: "desc" });
});

test("parseSort accepts an allowlisted key and exactly asc", () => {
  assert.deepEqual(parseSort("toiDelta", "asc"), { key: "toiDelta", dir: "asc" });
  assert.deepEqual(parseSort("ppDelta", "desc"), { key: "ppDelta", dir: "desc" });
});

test("parseSort treats an unknown dir as desc", () => {
  assert.deepEqual(parseSort("ppShare", "bogus"), { key: "ppShare", dir: "desc" });
  assert.deepEqual(parseSort("toiDelta", ["asc"]), { key: "toiDelta", dir: "desc" });
});

test("parseSort falls back to the default for an unknown or array key", () => {
  assert.deepEqual(parseSort("evil", "asc"), DEFAULT_SORT);
  assert.deepEqual(parseSort(["toiDelta", "ppDelta"], "asc"), DEFAULT_SORT);
  assert.deepEqual(parseSort("__proto__", "asc"), DEFAULT_SORT);
});

test("SORT_KEYS holds the four sortable columns", () => {
  assert.deepEqual([...SORT_KEYS], ["avgToi", "toiDelta", "ppShare", "ppDelta"]);
});

test("nextSort starts a new key descending and flips the active key", () => {
  assert.deepEqual(nextSort({ key: "avgToi", dir: "desc" }, "toiDelta"), { key: "toiDelta", dir: "desc" });
  assert.deepEqual(nextSort({ key: "toiDelta", dir: "desc" }, "toiDelta"), { key: "toiDelta", dir: "asc" });
  assert.deepEqual(nextSort({ key: "toiDelta", dir: "asc" }, "toiDelta"), { key: "toiDelta", dir: "desc" });
  assert.deepEqual(nextSort({ key: "toiDelta", dir: "asc" }, "avgToi"), { key: "avgToi", dir: "desc" });
});

test("researchHref omits sort and dir for the default and dir for desc", () => {
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT), "/research?team=MTL&games=10");
  assert.equal(researchHref("MTL", 10, { key: "toiDelta", dir: "asc" }), "/research?team=MTL&games=10&sort=toiDelta&dir=asc");
  assert.equal(researchHref("MTL", 10, { key: "ppShare", dir: "desc" }), "/research?team=MTL&games=10&sort=ppShare");
  assert.equal(researchHref("MTL", 10, { key: "avgToi", dir: "asc" }), "/research?team=MTL&games=10&sort=avgToi&dir=asc");
});

test("parsePlayer accepts a single string of 1-10 digits", () => {
  assert.equal(parsePlayer("8478402"), 8478402);
  assert.equal(parsePlayer("007"), 7);
});

test("parsePlayer rejects everything else", () => {
  for (const bad of ["", "abc", "-1", "1.5", " 12", "12345678901", "__proto__", ["1"], undefined, 12]) {
    assert.equal(parsePlayer(bad), null, String(bad));
  }
});

test("parseSit passes pp and sh through and treats anything else as ev", () => {
  assert.equal(parseSit("pp"), "pp");
  assert.equal(parseSit("sh"), "sh");
  for (const other of ["ev", "PP", "bogus", ["pp"], undefined, "__proto__"]) assert.equal(parseSit(other), "ev", String(other));
});

test("researchHref appends player, sit and all only when set to a non-default value", () => {
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT), "/research?team=MTL&games=10");
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT, { player: 8478402 }), "/research?team=MTL&games=10&player=8478402");
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT, { sit: "ev" }), "/research?team=MTL&games=10");
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT, { player: null }), "/research?team=MTL&games=10");
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT, { all: false }), "/research?team=MTL&games=10");
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT, { sit: "pp" }), "/research?team=MTL&games=10&sit=pp");
  assert.equal(researchHref("MTL", 10, DEFAULT_SORT, { all: true }), "/research?team=MTL&games=10&all=1");
});

test("researchHref puts the player extras after sort and dir", () => {
  assert.equal(
    researchHref("MTL", 10, { key: "toiDelta", dir: "asc" }, { player: 1, sit: "sh", all: true }),
    "/research?team=MTL&games=10&sort=toiDelta&dir=asc&player=1&sit=sh&all=1",
  );
});

function sortRow(id: number, group: "F" | "D", v: Partial<Pick<TrendRow, "avgToi" | "ppShare" | "toiDelta" | "ppShareDelta">>, name = `P${id}`): TrendRow {
  return {
    player: player(id, group, name),
    perGame: [],
    gamesPlayed: 5,
    includedGames: 5,
    avgToi: null,
    ppShare: null,
    shAvg: null,
    toiSlope: null,
    ppShareSlope: null,
    toiDelta: null,
    ppShareDelta: null,
    dnpLast2: false,
    mover: null,
    ...v,
  };
}
const ids = (rows: TrendRow[]) => rows.map((r) => r.player.id);

test("sortRows keeps every forward before every defenseman for each key and direction", () => {
  const rows = [
    sortRow(1, "D", { avgToi: 1500, ppShare: 90, toiDelta: 300, ppShareDelta: 30 }),
    sortRow(2, "F", { avgToi: 600, ppShare: 5, toiDelta: -300, ppShareDelta: -30 }),
    sortRow(3, "D", { avgToi: 1400, ppShare: 80, toiDelta: 200, ppShareDelta: 20 }),
    sortRow(4, "F", { avgToi: 700, ppShare: 6, toiDelta: -200, ppShareDelta: -20 }),
  ];
  for (const key of SORT_KEYS as readonly SortKey[]) {
    for (const dir of ["asc", "desc"] as const) {
      const out = sortRows(rows, { key, dir });
      assert.deepEqual(out.map((r) => r.player.group), ["F", "F", "D", "D"], `${key} ${dir}`);
    }
  }
});

test("sortRows by toiDelta desc puts the biggest riser first and asc the biggest faller", () => {
  const rows = [
    sortRow(1, "F", { toiDelta: 30 }),
    sortRow(2, "F", { toiDelta: 200 }),
    sortRow(3, "F", { toiDelta: -150 }),
  ];
  assert.deepEqual(ids(sortRows(rows, { key: "toiDelta", dir: "desc" })), [2, 1, 3]);
  assert.deepEqual(ids(sortRows(rows, { key: "toiDelta", dir: "asc" })), [3, 1, 2]);
});

test("sortRows ppDelta reads ppShareDelta and ppShare reads ppShare", () => {
  const rows = [
    sortRow(1, "F", { ppShare: 10, ppShareDelta: 40 }),
    sortRow(2, "F", { ppShare: 70, ppShareDelta: -5 }),
  ];
  assert.deepEqual(ids(sortRows(rows, { key: "ppDelta", dir: "desc" })), [1, 2]);
  assert.deepEqual(ids(sortRows(rows, { key: "ppShare", dir: "desc" })), [2, 1]);
});

test("sortRows sinks null values to the bottom of their group in both directions", () => {
  const rows = [
    sortRow(1, "F", { toiDelta: null, avgToi: 1200 }),
    sortRow(2, "F", { toiDelta: 10 }),
    sortRow(3, "D", { toiDelta: null, avgToi: 1300 }),
    sortRow(4, "D", { toiDelta: -10 }),
    sortRow(5, "F", { toiDelta: -20 }),
  ];
  assert.deepEqual(ids(sortRows(rows, { key: "toiDelta", dir: "desc" })), [2, 5, 1, 4, 3]);
  assert.deepEqual(ids(sortRows(rows, { key: "toiDelta", dir: "asc" })), [5, 2, 1, 4, 3]);
});

test("sortRows keeps equal-value rows separate and breaks ties by avgToi desc, then name, then id", () => {
  const rows = [
    sortRow(9, "F", { toiDelta: 60, avgToi: 900 }, "Zed"),
    sortRow(8, "F", { toiDelta: 60, avgToi: 1000 }, "Mid"),
    sortRow(7, "F", { toiDelta: 60, avgToi: 900 }, "Abe"),
    sortRow(5, "F", { toiDelta: 60, avgToi: 900 }, "Abe"),
  ];
  const out = sortRows(rows, { key: "toiDelta", dir: "desc" });
  assert.equal(out.length, 4);
  assert.deepEqual(ids(out), [8, 5, 7, 9]);
  assert.deepEqual(ids(sortRows(rows, { key: "toiDelta", dir: "asc" })), [8, 5, 7, 9]);
});

test("sortRows is deterministic whatever the input order", () => {
  const rows = [
    sortRow(1, "F", { toiDelta: 60, avgToi: 900 }, "B"),
    sortRow(2, "F", { toiDelta: 60, avgToi: 900 }, "A"),
    sortRow(3, "D", { toiDelta: 10, avgToi: 1200 }, "C"),
    sortRow(4, "F", { toiDelta: null }, "D"),
  ];
  const spec = { key: "toiDelta", dir: "desc" } as const;
  assert.deepEqual(ids(sortRows([...rows].reverse(), spec)), ids(sortRows(rows, spec)));
});

test("sortRows handles an empty list and a single row without mutating its input", () => {
  assert.deepEqual(sortRows([], DEFAULT_SORT), []);
  const one = sortRow(1, "F", { avgToi: 900 });
  assert.deepEqual(sortRows([one], { key: "ppDelta", dir: "asc" }), [one]);
  const input = [sortRow(1, "F", { avgToi: 900 }), sortRow(2, "F", { avgToi: 1000 })];
  const before = ids(input);
  const out = sortRows(input, DEFAULT_SORT);
  assert.deepEqual(ids(input), before);
  assert.notEqual(out, input);
});

test("buildTrendRows orders by the default sort: forwards then defense, Avg TOI descending", () => {
  const rows = buildTrendRows(
    [player(1, "F"), player(2, "D"), player(3, "F")],
    [game({ 1: 800, 2: 1500, 3: 1100 })],
  );
  assert.deepEqual(ids(rows), [3, 1, 2]);
});

test("effectiveSort falls back to the default for a delta sort in a 1-game window", () => {
  assert.deepEqual(effectiveSort({ key: "toiDelta", dir: "asc" }, 1), DEFAULT_SORT);
  assert.deepEqual(effectiveSort({ key: "ppDelta", dir: "desc" }, 1), DEFAULT_SORT);
});

test("effectiveSort leaves other sorts and larger windows unchanged", () => {
  assert.deepEqual(effectiveSort({ key: "ppShare", dir: "asc" }, 1), { key: "ppShare", dir: "asc" });
  assert.deepEqual(effectiveSort({ key: "avgToi", dir: "asc" }, 1), { key: "avgToi", dir: "asc" });
  assert.deepEqual(effectiveSort({ key: "toiDelta", dir: "asc" }, 5), { key: "toiDelta", dir: "asc" });
});
