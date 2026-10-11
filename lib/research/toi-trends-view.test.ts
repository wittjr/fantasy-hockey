import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToiTrends } from "@/components/ToiTrends";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";

const players = new Map<number, ResearchPlayer>([
  [1, { id: 1, name: "Alpha Forward", position: "C", group: "F" }],
  [2, { id: 2, name: "Bravo Forward", position: "L", group: "F" }],
  [3, { id: 3, name: "Charlie Defense", position: "D", group: "D" }],
  [4, { id: 4, name: "Golf Goalie", position: "G", group: "G" }],
]);

function fixtureGame(date: string, toi: Record<number, number>, withLines = true): ResearchGame {
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
    lines: withLines
      ? {
          situationSeconds: { ev: 3000, pp: 120, sh: 60 },
          units: { ev: { F: [], D: [] }, pp: { F: [], D: [] }, sh: { F: [], D: [] } },
          playerSeconds: new Map([[1, { ev: 1000, pp: 60, sh: 10 }]]),
        }
      : null,
  };
}

const research = (games: ResearchGame[], p = players): TeamResearch => ({ players: p, games });
const render = (r: TeamResearch) => renderToStaticMarkup(createElement(ToiTrends, { research: r }));
const threeGames = () => [
  fixtureGame("2026-10-01", { 1: 1200, 2: 900, 3: 1300 }),
  fixtureGame("2026-10-03", { 1: 1250, 2: 950, 3: 1350 }),
  fixtureGame("2026-10-05", { 1: 1300, 2: 1000, 3: 1400 }),
];
const headers = (html: string) =>
  [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]*>/g, "").trim());

test("renders headers in order, forwards before defense, no goalies", () => {
  const html = render(research(threeGames()));
  assert.deepEqual(headers(html), ["Player", "Pos", "Avg TOI", "PP share", "SH", "Per game", "TOI trend"]);
  assert.ok(html.includes("Ice-time trends"));
  assert.ok(html.indexOf("Alpha Forward") < html.indexOf("Charlie Defense"));
  assert.ok(html.indexOf("Alpha Forward") < html.indexOf("Bravo Forward"));
  assert.ok(!html.includes("Golf Goalie"));
});

test("shows the games-played count in the Pos cell", () => {
  const games = threeGames();
  games[1].toi.delete(2);
  assert.ok(render(research(games)).includes("2/3 GP"));
});

test("a player with null avgToi shows a dash and never 0:00", () => {
  const otNoChart: ResearchGame = { ...fixtureGame("2026-10-05", { 1: 1500 }, false), overtime: "OT", regulationToi: null };
  const html = render(research([otNoChart]));
  assert.ok(html.includes("—"));
  assert.ok(!html.includes("0:00"));
});

test("lists the dates of games without a shift chart in a footnote", () => {
  const one = [fixtureGame("2026-10-08", { 1: 1200 }, false), fixtureGame("2026-10-10", { 1: 1200 })];
  assert.ok(render(research(one)).includes("No PP/SH data for Oct 8"));
  const two = [fixtureGame("2026-10-08", { 1: 1200 }, false), fixtureGame("2026-10-09", { 1: 1200 }, false)];
  assert.ok(render(research(two)).includes("No PP/SH data for Oct 8, Oct 9"));
});

test("no footnote when every game has a shift chart", () => {
  assert.ok(!render(research(threeGames())).includes("No PP/SH data"));
});

test("a window with games but no skaters shows the empty message and no table", () => {
  const html = render(research([fixtureGame("2026-10-01", {})]));
  assert.ok(html.includes("No skaters played in this window."));
  assert.ok(!html.includes("<table"));
});

test("a one-game window has no TOI trend column", () => {
  const html = render(research([fixtureGame("2026-10-01", { 1: 1200, 3: 1300 })]));
  assert.ok(!headers(html).includes("TOI trend"));
});

// Game 1 regulation (player 2 missed it), game 2 OT with shift data, game 3 OT with no shift data.
const stripGames = (): ResearchGame[] => {
  const g1 = fixtureGame("2026-10-01", { 1: 1200, 3: 1300 });
  const g2 = {
    ...fixtureGame("2026-10-03", { 1: 1300, 2: 1000, 3: 1400 }),
    overtime: "OT" as const,
    regulationToi: new Map([[1, 1250], [2, 950], [3, 1350]]),
  };
  const g3 = { ...fixtureGame("2026-10-05", { 1: 1500, 2: 1100, 3: 1500 }, false), overtime: "OT" as const, regulationToi: null };
  return [g1, g2, g3];
};
const rowHtml = (html: string, name: string) =>
  [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((m) => m[0]).find((r) => r.includes(name)) ?? "";
const cells = (row: string) => [...row.matchAll(/<span[^>]*data-state="([^"]*)"[^>]*>/g)].map((m) => ({ tag: m[0], state: m[1] }));

test("every row has one strip cell per team game, oldest first, with played / dnp / excluded states", () => {
  const html = render(research(stripGames()));
  assert.deepEqual(cells(rowHtml(html, "Alpha Forward")).map((c) => c.state), ["played", "played", "excluded"]);
  assert.deepEqual(cells(rowHtml(html, "Bravo Forward")).map((c) => c.state), ["dnp", "played", "excluded"]);
  assert.equal(cells(rowHtml(html, "Charlie Defense")).length, 3);
});

test("a played OT game is ringed in sky; a regulation game is not", () => {
  const alpha = cells(rowHtml(render(research(stripGames())), "Alpha Forward"));
  assert.ok(!alpha[0].tag.includes("ring-sky-500"));
  assert.ok(alpha[1].tag.includes("ring-sky-500"));
});

test("the sparkline marks a played OT game with a hollow sky dot", () => {
  const html = render(research(stripGames()));
  assert.ok(rowHtml(html, "Alpha Forward").includes("stroke-sky-500"));
  assert.ok(!render(research(threeGames())).includes("stroke-sky-500"));
});

test("a one-game window still shows the Per game column with one cell per row", () => {
  const html = render(research([fixtureGame("2026-10-01", { 1: 1200, 3: 1300 })]));
  assert.ok(headers(html).includes("Per game"));
  assert.equal(cells(rowHtml(html, "Alpha Forward")).length, 1);
  assert.equal(cells(rowHtml(html, "Charlie Defense")).length, 1);
});

test("the legend explains the strip", () => {
  assert.ok(render(research(threeGames())).includes("Squares are team games, oldest to newest."));
});
