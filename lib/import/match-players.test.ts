import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFantraxPlayerIndex, matchSpreadsheetRow } from "./match-players";

const index = buildFantraxPlayerIndex({
  a: { name: "Robertson, Nick", fantraxId: "a", team: "PIT", position: "LW" },
  b: { name: "Robertson, Jason", fantraxId: "b", team: "DAL", position: "LW" },
  c: { name: "Pettersson, Elias", fantraxId: "c", team: "VAN", position: "C" },
  d: { name: "Pettersson, Elias", fantraxId: "d", team: "VAN", position: "D" },
  e: { name: "Hughes, Quinn", fantraxId: "e", team: "MIN", position: "D" },
  f: { name: "Hughes, Jack", fantraxId: "f", team: "NJD", position: "C" },
  g: { name: "Hughes, Luke", fantraxId: "g", team: "NJD", position: "D" },
});

test("a different first name matches the only same-team player with that last name", () => {
  assert.equal(matchSpreadsheetRow({ name: "Nicholas Robertson", nhlTeamAbbrev: "PIT", position: "LW,RW" }, index)?.fantraxPlayerId, "a");
});

test("the last-name fallback refuses when two teammates share the last name", () => {
  assert.equal(matchSpreadsheetRow({ name: "Jacques Hughes", nhlTeamAbbrev: "NJD", position: "C" }, index), null);
});

test("a parenthesized note is ignored and position picks between same-name teammates", () => {
  assert.equal(matchSpreadsheetRow({ name: "Elias Pettersson (D)", nhlTeamAbbrev: "VAN", position: "D" }, index)?.fantraxPlayerId, "d");
});
