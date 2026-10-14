import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LastGameLines } from "@/components/LastGameLines";
import { emptyCounts, type EventCounts, type GameEvents } from "./events";
import type { GameLines, Situation, Unit } from "./lines";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";
import { DEFAULT_SORT } from "./toi-trends";
import { buildUnitTable, DASH, statCells, UNIT_LIMITS } from "./unit-events-view";

const counts = (c: Partial<EventCounts> = {}): EventCounts => ({ ...emptyCounts(), ...c });
const unit = (playerIds: number[], seconds: number, total: number): Unit => ({ playerIds, seconds, pct: (seconds / total) * 100 });

type Units = Record<Situation, { F: Unit[]; D: Unit[] }>;
const noUnits = (): Units => ({ ev: { F: [], D: [] }, pp: { F: [], D: [] }, sh: { F: [], D: [] } });
const mkLines = (situationSeconds: Record<Situation, number>, units: Partial<Units> = {}): GameLines => ({
  situationSeconds,
  units: { ...noUnits(), ...units },
  playerSeconds: new Map(),
});

function mkEvents(
  total: Partial<Record<Situation, EventCounts>> = {},
  byUnit: Partial<Record<Situation, { F?: Record<string, EventCounts>; D?: Record<string, EventCounts> }>> = {},
): GameEvents {
  const maps = (s: Situation) => ({
    F: new Map(Object.entries(byUnit[s]?.F ?? {})),
    D: new Map(Object.entries(byUnit[s]?.D ?? {})),
  });
  return {
    total: { ev: counts(), pp: counts(), sh: counts(), ...total },
    byUnit: { ev: maps("ev"), pp: maps("pp"), sh: maps("sh") },
    excluded: { shootout: 0, penaltyShot: 0, teammateBlocked: 0 },
    unattributed: 0,
    quality: { checked: 0, matched: 0 },
    chartSuspect: false,
  };
}

test("statCells(null) is a dash in all nine fields, never 0", () => {
  const s = statCells(null);
  assert.deepEqual(Object.values(s), Array(9).fill(DASH));
  assert.equal(DASH, "—");
});

test("statCells formats counts, shares to one decimal and a signed +/-", () => {
  assert.deepEqual(statCells(counts({ gf: 2, ga: 1, sf: 10, sa: 6, cf: 20, ca: 12 })), {
    gf: "2",
    ga: "1",
    plusMinus: "+1",
    sf: "10",
    sa: "6",
    sfPct: "62.5",
    cf: "20",
    ca: "12",
    cfPct: "62.5",
  });
});

test("statCells of a known zero: 0 counts, dash shares and dash +/- (D-20)", () => {
  assert.deepEqual(statCells(counts()), {
    gf: "0",
    ga: "0",
    plusMinus: DASH,
    sf: "0",
    sa: "0",
    sfPct: DASH,
    cf: "0",
    ca: "0",
    cfPct: DASH,
  });
});

test("statCells: +/- is 0 for attempts without goals, CF% 100.0 for attempts only for", () => {
  const s = statCells(counts({ cf: 1 }));
  assert.equal(s.plusMinus, "0");
  assert.equal(s.sfPct, DASH);
  assert.equal(s.cfPct, "100.0");
});

test("statCells: goals against only gives a U+2212 minus", () => {
  assert.equal(statCells(counts({ ga: 2, ca: 2, sa: 2 })).plusMinus, "−2");
});

test("buildUnitTable caps listed units by UNIT_LIMITS and keeps lines.units order", () => {
  const total = 1000;
  const evF = Array.from({ length: 6 }, (_, i) => unit([10 + i, 20 + i, 30 + i], 300 - i * 10, total));
  const lines = mkLines({ ev: total, pp: 0, sh: 0 }, { ev: { F: evF, D: [] } });
  const view = buildUnitTable(lines, mkEvents(), "ev", "F");
  assert.equal(UNIT_LIMITS.ev.F, 4);
  assert.deepEqual(
    view.rows.map((r) => r.playerIds),
    evF.slice(0, 4).map((u) => u.playerIds),
  );
  assert.equal(view.rows[0].time, "5:00");
  assert.equal(view.rows[0].pct, "30.0");
  assert.equal(view.rows[1].time, "4:50");
});

test("buildUnitTable: a listed unit with no byUnit entry shows 0 counts when events are known", () => {
  const lines = mkLines({ ev: 100, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 60, 100)], D: [] } });
  const [row] = buildUnitTable(lines, mkEvents(), "ev", "F").rows;
  assert.equal(row.stats.gf, "0");
  assert.equal(row.stats.cf, "0");
  assert.equal(row.stats.cfPct, DASH);
});

test("buildUnitTable reads counts by the unit's playerIds key", () => {
  const lines = mkLines({ ev: 100, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 60, 100)], D: [] } });
  const events = mkEvents({}, { ev: { F: { "1,2,3": counts({ gf: 1, sf: 3, sa: 1, cf: 5, ca: 2 }) } } });
  const [row] = buildUnitTable(lines, events, "ev", "F").rows;
  assert.equal(row.stats.gf, "1");
  assert.equal(row.stats.plusMinus, "+1");
  assert.equal(row.stats.sfPct, "75.0");
});

test("buildUnitTable with events null: every listed stat cell is a dash, time and pct stay real", () => {
  const lines = mkLines({ ev: 100, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 60, 100)], D: [] } });
  const [row] = buildUnitTable(lines, null, "ev", "F").rows;
  assert.deepEqual(Object.values(row.stats), Array(9).fill(DASH));
  assert.equal(row.time, "1:00");
  assert.equal(row.pct, "60.0");
});

// --- markup -------------------------------------------------------------------------------------------------------

const players = new Map<number, ResearchPlayer>([
  [1, { id: 1, name: "Alpha Center", position: "C", group: "F" }],
  [2, { id: 2, name: "Bravo Winger", position: "L", group: "F" }],
  [3, { id: 3, name: "Charlie Winger", position: "R", group: "F" }],
  [11, { id: 11, name: "Delta Defense", position: "D", group: "D" }],
  [12, { id: 12, name: "Echo Defense", position: "D", group: "D" }],
]);

function markupGame(lines: GameLines | null, events: GameEvents | null): ResearchGame {
  const toi = new Map<number, number>();
  return {
    id: 1,
    date: "2026-10-08",
    opponent: "BOS",
    home: true,
    score: { for: 3, against: 2 },
    toi,
    overtime: null,
    regulationToi: toi,
    lines,
    pairs: null,
    events,
  };
}

const render = (game: ResearchGame) =>
  renderToStaticMarkup(
    createElement(LastGameLines, {
      research: { players, games: [game], unavailableDates: [] } satisfies TeamResearch,
      team: "MTL",
      gameCount: 5,
      sort: DEFAULT_SORT,
      sit: "ev",
      selected: null,
    }),
  );

const tablesOf = (html: string) => html.match(/<table[\s\S]*?<\/table>/g) ?? [];
const textOf = (html: string) => html.replace(/<[^>]*>/g, "");
const colHeaders = (table: string) => [...table.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
const groupHeaders = (table: string) => [...table.matchAll(/<th[^>]*scope="colgroup"[^>]*>([^<]*)<\/th>/g)].map((m) => m[0]);

const richLines = () =>
  mkLines(
    { ev: 600, pp: 120, sh: 90 },
    {
      ev: { F: [unit([1, 2, 3], 200, 600)], D: [unit([11, 12], 180, 600)] },
      pp: { F: [unit([1, 2, 3], 60, 120)], D: [] },
    },
  );
const richEvents = () => mkEvents({}, { ev: { F: { "1,2,3": counts({ gf: 2, ga: 1, sf: 10, sa: 6, cf: 20, ca: 12 }) } } });

test("markup: six tables in situation-then-group order, stacked full width in overflow wrappers", () => {
  const html = render(markupGame(richLines(), richEvents()));
  const tables = tablesOf(html);
  assert.equal(tables.length, 6);
  assert.deepEqual(
    tables.map((t) => colHeaders(t)[3]),
    ["EV - Forwards", "EV - Defense", "PP - Forwards", "PP - Defense", "SH - Forwards", "SH - Defense"],
  );
  assert.ok(html.includes('<div class="flex flex-col gap-6">'));
  assert.equal(html.split('<div class="overflow-x-auto"><table').length - 1, 6);
  assert.ok(!html.includes("lg:grid-cols-2"));
});

test("markup: every table has Goals, Shots, Corsi group headers over 13 column headers in order", () => {
  const tables = tablesOf(render(markupGame(richLines(), richEvents())));
  for (const table of tables) {
    const groups = groupHeaders(table);
    assert.equal(groups.length, 3);
    assert.deepEqual(groups.map(textOf), ["Goals", "Shots", "Corsi"]);
    for (const g of groups) assert.ok(g.includes('colSpan="3"') || g.includes('colspan="3"'));
    const headers = colHeaders(table);
    assert.equal(headers.length, 13);
    assert.deepEqual([...headers.slice(0, 3), ...headers.slice(4)], ["#", "Time", "%", "GF", "GA", "+/-", "SF", "SA", "SF%", "CF", "CA", "CF%"]);
  }
});

test("markup: abbreviated headers carry a title", () => {
  const [table] = tablesOf(render(markupGame(richLines(), richEvents())));
  for (const title of [
    "Goals for",
    "Goals against",
    "Goals for minus goals against",
    "Shots on goal for",
    "Shots on goal against",
    "Share of shots on goal",
    "Shot attempts for",
    "Shot attempts against",
    "Share of shot attempts",
  ]) {
    assert.ok(table.includes(`title="${title}"`), title);
  }
});

test("markup: a listed unit prints its stats and a PP name links to the PP tab", () => {
  const tables = tablesOf(render(markupGame(richLines(), richEvents())));
  const evRow = tables[0].match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Alpha Center[\s\S]*?<\/tr>/)?.[0] ?? "";
  assert.deepEqual(
    [...evRow.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]).slice(-9),
    ["2", "1", "+1", "10", "6", "62.5", "20", "12", "62.5"],
  );
  assert.ok(tables[2].includes("sit=pp"));
});

test("markup: no count, percentage or +/- is coloured green or red (D-10)", () => {
  const html = render(markupGame(richLines(), richEvents()));
  const classes = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1]);
  for (const c of classes) assert.ok(!/\b(green|emerald|red|rose)\b/.test(c.replace(/-/g, " ")), c);
});

test("markup: the None row spans 13 columns", () => {
  const html = render(markupGame(richLines(), richEvents()));
  assert.ok(tablesOf(html)[3].includes('colSpan="13"') || tablesOf(html)[3].includes('colspan="13"'));
});

test("markup: with lines null no table renders", () => {
  const html = render(markupGame(null, null));
  assert.equal(tablesOf(html).length, 0);
  assert.ok(html.includes("No shift chart is available"));
});
