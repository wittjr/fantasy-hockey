import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LinemateRowView, PlayerLinemates } from "@/components/PlayerLinemates";
import { ToiTrends } from "@/components/ToiTrends";
import { formatSignedPoints } from "./format";
import type { GameLines, Situation } from "./lines";
import { buildLinemateView, type LinemateRow } from "./linemates";
import type { GamePairs } from "./pair-seconds";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";
import { DEFAULT_SORT, researchHref, type SortSpec } from "./toi-trends";

// Player 1 is the subject. 2 and 3 are forwards, 11 and 12 defensemen, 20 a goalie.
const players = new Map<number, ResearchPlayer>([
  [1, { id: 1, name: "Alpha Center", position: "C", group: "F" }],
  [2, { id: 2, name: "Bravo Winger", position: "L", group: "F" }],
  [3, { id: 3, name: "Charlie Winger", position: "R", group: "F" }],
  [11, { id: 11, name: "Delta Defense", position: "D", group: "D" }],
  [12, { id: 12, name: "Echo Defense", position: "D", group: "D" }],
  [20, { id: 20, name: "Golf Goalie", position: "G", group: "G" }],
  // Fifteen more skaters for the capped-list fixture: forwards 30-38, defensemen 40-45. They appear in no other fixture.
  ...Array.from({ length: 9 }, (_, i): [number, ResearchPlayer] => [30 + i, { id: 30 + i, name: `Forward ${30 + i}`, position: "C", group: "F" }]),
  ...Array.from({ length: 6 }, (_, i): [number, ResearchPlayer] => [40 + i, { id: 40 + i, name: `Defender ${40 + i}`, position: "D", group: "D" }]),
]);

const sec = (ev = 0, pp = 0, sh = 0): Record<Situation, number> => ({ ev, pp, sh });

/** Builds a GamePairs like the real pass does: every pair is filled in both directions. */
function pairsOf(self: Record<number, Record<Situation, number>>, pairs: [number, number, Record<Situation, number>][]): GamePairs {
  const together: GamePairs["together"] = new Map();
  const add = (a: number, b: number, s: Record<Situation, number>) => {
    if (!together.has(a)) together.set(a, new Map());
    together.get(a)!.set(b, s);
  };
  for (const [a, b, s] of pairs) {
    add(a, b, s);
    add(b, a, s);
  }
  const groups: GamePairs["groups"] = new Map();
  for (const id of Object.keys(self).map(Number)) groups.set(id, players.get(id)!.group === "D" ? "D" : "F");
  return { self: new Map(Object.entries(self).map(([id, s]) => [Number(id), s])), together, groups };
}

function mkGame(
  id: number,
  date: string,
  dressed: number[],
  pairs: GamePairs | null,
  extra: Partial<ResearchGame> = {},
): ResearchGame {
  const toi = new Map(dressed.map((p) => [p, 1200]));
  return {
    id,
    date,
    opponent: "BOS",
    home: true,
    score: { for: 3, against: 2 },
    toi,
    overtime: null,
    regulationToi: toi,
    lines: null,
    pairs,
    ...extra,
  };
}

// Game 1: W 3-2 at home; Charlie did not dress; Echo dressed but shared no ice with Alpha.
// Game 2: no shift chart. Game 3: lost in OT on the road.
const fixtureGames = (): ResearchGame[] => [
  mkGame(
    1,
    "2026-10-01",
    [1, 2, 11, 12],
    pairsOf({ 1: sec(600, 100, 50), 2: sec(500, 100), 11: sec(500), 12: sec(500) }, [
      [1, 2, sec(300, 60)],
      [1, 11, sec(200)],
    ]),
  ),
  mkGame(2, "2026-10-03", [1, 2, 3, 11, 12], null),
  mkGame(
    3,
    "2026-10-05",
    [1, 2, 3, 11, 12],
    pairsOf({ 1: sec(800, 90), 2: sec(700, 90), 3: sec(700), 11: sec(700), 12: sec(700) }, [
      [1, 2, sec(500, 50)],
      [1, 3, sec(400)],
      [1, 11, sec(150)],
      [1, 12, sec(130)],
    ]),
    { home: false, score: { for: 2, against: 3 }, overtime: "OT" },
  ),
];

const research = (games: ResearchGame[] = fixtureGames()): TeamResearch => ({ players, games, unavailableDates: [] });
const renderPanel = (r: TeamResearch, playerId = 1, sit: Situation = "ev", sort: SortSpec = DEFAULT_SORT, all = false) =>
  renderToStaticMarkup(createElement(PlayerLinemates, { research: r, playerId, sit, team: "MTL", gameCount: 5, sort, all }));

const classTokens = (tag: string) => (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
const unescape = (s: string) => s.replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
// Opening tags of the hover popovers, independent of attribute order.
const popoverTags = (html: string) =>
  [...html.matchAll(/<span\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((t) => t.includes('aria-hidden="true"') && classTokens(t).includes("group-hover/cell:block"));
const rowHtml = (html: string, name: string) =>
  [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((m) => m[0]).find((r) => r.includes(name)) ?? "";

interface Square {
  state: string;
  /** The square's opening tag. */
  tag: string;
  /** Whether the square holds a shade fill span (an inline opacity style). */
  filled: boolean;
  label: string;
  /** The popover's text, one entry per element. */
  lines: string[];
}
// Each chunk after the first starts inside one square's opening tag and runs to the next square.
const squares = (html: string): Square[] =>
  html
    .split('data-state="')
    .slice(1)
    .map((chunk) => {
      const popover = chunk.includes('aria-hidden="true"') ? chunk.slice(chunk.indexOf('aria-hidden="true"')).replace(/^[^>]*>/, "") : "";
      return {
        state: chunk.slice(0, chunk.indexOf('"')),
        tag: `<span data-state="${chunk.slice(0, chunk.indexOf(">") + 1)}`,
        filled: (chunk.includes('aria-hidden="true"') ? chunk.slice(0, chunk.indexOf('aria-hidden="true"')) : chunk).includes('style="opacity:'),
        label: unescape(chunk.match(/aria-label="([^"]*)"/)?.[1] ?? ""),
        lines: unescape(popover.replace(/<span\s*$/, ""))
          .replace(/<[^>]*>/g, "\u0000")
          .split("\u0000")
          .filter(Boolean),
      };
    });
const rowSquares = (html: string, name: string) => squares(rowHtml(html, name));

test("a together square's popover starts with the linemate, then the game, then minutes together, share and the player's time", () => {
  const sq = rowSquares(renderPanel(research()), "Bravo Winger")[0];
  assert.equal(sq.state, "together");
  assert.deepEqual(sq.lines, [
    "Bravo Winger",
    "Oct 1 vs BOS · W 3–2",
    "Together",
    "5:00",
    "Share of EV time",
    "50%",
    "Player's EV time",
    "10:00",
  ]);
  assert.equal(
    sq.label,
    "Bravo Winger · Oct 1 vs BOS · W 3–2 · Together 5:00 · Share of EV time 50% · Player's EV time 10:00",
  );
});

test("unknown and absent squares say why in the popover and the label and never show 0:00 or a percentage", () => {
  const html = renderPanel(research());
  const unknown = rowSquares(html, "Bravo Winger")[1];
  const absent = rowSquares(html, "Charlie Winger")[0];
  assert.equal(unknown.state, "unknown");
  assert.equal(absent.state, "absent");
  for (const sq of [unknown, absent]) {
    for (const text of [sq.lines.join(" "), sq.label]) {
      assert.ok(!text.includes("0:00") && !text.includes("%"), text);
    }
  }
  assert.ok(unknown.lines.includes("No shift chart for this game"), unknown.lines.join("|"));
  assert.ok(unknown.label.includes("No shift chart for this game"), unknown.label);
  assert.ok(absent.lines.includes("Charlie Winger did not play for MTL"), absent.lines.join("|"));
  assert.ok(absent.label.includes("did not play"), absent.label);
});

test("with the PP situation a together square's popover reads Share of PP time and Player's PP time", () => {
  const sq = rowSquares(renderPanel(research(), 1, "pp"), "Bravo Winger")[0];
  assert.equal(sq.state, "together");
  assert.deepEqual(sq.lines.slice(2), ["Together", "1:00", "Share of PP time", "60%", "Player's PP time", "1:40"]);
  assert.ok(sq.label.includes("Share of PP time 60%") && sq.label.includes("Player's PP time 1:40"), sq.label);
});

test("a square in an overtime game carries the OT tag on its popover's title line", () => {
  const sq = rowSquares(renderPanel(research()), "Bravo Winger")[2];
  assert.equal(sq.lines[1], "Oct 5 @ BOS · L 2–3");
  assert.equal(sq.lines[2], "OT");
  assert.ok(sq.label.includes("· OT ·"), sq.label);
});

test("every heat-strip popover has the Per game strip popover's class string", () => {
  const r = research();
  const perGame = popoverTags(renderToStaticMarkup(createElement(ToiTrends, { research: r, sort: DEFAULT_SORT, team: "MTL", gameCount: 5 })));
  const heat = popoverTags(renderPanel(r));
  assert.ok(perGame.length > 0);
  const expected = new Set(perGame.map((t) => classTokens(t).join(" ")));
  assert.equal(expected.size, 1);
  assert.equal(heat.length, 12); // 4 linemates x 3 games
  for (const tag of heat) assert.ok(expected.has(classTokens(tag).join(" ")), tag);
});

test("the panel is a labelled section headed by the player's name, position and games played", () => {
  const html = renderPanel(research());
  const section = html.match(/<section[^>]*>/)?.[0] ?? "";
  assert.ok(section.includes('id="player-detail"') && section.includes('aria-labelledby="player-detail-title"'), section);
  assert.ok(classTokens(section).includes("scroll-mt-4"), section);
  const h2 = html.match(/<h2 id="player-detail-title"[^>]*>([\s\S]*?)<\/h2>/)?.[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  assert.equal(h2, "Alpha Center C 3/3 GP");
});

test("the Forwards block comes before the Defense block, which carries the divider", () => {
  const html = renderPanel(research());
  assert.ok(html.indexOf(">Forwards</th>") < html.indexOf(">Defense</th>"));
  for (const forward of ["Bravo Winger", "Charlie Winger"]) {
    for (const defender of ["Delta Defense", "Echo Defense"]) {
      assert.ok(html.indexOf(forward) < html.indexOf(defender), `${forward} before ${defender}`);
    }
  }
  const labelRow = (title: string) => classTokens(html.match(new RegExp(`<tr[^>]*><th scope="rowgroup"[^>]*>${title}</th>`))?.[0] ?? "");
  assert.ok(labelRow("Defense").includes("border-t-2"));
  assert.ok(!labelRow("Forwards").includes("border-t-2"));
});

test("every listed row has one square per team game, and the no-chart game is unknown with an amber outline in every row", () => {
  const html = renderPanel(research());
  for (const name of ["Bravo Winger", "Charlie Winger", "Delta Defense", "Echo Defense"]) {
    const sq = rowSquares(html, name);
    assert.equal(sq.length, 3, name);
    assert.equal(sq[1].state, "unknown", name);
    assert.ok(classTokens(sq[1].tag).includes("border-amber-600"), sq[1].tag);
    assert.ok(classTokens(sq[1].tag).includes("border-dashed"), sq[1].tag);
    assert.ok(!sq[1].filled, name);
  }
});

test("an absent square is dashed grey, an apart square is a plain light border with no fill and a together square is filled", () => {
  const html = renderPanel(research());
  const absent = rowSquares(html, "Charlie Winger")[0];
  assert.equal(absent.state, "absent");
  assert.ok(classTokens(absent.tag).includes("border-dashed") && classTokens(absent.tag).includes("border-neutral-400"), absent.tag);
  assert.ok(!absent.filled);

  const apart = rowSquares(html, "Echo Defense")[0];
  assert.equal(apart.state, "apart");
  assert.ok(classTokens(apart.tag).includes("border-neutral-200"), apart.tag);
  assert.ok(!classTokens(apart.tag).includes("border-dashed"), apart.tag);
  assert.ok(!apart.filled);

  const together = rowSquares(html, "Bravo Winger")[0];
  assert.equal(together.state, "together");
  assert.ok(together.filled);
});

test("a row with no counted game shows a dash as its window share, not 0%", () => {
  // buildLinemateView never lists such a row (it needs time together in a counted game), so the row component is rendered directly.
  const base = buildLinemateView(fixtureGames(), players, 1, "ev").forwards[0];
  const unknownGames = fixtureGames().map((g) => ({ ...g, pairs: null }));
  const row: LinemateRow = {
    ...base,
    cells: unknownGames.map(() => ({ state: "unknown", seconds: null, share: null, selfSeconds: null, absentReason: null })),
    windowShare: null,
  };
  const html = renderToStaticMarkup(
    createElement("table", null, createElement("tbody", null, createElement(LinemateRowView, { row, research: research(unknownGames), playerName: "Alpha Center", sit: "ev", team: "MTL" }))),
  );
  const shareCell = [...html.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0])[2] ?? "";
  assert.equal(shareCell.replace(/<[^>]*>/g, ""), "—");
  assert.ok(!html.includes("%") && !html.includes("0:00"));
});

test("a window share is the pooled share over counted games", () => {
  const html = renderPanel(research());
  const shareCell = (name: string) => ([...rowHtml(html, name).matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)][2]?.[0] ?? "").replace(/<[^>]*>/g, "");
  assert.equal(shareCell("Bravo Winger"), "57%"); // (300 + 500) / (600 + 800)
  assert.equal(shareCell("Charlie Winger"), "50%"); // 400 / 800: game 1 is absent and left out
});

test("a group with no listed linemate shows one None row", () => {
  const html = renderPanel(research(), 1, "pp");
  const defense = html.slice(html.indexOf(">Defense</th>"));
  assert.equal(defense.match(/<td[^>]*>None<\/td>/g)?.length, 1);
  assert.equal(squares(defense).length, 0);
  assert.ok(!html.slice(0, html.indexOf(">Defense</th>")).includes(">None<"));
});

test("a goalie or a player outside the window gets the not-in-window notice and no squares", () => {
  for (const id of [20, 999]) {
    const html = renderPanel(research(), id);
    assert.ok(html.includes("That player didn&#x27;t play for MTL in this window."), html);
    assert.equal(squares(html).length, 0);
    assert.ok(!html.includes("<section"));
  }
});

test("the close link keeps the team, games and situation in the panel and in the notice", () => {
  const hrefs = (html: string) => [...html.replace(/<nav[\s\S]*?<\/nav>/, "").matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1]));
  for (const sit of ["ev", "pp"] as const) {
    const expected = researchHref("MTL", 5, DEFAULT_SORT, { sit });
    assert.deepEqual(hrefs(renderPanel(research(), 1, sit)), [expected]);
    assert.deepEqual(hrefs(renderPanel(research(), 20, sit)), [expected]);
  }
});

// Alpha: 3 games with TOI 1000, 1300, 1300 (Avg 20:00, TOI Δ +5:00) and PP share 50%, no chart, 20% (35% pooled, Δ -30).
const noLines = { ev: { F: [], D: [] }, pp: { F: [], D: [] }, sh: { F: [], D: [] } };
const ppLines = (teamPp: number, alphaPp: number): GameLines => ({
  situationSeconds: sec(0, teamPp, 0),
  units: noLines,
  playerSeconds: new Map([[1, sec(0, alphaPp, 0)]]),
});
const evPairs = (together = 300) => pairsOf({ 1: sec(600), 2: sec(500) }, [[1, 2, sec(together)]]);
const alphaGame = (id: number, date: string, toi: number, pairs: GamePairs | null, lines: GameLines | null) =>
  mkGame(id, date, [1, 2], pairs, { toi: new Map([[1, toi], [2, toi]]), regulationToi: new Map([[1, toi], [2, toi]]), lines });
const headerGames = (): ResearchGame[] => [
  alphaGame(1, "2026-10-06", 1000, evPairs(), ppLines(200, 100)),
  alphaGame(2, "2026-10-08", 1300, null, null),
  alphaGame(3, "2026-10-10", 1300, evPairs(), ppLines(200, 40)),
];
// No game has a PP line record, so PP share and its Δ are unknown; Avg 18:20 and Δ +5:00 contain no "0:00".
const unknownPpGames = (): ResearchGame[] => [
  alphaGame(1, "2026-10-06", 900, evPairs(), null),
  alphaGame(2, "2026-10-08", 1200, evPairs(), null),
  alphaGame(3, "2026-10-10", 1200, evPairs(), null),
];

const stripTags = (s: string) => unescape(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const SR_ONLY = /<span class="sr-only">[\s\S]*?<\/span>/g;
/** The header stats: label, the dd's opening-tag attributes, the visible value (screen-reader text removed) and the raw markup. */
const stats = (html: string) => {
  const dl = html.match(/<dl[^>]*>[\s\S]*?<\/dl>/)?.[0] ?? "";
  return [...dl.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt><dd([^>]*)>([\s\S]*?)<\/dd>/g)].map((m) => ({
    label: stripTags(m[1]),
    attrs: m[2],
    value: stripTags(m[3].replace(SR_ONLY, "")),
    html: m[3],
  }));
};
const tabLinks = (html: string) =>
  [...(html.match(/<nav aria-label="Situation"[\s\S]*?<\/nav>/)?.[0] ?? "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    attrs: m[1],
    label: stripTags(m[2]),
    href: unescape(m[1].match(/href="([^"]*)"/)?.[1] ?? ""),
  }));
/** The paragraphs in the footnote block under the table. */
const footnotes = (html: string) => {
  const block = html.slice(html.indexOf('<div class="flex flex-col gap-1 text-xs text-neutral-500">'));
  return [...block.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)].map((m) => ({ attrs: m[1], text: stripTags(m[2]) }));
};

test("the header stats read Avg TOI, TOI Δ, PP share and PP share Δ with the trends table's values", () => {
  const r = research(headerGames());
  const items = stats(renderPanel(r));
  assert.deepEqual(items.map((i) => i.label), ["Avg TOI", "TOI Δ", "PP share", "PP share Δ"]);
  assert.deepEqual(items.map((i) => i.value), ["20:00", "+5:00", "35%", formatSignedPoints(-30)]);
  assert.ok(classTokens(items[0].attrs).includes("font-medium"));
  const table = stripTags(renderToStaticMarkup(createElement(ToiTrends, { research: r, sort: DEFAULT_SORT, team: "MTL", gameCount: 5 })));
  for (const item of items) assert.ok(table.includes(item.value), `${item.label} ${item.value} is in the trends table`);
});

test("a TOI Δ and a PP share Δ that cross the mover thresholds are coloured with a screen-reader word", () => {
  const items = stats(renderPanel(research(headerGames())));
  assert.ok(classTokens(items[1].attrs).includes("text-green-700") && classTokens(items[1].attrs).includes("font-medium"), items[1].attrs);
  assert.ok(items[1].html.includes('<span class="sr-only">Moving up</span>'), items[1].html);
  assert.ok(classTokens(items[3].attrs).includes("text-red-700") && classTokens(items[3].attrs).includes("font-medium"), items[3].attrs);
  assert.ok(items[3].html.includes('<span class="sr-only">Moving down</span>'), items[3].html);
  assert.ok(!classTokens(items[0].attrs).some((c) => c.startsWith("text-green") || c.startsWith("text-red")));
});

test("unknown header stats show a muted dash, never 0:00 or 0%", () => {
  const items = stats(renderPanel(research(unknownPpGames())));
  assert.deepEqual(items.map((i) => i.value), ["18:20", "+5:00", "—", "—"]);
  for (const i of [items[2], items[3]]) assert.ok(i.html.includes('class="text-neutral-400'), i.html);
  const text = items.map((i) => i.value).join(" ");
  assert.ok(!text.includes("0:00") && !text.includes("0%"), text);
});

test("a 1-game window drops the two Δ items", () => {
  const items = stats(renderPanel(research([headerGames()[0]])));
  assert.deepEqual(items.map((i) => i.label), ["Avg TOI", "PP share"]);
  assert.deepEqual(items.map((i) => i.value), ["16:40", "50%"]);
});

test("the situation tabs are EV, PP, SH links; the active one has aria-current and a dark border", () => {
  for (const [sit, active] of [["ev", 0], ["pp", 1], ["sh", 2]] as const) {
    const tabs = tabLinks(renderPanel(research(), 1, sit));
    assert.deepEqual(tabs.map((t) => t.label), ["EV", "PP", "SH"]);
    tabs.forEach((t, i) => {
      assert.equal(t.attrs.includes('aria-current="true"'), i === active, `${sit} tab ${t.label}`);
      assert.equal(classTokens(t.attrs).includes("border-neutral-900"), i === active, `${sit} tab ${t.label}`);
    });
  }
});

test("each tab keeps the team, window, sort and player, sets sit (omitted for EV) and carries no hash", () => {
  const sorts: SortSpec[] = [DEFAULT_SORT, { key: "toiDelta", dir: "asc" }];
  for (const sort of sorts) {
    for (const sit of ["ev", "pp"] as const) {
      const tabs = tabLinks(renderPanel(research(), 1, sit, sort));
      assert.deepEqual(
        tabs.map((t) => t.href),
        (["ev", "pp", "sh"] as const).map((s) => researchHref("MTL", 5, sort, { player: 1, sit: s })),
      );
      for (const t of tabs) assert.ok(!t.href.includes("#"), t.href);
    }
  }
  assert.equal(tabLinks(renderPanel(research()))[0].href, researchHref("MTL", 5, DEFAULT_SORT, { player: 1 }));
  assert.ok(!tabLinks(renderPanel(research()))[0].href.includes("sit="));
});

test("the panel runs header row, stats, tabs, intro, table, footnotes in that order", () => {
  const html = renderPanel(research());
  const at = (needle: string) => html.indexOf(needle);
  const order = [at("<h2"), at("<dl"), at('<nav aria-label="Situation"'), at("Who Alpha Center"), at("<table"), at("Squares are team games")];
  assert.ok(order.every((n) => n >= 0), order.join());
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("the intro names the player and explains the squares and the tabs", () => {
  const intro = stripTags(renderPanel(research()).match(/<p class="text-sm text-neutral-500">([\s\S]*?)<\/p>/)?.[1] ?? "");
  assert.equal(
    intro,
    "Who Alpha Center has been on the ice with, game by game. Click a square for exact minutes together; use EV, PP or SH to switch situation.",
  );
});

test("legend line 1 explains the squares and the regulation-only rule; line 2 states the denominator and the minimum for the situation", () => {
  const ev = footnotes(renderPanel(research()));
  assert.equal(
    ev[0].text,
    "Squares are team games, oldest to newest. Darker means that linemate was on the ice for more of Alpha Center's EV time in that game. Hollow means both played but not together. Dashed means one of them did not play; amber dashed means no shift chart. A blue ring means overtime; only regulation time counts.",
  );
  assert.equal(
    ev[1].text,
    "Window share is time together divided by Alpha Center's EV time in the games they both played. Linemates are ordered by the team's last 2 games, then by the whole window, and only those with 2:00 or more together are listed.",
  );
  const pp = footnotes(renderPanel(research(), 1, "pp"));
  assert.ok(pp[0].text.includes("Alpha Center's PP time"), pp[0].text);
  assert.ok(pp[1].text.includes("Alpha Center's PP time in the games they both played"), pp[1].text);
  assert.ok(pp[1].text.includes("only those with 0:30 or more together"), pp[1].text);
});

test("the amber footnote lists every window game without a shift chart and says they are left out", () => {
  const games = headerGames();
  games[2] = alphaGame(3, "2026-10-10", 1300, null, null);
  const notes = footnotes(renderPanel(research(games)));
  const amber = notes.find((n) => classTokens(n.attrs).includes("text-amber-600"));
  assert.ok(amber, JSON.stringify(notes));
  assert.ok(classTokens(amber.attrs).includes("dark:text-amber-400"));
  assert.ok(
    amber.text.startsWith("No linemate data for Oct 8, Oct 10: no shift chart is available for those games"),
    amber.text,
  );
  assert.ok(amber.text.endsWith("They are left out of shares and tags."), amber.text);
});

test("with every game charted there is no amber footnote", () => {
  const games = [1, 2, 3].map((n) => alphaGame(n, `2026-10-0${n}`, 1200, evPairs(), null));
  const notes = footnotes(renderPanel(research(games)));
  assert.equal(notes.length, 3); // legend lines 1-3
  assert.ok(!notes.some((n) => classTokens(n.attrs).includes("text-amber-600") || n.text.startsWith("No linemate data")));
});

test("when no game has a shift chart the panel says so, shows no table or legend and keeps the tabs", () => {
  const games = [1, 2, 3].map((n) => alphaGame(n, `2026-10-0${n}`, 1200, null, null));
  const html = renderPanel(research(games));
  assert.ok(
    stripTags(html).includes(
      "No linemate data for Alpha Center in this window: no shift chart is available for these games (not published yet, or it failed to load).",
    ),
  );
  assert.ok(!html.includes("<table") && !html.includes("Squares are team games"));
  assert.ok(!html.includes("text-amber-600"), "the empty message is not repeated as an amber footnote");
  assert.deepEqual(tabLinks(html).map((t) => t.label), ["EV", "PP", "SH"]);
});

test("a situation with no time says so in words, keeps the tabs and still flags a game without a chart", () => {
  const html = renderPanel(research(headerGames()), 1, "pp");
  assert.ok(stripTags(html).includes("Alpha Center had no power-play time in this window."), stripTags(html));
  assert.ok(!html.includes("<table"));
  assert.deepEqual(tabLinks(html).map((t) => t.label), ["EV", "PP", "SH"]);
  assert.ok(footnotes(html).some((n) => n.text.startsWith("No linemate data for Oct 8:")));
  assert.ok(stripTags(renderPanel(research(headerGames()), 1, "sh")).includes("Alpha Center had no penalty-kill time in this window."));
});

test("when nobody meets the minimum the panel says so with the minimum for the situation", () => {
  const games = [1, 2, 3].map((n) => alphaGame(n, `2026-10-0${n}`, 1200, evPairs(30), null));
  const html = renderPanel(research(games));
  assert.ok(stripTags(html).includes("No linemates with 2:00 or more together in this window."), stripTags(html));
  assert.ok(!html.includes("<table"));
  assert.deepEqual(tabLinks(html).map((t) => t.label), ["EV", "PP", "SH"]);
  const ppGames = [1, 2, 3].map((n) =>
    alphaGame(n, `2026-10-0${n}`, 1200, pairsOf({ 1: sec(0, 120), 2: sec(0, 100) }, [[1, 2, sec(0, 9)]]), null),
  );
  assert.ok(stripTags(renderPanel(research(ppGames), 1, "pp")).includes("No linemates with 0:30 or more together in this window."));
});

// ---- Tags, tag footnotes and the show-all line (PLYR-04, D-11, D-26) ----

const tds = (html: string, name: string) => [...rowHtml(html, name).matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);
const tagCell = (html: string, name: string) => tds(html, name).at(-1) ?? "";

// Game 1 is the earlier game; games 2 and 3 are the team's last 2.
// Bravo 25% -> 45% (Rising), Charlie 0% -> 30% (New), Delta 40% -> 0% (Fading), Echo dressed only in game 1 (Out).
const tagGames = (): ResearchGame[] => {
  const all = { 1: sec(1000), 2: sec(1000), 3: sec(1000), 11: sec(1000), 12: sec(1000) };
  const withoutEcho = { 1: all[1], 2: all[2], 3: all[3], 11: all[11] };
  return [
    mkGame(1, "2026-10-01", [1, 2, 3, 11, 12], pairsOf(all, [[1, 2, sec(250)], [1, 11, sec(400)], [1, 12, sec(300)]])),
    mkGame(2, "2026-10-03", [1, 2, 3, 11], pairsOf(withoutEcho, [[1, 2, sec(450)], [1, 3, sec(300)]])),
    mkGame(3, "2026-10-05", [1, 2, 3, 11], pairsOf(withoutEcho, [[1, 2, sec(450)], [1, 3, sec(300)]])),
  ];
};
// Bravo shared half the earlier game and none of the recent ones; Charlie the reverse: a forward changed lines.
const lineChangeGames = (): ResearchGame[] => {
  const self = { 1: sec(1000), 2: sec(1000), 3: sec(1000) };
  return [
    mkGame(1, "2026-10-01", [1, 2, 3], pairsOf(self, [[1, 2, sec(500)]])),
    mkGame(2, "2026-10-03", [1, 2, 3], pairsOf(self, [[1, 3, sec(500)]])),
    mkGame(3, "2026-10-05", [1, 2, 3], pairsOf(self, [[1, 3, sec(500)]])),
  ];
};
// One game; 9 forwards and 6 defensemen each with a clear amount of time with Alpha.
const crowdGames = (): ResearchGame[] => {
  const ids = [...Array.from({ length: 9 }, (_, i) => 30 + i), ...Array.from({ length: 6 }, (_, i) => 40 + i)];
  const self: Record<number, Record<Situation, number>> = { 1: sec(2000) };
  for (const id of ids) self[id] = sec(1000);
  return [
    mkGame(1, "2026-10-01", [1, ...ids], pairsOf(self, ids.map((id, i): [number, number, Record<Situation, number>] => [1, id, sec(600 - 10 * i)]))),
  ];
};

test("with 3 or more games the table has a Tag column and the group rows span 4 columns; with 1 game neither", () => {
  const html = renderPanel(research());
  assert.ok(/<th scope="col"[^>]*>Tag<\/th>/.test(html), "Tag header");
  const spans = [...html.matchAll(/<th scope="rowgroup" colSpan="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(spans, ["4", "4"]);
  assert.equal(tds(html, "Bravo Winger").length, 4);

  const one = renderPanel(research([fixtureGames()[0]]));
  assert.ok(!/>Tag<\/th>/.test(one), "no Tag header");
  assert.deepEqual([...one.matchAll(/<th scope="rowgroup" colSpan="(\d+)"/g)].map((m) => m[1]), ["3", "3"]);
  assert.equal(tds(one, "Bravo Winger").length, 3);
  assert.ok(footnotes(one).some((n) => n.text === "Tags need 2 or more games. Choose Last 3 or more."), JSON.stringify(footnotes(one)));
});

test("tag chips: New is the one solid chip, Rising and Fading carry an aria-hidden glyph and the word, Out is dashed", () => {
  const html = renderPanel(research(tagGames()));
  const bravo = tagCell(html, "Bravo Winger");
  assert.ok(bravo.includes('<span aria-hidden="true">▲ </span>Rising'), bravo);
  assert.equal(unescape(bravo.match(/title="([^"]*)"/)?.[1] ?? ""), "Share of Alpha Center's EV time is up 15 or more points in the recent games");

  const charlie = tagCell(html, "Charlie Winger");
  assert.equal(stripTags(charlie), "New");
  assert.ok(classTokens(charlie).includes("bg-neutral-900") && classTokens(charlie).includes("text-white"), charlie);
  assert.equal(unescape(charlie.match(/title="([^"]*)"/)?.[1] ?? ""), "Little or no time together before the recent games");

  const delta = tagCell(html, "Delta Defense");
  assert.ok(delta.includes('<span aria-hidden="true">▼ </span>Fading'), delta);
  assert.equal(unescape(delta.match(/title="([^"]*)"/)?.[1] ?? ""), "Share of Alpha Center's EV time is down 15 or more points in the recent games");

  const echo = tagCell(html, "Echo Defense");
  assert.equal(stripTags(echo), "Out");
  assert.ok(classTokens(echo).includes("border-dashed"), echo);
  assert.equal(unescape(echo.match(/title="([^"]*)"/)?.[1] ?? ""), "Missed the recent games");

  for (const cell of [bravo, charlie, delta, echo]) {
    assert.ok(!/green|red/.test(cell), cell);
    assert.ok(classTokens(cell).includes("inline-block") && classTokens(cell).includes("rounded") && classTokens(cell).includes("whitespace-nowrap"), cell);
  }
});

test("a linemate with no tag has an empty Tag cell, not a dash", () => {
  const cell = tagCell(renderPanel(research()), "Bravo Winger");
  assert.equal(stripTags(cell), "");
  assert.ok(!cell.includes("—"));
});

test("the SC4 line change lists the New linemate above the Fading one in the forwards block", () => {
  const html = renderPanel(research(lineChangeGames()));
  assert.ok(html.indexOf("Charlie Winger") < html.indexOf("Bravo Winger"));
  assert.equal(stripTags(tagCell(html, "Charlie Winger")), "New");
  assert.equal(stripTags(tagCell(html, "Bravo Winger")), "Fading");
});

test("a capped list says how many are shown and links to Show all with all=1 kept on the other params", () => {
  const html = renderPanel(research(crowdGames()));
  const line = html.match(/<p class="text-xs text-neutral-500">Showing [\s\S]*?<\/p>/)?.[0] ?? "";
  assert.equal(stripTags(line), "Showing 10 of 15 linemates, most recent time together first. Show all 15");
  const link = line.match(/<a\b[^>]*>/)?.[0] ?? "";
  assert.equal(unescape(link.match(/href="([^"]*)"/)?.[1] ?? ""), researchHref("MTL", 5, DEFAULT_SORT, { player: 1, all: true }));
  assert.ok(classTokens(link).includes("underline") && classTokens(link).includes("text-xs"), link);
  assert.equal(squares(html).length, 10);
});

test("with all=1 the whole list shows with a Show fewer link that drops all", () => {
  const html = renderPanel(research(crowdGames()), 1, "ev", DEFAULT_SORT, true);
  const line = html.match(/<p class="text-xs text-neutral-500">Showing [\s\S]*?<\/p>/)?.[0] ?? "";
  assert.equal(stripTags(line), "Showing all 15 linemates. Show fewer");
  assert.equal(unescape(line.match(/href="([^"]*)"/)?.[1] ?? ""), researchHref("MTL", 5, DEFAULT_SORT, { player: 1 }));
  assert.ok(!(line.match(/href="([^"]*)"/)?.[1] ?? "").includes("all="));
  assert.equal(squares(html).length, 15);
});

test("a list with nothing hidden has no Showing line", () => {
  assert.ok(!stripTags(renderPanel(research())).includes("Showing"));
  assert.ok(!stripTags(renderPanel(research(), 1, "ev", DEFAULT_SORT, true)).includes("Showing"));
});

test("with all=1 every tab keeps it and the close link drops it", () => {
  const html = renderPanel(research(), 1, "ev", DEFAULT_SORT, true);
  assert.deepEqual(
    tabLinks(html).map((t) => t.href),
    (["ev", "pp", "sh"] as const).map((s) => researchHref("MTL", 5, DEFAULT_SORT, { player: 1, sit: s, all: true })),
  );
  for (const t of tabLinks(html)) assert.ok(t.href.includes("all=1"), t.href);
  const close = [...html.replace(/<nav[\s\S]*?<\/nav>/, "").matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1]));
  assert.deepEqual(close, [researchHref("MTL", 5, DEFAULT_SORT, { sit: "ev" })]);
});

test("legend line 3 appears whenever the Tag column does, and never in a 1-game window", () => {
  const line3 =
    "New, Rising, Fading and Out compare the team's last 2 games (in a 2-game window, the latest game) with the earlier games and need 2 or more games played. They describe time together only, not how good a linemate is. Rising and Fading mean a change of 15 or more points of share; Out means the linemate missed the recent games.";
  assert.ok(footnotes(renderPanel(research())).some((n) => n.text === line3));
  assert.ok(footnotes(renderPanel(research(tagGames()))).some((n) => n.text === line3));
  assert.ok(!footnotes(renderPanel(research([fixtureGames()[0]]))).some((n) => n.text === line3));
});

test("a player who dressed in 1 game gets no tags and a note saying so", () => {
  const games = [fixtureGames()[0], mkGame(2, "2026-10-03", [2], null), mkGame(3, "2026-10-05", [2], null)];
  const html = renderPanel(research(games));
  assert.ok(footnotes(html).some((n) => n.text === "No tags: Alpha Center played only 1 game in this window."), JSON.stringify(footnotes(html)));
  assert.equal(stripTags(tagCell(html, "Bravo Winger")), "");
});

test("a player who missed the team's last 2 games gets a note naming them", () => {
  const g = fixtureGames()[0];
  const games = [g, { ...g, id: 11, date: "2026-10-02" }, { ...g, id: 12, date: "2026-10-03" }, mkGame(13, "2026-10-04", [2], null), mkGame(14, "2026-10-05", [2], null)];
  const notes = footnotes(renderPanel(research(games))).map((n) => n.text);
  assert.ok(notes.includes("No tags: Alpha Center missed the team's last 2 games."), notes.join("|"));
});

test("a recent game without a shift chart explains why there are no tags, with 'latest game' in a 2-game window", () => {
  const withChart = fixtureGames()[0];
  const three = [withChart, mkGame(2, "2026-10-03", [1, 2], null), mkGame(3, "2026-10-05", [1, 2], null)];
  assert.ok(
    footnotes(renderPanel(research(three))).some((n) => n.text === "No tags: Alpha Center has no even-strength time with a shift chart in the team's last 2 games."),
  );
  const two = [withChart, mkGame(2, "2026-10-03", [1, 2], null)];
  assert.ok(
    footnotes(renderPanel(research(two))).some((n) => n.text === "No tags: Alpha Center has no even-strength time with a shift chart in the team's latest game."),
  );
});

test("a player with no earlier game to compare with gets a note", () => {
  const g = fixtureGames()[0];
  const games = [mkGame(11, "2026-10-01", [2], null), mkGame(12, "2026-10-02", [2], null), mkGame(13, "2026-10-03", [2], null), { ...g, id: 14, date: "2026-10-04" }, { ...g, id: 15, date: "2026-10-05" }];
  const notes = footnotes(renderPanel(research(games))).map((n) => n.text);
  assert.ok(notes.includes("No tags: Alpha Center has no earlier games in this window to compare with."), notes.join("|"));
});

test("the tag notes are not amber", () => {
  const games = [fixtureGames()[0], mkGame(2, "2026-10-03", [2], null), mkGame(3, "2026-10-05", [2], null)];
  const note = footnotes(renderPanel(research(games))).find((n) => n.text.startsWith("No tags:"));
  assert.ok(note && !classTokens(note.attrs).includes("text-amber-600"), JSON.stringify(note));
});
