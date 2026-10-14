import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NhlPlayByPlay } from "@/lib/nhl/client";
import { attributeEvents, onIceAt } from "./events";
import { bucketOnIce, dedupeOnIce, parseClock, situationFor, type OnIce, type PositionGroup, type ShiftInput } from "./lines";
import { toGameEvents } from "./play-events";

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
