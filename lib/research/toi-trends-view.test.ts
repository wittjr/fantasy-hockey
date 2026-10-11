import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToiTrends } from "@/components/ToiTrends";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";
import { DEFAULT_SORT, researchHref, type SortSpec } from "./toi-trends";

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

const research = (games: ResearchGame[], p = players): TeamResearch => ({ players: p, games, unavailableDates: [] });
const render = (r: TeamResearch, sort: SortSpec = DEFAULT_SORT, team = "MTL", gameCount = 5) =>
  renderToStaticMarkup(createElement(ToiTrends, { research: r, sort, team, gameCount }));
const threeGames = () => [
  fixtureGame("2026-10-01", { 1: 1200, 2: 900, 3: 1300 }),
  fixtureGame("2026-10-03", { 1: 1250, 2: 950, 3: 1350 }),
  fixtureGame("2026-10-05", { 1: 1300, 2: 1000, 3: 1400 }),
];
const headers = (html: string) =>
  [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]*>/g, "").trim());

test("renders headers in order, forwards before defense, no goalies", () => {
  const html = render(research(threeGames()));
  assert.deepEqual(headers(html), ["Player", "Pos", "Avg TOI ↓", "TOI Δ", "PP share", "PP share Δ", "SH", "Per game", "TOI trend"]);
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

test("a one-game window has no delta or trend columns and shows the explanatory note", () => {
  const html = render(research([fixtureGame("2026-10-01", { 1: 1200, 3: 1300 })]));
  const h = headers(html);
  assert.ok(!h.includes("TOI Δ") && !h.includes("PP share Δ") && !h.includes("TOI trend"));
  assert.ok(html.includes("Deltas and trends need 2 or more games."));
  assert.ok(!html.includes("whole-window trend"));
});

test("a multi-game window shows legend line 2 and not the one-game note", () => {
  const html = render(research(threeGames()));
  assert.ok(html.includes("Δ compares the team&#x27;s last 2 games with the player&#x27;s earlier games"));
  assert.ok(html.includes("can disagree with Δ."));
  assert.ok(!html.includes("Deltas and trends need 2 or more games."));
});

test("a player with 2 included games shows a dash in both delta cells", () => {
  const games = threeGames();
  games[0].toi.delete(2);
  const row = rowHtml(render(research(games)), "Bravo Forward");
  const cellsHtml = [...row.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);
  assert.ok(cellsHtml[3].includes("—"), cellsHtml[3]);
  assert.ok(cellsHtml[5].includes("—"), cellsHtml[5]);
});

test("a rising TOI slope shows a muted up arrow with screen-reader text and no green or red", () => {
  const games = [
    fixtureGame("2026-10-01", { 1: 1000, 2: 900, 3: 1300 }),
    fixtureGame("2026-10-03", { 1: 1030, 2: 900, 3: 1300 }),
    fixtureGame("2026-10-05", { 1: 1060, 2: 900, 3: 1300 }),
  ];
  const row = rowHtml(render(research(games)), "Alpha Forward");
  const toiDeltaCell = [...row.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0])[3];
  assert.ok(toiDeltaCell.includes("▲"), toiDeltaCell);
  assert.ok(toiDeltaCell.includes("trend up"));
  assert.ok(toiDeltaCell.includes("text-neutral-600"));
  const arrowSlot = toiDeltaCell.match(/<span[^>]*>▲[\s\S]*?<\/span>/)?.[0] ?? "";
  assert.ok(!/green|red/.test(arrowSlot), arrowSlot);
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

test("every strip cell is focusable, role img, and carries the full detail as its aria-label", () => {
  const html = render(research(threeGames()));
  const tags = cells(html);
  assert.equal(tags.length, 9);
  for (const c of tags) {
    assert.ok(c.tag.includes('tabindex="0"'), c.tag);
    assert.ok(c.tag.includes('role="img"'), c.tag);
    assert.ok(/aria-label="[^"]+"/.test(c.tag), c.tag);
  }
  assert.ok(html.includes('aria-label="Oct 1 vs BOS · W 3–2 · TOI 20:00 · PP 1:00 (50% of team PP) · SH 0:10"'));
});

test("the popover holds the same values and is hidden from assistive tech", () => {
  const html = rowHtml(render(research(threeGames())), "Alpha Forward");
  const popovers = [...html.matchAll(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span><\/span>/g)]
    .map((m) => m[0])
    .filter((p) => p.includes("Oct"));
  assert.ok(popovers.length >= 3);
  assert.ok(popovers[0].includes("Oct 1") && popovers[0].includes("20:00") && popovers[0].includes("1:00"));
});

test("a missed game's strip cell says Did not play", () => {
  const html = render(research(stripGames()));
  assert.ok(rowHtml(html, "Bravo Forward").includes("Did not play"));
});

// Five games, 100 s of team PP each; `pp[id]` is that player's PP seconds per game (oldest first).
function moverGames(toi: Record<number, number[]>, pp: Record<number, number[]> = {}): ResearchGame[] {
  return [0, 1, 2, 3, 4].map((i) => {
    const toiNow = Object.fromEntries(
      Object.entries(toi).flatMap(([id, vals]) => (vals[i] === undefined ? [] : [[id, vals[i]]])),
    ) as Record<number, number>;
    const g = fixtureGame(`2026-10-0${i + 1}`, toiNow);
    g.lines = {
      situationSeconds: { ev: 3000, pp: 100, sh: 60 },
      units: { ev: { F: [], D: [] }, pp: { F: [], D: [] }, sh: { F: [], D: [] } },
      playerSeconds: new Map(Object.entries(pp).map(([id, vals]) => [Number(id), { ev: 1000, pp: vals[i] ?? 0, sh: 0 }])),
    };
    return g;
  });
}
const tds = (row: string) => [...row.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);

test("an up-mover row is tinted green and announced; a down-mover row is tinted red", () => {
  const html = render(
    research(
      moverGames({
        1: [1000, 1000, 1000, 1200, 1200],
        2: [1000, 1000, 1000, 1000, 1000],
        3: [1300, 1300, 1300, 1100, 1100],
      }),
    ),
  );
  const up = rowHtml(html, "Alpha Forward");
  const down = rowHtml(html, "Charlie Defense");
  const flat = rowHtml(html, "Bravo Forward");
  assert.ok(up.includes("bg-green-50") && up.includes("Moving up"));
  assert.ok(down.includes("bg-red-50") && down.includes("Moving down"));
  assert.ok(!flat.includes("bg-green-50") && !flat.includes("bg-red-50") && !flat.includes("Moving"));
  assert.ok(tds(up)[3].includes("text-green-700") && tds(up)[3].includes("font-medium"));
  assert.ok(tds(down)[3].includes("text-red-700") && tds(down)[3].includes("font-medium"));
});

test("a mixed-sign mover has no tint but each delta is coloured on its own", () => {
  const html = render(
    research(
      moverGames(
        { 1: [1000, 1000, 1000, 1200, 1200], 2: [1000, 1000, 1000, 1000, 1000], 3: [1000, 1000, 1000, 1000, 1000] },
        { 1: [50, 50, 50, 20, 20] },
      ),
    ),
  );
  const row = rowHtml(html, "Alpha Forward");
  assert.ok(!row.includes("bg-green-50") && !row.includes("bg-red-50") && !row.includes("Moving"));
  assert.ok(tds(row)[3].includes("text-green-700"), tds(row)[3]);
  assert.ok(tds(row)[5].includes("text-red-700"), tds(row)[5]);
});

test("a delta below the mover threshold has no weight or colour", () => {
  const html = render(research(moverGames({ 1: [1000, 1000, 1000, 1050, 1050], 2: [1000, 1000, 1000, 1000, 1000] })));
  const cell = tds(rowHtml(html, "Alpha Forward"))[3];
  assert.ok(cell.includes("+0:50"), cell);
  assert.ok(!cell.includes("font-medium") && !/text-(green|red)-/.test(cell), cell);
});

test("the delta that rounds to exactly 2:00 is coloured and 1:59 is not", () => {
  const html = render(research(moverGames({ 1: [1000, 1000, 1000, 1120, 1120], 2: [1000, 1000, 1000, 1119, 1119] })));
  assert.ok(tds(rowHtml(html, "Alpha Forward"))[3].includes("text-green-700"));
  assert.ok(!/text-(green|red)-/.test(tds(rowHtml(html, "Bravo Forward"))[3]));
});

test("a player who sat out the team's last 2 games shows the DNP badge after his name and dashes for deltas", () => {
  const html = render(research(moverGames({ 1: [1000, 1000, 1000], 2: [1000, 1000, 1000, 1000, 1000] })));
  const row = rowHtml(html, "Alpha Forward");
  assert.ok(row.indexOf("Alpha Forward") < row.indexOf("DNP last 2"));
  assert.ok(tds(row)[3].includes("—") && tds(row)[5].includes("—"));
  assert.ok(!rowHtml(html, "Bravo Forward").includes("DNP last 2"));
  assert.ok(!row.includes("bg-green-50") && !row.includes("bg-red-50"));
});

test("a one-game window never tints or shows the DNP badge", () => {
  const html = render(research([fixtureGame("2026-10-01", { 1: 1200, 3: 1300 })]));
  assert.ok(!html.includes("bg-green-50") && !html.includes("bg-red-50") && !html.includes("DNP last 2"));
});

// Sorting (TRND-05)
const headerCell = (html: string, label: string) =>
  [...html.matchAll(/<th[^>]*>[\s\S]*?<\/th>/g)].map((m) => m[0]).find((h) => h.replace(/<[^>]*>/g, "").trim().startsWith(label)) ?? "";
const hrefOf = (cell: string) => cell.match(/href="([^"]*)"/)?.[1]?.replaceAll("&amp;", "&");

test("the active sort header carries aria-sort and an arrow; no other header does", () => {
  const html = render(research(threeGames()), { key: "toiDelta", dir: "desc" });
  const active = headerCell(html, "TOI Δ");
  assert.ok(active.includes('aria-sort="descending"'), active);
  assert.ok(active.replace(/<[^>]*>/g, "").trim().endsWith("↓"), active);
  assert.equal((html.match(/aria-sort=/g) ?? []).length, 1);
  const asc = render(research(threeGames()), { key: "toiDelta", dir: "asc" });
  assert.ok(headerCell(asc, "TOI Δ").includes('aria-sort="ascending"'));
  assert.ok(headerCell(asc, "TOI Δ").replace(/<[^>]*>/g, "").trim().endsWith("↑"));
});

test("sort header links toggle the sort and keep team and window", () => {
  const html = render(research(threeGames()), { key: "toiDelta", dir: "desc" }, "MTL", 10);
  assert.equal(hrefOf(headerCell(html, "TOI Δ")), researchHref("MTL", 10, { key: "toiDelta", dir: "asc" }));
  assert.equal(hrefOf(headerCell(html, "Avg TOI")), researchHref("MTL", 10, { key: "avgToi", dir: "desc" }));
  assert.equal(hrefOf(headerCell(html, "PP share Δ")), researchHref("MTL", 10, { key: "ppDelta", dir: "desc" }));
  assert.equal(hrefOf(headerCell(html, "PP share")), researchHref("MTL", 10, { key: "ppShare", dir: "desc" }));
});

test("Player, Pos, SH, Per game and TOI trend headers are not links", () => {
  const html = render(research(threeGames()));
  for (const label of ["Player", "Pos", "SH", "Per game", "TOI trend"]) {
    assert.ok(!headerCell(html, label).includes("<a"), label);
  }
  assert.ok(headerCell(html, "Avg TOI").includes("<a"));
});

test("rows follow the chosen sort within the forwards and defense blocks", () => {
  const html = render(
    research(
      moverGames({
        1: [1000, 1000, 1000, 1000, 1000],
        2: [1000, 1000, 1000, 1200, 1200],
        3: [1300, 1300, 1300, 1100, 1100],
      }),
    ),
    { key: "toiDelta", dir: "desc" },
  );
  assert.ok(html.indexOf("Bravo Forward") < html.indexOf("Alpha Forward"));
  assert.ok(html.indexOf("Alpha Forward") < html.indexOf("Charlie Defense"));
  const asc = render(research(moverGames({ 1: [1000, 1000, 1000, 1000, 1000], 2: [1000, 1000, 1000, 1200, 1200] })), { key: "toiDelta", dir: "asc" });
  assert.ok(asc.indexOf("Alpha Forward") < asc.indexOf("Bravo Forward"));
});

test("a delta sort in a 1-game window orders by Avg TOI and marks Avg TOI active", () => {
  const one = research([fixtureGame("2026-10-01", { 1: 900, 2: 1200, 3: 1300 })]);
  const html = render(one, { key: "toiDelta", dir: "asc" });
  const avg = headerCell(html, "Avg TOI");
  assert.ok(avg.includes('aria-sort="descending"'), avg);
  assert.equal((html.match(/aria-sort=/g) ?? []).length, 1);
  assert.ok(html.indexOf("Bravo Forward") < html.indexOf("Alpha Forward"));
  assert.ok(headerCell(html, "PP share").includes("<a"));
  assert.equal([...html.matchAll(/<th[^>]*>[\s\S]*?<\/th>/g)].filter((m) => m[0].includes("<a")).length, 2);
});

test("the sortable headers carry their hover titles", () => {
  const html = render(research(threeGames())).replaceAll("&#x27;", "'");
  assert.ok(headerCell(html, "Avg TOI").includes('title="Average regulation ice time per game played"'));
  assert.ok(headerCell(html, "TOI Δ").includes(`title="Average of the team's last 2 games minus the player's earlier games in the window"`));
  assert.ok(headerCell(html, "PP share").includes(`title="Player's share of the team's power-play time in the games he played"`));
  assert.ok(headerCell(html, "PP share Δ").includes('title="Same comparison, in percentage points"'));
});

test("the section intro is the approved copy", () => {
  const html = render(research(threeGames())).replaceAll("&#x27;", "'");
  assert.ok(
    html.includes(
      "Average regulation ice time per game played, and how each player's last 2 games compare with his earlier games in the window. Rows tinted green or red moved by 2:00 or more of TOI or 15 or more points of power-play share. Click Avg TOI, TOI Δ, PP share or PP share Δ to sort; hover or focus a square for exact per-game times.",
    ),
  );
});

// WR-01: the popover anchors to the hovered square, not the strip's <td>.
const classTokens = (tag: string) => (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);

test("every strip square is the popover's containing block", () => {
  const squares = cells(render(research(threeGames())));
  assert.equal(squares.length, 9);
  for (const c of squares) assert.ok(classTokens(c.tag).includes("relative"), c.tag);
});

test("every popover opens below and to the left of its square, never at the strip's left edge", () => {
  const html = render(research(threeGames()));
  const popovers = [...html.matchAll(/<span aria-hidden="true" class="([^"]*group-hover\/cell:block[^"]*)"/g)].map((m) => m[1].split(/\s+/));
  assert.equal(popovers.length, 9);
  for (const tokens of popovers) {
    assert.ok(tokens.includes("absolute") && tokens.includes("right-0") && tokens.includes("top-full"), tokens.join(" "));
    assert.ok(!tokens.includes("left-0"), tokens.join(" "));
  }
});

test("the strip cell is not positioned", () => {
  const html = render(research(threeGames()));
  const stripTds = [...html.matchAll(/<td class="([^"]*)"><div role="group"/g)].map((m) => m[1].split(/\s+/));
  assert.equal(stripTds.length, 3);
  for (const tokens of stripTds) assert.ok(!tokens.includes("relative"), tokens.join(" "));
});

// WR-04: at exactly 2 games every Δ is "—"; the legend says why.
const twoGames = () => threeGames().slice(0, 2);
const twoGameLegend = "Δ needs 3 or more games, and this window has only 2, so every Δ shows —. ▲ ▼ show the direction of the whole-window trend.";

test("a 2-game window keeps the Δ columns, shows a dash in every Δ cell and explains why", () => {
  const html = render(research(twoGames())).replaceAll("&#x27;", "'");
  const h = headers(html);
  assert.ok(h.includes("TOI Δ") && h.includes("PP share Δ"));
  for (const name of ["Alpha Forward", "Bravo Forward", "Charlie Defense"]) {
    const t = tds(rowHtml(html, name));
    assert.ok(t[3].includes("—") && t[5].includes("—"), name);
  }
  assert.ok(html.includes(twoGameLegend));
  assert.ok(!html.includes("needs 3 or more games played"));
});

test("a 3-game window keeps the standard legend and not the 2-game explanation", () => {
  const html = render(research(threeGames())).replaceAll("&#x27;", "'");
  assert.ok(html.includes("needs 3 or more games played"));
  assert.ok(html.includes("can disagree with Δ."));
  assert.ok(!html.includes("this window has only 2"));
});

test("a 1-game window keeps its note and not the 2-game explanation", () => {
  const html = render(research([fixtureGame("2026-10-01", { 1: 1200 })]));
  assert.ok(html.includes("Deltas and trends need 2 or more games."));
  assert.ok(!html.includes("this window has only 2"));
});
