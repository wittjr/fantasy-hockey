import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeYahoo } from "./normalize";

test("turns count-keyed collections into arrays and merges resource fragments", () => {
  const raw = {
    users: {
      "0": {
        user: [
          { guid: "ABC" },
          {
            games: {
              "0": {
                game: [
                  { game_key: "465", code: "nhl" },
                  {
                    leagues: {
                      "0": { league: [{ league_key: "465.l.1", name: "Keepers", season: "2026", num_teams: 12 }] },
                      "1": { league: [{ league_key: "465.l.2", name: "Other", season: "2026", num_teams: 10 }] },
                      count: 2,
                    },
                  },
                ],
              },
              count: 1,
            },
          },
        ],
      },
      count: 1,
    },
  };

  assert.deepEqual(normalizeYahoo(raw), {
    users: [
      {
        user: {
          guid: "ABC",
          games: [
            {
              game: {
                game_key: "465",
                code: "nhl",
                leagues: [
                  { league: { league_key: "465.l.1", name: "Keepers", season: "2026", num_teams: 12 } },
                  { league: { league_key: "465.l.2", name: "Other", season: "2026", num_teams: 10 } },
                ],
              },
            },
          ],
        },
      },
    ],
  });
});

test("keeps repeated-key lists as arrays and flattens nested fragment arrays", () => {
  const raw = {
    settings: [
      {
        roster_positions: [
          { roster_position: { position: "C", count: 2 } },
          { roster_position: { position: "BN", count: 4 } },
        ],
      },
    ],
    team: [[{ team_key: "465.l.1.t.3" }, [], { name: "Mine" }], { managers: [{ manager: { nickname: "J" } }] }],
  };

  assert.deepEqual(normalizeYahoo(raw), {
    settings: {
      roster_positions: [
        { roster_position: { position: "C", count: 2 } },
        { roster_position: { position: "BN", count: 4 } },
      ],
    },
    team: { team_key: "465.l.1.t.3", name: "Mine", managers: { manager: { nickname: "J" } } },
  });
});
