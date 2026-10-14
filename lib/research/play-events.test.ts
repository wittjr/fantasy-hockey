import { test } from "node:test";
import assert from "node:assert/strict";
import type { NhlPlay, NhlPlayByPlay } from "@/lib/nhl/client";
import { toGameEvents } from "./play-events";

const HOME = { id: 1, abbrev: "HOM" };
const AWAY = { id: 2, abbrev: "AWY" };

// A play with sensible defaults; `details: undefined` removes the details object.
function play(overrides: Partial<NhlPlay> & { owner?: number | null } = {}): NhlPlay {
  const { owner = HOME.id, ...rest } = overrides;
  return {
    typeDescKey: "shot-on-goal",
    timeInPeriod: "05:30",
    situationCode: "1551",
    periodDescriptor: { number: 1, periodType: "REG" },
    details: owner === null ? {} : { eventOwnerTeamId: owner },
    ...rest,
  };
}

function pbp(...plays: NhlPlay[]): NhlPlayByPlay {
  return { id: 1, homeTeam: HOME, awayTeam: AWAY, plays };
}

function only(...plays: NhlPlay[]) {
  const events = toGameEvents(pbp(...plays));
  assert.equal(events.length, 1);
  return events[0];
}

test("maps the owner team id to its abbrev, the clock to seconds and each kind one to one", () => {
  const kinds = ["goal", "shot-on-goal", "missed-shot", "blocked-shot"] as const;
  const events = toGameEvents(
    pbp(...kinds.map((typeDescKey) => play({ typeDescKey })), play({ owner: AWAY.id, timeInPeriod: "19:59" })),
  );
  assert.deepEqual(events.slice(0, 4).map((e) => [e.kind, e.team, e.t]), kinds.map((k) => [k, "HOM", 330]));
  assert.deepEqual([events[4].team, events[4].t, events[4].period], ["AWY", 1199, 1]);
});

test("skips plays that are not shot events without throwing", () => {
  assert.deepEqual(toGameEvents(pbp(play({ typeDescKey: "faceoff" }), play({ typeDescKey: "hit" }))), []);
});

test("skips a play with no details, no owner, an unknown owner or a malformed clock without throwing", () => {
  const events = toGameEvents(
    pbp(
      play({ details: undefined }),
      play({ owner: null }),
      play({ owner: 99 }),
      play({ timeInPeriod: "bad" }),
      play({ owner: AWAY.id }),
    ),
  );
  assert.deepEqual(events.map((e) => e.team), ["AWY"]);
});

test("a shootout is excluded by periodType, not by period number", () => {
  assert.equal(only(play({ periodDescriptor: { number: 5, periodType: "SO" } })).exclusion, "shootout");
  // A playoff second overtime is period 5 with periodType OT and counts.
  assert.equal(only(play({ periodDescriptor: { number: 5, periodType: "OT" } })).exclusion, null);
});

test("situation codes 1010 and 0101 outside the shootout are penalty shots", () => {
  assert.equal(only(play({ situationCode: "1010" })).exclusion, "penalty-shot");
  assert.equal(only(play({ situationCode: "0101", periodDescriptor: { number: 4, periodType: "OT" } })).exclusion, "penalty-shot");
});

test("a shootout attempt with a penalty-shot code is still a shootout", () => {
  assert.equal(only(play({ situationCode: "1010", periodDescriptor: { number: 5, periodType: "SO" } })).exclusion, "shootout");
});

test("every block reason, teammate-blocked included, counts for the shooting team (UAT G-03-1)", () => {
  const blocked = (reason: string) => only(play({ typeDescKey: "blocked-shot", details: { eventOwnerTeamId: HOME.id, reason } }));
  for (const reason of ["teammate-blocked", "blocked", "other-block", "xyz"]) {
    const event = blocked(reason);
    assert.equal(event.exclusion, null, reason);
    assert.equal(event.kind, "blocked-shot", reason);
    assert.equal(event.team, "HOM", reason);
  }
});

test("pulledGoalie is true when either goalie digit of the situation code is 0", () => {
  assert.equal(only(play({ situationCode: "0651" })).pulledGoalie, true);
  assert.equal(only(play({ situationCode: "1560" })).pulledGoalie, true);
  assert.equal(only(play({ situationCode: "1551" })).pulledGoalie, false);
});

test("pulledGoalie flags a blocked shot even though it has no goalieInNetId", () => {
  const event = only(play({ typeDescKey: "blocked-shot", situationCode: "0651", details: { eventOwnerTeamId: HOME.id, reason: "blocked" } }));
  assert.equal(event.pulledGoalie, true);
  assert.equal(event.exclusion, null);
});

test("pulledGoalie is false and the event still counts when the situation code is absent", () => {
  const event = only(play({ situationCode: undefined }));
  assert.equal(event.pulledGoalie, false);
  assert.equal(event.exclusion, null);
  assert.equal(event.situationCode, "");
});

test("pulledGoalie is false for every excluded event", () => {
  assert.equal(only(play({ situationCode: "0651", periodDescriptor: { number: 5, periodType: "SO" } })).pulledGoalie, false);
  assert.equal(only(play({ situationCode: "0101" })).pulledGoalie, false);
});

test("a teammate-blocked attempt with a goalie out is a counted event, so it is flagged pulledGoalie and goes to Other (D-21)", () => {
  const teammateBlocked = play({ typeDescKey: "blocked-shot", situationCode: "0651", details: { eventOwnerTeamId: HOME.id, reason: "teammate-blocked" } });
  const event = only(teammateBlocked);
  assert.equal(event.exclusion, null);
  assert.equal(event.pulledGoalie, true);
});
