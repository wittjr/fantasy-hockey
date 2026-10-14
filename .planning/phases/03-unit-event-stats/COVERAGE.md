# API Coverage — NHL public web API (api-web.nhle.com) and stats API shift charts (api.nhle.com)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Scope: the game-level surface Phase 3 reads (play-by-play is new; boxscore, shift charts and the club schedule are existing integrations whose caching changes). The rest of the NHL API is listed as one row per area.

| capability | decision | reason |
|---|---|---|
| gamecenter play-by-play (fetch, cached, empty re-request uncached) | INTEGRATE | |
| play-by-play event goal | INTEGRATE | |
| play-by-play event shot-on-goal | INTEGRATE | |
| play-by-play event missed-shot | INTEGRATE | |
| play-by-play event blocked-shot (incl. reason teammate-blocked) | INTEGRATE | |
| play-by-play situationCode | INTEGRATE | |
| play-by-play periodDescriptor periodType | INTEGRATE | |
| play-by-play homeTeam/awayTeam id and abbrev | INTEGRATE | |
| play-by-play event faceoff | OPT-OUT | explicitly out of scope: zone starts are out of scope (REQUIREMENTS Out of Scope) |
| play-by-play events hit, giveaway, takeaway | OPT-OUT | not needed: not in the unit-table stat set (D-09) |
| play-by-play events penalty, delayed-penalty | OPT-OUT | not needed: strength comes from the shift chart through the one shared classifier (locked decision) |
| play-by-play stoppage, period and game boundary events | OPT-OUT | not needed: periods come from each shot event's periodDescriptor |
| play-by-play rosterSpots | OPT-OUT | not needed: positions come from the boxscore (dropping the boxscore call is only a fallback if 429s persist, plan 03-09) |
| play-by-play shot location and type (xCoord, yCoord, zoneCode, shotType) | OPT-OUT | explicitly out of scope: xG and shot quality (REQUIREMENTS Out of Scope) |
| play-by-play goalieInNetId | OPT-OUT | not needed: the situationCode goalie digit covers blocked shots too (research) |
| play-by-play scorer and assist ids | OPT-OUT | not needed: unit counts come from who was on ice, not who scored |
| gamecenter boxscore (tiered cache, 429 retry) | INTEGRATE | |
| stats API shift charts (tiered cache) | INTEGRATE | |
| club-schedule-season now (startTimeUTC for the cache tier) | INTEGRATE | |
| HTTP 429 with Retry-After | INTEGRATE | |
| gamecenter landing, right-rail, game-story | OPT-OUT | not needed: duplicate the boxscore and play-by-play data used here |
| standings, scores, schedule calendar, TV schedule | OPT-OUT | explicitly out of scope: league-wide views are out of scope for this phase |
| player landing, game logs, stat leaders, stats reports, NHL Edge | OPT-OUT | explicitly out of scope: per-60, xG and player quality are out of scope (REQUIREMENTS) |
| roster endpoints | OPT-OUT | not needed: dressed players come from the boxscore |
