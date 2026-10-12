import { test } from "node:test";
import assert from "node:assert/strict";
import type { PositionGroup, Situation } from "./lines";
import {
  buildLinemateView,
  gameColumnLabels,
  linemateCell,
  linemateDetail,
  linemateOpacity,
  recentStart,
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
