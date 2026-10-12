import { test } from "node:test";
import assert from "node:assert/strict";
import type { PositionGroup, Situation } from "./lines";
import {
  buildLinemateView,
  gameColumnLabels,
  LINEMATE_CAPS,
  LINEMATE_MIN_SECONDS,
  LINEMATE_NEW_EARLIER_MAX_POINTS,
  LINEMATE_TAG_POINTS,
  linemateCell,
  linemateDetail,
  linemateOpacity,
  recentStart,
  SITUATION_WORDS,
  type LinemateGame,
} from "./linemates";
import { detailText } from "./game-strip";
import type { GamePairs } from "./pair-seconds";
import type { ResearchPlayer } from "./team-games";

const PLAYER = 1;
const players = new Map<number, ResearchPlayer>([
  [1, { id: 1, name: "Alpha Forward", position: "C", group: "F" }],
  [2, { id: 2, name: "Bravo Forward", position: "L", group: "F" }],
  [3, { id: 3, name: "Charlie Forward", position: "R", group: "F" }],
  [4, { id: 4, name: "Delta Defense", position: "D", group: "D" }],
  [5, { id: 5, name: "Echo Goalie", position: "G", group: "G" }],
]);

/** Pair data for PLAYER in one situation; fills both directions of `together` like the real pass. */
function pairs(
  selfSeconds: number,
  together: Record<number, number>,
  groups: Record<number, PositionGroup> = {},
  situation: Situation = "ev",
): GamePairs {
  const rec = (s: number): Record<Situation, number> => ({ ev: 0, pp: 0, sh: 0, [situation]: s });
  const result: GamePairs = {
    self: new Map([[PLAYER, rec(selfSeconds)]]),
    together: new Map([[PLAYER, new Map()]]),
    groups: new Map([[PLAYER, "F"], ...Object.entries(groups).map(([id, g]) => [Number(id), g] as [number, PositionGroup])]),
  };
  for (const [id, secs] of Object.entries(together)) {
    result.self.set(Number(id), rec(secs));
    result.together.get(PLAYER)!.set(Number(id), rec(secs));
    result.together.set(Number(id), new Map([[PLAYER, rec(secs)]]));
  }
  return result;
}

function game(day: number, dressed: number[], pair: GamePairs | null, overtime: "OT" | "SO" | null = null): LinemateGame {
  return {
    id: 2026020000 + day,
    date: `2026-10-${String(day).padStart(2, "0")}`,
    home: true,
    opponent: "BOS",
    score: { for: 3, against: 2 },
    toi: new Map(dressed.map((id) => [id, 900])),
    overtime,
    pairs: pair,
  };
}

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);
const allRows = (v: ReturnType<typeof buildLinemateView>) => [...v.forwards, ...v.defense];

test("recentStart is the team's last 2 games, the latest game of a 2-game window, and none for 1 game", () => {
  assert.equal(recentStart(1), null);
  assert.equal(recentStart(2), 1);
  assert.equal(recentStart(3), 1);
  assert.equal(recentStart(5), 3);
  assert.equal(recentStart(10), 8);
});

test("linemateOpacity runs from 0.2 to 1 and saturates at a 75% share", () => {
  close(linemateOpacity(0), 0.2);
  close(linemateOpacity(0.375), 0.6);
  close(linemateOpacity(0.75), 1);
  close(linemateOpacity(1), 1);
});

test("linemateCell is unknown without a shift chart even when both players dressed", () => {
  const cell = linemateCell(game(1, [1, 2], null), 1, 2, "ev");
  assert.deepEqual(cell, { state: "unknown", seconds: null, share: null, selfSeconds: null, absentReason: null });
});

test("linemateCell is absent when the player did not dress", () => {
  const cell = linemateCell(game(1, [2], pairs(600, { 2: 300 })), 1, 2, "ev");
  assert.equal(cell.state, "absent");
  assert.equal(cell.absentReason, "player-missed");
  assert.equal(cell.seconds, null);
});

test("linemateCell is absent when the player had no time in the situation", () => {
  const cell = linemateCell(game(1, [1, 2], pairs(0, {})), 1, 2, "ev");
  assert.equal(cell.state, "absent");
  assert.equal(cell.absentReason, "no-situation-time");
  assert.equal(cell.share, null);
});

test("linemateCell is absent when the linemate did not dress", () => {
  const cell = linemateCell(game(1, [1], pairs(600, {})), 1, 2, "ev");
  assert.equal(cell.state, "absent");
  assert.equal(cell.absentReason, "linemate-missed");
});

test("linemateCell reasons are checked player-missed, then no-situation-time, then linemate-missed", () => {
  assert.equal(linemateCell(game(1, [], pairs(0, {})), 1, 2, "ev").absentReason, "player-missed");
  assert.equal(linemateCell(game(1, [1], pairs(0, {})), 1, 2, "ev").absentReason, "no-situation-time");
  assert.equal(linemateCell(game(1, [1], pairs(600, {})), 1, 2, "ev").absentReason, "linemate-missed");
});

test("linemateCell is apart with share 0 when both dressed and shared no time", () => {
  const cell = linemateCell(game(1, [1, 2], pairs(600, {})), 1, 2, "ev");
  assert.equal(cell.state, "apart");
  assert.equal(cell.seconds, 0);
  assert.equal(cell.share, 0);
  assert.equal(cell.selfSeconds, 600);
});

test("linemateCell is together with the share of the player's own situation seconds", () => {
  const cell = linemateCell(game(1, [1, 2], pairs(600, { 2: 240 })), 1, 2, "ev");
  assert.equal(cell.state, "together");
  assert.equal(cell.seconds, 240);
  close(cell.share!, 0.4);
  assert.equal(cell.selfSeconds, 600);
});

test("window share pools only counted games, so a linemate's missed games do not dilute it", () => {
  const games = [
    game(1, [1], pairs(600, {})), // linemate missed
    game(2, [1, 2], pairs(600, { 2: 300 })),
    game(3, [1], pairs(600, {})), // linemate missed
    game(4, [1, 2], pairs(600, { 2: 150 })),
  ];
  const [row] = allRows(buildLinemateView(games, players, PLAYER, "ev"));
  close(row.windowShare!, 450 / 1200);
  assert.equal(row.totalSeconds, 450);
  assert.deepEqual(row.cells.map((c) => c.state), ["absent", "together", "absent", "together"]);
});

test("a game without a shift chart never enters the share or the total", () => {
  const games = [game(1, [1, 2], null), game(2, [1, 2], pairs(600, { 2: 300 })), game(3, [1, 2], pairs(600, { 2: 300 }))];
  const [row] = allRows(buildLinemateView(games, players, PLAYER, "ev"));
  close(row.windowShare!, 0.5);
  assert.equal(row.totalSeconds, 600);
  assert.equal(row.cells[0].state, "unknown");
});

test("a linemate with no counted game is not listed", () => {
  const games = [game(1, [1], pairs(600, { 2: 300 })), game(2, [1], pairs(600, { 2: 300 }))]; // linemate 2 never dressed
  assert.equal(allRows(buildLinemateView(games, players, PLAYER, "ev")).length, 0);
});

test("the listing minimum is 2:00 at EV and 0:30 on special teams", () => {
  const ev119 = [game(1, [1, 2], pairs(600, { 2: 119 }))];
  const ev120 = [game(1, [1, 2], pairs(600, { 2: 120 }))];
  assert.equal(allRows(buildLinemateView(ev119, players, PLAYER, "ev")).length, 0);
  assert.equal(allRows(buildLinemateView(ev120, players, PLAYER, "ev")).length, 1);
  const pp29 = [game(1, [1, 2], pairs(60, { 2: 29 }, {}, "pp"))];
  const pp30 = [game(1, [1, 2], pairs(60, { 2: 30 }, {}, "pp"))];
  assert.equal(allRows(buildLinemateView(pp29, players, PLAYER, "pp")).length, 0);
  assert.equal(allRows(buildLinemateView(pp30, players, PLAYER, "pp")).length, 1);
  assert.equal(allRows(buildLinemateView(pp30, players, PLAYER, "ev")).length, 0);
});

test("recent time ranks first even with a lower window total (synthetic line change with near-zero earlier overlap)", () => {
  const dressed = [1, 2, 3];
  const games = [
    game(1, dressed, pairs(600, { 2: 600, 3: 0 })),
    game(2, dressed, pairs(600, { 2: 600, 3: 0 })),
    game(3, dressed, pairs(600, { 2: 600, 3: 0 })),
    game(4, dressed, pairs(600, { 2: 0, 3: 400 })),
    game(5, dressed, pairs(600, { 2: 0, 3: 400 })),
  ];
  const ids = allRows(buildLinemateView(games, players, PLAYER, "ev")).map((r) => r.player.id);
  assert.deepEqual(ids, [3, 2]);
});

test("equal recent time orders by window total, then by id", () => {
  const dressed = [1, 2, 3, 4];
  const games = [
    game(1, dressed, pairs(600, { 2: 100, 3: 300, 4: 300 }, { 4: "F" })),
    game(2, dressed, pairs(600, { 2: 200, 3: 200, 4: 200 }, { 4: "F" })),
  ];
  const ids = allRows(buildLinemateView(games, players, PLAYER, "ev")).map((r) => r.player.id);
  assert.deepEqual(ids, [3, 4, 2]);
});

test("a linemate is listed under the position group he played in most games", () => {
  const dressed = [1, 2];
  const g = (day: number, group: PositionGroup) => game(day, dressed, pairs(600, { 2: 100 }, { 2: group }));
  const view = buildLinemateView([g(1, "F"), g(2, "F"), g(3, "F"), g(4, "D"), g(5, "D")], players, PLAYER, "ev");
  assert.deepEqual(view.forwards.map((r) => r.player.id), [2]);
  assert.equal(view.defense.length, 0);
});

test("a tie between position groups goes to the group of the latest game", () => {
  const dressed = [1, 2];
  const g = (day: number, group: PositionGroup) => game(day, dressed, pairs(600, { 2: 100 }, { 2: group }));
  const endsD = buildLinemateView([g(1, "F"), g(2, "F"), g(3, "D"), g(4, "D")], players, PLAYER, "ev");
  assert.deepEqual(endsD.defense.map((r) => r.player.id), [2]);
  assert.equal(endsD.forwards.length, 0);
  const endsF = buildLinemateView([g(1, "D"), g(2, "D"), g(3, "F"), g(4, "F")], players, PLAYER, "ev");
  assert.deepEqual(endsF.forwards.map((r) => r.player.id), [2]);
});

test("defense linemates go in the defense block, forwards in the forwards block", () => {
  const games = [game(1, [1, 2, 4], pairs(600, { 2: 300, 4: 300 }, { 2: "F", 4: "D" }))];
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.deepEqual(view.forwards.map((r) => r.player.id), [2]);
  assert.deepEqual(view.defense.map((r) => r.player.id), [4]);
});

test("the selected player is never his own linemate and a goalie is never listed", () => {
  const p = pairs(600, { 2: 300, 5: 300 });
  p.together.get(PLAYER)!.set(PLAYER, { ev: 600, pp: 0, sh: 0 });
  const view = buildLinemateView([game(1, [1, 2, 5], p)], players, PLAYER, "ev");
  assert.deepEqual(allRows(view).map((r) => r.player.id), [2]);
});

test("gameColumnLabels shows the month on the first game and where it changes", () => {
  const labels = gameColumnLabels(["2026-10-30", "2026-10-31", "2026-11-02"]);
  assert.deepEqual(labels.map((l) => l.month), ["Oct", null, "Nov"]);
  assert.deepEqual(labels.map((l) => l.day), ["30", "31", "2"]);
});

const names = { linemate: "Bravo Forward", player: "Alpha Forward" };

test("linemateDetail text for a together cell lists the heading, game, time, share and the player's time", () => {
  const g = game(1, [1, 2], pairs(600, { 2: 240 }));
  const cell = linemateCell(g, 1, 2, "ev");
  assert.equal(
    detailText(linemateDetail(cell, g, names, "ev", "MTL")),
    "Bravo Forward · Oct 1 vs BOS · W 3–2 · Together 4:00 · Share of EV time 40% · Player's EV time 10:00",
  );
});

test("linemateDetail for absent and unknown cells says why and shows no 0:00 or %", () => {
  const cases: [LinemateGame, string][] = [
    [game(1, [1], pairs(600, {})), "Bravo Forward did not play for MTL"],
    [game(1, [2], pairs(600, { 2: 300 })), "Alpha Forward did not play"],
    [game(1, [1, 2], pairs(0, {})), "Alpha Forward had no EV time this game"],
    [game(1, [1, 2], null), "No shift chart for this game · Left out of shares and tags"],
  ];
  for (const [g, note] of cases) {
    const text = detailText(linemateDetail(linemateCell(g, 1, 2, "ev"), g, names, "ev", "MTL"));
    assert.ok(text.endsWith(note), text);
    assert.ok(!text.includes("0:00") && !text.includes("%"), text);
  }
});

test("linemateDetail adds the OT period tag for an overtime game", () => {
  const g = game(1, [1, 2], pairs(600, { 2: 240 }), "OT");
  const text = detailText(linemateDetail(linemateCell(g, 1, 2, "ev"), g, names, "ev", "MTL"));
  assert.ok(text.includes("Oct 1 vs BOS · W 3–2 · OT · Together 4:00"), text);
});

test("SITUATION_WORDS are the words used in sentences", () => {
  assert.deepEqual(SITUATION_WORDS, { ev: "even-strength", pp: "power-play", sh: "penalty-kill" });
});

test("emptyReason is no-chart when every game the player dressed for lacks a shift chart", () => {
  const games = [game(1, [1, 2], null), game(2, [1, 2], null)];
  assert.equal(buildLinemateView(games, players, PLAYER, "ev").emptyReason, "no-chart");
});

test("emptyReason judges no-chart over the games the player dressed for, not the whole window", () => {
  // Game 1 has a chart but the player did not dress; the games he played in have none: he must not be told he had no time.
  const games = [game(1, [2], pairs(600, { 2: 300 })), game(2, [1, 2], null)];
  assert.equal(buildLinemateView(games, players, PLAYER, "ev").emptyReason, "no-chart");
});

test("emptyReason is no-situation-time when he has charts but zero seconds in the situation", () => {
  const games = [game(1, [1, 2], pairs(600, { 2: 300 })), game(2, [1, 2], pairs(600, { 2: 300 }))];
  assert.equal(buildLinemateView(games, players, PLAYER, "pp").emptyReason, "no-situation-time");
  assert.equal(buildLinemateView(games, players, PLAYER, "sh").emptyReason, "no-situation-time");
});

test("emptyReason is below-minimum when he has situation time but no linemate reaches the minimum", () => {
  const games = [game(1, [1, 2], pairs(600, { 2: 100 }))];
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.equal(allRows(view).length, 0);
  assert.equal(view.emptyReason, "below-minimum");
});

test("emptyReason is below-minimum when nobody shared the ice at all", () => {
  assert.equal(buildLinemateView([game(1, [1], pairs(600, {}))], players, PLAYER, "ev").emptyReason, "below-minimum");
});

test("emptyReason is null when a linemate is listed", () => {
  const games = [game(1, [1, 2], pairs(600, { 2: 300 }))];
  assert.equal(buildLinemateView(games, players, PLAYER, "ev").emptyReason, null);
});

test("emptyReason precedence is no-chart, then no-situation-time, then below-minimum", () => {
  // No chart and no time: no-chart wins.
  assert.equal(buildLinemateView([game(1, [1], null)], players, PLAYER, "pp").emptyReason, "no-chart");
  // Chart, no time, and (vacuously) no linemate above the minimum: no-situation-time wins.
  assert.equal(buildLinemateView([game(1, [1, 2], pairs(600, { 2: 100 }))], players, PLAYER, "pp").emptyReason, "no-situation-time");
});

test("a game without a chart does not turn the empty reason into no-chart while another game has one", () => {
  const games = [game(1, [1, 2], null), game(2, [1, 2], pairs(600, { 2: 60 }))];
  assert.equal(buildLinemateView(games, players, PLAYER, "ev").emptyReason, "below-minimum");
});

test("noChartDates lists the dates of window games without a shift chart, oldest first", () => {
  const games = [game(8, [1, 2], null), game(9, [1, 2], pairs(600, { 2: 300 })), game(10, [1], null)];
  assert.deepEqual(buildLinemateView(games, players, PLAYER, "ev").noChartDates, ["2026-10-08", "2026-10-10"]);
});

test("noChartDates includes a game the player missed and is empty when every game has a chart", () => {
  assert.deepEqual(buildLinemateView([game(8, [2], null)], players, PLAYER, "ev").noChartDates, ["2026-10-08"]);
  assert.deepEqual(buildLinemateView([game(8, [1, 2], pairs(600, { 2: 300 }))], players, PLAYER, "ev").noChartDates, []);
});

// ---- Tags, tag availability and the cap (PLYR-04, D-11, D-14..D-18, D-20, D-26) ----

const wide = new Map<number, ResearchPlayer>([
  ...players,
  ...[10, 11, 12, 13, 14, 15, 16, 17, 18].map((id): [number, ResearchPlayer] => [id, { id, name: `Forward ${id}`, position: "C", group: "F" }]),
  ...[20, 21, 22, 23, 24, 25].map((id): [number, ResearchPlayer] => [id, { id, name: `Defense ${id}`, position: "D", group: "D" }]),
]);
const tagOf = (v: ReturnType<typeof buildLinemateView>, id: number) => allRows(v).find((r) => r.player.id === id)?.tag;

test("tag constants are single named values: 15 points, and New below 10 points earlier", () => {
  assert.equal(LINEMATE_TAG_POINTS, 15);
  assert.equal(LINEMATE_NEW_EARLIER_MAX_POINTS, 10);
  assert.deepEqual(LINEMATE_CAPS, { ev: { F: 6, D: 4 }, pp: { F: 4, D: 3 }, sh: { F: 4, D: 3 } });
});

// Synthetic line change with near-zero earlier overlap: P skated with 10 and 11 earlier and with 12 and 13 in the recent games.
for (const n of [2, 3, 5]) {
  test(`line change in a ${n}-game window: the new linemates are New and listed first, the old ones Fading`, () => {
    const start = recentStart(n)!;
    const dressed = [1, 10, 11, 12, 13];
    const games = Array.from({ length: n }, (_, i) =>
      game(i + 1, dressed, i < start ? pairs(600, { 10: 300, 11: 300, 12: 0, 13: 0 }) : pairs(600, { 10: 0, 11: 0, 12: 300, 13: 300 })),
    );
    const view = buildLinemateView(games, wide, PLAYER, "ev");
    assert.equal(view.tags.available, true);
    assert.deepEqual(view.forwards.map((r) => [r.player.id, r.tag]), [[12, "New"], [13, "New"], [10, "Fading"], [11, "Fading"]]);
  });
}

test("line change: old linemates who did not dress in the recent games are Out, not Fading", () => {
  const games = [
    game(1, [1, 10, 11, 12], pairs(600, { 10: 300, 11: 300, 12: 0 })),
    game(2, [1, 10, 11, 12], pairs(600, { 10: 300, 11: 300, 12: 0 })),
    game(3, [1, 12], pairs(600, { 12: 300 })),
  ];
  const view = buildLinemateView(games, wide, PLAYER, "ev");
  assert.deepEqual(view.forwards.map((r) => [r.player.id, r.tag]), [[12, "New"], [10, "Out"], [11, "Out"]]);
});

test("a linemate who dressed in none of the recent games is Out even with a 60% earlier share", () => {
  const games = [
    game(1, [1, 2], pairs(1000, { 2: 600 })),
    game(2, [1, 2], pairs(1000, { 2: 600 })),
    game(3, [1, 2], pairs(1000, { 2: 600 })),
    game(4, [1, 3], pairs(1000, { 3: 500 })),
    game(5, [1, 3], pairs(1000, { 3: 500 })),
  ];
  assert.equal(tagOf(buildLinemateView(games, players, PLAYER, "ev"), 2), "Out");
});

/** 3-game window: game 1 earlier, games 2-3 recent. Each share is per 1000 s of the player's time. */
function shareWindow(earlier: number, recent: number) {
  return [
    game(1, [1, 2], pairs(1000, { 2: earlier })),
    game(2, [1, 2], pairs(1000, { 2: recent })),
    game(3, [1, 2], pairs(1000, { 2: recent })),
  ];
}
const tagForShares = (earlier: number, recent: number) => buildLinemateView(shareWindow(earlier, recent), players, PLAYER, "ev").forwards[0].tag;

test("boundary on rounded shares: 40 against 25 is Rising, 39 against 25 is no tag, 10 against 25 is Fading", () => {
  assert.equal(tagForShares(250, 400), "Rising");
  assert.equal(tagForShares(250, 390), null);
  assert.equal(tagForShares(250, 100), "Fading");
  assert.equal(tagForShares(250, 110), null);
});

test("the 15-point test uses the rounded shares: 40.4 against 25.5 rounds to 40 against 26 and gets no tag", () => {
  assert.equal(tagForShares(255, 404), null);
});

test("a 15-point rise from a rounded earlier share of 9 is New, from 10 it is Rising", () => {
  assert.equal(tagForShares(90, 240), "New");
  assert.equal(tagForShares(100, 250), "Rising");
});

test("a linemate with no counted earlier game and a 30% recent share is New, and his absent earlier game is not in the window share", () => {
  const games = [game(1, [1], pairs(1000, {})), game(2, [1, 2], pairs(1000, { 2: 300 })), game(3, [1, 2], pairs(1000, { 2: 300 }))];
  const [row] = buildLinemateView(games, players, PLAYER, "ev").forwards;
  assert.equal(row.tag, "New");
  assert.equal(row.cells[0].state, "absent");
  close(row.windowShare!, 0.3);
});

test("a linemate who still dresses but spent the recent games apart after a 40% earlier share is Fading", () => {
  assert.equal(tagForShares(400, 0), "Fading");
});

test("games without a shift chart, or where a player missed, never count toward a tag's shares", () => {
  // Game 2 has no chart; game 3 the linemate missed. The only counted recent cell is game 4 (30% against 30%): no tag.
  const games = [
    game(1, [1, 2], pairs(1000, { 2: 300 })),
    game(2, [1, 2], null),
    game(3, [1], pairs(1000, {})),
    game(4, [1, 2], pairs(1000, { 2: 300 })),
  ];
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.equal(view.tags.available, true);
  assert.equal(tagOf(view, 2), null);
});

test("a linemate who dressed in the recent games but has no counted recent game gets no tag", () => {
  // Game 2 has a chart but linemate 2 missed it; his only recent dressed game (3) has no chart. He is not Out, and not Fading.
  const games = [game(1, [1, 2], pairs(1000, { 2: 300 })), game(2, [1], pairs(1000, {})), game(3, [1, 2], null)];
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.equal(view.tags.available, true);
  assert.equal(tagOf(view, 2), null);
});

test("tag availability: a 1-game window has no tags", () => {
  const view = buildLinemateView([game(1, [1, 2], pairs(600, { 2: 300 }))], players, PLAYER, "ev");
  assert.deepEqual(view.tags, { available: false, reason: "one-game", dressedGames: 1 });
  assert.deepEqual(allRows(view).map((r) => r.tag), [null]);
});

test("tag availability: a player who dressed in 1 of 3 games has no tags", () => {
  const games = [game(1, [1, 2], pairs(600, { 2: 300 })), game(2, [2], pairs(600, { 2: 300 })), game(3, [2], pairs(600, { 2: 300 }))];
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.deepEqual(view.tags, { available: false, reason: "played-fewer-than-2", dressedGames: 1 });
  assert.ok(allRows(view).every((r) => r.tag === null));
});

test("tag availability: a player who dressed in the 3 earlier games of 5 but neither recent one has no tags (missed-recent)", () => {
  const games = [1, 2, 3].map((d) => game(d, [1, 2], pairs(600, { 2: 300 }))).concat([4, 5].map((d) => game(d, [2], pairs(600, { 2: 300 }))));
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.deepEqual(view.tags, { available: false, reason: "missed-recent", dressedGames: 3 });
  assert.ok(allRows(view).every((r) => r.tag === null));
});

test("tag availability: dressed in the recent games but both lack a chart is no-recent-data", () => {
  const games = [game(1, [1, 2], pairs(600, { 2: 300 })), game(2, [1, 2], null), game(3, [1, 2], null)];
  assert.equal(buildLinemateView(games, players, PLAYER, "ev").tags.reason, "no-recent-data");
});

test("tag availability: dressed only in the 2 recent games of 5 is no-earlier-data", () => {
  const games = [1, 2, 3].map((d) => game(d, [2], pairs(600, { 2: 300 }))).concat([4, 5].map((d) => game(d, [1, 2], pairs(600, { 2: 300 }))));
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.deepEqual(view.tags, { available: false, reason: "no-earlier-data", dressedGames: 2 });
});

test("tag availability: no time in the situation in the recent games is no-recent-data for that tab", () => {
  const games = [game(1, [1, 2], pairs(600, { 2: 30 }, {}, "pp")), game(2, [1, 2], pairs(600, { 2: 300 })), game(3, [1, 2], pairs(600, { 2: 300 }))];
  assert.equal(buildLinemateView(games, players, PLAYER, "pp").tags.reason, "no-recent-data");
  assert.equal(buildLinemateView(games, players, PLAYER, "ev").tags.reason, "no-earlier-data");
});

test("a 2-game window compares the latest game with the game before it", () => {
  const games = [game(1, [1, 2], pairs(1000, { 2: 100 })), game(2, [1, 2], pairs(1000, { 2: 500 }))];
  const view = buildLinemateView(games, players, PLAYER, "ev");
  assert.equal(view.tags.available, true);
  assert.equal(tagOf(view, 2), "Rising");
});

/** One game, `forwards` forwards (ids 10..) and `defense` defensemen (ids 20..), the earlier ids with the most time, all untagged. */
function crowd(situation: Situation, forwards: number, defense: number, extra: Record<number, number> = {}) {
  const together: Record<number, number> = { ...extra };
  const groups: Record<number, PositionGroup> = {};
  for (let i = 0; i < forwards; i++) ((together[10 + i] = 600 - 10 * i), (groups[10 + i] = "F"));
  for (let i = 0; i < defense; i++) ((together[20 + i] = 500 - 10 * i), (groups[20 + i] = "D"));
  const dressed = [1, ...Object.keys(together).map(Number)];
  return [game(1, dressed, pairs(1000, together, groups, situation))];
}

test("cap at EV: 9 forwards and 6 defensemen show 6 and 4 of 15; all lifts it", () => {
  const games = crowd("ev", 9, 6);
  const capped = buildLinemateView(games, wide, PLAYER, "ev");
  assert.equal(capped.forwards.length, 6);
  assert.equal(capped.defense.length, 4);
  assert.equal(capped.total, 15);
  assert.equal(capped.cappedCount, 10);
  const open = buildLinemateView(games, wide, PLAYER, "ev", { all: true });
  assert.equal(open.forwards.length, 9);
  assert.equal(open.defense.length, 6);
  assert.equal(open.total, 15);
  assert.equal(open.cappedCount, 10);
});

test("cap on special teams is 4 forwards and 3 defense", () => {
  for (const sit of ["pp", "sh"] as const) {
    const view = buildLinemateView(crowd(sit, 9, 6), wide, PLAYER, sit);
    assert.deepEqual([view.forwards.length, view.defense.length, view.total, view.cappedCount], [4, 3, 15, 7]);
  }
});

test("a tagged forward at position 8 is shown under the cap", () => {
  // Forwards 10-16 hold 40% in every game, so no tag. Forward 17 goes from nothing to 30% (New) but ranks 8th; 18 stays at 10%.
  const dressed = [1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25];
  const groups: Record<number, PositionGroup> = Object.fromEntries(dressed.slice(1).map((id) => [id, id < 20 ? "F" : "D"]));
  const steady: Record<number, number> = { 10: 600, 11: 590, 12: 580, 13: 570, 14: 560, 15: 550, 16: 540, 18: 100, 20: 400, 21: 390, 22: 380, 23: 370, 24: 360, 25: 350 };
  const games = [
    game(1, dressed, pairs(1000, { ...steady, 17: 0 }, groups)),
    game(2, dressed, pairs(1000, { ...steady, 17: 300 }, groups)),
    game(3, dressed, pairs(1000, { ...steady, 17: 300 }, groups)),
  ];
  const view = buildLinemateView(games, wide, PLAYER, "ev");
  assert.deepEqual(view.forwards.map((r) => r.player.id), [10, 11, 12, 13, 14, 15, 17]);
  assert.equal(view.forwards[6].tag, "New");
  assert.equal(view.defense.length, 4);
  assert.equal(view.total, 15);
  assert.equal(view.cappedCount, 11);
});

test("all lifts the cap but never lists a linemate below the minimum", () => {
  const games = crowd("ev", 9, 6, { 3: LINEMATE_MIN_SECONDS.ev - 1 });
  const view = buildLinemateView(games, wide, PLAYER, "ev", { all: true });
  assert.equal(view.total, 15);
  assert.ok(!allRows(view).some((r) => r.player.id === 3));
});
