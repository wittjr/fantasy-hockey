import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToiTrends } from "@/components/ToiTrends";
import type { Situation } from "./lines";
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
  [...html.matchAll(/<th[^>]*>[\s\S]*?<\/th>/g)].map((m) => m[0]).find((h) => h.replace(/<[^>]*>/g, "").trim().startsWith(label)) ?? "";
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
