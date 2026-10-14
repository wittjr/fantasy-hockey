import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NhlPlayByPlay } from "@/lib/nhl/client";
import { attributeEvents, buildGameEvents, onIceAt, type EventCounts } from "./events";
import { analyzeGameLines, bucketOnIce, dedupeOnIce, parseClock, situationFor, type OnIce, type PositionGroup, type ShiftInput } from "./lines";
import { toGameEvents, type EventKind, type GameEvent } from "./play-events";

// The DATA-03 gate: counts from real NHL payloads must reproduce the official boxscore.
// GATE_FIXTURES are games whose team SOG and every skater's plus-minus are reconciled;
// ALL_FIXTURES is every committed fixture. Later plans append to both.
const GATE_FIXTURES = [2025020084];
export const ALL_FIXTURES = [2025020084];

interface Fixture {
  gameId: number;
  category: string;
  homeTeam: { id: number; abbrev: string; sog: number };
  awayTeam: { id: number; abbrev: string; sog: number };
  plays: NhlPlayByPlay["plays"];
  shifts: Array<[number, string, number, string, string]>;
  players: Array<[number, "home" | "away", PositionGroup, number | null, string]>;
}

const NO_ONE: OnIce = { skaters: [], goalie: false };

function load(id: number) {
  const fixture: Fixture = JSON.parse(readFileSync(path.join(__dirname, "fixtures", id + ".json"), "utf8"));
  const pbp: NhlPlayByPlay = {
    id: fixture.gameId,
    homeTeam: { id: fixture.homeTeam.id, abbrev: fixture.homeTeam.abbrev },
    awayTeam: { id: fixture.awayTeam.id, abbrev: fixture.awayTeam.abbrev },
    plays: fixture.plays,
  };
  // Same tolerant mapping as team-games.ts: skip a row when either clock is malformed.
  const shifts: ShiftInput[] = fixture.shifts.flatMap(([playerId, team, period, start, end]) => {
    const startSec = parseClock(start);
    const endSec = parseClock(end);
    return startSec === null || endSec === null ? [] : [{ playerId, team, period, startSec, endSec }];
  });
  const positions = new Map<number, PositionGroup>(fixture.players.map(([playerId, , group]) => [playerId, group]));
  return { fixture, pbp, shifts, positions };
}

for (const id of GATE_FIXTURES) {
  const { fixture, pbp, shifts, positions } = load(id);
  const events = toGameEvents(pbp);
  const teams = [
    { abbrev: fixture.homeTeam.abbrev, sog: fixture.homeTeam.sog, opp: fixture.awayTeam },
    { abbrev: fixture.awayTeam.abbrev, sog: fixture.awayTeam.sog, opp: fixture.homeTeam },
  ];
  const isSog = (e: { kind: string }) => e.kind === "goal" || e.kind === "shot-on-goal";

  for (const { abbrev, sog, opp } of teams) {
    test(`${id} ${abbrev}: shots on goal from play-by-play equal the boxscore SOG`, () => {
      const own = events.filter((e) => e.team === abbrev && isSog(e) && e.exclusion !== "shootout");
      assert.equal(own.length, sog);
    });

    test(`${id} ${abbrev}: attributed shots plus penalty shots equal the boxscore SOG for and against`, () => {
      const attributed = attributeEvents(abbrev, shifts, positions, events);
      assert.equal(attributed.unattributed, 0);
      const sum = (key: "sf" | "sa") => attributed.total.ev[key] + attributed.total.pp[key] + attributed.total.sh[key];
      const penaltyShots = (team: string) => events.filter((e) => e.team === team && e.exclusion === "penalty-shot" && isSog(e)).length;
      assert.equal(sum("sf") + penaltyShots(abbrev), sog);
      assert.equal(sum("sa") + penaltyShots(opp.abbrev), opp.sog);
    });
  }

  test(`${id}: every skater's plus-minus recomputed from attributed goals equals the boxscore`, () => {
    const buckets = bucketOnIce(shifts, positions);
    const computed = new Map<number, number>();
    for (const event of events) {
      if (event.kind !== "goal" || event.exclusion !== null) continue;
      const byTeam = onIceAt(buckets, event.period, event.t);
      assert.ok(byTeam, `no shift data for the goal at period ${event.period} ${event.t}s`);
      const scoringOnIce = dedupeOnIce(byTeam.get(event.team) ?? NO_ONE);
      const otherAbbrev = event.team === fixture.homeTeam.abbrev ? fixture.awayTeam.abbrev : fixture.homeTeam.abbrev;
      const otherOnIce = dedupeOnIce(byTeam.get(otherAbbrev) ?? NO_ONE);
      // Official plus-minus ignores power-play goals for.
      if (situationFor(scoringOnIce, otherOnIce) === "pp") continue;
      for (const playerId of scoringOnIce.skaters) computed.set(playerId, (computed.get(playerId) ?? 0) + 1);
      for (const playerId of otherOnIce.skaters) computed.set(playerId, (computed.get(playerId) ?? 0) - 1);
    }
    for (const [playerId, , group, plusMinus, name] of fixture.players) {
      if (group === "G") continue;
      assert.equal(computed.get(playerId) ?? 0, plusMinus, `${name} (${playerId}) plus-minus`);
    }
  });
}

// ---- Attribution rules on synthetic games (plan 03-02) ----
// BUF: forwards 1-6, D 11-14, G 20. OPP: forwards 101-106, D 111-114, G 120.
const synthPositions = new Map<number, PositionGroup>([
  ...[1, 2, 3, 4, 5, 6].map((id) => [id, "F"] as [number, PositionGroup]),
  ...[11, 12, 13, 14].map((id) => [id, "D"] as [number, PositionGroup]),
  [20, "G"],
  ...[101, 102, 103, 104, 105, 106].map((id) => [id, "F"] as [number, PositionGroup]),
  ...[111, 112, 113, 114].map((id) => [id, "D"] as [number, PositionGroup]),
  [120, "G"],
]);

function synthShifts(team: string, ids: number[], startSec: number, endSec: number, period = 1): ShiftInput[] {
  return ids.map((playerId) => ({ playerId, team, period, startSec, endSec }));
}

function synthEvent(team: string, period: number, t: number, kind: EventKind = "shot-on-goal", extra: Partial<GameEvent> = {}): GameEvent {
  return { team, period, t, kind, exclusion: null, pulledGoalie: false, situationCode: "1551", ...extra };
}

const BUF_FULL = [1, 2, 3, 11, 12, 20];
const OPP_FULL = [101, 102, 103, 111, 112, 120];
const counts = (c: Partial<EventCounts>): EventCounts => ({ gf: 0, ga: 0, sf: 0, sa: 0, cf: 0, ca: 0, ...c });
const fiveOnFive = (end: number, period = 1) => [...synthShifts("BUF", BUF_FULL, 0, end, period), ...synthShifts("OPP", OPP_FULL, 0, end, period)];
const unitCount = (r: ReturnType<typeof attributeEvents>) =>
  (["ev", "pp", "sh"] as const).reduce((n, s) => n + r.byUnit[s].F.size + r.byUnit[s].D.size, 0);

test("onIceAt sees a shift that ends at t and not one that starts at t (start < t <= end)", () => {
  const ending = bucketOnIce(synthShifts("BUF", BUF_FULL, 0, 60), synthPositions);
  assert.deepEqual(onIceAt(ending, 1, 60)?.get("BUF")?.skaters, [1, 2, 3, 11, 12]);
  assert.equal(onIceAt(ending, 1, 61), undefined);

  const starting = bucketOnIce(synthShifts("BUF", BUF_FULL, 60, 120), synthPositions);
  assert.equal(onIceAt(starting, 1, 60), undefined);
  assert.deepEqual(onIceAt(starting, 1, 61)?.get("BUF")?.skaters, [1, 2, 3, 11, 12]);
});

test("onIceAt reads no second for 00:00, even when the previous period's last second has a shift", () => {
  const buckets = bucketOnIce(synthShifts("BUF", BUF_FULL, 0, 1200), synthPositions);
  assert.equal(onIceAt(buckets, 1, 0), undefined);
  assert.equal(onIceAt(buckets, 2, 0), undefined);
});

test("onIceAt offsets a later period by (period - 1) * 1200", () => {
  const buckets = bucketOnIce(synthShifts("BUF", BUF_FULL, 0, 60, 5), synthPositions);
  assert.ok(onIceAt(buckets, 5, 30));
  assert.equal(onIceAt(buckets, 5, 30), buckets.get(4 * 1200 + 29));
});

test("a goal credits the scoring team's gf, sf, cf and the other team's ga, sa, ca", () => {
  const events = [synthEvent("BUF", 1, 10, "goal")];
  assert.deepEqual(attributeEvents("BUF", fiveOnFive(60), synthPositions, events).total.ev, counts({ gf: 1, sf: 1, cf: 1 }));
  assert.deepEqual(attributeEvents("OPP", fiveOnFive(60), synthPositions, events).total.ev, counts({ ga: 1, sa: 1, ca: 1 }));
});

test("shots on goal add shots and attempts, missed and blocked shots add attempts only", () => {
  const events = [
    synthEvent("BUF", 1, 10, "shot-on-goal"),
    synthEvent("BUF", 1, 20, "missed-shot"),
    synthEvent("BUF", 1, 30, "blocked-shot"),
    synthEvent("OPP", 1, 40, "shot-on-goal"),
    synthEvent("OPP", 1, 50, "missed-shot"),
  ];
  const { total } = attributeEvents("BUF", fiveOnFive(60), synthPositions, events);
  assert.deepEqual(total.ev, counts({ sf: 1, cf: 3, sa: 1, ca: 2 }));
});

test("a 5-on-5 event is in total.ev and credited to the forward trio and the defense pair", () => {
  const result = attributeEvents("BUF", fiveOnFive(60), synthPositions, [synthEvent("BUF", 1, 10, "goal")]);
  const expected = counts({ gf: 1, sf: 1, cf: 1 });
  assert.deepEqual(result.total.ev, expected);
  assert.deepEqual([...result.byUnit.ev.F], [["1,2,3", expected]]);
  assert.deepEqual([...result.byUnit.ev.D], [["11,12", expected]]);
});

test("an event with the own goalie pulled is in total.ev and in no unit", () => {
  const shifts = [...synthShifts("BUF", [1, 2, 3, 4, 11, 12], 0, 60), ...synthShifts("OPP", OPP_FULL, 0, 60)];
  const result = attributeEvents("BUF", shifts, synthPositions, [synthEvent("OPP", 1, 10, "goal")]);
  assert.deepEqual(result.total.ev, counts({ ga: 1, sa: 1, ca: 1 }));
  assert.equal(unitCount(result), 0);
});

test("an event flagged pulledGoalie by its situationCode goes to total only, even when both goalie shifts exist", () => {
  const events = [synthEvent("BUF", 1, 10, "shot-on-goal", { pulledGoalie: true, situationCode: "0651" })];
  const result = attributeEvents("BUF", fiveOnFive(60), synthPositions, events);
  assert.deepEqual(result.total.ev, counts({ sf: 1, cf: 1 }));
  assert.equal(unitCount(result), 0);
});

test("an event while the opponent has no shift rows goes to total only", () => {
  const result = attributeEvents("BUF", synthShifts("BUF", BUF_FULL, 0, 60), synthPositions, [synthEvent("BUF", 1, 10)]);
  assert.equal(result.total.ev.cf + result.total.pp.cf + result.total.sh.cf, 1);
  assert.equal(unitCount(result), 0);
});

test("a 4-on-4 event is in total.ev and in no unit", () => {
  const shifts = [...synthShifts("BUF", [1, 2, 11, 12, 20], 0, 60), ...synthShifts("OPP", [101, 102, 111, 112, 120], 0, 60)];
  const result = attributeEvents("BUF", shifts, synthPositions, [synthEvent("BUF", 1, 10)]);
  assert.deepEqual(result.total.ev, counts({ sf: 1, cf: 1 }));
  assert.equal(unitCount(result), 0);
});

test("a period-4 3-on-3 event is in total.ev and in no unit", () => {
  const shifts = [...synthShifts("BUF", [1, 2, 3, 20], 0, 60, 4), ...synthShifts("OPP", [101, 102, 103, 120], 0, 60, 4)];
  const result = attributeEvents("BUF", shifts, synthPositions, [synthEvent("OPP", 4, 10)]);
  assert.deepEqual(result.total.ev, counts({ sa: 1, ca: 1 }));
  assert.equal(unitCount(result), 0);
});

test("an event at a second where the team has no skaters is unattributed, not in total", () => {
  const events = [synthEvent("BUF", 1, 100), synthEvent("BUF", 1, 0)];
  const result = attributeEvents("BUF", fiveOnFive(60), synthPositions, events);
  assert.equal(result.unattributed, 2);
  for (const situation of ["ev", "pp", "sh"] as const) assert.deepEqual(result.total[situation], counts({}));
});

test("buildGameEvents returns null for an empty shift list, a null play-by-play and a play-by-play with no plays", () => {
  const { pbp, shifts, positions } = load(ALL_FIXTURES[0]);
  assert.equal(buildGameEvents("WPG", [], positions, pbp), null);
  assert.equal(buildGameEvents("WPG", shifts, positions, null), null);
  assert.equal(buildGameEvents("WPG", shifts, positions, { ...pbp, plays: [] }), null);
  assert.notEqual(buildGameEvents("WPG", shifts, positions, pbp), null);
});

for (const id of ALL_FIXTURES) {
  const { fixture, pbp, shifts, positions } = load(id);
  const events = toGameEvents(pbp);
  for (const abbrev of [fixture.homeTeam.abbrev, fixture.awayTeam.abbrev]) {
    const attributed = attributeEvents(abbrev, shifts, positions, events);

    test(`${id} ${abbrev}: included + excluded + unattributed account for every mapped event`, () => {
      const included = (["ev", "pp", "sh"] as const).reduce((n, s) => n + attributed.total[s].cf + attributed.total[s].ca, 0);
      const { shootout, penaltyShot, teammateBlocked } = attributed.excluded;
      assert.equal(included + shootout + penaltyShot + teammateBlocked + attributed.unattributed, events.length);
    });

    test(`${id} ${abbrev}: listed units never exceed the situation total, so Other is never negative`, () => {
      for (const situation of ["ev", "pp", "sh"] as const) {
        for (const group of ["F", "D"] as const) {
          for (const counter of ["gf", "ga", "sf", "sa", "cf", "ca"] as const) {
            let listed = 0;
            for (const unit of attributed.byUnit[situation][group].values()) listed += unit[counter];
            assert.ok(listed <= attributed.total[situation][counter], `${situation} ${group} ${counter}: ${listed} > ${attributed.total[situation][counter]}`);
          }
        }
      }
    });
  }
}

test("attributeEvents is pure: the same input gives deep-equal results and is not mutated", () => {
  const { pbp, shifts, positions } = load(2025020084);
  const events = toGameEvents(pbp);
  const shiftsBefore = structuredClone(shifts);
  const eventsBefore = structuredClone(events);
  const first = attributeEvents("WPG", shifts, positions, events);
  const second = attributeEvents("WPG", shifts, positions, events);
  assert.deepEqual(first, second);
  assert.deepEqual(shifts, shiftsBefore);
  assert.deepEqual(events, eventsBefore);
});

test("a unit's Time and its events cover the same seconds: a pulled-goalie stretch is in neither", () => {
  // 60 s of 5-on-5, then 30 s with BUF's goalie pulled for a sixth skater (D 13).
  const shifts = [
    ...synthShifts("BUF", BUF_FULL, 0, 60),
    ...synthShifts("BUF", [1, 2, 3, 11, 12, 13], 60, 90),
    ...synthShifts("OPP", OPP_FULL, 0, 90),
  ];
  const lines = analyzeGameLines("BUF", shifts, synthPositions);
  assert.deepEqual(lines.units.ev.F, [{ playerIds: [1, 2, 3], seconds: 60, pct: (60 / 90) * 100 }]);

  const result = attributeEvents("BUF", shifts, synthPositions, [synthEvent("BUF", 1, 30), synthEvent("BUF", 1, 80)]);
  assert.deepEqual(result.total.ev, counts({ sf: 2, cf: 2 }));
  assert.deepEqual([...result.byUnit.ev.F], [["1,2,3", counts({ sf: 1, cf: 1 })]]);
});

test("toGameEvents is pure: two runs are deep-equal and the play-by-play is not mutated", () => {
  const { pbp } = load(2025020084);
  const before = structuredClone(pbp);
  assert.deepEqual(toGameEvents(pbp), toGameEvents(pbp));
  assert.deepEqual(pbp, before);
});
