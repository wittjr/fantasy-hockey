import { test } from "node:test";
import assert from "node:assert/strict";
import { countOffNightGamesByTeam, formatOffNights } from "./off-nights";

const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD"];

function night(date: string, gameCount: number) {
  return Array.from({ length: gameCount }, (_, i) => ({
    gameDate: date,
    homeTeamAbbrev: TEAMS[i * 2],
    awayTeamAbbrev: TEAMS[i * 2 + 1],
  }));
}

const games = [...night("2026-10-10", 8), ...night("2026-10-11", 7), ...night("2026-10-12", 2)];
const allDays = ["2026-10-10", "2026-10-11", "2026-10-12"];

test("counts only games on nights with fewer than 8 games", () => {
  const counts = countOffNightGamesByTeam(games, allDays);
  assert.equal(counts.get("ANA"), 2); // plays all three nights; the 8-game night isn't an off night
  assert.equal(counts.get("CBJ"), 1); // plays 10-10 and 10-11
  assert.equal(counts.get("NJD"), undefined); // only plays the 8-game night
});

test("counts only the given days, judging each night by the full schedule", () => {
  const counts = countOffNightGamesByTeam(games, ["2026-10-12"]);
  assert.equal(counts.get("ANA"), 1);
  assert.equal(counts.get("CBJ"), undefined);
});

test("formatOffNights shows regular/playoff", () => {
  assert.equal(formatOffNights(12, 4), "12/4");
  assert.equal(formatOffNights(12, null), "12");
  assert.equal(formatOffNights(null, null), "—");
});
