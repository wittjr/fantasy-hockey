import { test } from "node:test";
import assert from "node:assert/strict";
import { datesBetween, daysToLoad, pickNextWeek, pickupHorizon, todayEastern } from "./weeks";

const weeks = [
  { number: 1, startDate: "2026-09-29" },
  { number: 2, startDate: "2026-10-05" },
  { number: 3, startDate: "2026-10-12" },
];

test("pickNextWeek picks the first week that hasn't started", () => {
  assert.equal(pickNextWeek(weeks, "2026-09-27")?.number, 1);
  assert.equal(pickNextWeek(weeks, "2026-09-29")?.number, 2);
  assert.equal(pickNextWeek(weeks, "2026-10-07")?.number, 3);
});

test("pickNextWeek falls back to the last week at season end", () => {
  assert.equal(pickNextWeek(weeks, "2027-01-01")?.number, 3);
});

test("datesBetween is inclusive and crosses month boundaries", () => {
  assert.deepEqual(datesBetween("2026-09-29", "2026-10-02"), ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
});

test("todayEastern uses Eastern time, not UTC", () => {
  // 02:00 UTC on Oct 1 is still Sep 30 in New York.
  assert.equal(todayEastern(new Date("2026-10-01T02:00:00Z")), "2026-09-30");
});

const fullWeeks = [
  { number: 1, startDate: "2026-09-29", endDate: "2026-10-04", days: datesBetween("2026-09-29", "2026-10-04") },
  { number: 2, startDate: "2026-10-05", endDate: "2026-10-11", days: datesBetween("2026-10-05", "2026-10-11") },
  { number: 3, startDate: "2026-10-12", endDate: "2026-10-18", days: datesBetween("2026-10-12", "2026-10-18") },
];

test("pickupHorizon is the displayed week from today on, plus the week after it", () => {
  const h = pickupHorizon(fullWeeks, fullWeeks[1], "2026-10-08"); // Thursday of week 2
  assert.equal(h.thisWeek.number, 2);
  assert.deepEqual(h.thisWeek.days, ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.equal(h.nextWeek?.number, 3);
  assert.equal(h.nextWeek?.days.length, 7);
});

test("pickupHorizon uses all of a future week and none of a past one", () => {
  assert.equal(pickupHorizon(fullWeeks, fullWeeks[2], "2026-10-08").thisWeek.days.length, 7);
  assert.equal(pickupHorizon(fullWeeks, fullWeeks[2], "2026-10-08").nextWeek, null);
  assert.deepEqual(pickupHorizon(fullWeeks, fullWeeks[0], "2026-10-08").thisWeek.days, []);
});

test("daysToLoad is the displayed week plus the next", () => {
  const days = daysToLoad(fullWeeks[0], pickupHorizon(fullWeeks, fullWeeks[0], "2026-09-27"));
  assert.deepEqual(days, [...fullWeeks[0].days, ...fullWeeks[1].days]);
});
