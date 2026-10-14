import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LastGameLines } from "@/components/LastGameLines";
import { emptyCounts, type EventCounts, type GameEvents } from "./events";
import type { GameLines, Situation, Unit } from "./lines";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";
import { DEFAULT_SORT } from "./toi-trends";
import { buildUnitTable, DASH, exclusionsNote, statCells, UNIT_LEGEND, UNIT_LIMITS } from "./unit-events-view";

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
const richEvents = () =>
  mkEvents(
    { ev: counts({ gf: 3, ga: 2, sf: 12, sa: 8, cf: 25, ca: 15 }) },
    { ev: { F: { "1,2,3": counts({ gf: 2, ga: 1, sf: 10, sa: 6, cf: 20, ca: 12 }) } } },
  );

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
  const table = tablesOf(render(markupGame(richLines(), richEvents())))[0] ?? "";
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
  const evRow = (tables[0] ?? "").match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Alpha Center[\s\S]*?<\/tr>/)?.[0] ?? "";
  assert.deepEqual(
    [...evRow.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]).slice(-9),
    ["2", "1", "+1", "10", "6", "62.5", "20", "12", "62.5"],
  );
  assert.ok((tables[2] ?? "").includes("sit=pp"));
});

test("markup: no count, percentage or +/- is coloured green or red (D-10)", () => {
  const html = render(markupGame(richLines(), richEvents()));
  const classes = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1]);
  for (const c of classes) assert.ok(!/\b(green|emerald|red|rose)\b/.test(c.replace(/-/g, " ")), c);
});

test("markup: the None row spans 13 columns", () => {
  const html = render(markupGame(richLines(), richEvents()));
  assert.ok((tablesOf(html)[3] ?? "").includes('colSpan="13"'));
});

test("markup: with lines null no table renders", () => {
  const html = render(markupGame(null, null));
  assert.equal(tablesOf(html).length, 0);
  assert.ok(html.includes("No shift chart is available"));
});

// --- Other and Total ----------------------------------------------------------------------------------------------

const STAT_KEYS = ["gf", "ga", "sf", "sa", "cf", "ca"] as const;
const rowsOf = (table: string) => table.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
const cellsOf = (row: string) => [...row.matchAll(/<(?:td|th)\b[^>]*>[\s\S]*?<\/(?:td|th)>/g)].map((m) => m[0]);
const cellTexts = (row: string) => cellsOf(row).map(textOf);
const bodyRows = (table: string) => rowsOf(table).slice(2);
const rowLabelled = (table: string, label: string) => rowsOf(table).find((r) => cellTexts(r)[3] === label) ?? "";
const rowClasses = (row: string) => (row.match(/^<tr[^>]*class="([^"]*)"/)?.[1] ?? "").split(/\s+/);

test("Other and Total: time and pct come from seconds, Total is 100.0", () => {
  const lines = mkLines({ ev: 300, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 120, 300), unit([4, 5, 6], 90, 300)], D: [] } });
  const view = buildUnitTable(lines, mkEvents(), "ev", "F");
  assert.equal(view.other?.time, "1:30");
  assert.equal(view.other?.pct, "30.0");
  assert.equal(view.total?.time, "5:00");
  assert.equal(view.total?.pct, "100.0");
});

test("Other is the situation total minus the listed rows for every counter, so listed plus Other equals Total", () => {
  const a = counts({ gf: 1, ga: 0, sf: 4, sa: 2, cf: 7, ca: 3 });
  const b = counts({ gf: 0, ga: 1, sf: 2, sa: 5, cf: 3, ca: 8 });
  const total = counts({ gf: 3, ga: 2, sf: 9, sa: 9, cf: 15, ca: 16 });
  const lines = mkLines({ ev: 300, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 120, 300), unit([4, 5, 6], 90, 300)], D: [] } });
  const events = mkEvents({ ev: total }, { ev: { F: { "1,2,3": a, "4,5,6": b } } });
  const view = buildUnitTable(lines, events, "ev", "F");
  assert.deepEqual(view.other?.stats, statCells(counts({ gf: 2, ga: 1, sf: 3, sa: 2, cf: 5, ca: 5 })));
  assert.deepEqual(view.total?.stats, statCells(total));
  for (const k of STAT_KEYS) {
    const sum: number = Number(view.rows[0]?.stats[k]) + Number(view.rows[1]?.stats[k]) + Number(view.other?.stats[k]);
    assert.equal(sum, Number(view.total?.stats[k]), k);
  }
});

test("a unit below the cap folds into Other with its time and counts", () => {
  const units = Array.from({ length: 5 }, (_, i) => unit([10 + i, 20 + i, 30 + i], 60, 300));
  const lines = mkLines({ ev: 300, pp: 0, sh: 0 }, { ev: { F: units, D: [] } });
  const perUnit = Object.fromEntries(units.map((u) => [u.playerIds.join(","), counts({ gf: 1, cf: 2, sf: 1 })]));
  const view = buildUnitTable(lines, mkEvents({ ev: counts({ gf: 5, cf: 10, sf: 5 }) }, { ev: { F: perUnit } }), "ev", "F");
  assert.equal(view.rows.length, 4);
  assert.equal(view.other?.time, "1:00");
  assert.equal(view.other?.stats.gf, "1");
  assert.equal(view.other?.stats.cf, "2");
});

test("pulled-goalie and 4-on-4 events sit in the total only, so they land in Other", () => {
  const lines = mkLines({ ev: 100, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 60, 100)], D: [] } });
  const view = buildUnitTable(lines, mkEvents({ ev: counts({ gf: 1, cf: 3, sf: 2 }) }), "ev", "F");
  assert.equal(view.rows[0]?.stats.cf, "0");
  assert.equal(view.other?.stats.cf, "3");
  assert.equal(view.total?.stats.cf, "3");
});

test("events null: every stat cell in rows, Other and Total is a dash while their time and pct are real", () => {
  const lines = mkLines({ ev: 300, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 120, 300)], D: [] } });
  const view = buildUnitTable(lines, null, "ev", "F");
  assert.ok(view.other && view.total);
  for (const row of [...view.rows, view.other, view.total]) assert.deepEqual(Object.values(row.stats), Array(9).fill(DASH));
  assert.equal(view.other.time, "3:00");
  assert.equal(view.other.pct, "60.0");
  assert.equal(view.total.time, "5:00");
});

test("a situation with no time and no events has no Other or Total", () => {
  const lines = mkLines({ ev: 300, pp: 0, sh: 0 });
  for (const events of [mkEvents(), null]) {
    assert.deepEqual(buildUnitTable(lines, events, "pp", "F"), { rows: [], other: null, total: null });
  }
});

test("no listed unit but time in the situation: Other and Total still render", () => {
  const lines = mkLines({ ev: 0, pp: 45, sh: 0 });
  const view = buildUnitTable(lines, mkEvents({ pp: counts({ cf: 2, ca: 1, sf: 1 }) }), "pp", "D");
  assert.equal(view.rows.length, 0);
  assert.equal(view.other?.time, "0:45");
  assert.equal(view.other?.pct, "100.0");
  assert.equal(view.total?.stats.cf, "2");
});

test("events with no time still render Other and Total, with a dash percentage for Other", () => {
  const view = buildUnitTable(mkLines({ ev: 0, pp: 0, sh: 0 }), mkEvents({ ev: counts({ cf: 1 }) }), "ev", "F");
  assert.equal(view.other?.pct, DASH);
  assert.equal(view.total?.time, "0:00");
});

test("the F and D tables of one situation have identical Totals", () => {
  const lines = mkLines(
    { ev: 300, pp: 0, sh: 0 },
    { ev: { F: [unit([1, 2, 3], 120, 300)], D: [unit([11, 12], 100, 300), unit([13, 14], 50, 300)] } },
  );
  const events = mkEvents({ ev: counts({ gf: 1, sf: 3, cf: 6, ca: 2 }) });
  assert.deepEqual(buildUnitTable(lines, events, "ev", "F").total, buildUnitTable(lines, events, "ev", "D").total);
});

test("markup: Other row styling and label, Total row last with its rule and weight", () => {
  const table = tablesOf(render(markupGame(richLines(), richEvents())))[0] ?? "";
  const other = rowLabelled(table, "Other");
  const total = rowLabelled(table, "Total");
  for (const token of ["text-neutral-600", "dark:text-neutral-400", "border-b", "border-neutral-100", "dark:border-neutral-900"]) {
    assert.ok(rowClasses(other).includes(token), token);
  }
  for (const token of ["border-t", "border-neutral-300", "font-medium", "dark:border-neutral-700"]) assert.ok(rowClasses(total).includes(token), token);
  assert.equal(rowsOf(table).at(-1), total);
  assert.deepEqual(cellTexts(other).slice(0, 4), ["", "6:40", "66.7", "Other"]);
  assert.deepEqual(cellTexts(total).slice(0, 4), ["", "10:00", "100.0", "Total"]);
});

test("markup: exactly the GF, SF and CF cells carry border-l in every row", () => {
  const table = tablesOf(render(markupGame(richLines(), richEvents())))[0] ?? "";
  const rows = rowsOf(table).slice(1); // the group row is covered by the header test
  assert.equal(rows.length, 4); // column headers, one listed unit, Other, Total
  for (const row of rows) {
    const cells = cellsOf(row);
    assert.equal(cells.length, 13);
    cells.forEach((cell, i) => {
      const has = (cell.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/).includes("border-l");
      assert.equal(has, i === 4 || i === 7 || i === 10, `cell ${i} of ${row.slice(0, 60)}`);
    });
  }
});

test("markup: a situation with neither time nor events shows only the None row", () => {
  const lines = mkLines({ ev: 600, pp: 0, sh: 0 }, { ev: { F: [unit([1, 2, 3], 200, 600)], D: [] } });
  const pp = tablesOf(render(markupGame(lines, mkEvents())))[2] ?? "";
  assert.equal(bodyRows(pp).length, 1);
  assert.ok(pp.includes(">None<"));
  assert.ok(!pp.includes(">Other<") && !pp.includes(">Total<"));
});

test("markup: a None list with remaining time still shows Other and Total", () => {
  const shForwards = tablesOf(render(markupGame(richLines(), richEvents())))[4] ?? "";
  assert.ok(shForwards.includes(">None<"));
  assert.deepEqual(cellTexts(rowLabelled(shForwards, "Other")).slice(1, 4), ["1:30", "100.0", "Other"]);
  assert.deepEqual(cellTexts(rowLabelled(shForwards, "Total")).slice(1, 4), ["1:30", "100.0", "Total"]);
});

test("markup: with events null every stat cell in listed, Other and Total rows is a dash and Time and % are real", () => {
  const table = tablesOf(render(markupGame(richLines(), null)))[0] ?? "";
  assert.equal(bodyRows(table).length, 3);
  for (const row of bodyRows(table)) assert.deepEqual(cellTexts(row).slice(-9), Array(9).fill(DASH), row);
  assert.deepEqual(cellTexts(rowLabelled(table, "Other")).slice(1, 4), ["6:40", "66.7", "Other"]);
  assert.deepEqual(cellTexts(rowLabelled(table, "Total")).slice(1, 4), ["10:00", "100.0", "Total"]);
});

test("markup: the F and D tables of one situation print the same Total stats", () => {
  const tables = tablesOf(render(markupGame(richLines(), richEvents())));
  const stats = (table: string) => cellTexts(rowLabelled(table, "Total")).slice(4);
  assert.deepEqual(stats(tables[0] ?? ""), stats(tables[1] ?? ""));
});

// --- legend and exclusions note -----------------------------------------------------------------------------------

const excluded = (shootout: number, penaltyShot: number, teammateBlocked: number): GameEvents => ({
  ...mkEvents(),
  excluded: { shootout, penaltyShot, teammateBlocked },
});

test("exclusionsNote lists the non-zero kinds in order, plural by default", () => {
  assert.equal(
    exclusionsNote(excluded(2, 1, 3)),
    "Excluded from these tables: 2 shootout attempts, 1 penalty shot, 3 teammate-blocked attempts.",
  );
});

test("exclusionsNote uses the singular for 1 and omits zero kinds", () => {
  assert.equal(exclusionsNote(excluded(1, 0, 1)), "Excluded from these tables: 1 shootout attempt, 1 teammate-blocked attempt.");
  assert.equal(exclusionsNote(excluded(0, 2, 0)), "Excluded from these tables: 2 penalty shots.");
});

test("exclusionsNote is null when nothing was excluded or events are null", () => {
  assert.equal(exclusionsNote(excluded(0, 0, 0)), null);
  assert.equal(exclusionsNote(null), null);
});

test("UNIT_LEGEND is the three 03-UI-SPEC lines", () => {
  assert.equal(UNIT_LEGEND.length, 3);
  assert.ok(UNIT_LEGEND[0].startsWith("GF and GA are goals for and against."));
  assert.ok(UNIT_LEGEND[1].includes("not the NHL's official plus-minus"));
  assert.ok(UNIT_LEGEND[2].includes("all time and events while either goalie was pulled"));
  assert.ok(UNIT_LEGEND[2].includes("shootout attempts, penalty shots and teammate-blocked attempts are left out"));
});

const FOOTNOTES = '<div class="flex flex-col gap-1 text-xs text-neutral-500">';
const footnotesOf = (html: string) => html.split(FOOTNOTES)[1]?.split("</div>")[0] ?? "";
const paragraphs = (block: string) => [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/&#x27;/g, "'"));

test("markup: the footnotes block follows the tables with the exclusions note, then the three legend lines", () => {
  const html = render(markupGame(richLines(), { ...richEvents(), excluded: { shootout: 2, penaltyShot: 0, teammateBlocked: 1 } }));
  assert.ok(html.lastIndexOf("</table>") < html.indexOf(FOOTNOTES));
  assert.deepEqual(paragraphs(footnotesOf(html)), [
    "Excluded from these tables: 2 shootout attempts, 1 teammate-blocked attempt.",
    ...UNIT_LEGEND,
  ]);
});

test("markup: the legend renders without an exclusions note when nothing was excluded or events are null", () => {
  for (const events of [richEvents(), null]) {
    assert.deepEqual(paragraphs(footnotesOf(render(markupGame(richLines(), events)))), [...UNIT_LEGEND]);
  }
});

test("markup: with lines null no legend renders, only the no-shift-chart message", () => {
  const html = render(markupGame(null, null));
  assert.ok(!html.includes(FOOTNOTES));
  assert.ok(!html.includes("GF and GA are goals"));
});
