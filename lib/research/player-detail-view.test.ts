import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerLinemates } from "@/components/PlayerLinemates";
import { ToiTrends } from "@/components/ToiTrends";
import type { Situation } from "./lines";
import type { GamePairs } from "./pair-seconds";
import type { ResearchGame, ResearchPlayer, TeamResearch } from "./team-games";
import { DEFAULT_SORT } from "./toi-trends";

// Player 1 is the subject. 2 and 3 are forwards, 11 and 12 defensemen, 20 a goalie.
const players = new Map<number, ResearchPlayer>([
  [1, { id: 1, name: "Alpha Center", position: "C", group: "F" }],
  [2, { id: 2, name: "Bravo Winger", position: "L", group: "F" }],
  [3, { id: 3, name: "Charlie Winger", position: "R", group: "F" }],
  [11, { id: 11, name: "Delta Defense", position: "D", group: "D" }],
  [12, { id: 12, name: "Echo Defense", position: "D", group: "D" }],
  [20, { id: 20, name: "Golf Goalie", position: "G", group: "G" }],
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
const renderPanel = (r: TeamResearch, playerId = 1, sit: Situation = "ev") =>
  renderToStaticMarkup(createElement(PlayerLinemates, { research: r, playerId, sit, team: "MTL", gameCount: 5, sort: DEFAULT_SORT }));

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
