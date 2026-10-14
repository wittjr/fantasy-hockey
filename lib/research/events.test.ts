import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NhlPlayByPlay } from "@/lib/nhl/client";
import { attributeEvents, buildGameEvents, EVENT_MATCH_THRESHOLD, isShiftChartSuspect, matchIsLow, matchQuality, matchRatio, MAX_REPEATED_SHIFT_SHARE, onIceAt, type EventCounts } from "./events";
import { analyzeGameLines, bucketOnIce, dedupeOnIce, parseClock, situationFor, uniqueShifts, type OnIce, type PositionGroup, type ShiftInput } from "./lines";
import { toGameEvents, type EventKind, type GameEvent } from "./play-events";

// The DATA-03 gate: counts from real NHL payloads must reproduce the official boxscore.
// GATE_FIXTURES are games whose team SOG and every skater's plus-minus are reconciled;
// ALL_FIXTURES is every committed fixture. Later plans append to both.
// 2025020565 is a negative fixture for the corrupted-chart flag (D-23): in ALL_FIXTURES, never a gate game.
const GATE_FIXTURES = [2025020084, 2025020306, 2026020075, 2025020343, 2025020528, 2025020500];
export const ALL_FIXTURES = [...GATE_FIXTURES, 2026020026, 2025020565];

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

// The one skater whose reproduced plus-minus differs from the boxscore, pinned so it cannot widen.
// Research Pitfall 4: his period-1 shift ends on the second of a goal; the locked start < t <= end rule
// counts him on ice for it and the official record does not. No other skater, game or tolerance is exempt.
const KNOWN_BOXSCORE_DISAGREEMENTS = [
  { gameId: 2025020500, playerId: 8478550, official: 0, reproduced: -1, why: "A. Panarin: P1 shift 15:28-16:18 ends on the P1 goal at 16:18" },
];

/** Plus-minus from attributed goals by the research rule; `skipGoal` leaves out goals it returns true for. */
function recomputePlusMinus(
  fixture: Fixture,
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
  events: GameEvent[],
  skipGoal: (event: GameEvent) => boolean = () => false,
) {
  const buckets = bucketOnIce(shifts, positions);
  const computed = new Map<number, number>();
  for (const event of events) {
    if (event.kind !== "goal" || event.exclusion !== null || skipGoal(event)) continue;
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
  return computed;
}

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
    const computed = recomputePlusMinus(fixture, shifts, positions, events);
    for (const [playerId, , group, plusMinus, name] of fixture.players) {
      if (group === "G") continue;
      const known = KNOWN_BOXSCORE_DISAGREEMENTS.find((k) => k.gameId === id && k.playerId === playerId);
      if (known) assert.equal(known.official, plusMinus, `${name} official value is pinned`);
      assert.equal(computed.get(playerId) ?? 0, known ? known.reproduced : plusMinus, `${name} (${playerId}) plus-minus`);
    }
  });
}

test("KNOWN_BOXSCORE_DISAGREEMENTS entry is explained by its boundary goal", () => {
  const [known] = KNOWN_BOXSCORE_DISAGREEMENTS;
  const { fixture, shifts, positions, pbp } = load(known.gameId);
  const events = toGameEvents(pbp);
  const player = fixture.players.find(([playerId]) => playerId === known.playerId);
  assert.equal(player?.[4], "A. Panarin");
  assert.equal(player?.[3], known.official);
  // His period-1 shift ends at 16:18, the same second as a period-1 goal that counts.
  assert.ok(fixture.shifts.some(([playerId, , period, , end]) => playerId === known.playerId && period === 1 && end === "16:18"));
  const boundaryT = parseClock("16:18");
  const isBoundaryGoal = (e: GameEvent) => e.kind === "goal" && e.exclusion === null && e.period === 1 && e.t === boundaryT;
  assert.ok(events.some(isBoundaryGoal));
  // Under start < t <= end he is on ice for it; leaving out only that goal gives the official value.
  assert.equal(recomputePlusMinus(fixture, shifts, positions, events).get(known.playerId) ?? 0, known.reproduced);
  assert.equal(recomputePlusMinus(fixture, shifts, positions, events, isBoundaryGoal).get(known.playerId) ?? 0, known.official);
});

test("the gate has exactly one known disagreement, on one of the gate games", () => {
  assert.equal(KNOWN_BOXSCORE_DISAGREEMENTS.length, 1);
  assert.ok(GATE_FIXTURES.includes(KNOWN_BOXSCORE_DISAGREEMENTS[0].gameId));
});

// A game whose shift chart is unpublished: its fixture stores no shifts, so only play-by-play SOG can be checked.
{
  const { fixture, pbp, shifts, positions } = load(2026020026);
  const events = toGameEvents(pbp);
  for (const [team, sog] of [[fixture.homeTeam.abbrev, fixture.homeTeam.sog], [fixture.awayTeam.abbrev, fixture.awayTeam.sog]] as const) {
    test(`2026020026 ${team}: shots on goal from play-by-play equal the boxscore SOG with no shift chart`, () => {
      const own = events.filter((e) => e.team === team && (e.kind === "goal" || e.kind === "shot-on-goal") && e.exclusion !== "shootout");
      assert.equal(own.length, sog);
    });

    test(`2026020026 ${team}: with no shift chart the events are unknown (null), never zeros`, () => {
      assert.equal(shifts.length, 0);
      assert.equal(buildGameEvents(team, shifts, positions, pbp), null);
    });
  }
}

test("the shootout attempts of 2026020075 are counted in excluded.shootout", () => {
  const { fixture, shifts, positions, pbp } = load(2026020075);
  const events = toGameEvents(pbp);
  const shootoutEvents = events.filter((e) => e.exclusion === "shootout").length;
  assert.ok(shootoutEvents > 0);
  assert.equal(attributeEvents(fixture.homeTeam.abbrev, shifts, positions, events).excluded.shootout, shootoutEvents);
});

for (const id of [2025020528, 2025020500]) {
  test(`the penalty shot of ${id} is counted in excluded.penaltyShot`, () => {
    const { fixture, shifts, positions, pbp } = load(id);
    assert.equal(attributeEvents(fixture.homeTeam.abbrev, shifts, positions, toGameEvents(pbp)).excluded.penaltyShot, 1);
  });
}

test("the gate fixture set is pinned, and every gate fixture is in ALL_FIXTURES with the missing-chart game", () => {
  assert.deepEqual([...GATE_FIXTURES].sort(), [2025020084, 2025020306, 2025020343, 2025020500, 2025020528, 2026020075]);
  for (const id of [...GATE_FIXTURES, 2026020026]) assert.ok(ALL_FIXTURES.includes(id), `${id} is in ALL_FIXTURES`);
});

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

// ---- Match quality: shift chart versus situationCode (plan 03-04, D-16, D-17) ----
const countedForMatch = (events: readonly GameEvent[]) =>
  events.filter((e) => e.exclusion !== "shootout" && e.exclusion !== "penalty-shot" && e.situationCode.length === 4);
const fixtureTeams = (f: Fixture) => ({ home: f.homeTeam.abbrev, away: f.awayTeam.abbrev });

test("every gate fixture matches its shift chart to situationCode at or above EVENT_MATCH_THRESHOLD", () => {
  assert.equal(EVENT_MATCH_THRESHOLD, 0.95);
  const measured: string[] = [];
  for (const id of GATE_FIXTURES) {
    const { fixture, pbp, shifts, positions } = load(id);
    const q = matchQuality(shifts, positions, toGameEvents(pbp), fixtureTeams(fixture));
    const ratio = matchRatio(q);
    assert.ok(ratio !== null && ratio >= EVENT_MATCH_THRESHOLD, `${id}: ${q.matched}/${q.checked}`);
    assert.equal(matchIsLow(q), false, `${id} is not low`);
    measured.push(`${id} ${q.matched}/${q.checked}`);
  }
  console.log("measured match per gate fixture:", measured.join(", "));
});

for (const id of [2025020084, 2026020075, 2025020343]) {
  test(`${id} with every period-2 shift removed falls below EVENT_MATCH_THRESHOLD`, () => {
    const { fixture, pbp, shifts, positions } = load(id);
    const q = matchQuality(shifts.filter((s) => s.period !== 2), positions, toGameEvents(pbp), fixtureTeams(fixture));
    const ratio = matchRatio(q);
    assert.ok(ratio !== null && ratio < EVENT_MATCH_THRESHOLD, `${id}: ${q.matched}/${q.checked}`);
    assert.equal(matchIsLow(q), true);
  });
}

test("the shootout attempts of 2026020075 and the penalty shots of 2025020528 are not counted in checked", () => {
  for (const id of [2026020075, 2025020528]) {
    const { fixture, pbp, shifts, positions } = load(id);
    const events = toGameEvents(pbp);
    const expected = countedForMatch(events).length;
    assert.ok(expected < events.length, `${id} has events that must not count`);
    assert.equal(matchQuality(shifts, positions, events, fixtureTeams(fixture)).checked, expected);
  }
});

test("matchQuality: 1551 matches 5 skaters and a goalie each side, 1451 does not", () => {
  const teams = { home: "OPP", away: "BUF" };
  const shifts = fiveOnFive(60);
  assert.deepEqual(matchQuality(shifts, synthPositions, [synthEvent("BUF", 1, 10)], teams), { checked: 1, matched: 1 });
  assert.deepEqual(matchQuality(shifts, synthPositions, [synthEvent("BUF", 1, 10, "shot-on-goal", { situationCode: "1451" })], teams), { checked: 1, matched: 0 });
});

test("matchQuality: a missing goalie shift matches only a code with that goalie digit 0", () => {
  const teams = { home: "OPP", away: "BUF" };
  const shifts = [...synthShifts("BUF", [1, 2, 3, 4, 11, 12], 0, 60), ...synthShifts("OPP", OPP_FULL, 0, 60)];
  assert.deepEqual(matchQuality(shifts, synthPositions, [synthEvent("OPP", 1, 10, "goal", { situationCode: "0651" })], teams), { checked: 1, matched: 1 });
  assert.deepEqual(matchQuality(shifts, synthPositions, [synthEvent("OPP", 1, 10, "goal", { situationCode: "1651" })], teams), { checked: 1, matched: 0 });
});

test("matchQuality: a teammate-blocked event is checked", () => {
  const teams = { home: "OPP", away: "BUF" };
  const event = synthEvent("BUF", 1, 10, "blocked-shot", { exclusion: "teammate-blocked" });
  assert.deepEqual(matchQuality(fiveOnFive(60), synthPositions, [event], teams), { checked: 1, matched: 1 });
});

test("matchQuality: an event with no shift data at its second is checked and not matched", () => {
  const teams = { home: "OPP", away: "BUF" };
  assert.deepEqual(matchQuality(fiveOnFive(60), synthPositions, [synthEvent("BUF", 1, 100), synthEvent("BUF", 1, 0)], teams), { checked: 2, matched: 0 });
});

test("matchQuality: shootout and penalty-shot events and codes that are not 4 digits are not checked", () => {
  const teams = { home: "OPP", away: "BUF" };
  const events = [
    synthEvent("BUF", 1, 10, "shot-on-goal", { exclusion: "shootout" }),
    synthEvent("BUF", 1, 20, "shot-on-goal", { exclusion: "penalty-shot", situationCode: "1010" }),
    synthEvent("BUF", 1, 30, "shot-on-goal", { situationCode: "" }),
    synthEvent("BUF", 1, 40, "shot-on-goal", { situationCode: "155" }),
  ];
  assert.deepEqual(matchQuality(fiveOnFive(60), synthPositions, events, teams), { checked: 0, matched: 0 });
});

test("matchRatio is null with nothing checked, and matchIsLow is false there and at exactly 0.95, true at 0.94", () => {
  assert.equal(matchRatio({ checked: 0, matched: 0 }), null);
  assert.equal(matchIsLow({ checked: 0, matched: 0 }), false);
  assert.equal(matchIsLow({ checked: 100, matched: 95 }), false);
  assert.equal(matchIsLow({ checked: 100, matched: 94 }), true);
});

test("buildGameEvents carries the game's match quality", () => {
  const { fixture, pbp, shifts, positions } = load(2025020084);
  const built = buildGameEvents(fixture.homeTeam.abbrev, shifts, positions, pbp);
  assert.deepEqual(built?.quality, matchQuality(shifts, positions, toGameEvents(pbp), fixtureTeams(fixture)));
  assert.ok((built?.quality.checked ?? 0) > 0);
});

// ---- Corrupted shift chart flag (plan 03-04, D-23) ----
const repeatedShare = (shifts: readonly ShiftInput[]) => (shifts.length - uniqueShifts(shifts).length) / shifts.length;

test("2025020565 is the corrupted-chart fixture: every row kept, in ALL_FIXTURES and not in GATE_FIXTURES", () => {
  const { fixture } = load(2025020565);
  assert.equal(fixture.category, "corrupted-shift-chart");
  assert.ok(fixture.shifts.length > 2000);
  assert.ok(ALL_FIXTURES.includes(2025020565));
  assert.ok(!GATE_FIXTURES.includes(2025020565));
});

for (const abbrev of ["NJD", "BUF"]) {
  test(`2025020565 ${abbrev}: repeated rows and other teams' players change no count`, () => {
    const { pbp, shifts, positions } = load(2025020565);
    const events = toGameEvents(pbp);
    const raw = attributeEvents(abbrev, shifts, positions, events);
    assert.deepEqual(raw, attributeEvents(abbrev, uniqueShifts(shifts), positions, events));
    for (const situation of ["ev", "pp", "sh"] as const) {
      for (const group of ["F", "D"] as const) {
        for (const key of raw.byUnit[situation][group].keys()) {
          for (const id of key.split(",")) assert.ok(positions.has(Number(id)), `unit member ${id} is a listed player`);
        }
      }
    }
  });
}

test("2025020565 is flagged by both rules: players from other teams and a repeated share above the threshold", () => {
  const { fixture, shifts } = load(2025020565);
  const teams = fixtureTeams(fixture);
  assert.equal(isShiftChartSuspect(shifts, teams), true);
  assert.ok(shifts.some((s) => s.team !== teams.home && s.team !== teams.away), "foreign team rows are present");
  assert.ok(repeatedShare(shifts) > MAX_REPEATED_SHIFT_SHARE, `repeated share ${repeatedShare(shifts)}`);
});

test("no gate fixture is flagged, and each repeated-row share is below MAX_REPEATED_SHIFT_SHARE", () => {
  const shares: string[] = [];
  for (const id of GATE_FIXTURES) {
    const { fixture, shifts } = load(id);
    assert.equal(isShiftChartSuspect(shifts, fixtureTeams(fixture)), false, `${id} is not flagged`);
    assert.ok(repeatedShare(shifts) < MAX_REPEATED_SHIFT_SHARE, `${id} repeated share ${repeatedShare(shifts)}`);
    shares.push(`${id} ${repeatedShare(shifts).toFixed(4)}`);
  }
  console.log("measured repeated-row share per gate fixture:", shares.join(", "));
});

test("isShiftChartSuspect: one row from a third team is suspect", () => {
  const shifts = [...fiveOnFive(60), ...synthShifts("VGK", [301], 0, 30)];
  assert.equal(isShiftChartSuspect(shifts, { home: "OPP", away: "BUF" }), true);
});

test("isShiftChartSuspect: 10 verbatim repeats in 100 rows is suspect, 1 in 100 is not, an empty list is not", () => {
  const teams = { home: "OPP", away: "BUF" };
  const row = (n: number): ShiftInput => ({ playerId: n, team: "BUF", period: 1, startSec: 0, endSec: 30 });
  const unique = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1));
  assert.equal(isShiftChartSuspect([...unique(90), ...unique(10)], teams), true);
  assert.equal(isShiftChartSuspect([...unique(99), row(1)], teams), false);
  assert.equal(isShiftChartSuspect([], teams), false);
});

test("buildGameEvents on the corrupted 2025020565 is flagged and still returns counts", () => {
  const { pbp, shifts, positions } = load(2025020565);
  const built = buildGameEvents("BUF", shifts, positions, pbp);
  assert.ok(built);
  assert.equal(built.chartSuspect, true);
  assert.ok(built.total.ev.cf + built.total.pp.cf + built.total.sh.cf > 0);
});

test("buildGameEvents leaves a good game unflagged", () => {
  const { pbp, shifts, positions } = load(2025020084);
  assert.equal(buildGameEvents("WPG", shifts, positions, pbp)?.chartSuspect, false);
});
