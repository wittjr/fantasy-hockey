import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LastGameLines } from "@/components/LastGameLines";
import { ToiTrends } from "@/components/ToiTrends";
import type { Situation, Unit } from "./lines";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";
import { DEFAULT_SORT, researchHref, type SortSpec } from "./toi-trends";

const players = new Map<number, ResearchPlayer>([
  [1, { id: 1, name: "Alpha Forward", position: "C", group: "F" }],
  [2, { id: 2, name: "Bravo Forward", position: "L", group: "F" }],
  [3, { id: 3, name: "Charlie Defense", position: "D", group: "D" }],
]);

function fixtureGame(date: string, toi: Record<number, number>): ResearchGame {
  const toiMap = new Map(Object.entries(toi).map(([id, t]) => [Number(id), t]));
  return {
    id: Number(date.replaceAll("-", "")),
    date,
    opponent: "BOS",
    home: true,
    score: { for: 3, against: 2 },
    toi: toiMap,
    overtime: null,
    regulationToi: toiMap,
    lines: {
      situationSeconds: { ev: 3000, pp: 120, sh: 60 },
      units: { ev: { F: [], D: [] }, pp: { F: [], D: [] }, sh: { F: [], D: [] } },
      playerSeconds: new Map([[1, { ev: 1000, pp: 60, sh: 10 }]]),
    },
    pairs: null,
    events: null,
  };
}

const research = (games: ResearchGame[]): TeamResearch => ({ players, games, unavailableDates: [] });
const threeGames = () => [
  fixtureGame("2026-10-01", { 1: 1200, 2: 900, 3: 1300 }),
  fixtureGame("2026-10-03", { 1: 1250, 2: 950, 3: 1350 }),
  fixtureGame("2026-10-05", { 1: 1300, 2: 1000, 3: 1400 }),
];

interface TrendProps {
  selected?: number | null;
  sit?: Situation;
  all?: boolean;
  sort?: SortSpec;
  gameCount?: number;
}
const renderTrends = (r: TeamResearch, p: TrendProps = {}) =>
  renderToStaticMarkup(
    createElement(ToiTrends, { research: r, sort: p.sort ?? DEFAULT_SORT, team: "MTL", gameCount: p.gameCount ?? 5, selected: p.selected, sit: p.sit, all: p.all }),
  );

const classTokens = (tag: string) => (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]?.replaceAll("&amp;", "&");
const rowHtml = (html: string, name: string) =>
  [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((m) => m[0]).find((r) => r.includes(name)) ?? "";
const tds = (row: string) => [...row.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);
const openTag = (cell: string) => cell.match(/^<[a-z]+\b[^>]*>/)?.[0] ?? "";
const nameCell = (html: string, name: string) => tds(rowHtml(html, name))[0];
const nameAnchor = (html: string, name: string) => nameCell(html, name).match(/<a\b[^>]*>/)?.[0] ?? "";
const headerCell = (html: string, label: string) =>
  [...html.matchAll(/<th\b[^>]*>[\s\S]*?<\/th>/g)].map((m) => m[0]).find((h) => h.replace(/<[^>]*>/g, "").trim().startsWith(label)) ?? "";
const BAR = ["shadow-[inset_4px_0_0_0]", "shadow-neutral-900", "dark:shadow-neutral-100"];

test("the selected row's name cell has the neutral bar, a Selected note, and a font-medium #player-detail anchor", () => {
  const html = renderTrends(research(threeGames()), { selected: 1, sit: "ev" });
  const cell = nameCell(html, "Alpha Forward");
  for (const token of BAR) assert.ok(classTokens(openTag(cell)).includes(token), token);
  assert.ok(cell.includes('<span class="sr-only">Selected</span>'), cell);
  const anchor = nameAnchor(html, "Alpha Forward");
  assert.equal(attr(anchor, "href"), "#player-detail");
  assert.equal(attr(anchor, "aria-current"), "true");
  assert.ok(classTokens(anchor).includes("font-medium"), anchor);
  const other = nameCell(html, "Bravo Forward");
  for (const token of BAR) assert.ok(!classTokens(openTag(other)).includes(token), token);
  assert.ok(!other.includes("Selected"));
});

test("an unselected name links to the player's panel on the current tab", () => {
  const ev = nameAnchor(renderTrends(research(threeGames()), { selected: 1, sit: "ev" }), "Bravo Forward");
  assert.equal(attr(ev, "href"), "/research?team=MTL&games=5&player=2#player-detail");
  assert.equal(attr(ev, "title"), "Show who Bravo Forward plays with");
  assert.equal(attr(ev, "aria-current"), undefined);
  const pp = nameAnchor(renderTrends(research(threeGames()), { selected: 1, sit: "pp" }), "Bravo Forward");
  assert.equal(attr(pp, "href"), "/research?team=MTL&games=5&player=2&sit=pp#player-detail");
});

test("with no selection nothing is marked and every name is still a link", () => {
  const html = renderTrends(research(threeGames()));
  for (const token of BAR) assert.ok(!html.includes(token), token);
  assert.ok(!html.includes("aria-current"));
  assert.ok(!html.includes("Selected"));
  for (const [id, name] of [[1, "Alpha Forward"], [2, "Bravo Forward"], [3, "Charlie Defense"]] as const) {
    assert.equal(attr(nameAnchor(html, name), "href"), `/research?team=MTL&games=5&player=${id}#player-detail`);
  }
});

test("the Player header and every row's first cell carry pl-2", () => {
  const html = renderTrends(research(threeGames()), { selected: 1 });
  assert.ok(classTokens(openTag(headerCell(html, "Player"))).includes("pl-2"));
  for (const name of ["Alpha Forward", "Bravo Forward", "Charlie Defense"]) {
    assert.ok(classTokens(openTag(nameCell(html, name))).includes("pl-2"), name);
  }
});

test("sort headers keep the selection, tab and show-all state", () => {
  const html = renderTrends(research(threeGames()), { selected: 1, sit: "pp", all: true });
  const href = attr(headerCell(html, "TOI Δ").match(/<a\b[^>]*>/)?.[0] ?? "", "href");
  assert.equal(href, researchHref("MTL", 5, { key: "toiDelta", dir: "desc" }, { player: 1, sit: "pp", all: true }));
});

test("in a 1-game window a requested Δ sort stays in the name links but not in the sort headers", () => {
  const html = renderTrends(research([threeGames()[0]]), { sort: { key: "toiDelta", dir: "desc" }, gameCount: 1 });
  assert.equal(attr(nameAnchor(html, "Bravo Forward"), "href"), "/research?team=MTL&games=1&sort=toiDelta&player=2#player-detail");
  assert.equal(attr(headerCell(html, "Avg TOI").match(/<a\b[^>]*>/)?.[0] ?? "", "href"), researchHref("MTL", 1, { key: "avgToi", dir: "asc" }));
});

test("a mover row keeps its tint and its screen-reader text, and the name link comes first", () => {
  const toi = [1000, 1000, 1000, 1200, 1200];
  const games = toi.map((t, i) => fixtureGame(`2026-10-0${i + 1}`, { 1: t, 2: 900, 3: 1300 }));
  const html = renderTrends(research(games), { selected: 1 });
  const row = rowHtml(html, "Alpha Forward");
  assert.ok(classTokens(row.match(/^<tr[^>]*>/)![0]).includes("bg-green-100"));
  const cell = nameCell(html, "Alpha Forward");
  assert.ok(cell.includes("<a"), cell);
  assert.ok(cell.indexOf("<a") < cell.indexOf("Moving up"), cell);
  assert.ok(cell.includes('<span class="sr-only">Moving up</span>'));
});

test("the name link comes before the DNP last 2 chip", () => {
  const games = [1, 2, 3, 4, 5].map((i) => fixtureGame(`2026-10-0${i}`, i <= 3 ? { 1: 1200, 2: 900 } : { 1: 1200 }));
  const cell = nameCell(renderTrends(research(games)), "Bravo Forward");
  assert.ok(cell.includes("<a"), cell);
  assert.ok(cell.indexOf("<a") < cell.indexOf("DNP last 2"), cell);
});

// Last game unit tables (UNIT-04)
const unit = (playerIds: number[], seconds = 300, pct = 20): Unit => ({ playerIds, seconds, pct });
const unitPlayers = new Map<number, ResearchPlayer>(
  [2, 3, 4, 5, 6, 7, 8, 11, 12, 13].map((id) => [id, { id, name: id === 2 ? "Bravo Forward" : `Player ${id}`, position: id === 11 ? "D" : "C", group: id === 11 ? "D" : "F" }]),
);
function unitResearch(units: Partial<Record<Situation, { F?: Unit[]; D?: Unit[] }>>, p = unitPlayers): TeamResearch {
  const game = fixtureGame("2026-10-05", { 2: 1000 });
  game.lines = {
    situationSeconds: { ev: 3000, pp: 120, sh: 60 },
    units: {
      ev: { F: units.ev?.F ?? [], D: units.ev?.D ?? [] },
      pp: { F: units.pp?.F ?? [], D: units.pp?.D ?? [] },
      sh: { F: units.sh?.F ?? [], D: units.sh?.D ?? [] },
    },
    playerSeconds: new Map(),
  };
  return { players: p, games: [game], unavailableDates: [] };
}
const renderUnits = (r: TeamResearch, sit: Situation = "ev", selected: number | null = 2) =>
  renderToStaticMarkup(createElement(LastGameLines, { research: r, team: "MTL", gameCount: 5, sort: DEFAULT_SORT, sit, selected }));
const tableHtml = (html: string, title: string) =>
  [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]).find((t) => t.includes(`>${title}</th>`)) ?? "";
const anchors = (cell: string) => [...cell.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
const fixtureUnits = () =>
  unitResearch({
    ev: { F: [unit([3, 4, 5], 600, 40), unit([6, 7, 8])] },
    pp: { F: [unit([2, 3, 4, 5])], D: [unit([11])] },
  });

test("EV unit names link without sit and PP unit names link with sit=pp", () => {
  const html = renderUnits(fixtureUnits());
  const ev = anchors(tds(rowHtml(tableHtml(html, "EV - Forwards"), "Player 3"))[3]);
  assert.deepEqual(ev.map((a) => attr(a, "href")), [3, 4, 5].map((id) => `/research?team=MTL&games=5&player=${id}#player-detail`));
  const pp = anchors(tds(rowHtml(tableHtml(html, "PP - Forwards"), "Player 3"))[3]);
  assert.deepEqual(pp.map((a) => attr(a, "href")), [2, 3, 4, 5].map((id) => `/research?team=MTL&games=5&player=${id}&sit=pp#player-detail`));
});

test("names in a unit are separated by an aria-hidden dash and a one-player unit has no separator", () => {
  const html = renderUnits(fixtureUnits());
  const three = tds(rowHtml(tableHtml(html, "EV - Forwards"), "Player 3"))[3];
  assert.equal((three.match(/<span aria-hidden="true"> – <\/span>/g) ?? []).length, 2);
  const one = tds(rowHtml(tableHtml(html, "PP - Defense"), "Player 11"))[3];
  assert.equal(anchors(one).length, 1);
  assert.ok(!one.includes("–"));
});

test("the #, Time and % cells keep their values", () => {
  const cells = tds(rowHtml(tableHtml(renderUnits(fixtureUnits()), "EV - Forwards"), "Player 3")).map((c) => c.replace(/<[^>]*>/g, "").trim());
  assert.deepEqual(cells.slice(0, 3), ["1", "10:00", "40.0"]);
});

test("an empty unit table shows one None row with no link", () => {
  const sh = tableHtml(renderUnits(fixtureUnits()), "SH - Defense");
  assert.ok(sh.includes("None"));
  assert.equal((sh.match(/<tr/g) ?? []).length, 2);
  assert.ok(!sh.includes("<a"));
});

test("the selected player is marked wherever he appears, and links to the table's own tab", () => {
  const html = renderUnits(fixtureUnits(), "ev", 2);
  const bravo = anchors(tds(rowHtml(tableHtml(html, "PP - Forwards"), "Bravo Forward"))[3])[0];
  assert.equal(attr(bravo, "href"), "/research?team=MTL&games=5&player=2&sit=pp#player-detail");
  assert.equal(attr(bravo, "aria-current"), "true");
  assert.ok(classTokens(bravo).includes("font-medium"));
  assert.equal(attr(bravo, "title"), "Show who Bravo Forward plays with at PP");
});

test("the selected player's name on his own tab is a plain #player-detail anchor", () => {
  const html = renderUnits(fixtureUnits(), "ev", 3);
  const evThree = anchors(tds(rowHtml(tableHtml(html, "EV - Forwards"), "Player 3"))[3])[0];
  assert.equal(attr(evThree, "href"), "#player-detail");
  assert.equal(attr(evThree, "aria-current"), "true");
  const ppThree = anchors(tds(rowHtml(tableHtml(html, "PP - Forwards"), "Player 3"))[3])[1];
  assert.equal(attr(ppThree, "href"), "/research?team=MTL&games=5&player=3&sit=pp#player-detail");
  assert.equal(attr(ppThree, "aria-current"), "true");
});

test("an EV forward list of 5 units renders 4 rows", () => {
  const five = unitResearch({ ev: { F: [3, 4, 5, 6, 7].map((id) => unit([id, 8])) } });
  const table = tableHtml(renderUnits(five), "EV - Forwards");
  assert.equal((table.match(/<tr/g) ?? []).length, 1 + 4);
});

test("players with the same display name get links with their own ids", () => {
  const twins = new Map(unitPlayers);
  twins.set(12, { id: 12, name: "Same Name", position: "C", group: "F" });
  twins.set(13, { id: 13, name: "Same Name", position: "C", group: "F" });
  const cell = tds(tableHtml(renderUnits(unitResearch({ ev: { F: [unit([12, 13])] } }, twins), "ev", null), "EV - Forwards").match(/<tr[\s\S]*?<\/tr>/g)![1])[3];
  assert.deepEqual(anchors(cell).map((a) => attr(a, "href")), [12, 13].map((id) => `/research?team=MTL&games=5&player=${id}#player-detail`));
});

test("a last game with no shift chart still shows the unavailable note", () => {
  const r = unitResearch({});
  r.games[0].lines = null;
  assert.ok(renderUnits(r).includes("No shift chart is available for this game (not published yet, or it failed to load)."));
});
