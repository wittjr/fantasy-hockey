import { test } from "node:test";
import assert from "node:assert/strict";
import { countGamesByTeam, fantasySeasonDays } from "./playoff-games";

// Real periods 23-26 from the Southern Hockey Keeper League, 2026-09-27.
const periods = [
  { number: 23, startDate: "2027-03-08T19:00:00.0-0500", endDate: "2027-03-15T14:59:59.0-0400" },
  { number: 24, startDate: "2027-03-15T15:00:00.0-0400", endDate: "2027-03-22T18:59:59.0-0400" },
  { number: 25, startDate: "2027-03-22T19:00:00.0-0400", endDate: "2027-03-29T18:59:59.0-0400" },
  { number: 26, startDate: "2027-03-29T19:00:00.0-0400", endDate: "2027-04-05T11:59:59.0-0400" },
];

test("fantasySeasonDays splits the season at the first playoff period and stops after the last one", () => {
  const { regular, playoffs } = fantasySeasonDays({ used: true, firstPlayoffPeriod: 24 }, periods);
  assert.equal(regular[0], "2027-03-08");
  assert.equal(regular.at(-1), "2027-03-14");
  assert.equal(playoffs![0], "2027-03-15");
  assert.equal(playoffs!.at(-1), "2027-04-04");
  assert.equal(playoffs!.length, 21);
});

test("fantasySeasonDays treats every period as regular season when the league has no playoffs", () => {
  for (const settings of [undefined, { used: false, firstPlayoffPeriod: 24 }]) {
    const { regular, playoffs } = fantasySeasonDays(settings, periods);
    assert.equal(playoffs, null);
    assert.equal(regular.at(-1), "2027-04-04");
  }
});

test("countGamesByTeam counts home and away games on the given days only", () => {
  const games = [
    { gameDate: "2027-03-14", homeTeamAbbrev: "TOR", awayTeamAbbrev: "BOS" },
    { gameDate: "2027-03-15", homeTeamAbbrev: "TOR", awayTeamAbbrev: "MTL" },
    { gameDate: "2027-03-16", homeTeamAbbrev: "BOS", awayTeamAbbrev: "TOR" },
  ];
  const counts = countGamesByTeam(games, ["2027-03-15", "2027-03-16"]);
  assert.equal(counts.get("TOR"), 2);
  assert.equal(counts.get("BOS"), 1);
  assert.equal(counts.get("MTL"), 1);
});
