# Pitfalls Research

**Domain:** NHL play-by-play to shift-chart event attribution (SF/SA, GF/GA, CF/CA per EV/PP/SH unit), ice-time trend view, linemate time-together trends
**Researched:** 2026-10-11
**Confidence:** HIGH for feed-shape and attribution-convention findings (probed live NHL API responses for 2023-24 through 2026-27 games and validated against official boxscore numbers); MEDIUM for how other public tools handle the same edge cases (recalled, not re-fetched); MEDIUM for trend-noise guidance (statistical judgment, not measured on this app's data)

Phase names used below are placeholders for the roadmapper:
- **Phase A (Attribution core):** extend `lib/research/lines.ts` / `team-games.ts` with play-by-play loading and event-to-unit attribution
- **Phase B (Unit tables):** SF/SA/GF/GA/CF/CA columns on the last-game EV/PP/SH unit tables
- **Phase C (Trends view):** averages, slopes, de-emphasized raw per-game times
- **Phase D (Player detail):** linemate time-together trends

How findings were verified: for five to ten recent games I pulled play-by-play, shift charts, and boxscore directly from `api-web.nhle.com` and `api.nhle.com/stats` and tested each rule below against official numbers (boxscore plus/minus, boxscore SOG, boxscore blocked shots, the `situationCode` on every event). Where a rule says "verified", that is what was measured.

## Critical Pitfalls

### Pitfall 1: Reusing the existing half-open second buckets to look up an event's on-ice players

**What goes wrong:**
`analyzeGameLines` fills bucket `s` for every `startSec <= s < endSec`. That is correct for TOI, but it is the wrong lookup for an event stamped `timeInPeriod = t`. Looking up bucket `t` returns the players who *start* a shift at `t` and drops the players whose shift *ends* at `t`. The attributed on-ice set is the wrong one for every event that lands on a change second.

**Why it happens:**
The buckets already exist, so "look up the event's second" is the obvious, cheap implementation. Both clocks are whole elapsed seconds, so it looks like they line up.

**Measured evidence (verified):**
Recomputing official EV and SH plus/minus from goal events and shift rows, for 12 games (11 with shift data):
- Convention `start < t <= end` (shift start exclusive, end inclusive): 0 mismatches against boxscore `plusMinus` in 8 of 11 games that had shift data, 1 skater off in one game, and 11 off in two games where my test filter treated a 6v5 pulled-goalie goal as a power play (a test-harness error, see Pitfall 5, not a convention error).
- Convention `start <= t < end` (what the current buckets implement): 14 to 32 of ~36 skaters wrong per game in every game tested.
- Convention `start <= t <= end` (both inclusive): also 10 to 34 wrong.
- Across shot attempts in 4 games, 7% to 14% of attempts have a different on-ice set under the two half-open conventions. That is the real size of the "ambiguous event" problem, and picking the wrong side is systematic, not random.
- Cross-check: with `start < t <= end`, the number of skaters on ice per team equals the `situationCode` skater counts on 100% of regulation/OT attempts in 5 of 6 games (the sixth had one penalty-shot event, which is expected). Under the other conventions it does not.

**How to avoid:**
Use `start < t <= end`: an event at second `t` belongs to the second interval `[t-1, t)`, i.e. bucket `offset + t - 1` in the existing map. Put this in one named function (e.g. `onIceAt(period, t)`) with a comment citing this rule, and unit-test it with a shift that ends exactly at the event second and one that starts exactly at it. Do not scatter `t - 1` through callers.

**Warning signs:**
- Goals attributed to a player who just stepped off, or to a player whose first shift of the period starts at that second.
- Per-event on-ice skater counts that do not match `situationCode`.
- Plus/minus computed from the same machinery disagreeing with the boxscore.

**Phase to address:** Phase A. Make the "reproduce boxscore plusMinus" test the acceptance gate for the attribution function before any UI work.

---

### Pitfall 2: Period-start event at t = 0 reads the previous period's last second

**What goes wrong:**
The bucket key is `(period - 1) * 1200 + s`. With the correct `t - 1` lookup, an event at `00:00` of period 2 computes key `1200 - 1 = 1199`, which is the *last second of period 1*. It silently returns the wrong players instead of "nobody".

**Why it happens:**
Flat global-second keys hide the period boundary. The same applies to OT (offset 3600) after regulation.

**How to avoid:**
In `onIceAt`, return an empty set when `t <= 0`. Add a test: event at `00:00` of period 2 with players on ice at 19:59 of period 1 must not attribute them. Real shot attempts at exactly `00:00` are rare, but faceoff and penalty-shot-adjacent events occur there and bad keys are an easy silent bug.

**Warning signs:** Attributed players in period N whose shift list has no shift in period N.

**Phase to address:** Phase A.

---

### Pitfall 3: Assuming `eventOwnerTeamId` on a blocked shot is the blocking team, and crediting teammate-blocked shots as blocks

**What goes wrong:**
Folklore (and older API write-ups) say the owner of a `blocked-shot` event is the blocking team. In the current `api-web` feed it is the **shooter's** team. Code written to the folklore swaps CF and CA for every blocked attempt, which is roughly a quarter of all Corsi events.

Separately, some `blocked-shot` events have `details.reason = "teammate-blocked"`: the blocker is on the shooter's own team (2 to 4 per game in every sampled game). These are not blocks by the opponent and must not be credited to the opponent as a block or counted against anyone.

**Measured evidence (verified):**
- In 5 games spanning 2023-24 to 2026-27, `eventOwnerTeamId == team(shootingPlayerId)` for 100% of `shot-on-goal`, `missed-shot`, `blocked-shot`, and `goal` events (team looked up via `rosterSpots`, which lists both teams).
- For `reason = "blocked"`, `team(blockingPlayerId)` is the other team. For `reason = "teammate-blocked"`, it is the same team as the shooter.
- Boxscore `blockedShots` per player excludes teammate-blocked events (43 events vs 41 boxscore blocks in one game, difference = the 2 teammate-blocked rows).

**How to avoid:**
Define the attempt's team from `shootingPlayerId` / `scoringPlayerId` via `rosterSpots` (and assert it equals `eventOwnerTeamId`; log a data-quality counter on disagreement, do not throw). The attacking team gets CF; the other team gets CA. Never use `blockingPlayerId`'s team for Corsi direction. Decide and document one rule for `teammate-blocked`: count as a Corsi attempt for the shooter's team (it is still an attempt) but not as a block. Keep a unit test with one `blocked` and one `teammate-blocked` fixture.

**Warning signs:** Team CF != team SF + missed + blocked-by-opponent reconciliation; a team's CF% looks inverted relative to who is visibly dominating.

**Phase to address:** Phase A (definition), Phase B (legend text).

---

### Pitfall 4: Wrong SF definition (forgetting goals are separate events) and no reconciliation test

**What goes wrong:**
`shot-on-goal` events do **not** include goals; goals are separate `goal` events. Counting only `shot-on-goal` as SF undercounts by the goal total and makes SH% / GF-vs-SF nonsense. Likewise Corsi = SOG-with-goals + missed + blocked.

**Measured evidence (verified):**
Boxscore team `sog` equals `count(shot-on-goal) + count(goal)` for the team in every sampled game (e.g. 29 = 24 + 5, 18 = 14 + 4), excluding shootout events. Penalty shots are inside that count.

**How to avoid:**
- SF = `shot-on-goal` + `goal`; CF = SF + `missed-shot` + `blocked-shot` (shooter's team); GF = `goal`.
- Add a test that, for a fixture game, summing team-level SF over all events equals boxscore `sog` for each team. This one test catches definition errors, shootout leakage, and team-direction errors at once.
- Also reconcile: sum of per-unit counts plus an explicit "unattributed" bucket equals team totals (see Pitfall 7).

**Warning signs:** Team SF off from the NHL's displayed shots by roughly the goal count.

**Phase to address:** Phase A (definition and test), Phase B (legend).

---

### Pitfall 5: Using `situationCode` skater counts (or on-ice counts) naively, so empty-net extra attackers become "power plays"

**What goes wrong:**
`situationCode` is four digits: away goalie (0/1), away skaters, home skaters, home goalie. When a goalie is pulled it shows e.g. `1560` (home 6 skaters, home goalie 0). A rule of "more skaters than the opponent = PP" misclassifies the extra-attacker period as a power play. `lines.ts` already handles this correctly in `situationFor` (strength = skaters minus one if no goalie on ice). A second, independent classifier for events will not unless it copies that logic.

**Measured evidence (verified):** In two games, 6v5 extra-attacker goals made my first plus/minus check wrong in 11 skaters per game until I treated goalie-pulled as even strength, matching the NHL's plus/minus rule.

**How to avoid:**
Make **one** strength classifier used for both TOI seconds and events. Prefer `situationCode` for the event's strength because it is exact and free (verified to match shift-derived skater counts), but convert it through the same "goalie digit 0 means subtract nothing, add a skater without changing strength" rule. Cover delayed-penalty 6v5 turning into 6v4 (which is a real PP/SH) in tests. Empty-net shots and goals: keep them in Corsi but mark them (events with no `goalieInNetId`, or goalie digit 0) so they can be excluded from SF%-style displays if desired, and document the choice. FEATURES.md says to exclude empty-net-affected events "consistently"; pick the rule once and apply to all of SF/GF/CF.

**Warning signs:** A team that trails by one late shows a spike of "PP" attempts; the EV table loses time to the PP table in the final two minutes.

**Phase to address:** Phase A.

---

### Pitfall 6: Shootout and penalty-shot events leaking into Corsi or into the wrong unit

**What goes wrong:**
Shootout attempts are real `shot-on-goal` / `goal` events (`periodDescriptor.periodType = "SO"`, period 5, `situationCode` `1010`/`0101`, `timeInPeriod` `00:00`). There are no shift rows for the shootout period, so attribution would return an empty set; the real danger is counting them in team totals, and the opposite danger is dropping them from the SOG reconciliation. Regulation/OT penalty shots have the same `1010`/`0101` code inside a normal period, and appear in a game's SOG but should not be a Corsi attempt for a five-skater unit.

**Why it happens:**
Filtering by `period <= 3` or by `period === 5` instead of `periodType`. Playoff OT is periods 4, 5, 6... with `periodType = "OT"`, so a hard-coded "period 5 = shootout" is wrong in the playoffs. (Playoffs are in scope: `RESEARCH_GAME_TYPES` includes 3.)

**How to avoid:**
- Exclude events where `periodType === "SO"` from unit attribution. Never infer shootout from the period number.
- Exclude events whose `situationCode` is `1010` or `0101` (one skater vs one goalie) from unit tables as penalty shots; keep them in a team-level SOG reconciliation if you do that test.
- Test with a fixture from a shootout game (game `2026020075` is one) and one with a mid-period penalty shot (`2025020500`, period 1 at 19:08).

**Warning signs:** Event timestamps of `00:00` clustered in period 5; units with attributed events but zero seconds.

**Phase to address:** Phase A.

---

### Pitfall 7: Unit totals that silently do not add up to team totals

**What goes wrong:**
Units are filtered in several ways, so attributing each event to "the unit on ice" drops events with no explanation:
- `EV_UNIT_SIZE` rejects F groups not equal to 3 and D groups not equal to 2. Every attempt that happens during a line change, with 2, 4 or 5 forwards on ice, matches no unit.
- `MIN_UNIT_SECONDS = 10` removes short-lived units, and their events along with them.
- 7% to 14% of attempts sit on ambiguous change seconds (Pitfall 1), plus the transitional seconds either side.
- F and D are tracked as independent unit sets (a trio and a pair), so one event is counted once in an F row and once in a D row. Summing F and D rows double counts.

The user compares to Frozen Pool, which shows tidy totals; a table where CF + CA is visibly lower than the game's attempts looks broken.

**How to avoid:**
Attribute every event against unit keys **before** applying `MIN_UNIT_SECONDS`, in the same pass that accumulates seconds. Keep an explicit `other` / "line change & short units" bucket per situation and per group so totals reconcile, and expose it (a muted row or a footnote with the share). Write a test asserting `sum(unit counts) + other == team situation total`. Never add F rows and D rows together.

**Warning signs:** A game where per-unit CF sums to only 85% to 90% of team CF, with no "other" row to explain it.

**Phase to address:** Phase A (accounting), Phase B (display of the "other" row).

---

### Pitfall 8: Overtime 3v3 and 4v4 are classified as "EV" but never form valid EV units

**What goes wrong:**
`situationFor` returns `"ev"` whenever strengths are equal, so regular-season 3v3 OT (`situationCode 1331`) and post-coincidental-minor 4v4 land in the EV bucket. `EV_UNIT_SIZE` (3F + 2D) then skips every second of 3v3 or 4v4 for the unit rows, but those seconds still count into `situationSeconds.ev`, depressing every unit's `pct` of EV time. A 3F+0D 3v3 shift still produces an F "unit" (its D group is empty, which is skipped, and the F size matches 3), and a 1F+2D shift produces a stray D "pair". Attempts in OT (16 attempts in one sampled game) will attribute to those stray units or to nothing.

OT also inflates per-game EV TOI for top players by up to 5 minutes (regular season) in the Trends view, which looks like a "role increase" that is not.

**How to avoid:**
- Give 3v3 (both teams at 3 skaters) and 4v4 their own situation label (or at minimum, separate OT from EV). Do not mix them into EV units or EV percentages.
- For the Trends view, either exclude OT seconds from the TOI trend or show a small marker on OT games and use TOI excluding OT for the slope. Also flag games decided in overtime so a single longer game is not read as a trend.
- Test with a `1331` fixture second.

**Warning signs:** EV unit `pct` values summing to well under 100% in OT games; a star's EV TOI spiking only in OT games.

**Phase to address:** Phase A (situation labelling), Phase C (OT handling in trends).

---

### Pitfall 9: Missing or late shift charts treated as "zero" (or silently poisoning averages)

**What goes wrong:**
A finished regular-season game can have **no** shift data and keep having none: I confirmed game `2026020026` (October 3, finished, one week old) returns `total: 0` from the shift chart endpoint, and a preseason game returned 5 rows. The existing `lines: null` handling covers that, but the new feature adds more places that can mistreat it:
- Event counts for that game computed as 0 instead of "unknown" (a unit table showing `0 0 0` looks like a real result).
- Trend averages and slopes that fold a `null` game in as 0 seconds, or that divide by the selected game count instead of the number of games with data.
- PBP fetched and parsed fine but shifts empty, so team-level SF/CF displayed from PBP alone while unit-level is blank: inconsistent within one table.
- The 1-hour `revalidate` on `FINISHED_GAME_CACHE` caches an empty shift response for an hour right after a game ends; a user checking just after the game sees "no data" for up to an hour longer than necessary.
- A shift chart can be partial (some periods or one team missing) rather than empty. A non-empty array is not proof of completeness.

**How to avoid:**
- Treat "no shift data" as a first-class state at every aggregation point: `null`, excluded from averages and slopes, labelled in the UI ("shift data unavailable") and counted as "n of N games used".
- Do not cache empty/short shift responses: skip `revalidate` caching (or use a short TTL) when `data.length === 0` or when the on-ice skater counts fail the `situationCode` sanity check.
- Add a per-game completeness check: for sampled events, on-ice skater counts per team must equal the `situationCode` skater counts (verified to hold for ~100% of events in good games). Store a coverage fraction; if below roughly 95%, mark the game's event stats unreliable instead of showing partial numbers. Also compare the sum of each skater's shift seconds with boxscore `toi` (small drift of a few seconds is expected).
- Require all three payloads (boxscore, play-by-play, shifts) to be present before computing event stats for a game; otherwise record which one is missing.

**Warning signs:** A game column with 0.0 TOI in the trend sparkline; unit tables showing zeros when a game's units are absent; averages that drop sharply for one game.

**Phase to address:** Phase A (state and validation), Phase C (exclusion from averages), Phase D (linemate gaps).

---

### Pitfall 10: Ordering events by `eventId` and assuming one second of resolution implies an order

**What goes wrong:**
`eventId` is not chronological. Verified: a penalty-shot `goal` has `eventId 403` while the same-second `penalty` has `eventId 520`; the correct order is `sortOrder` (goal 258, penalty 254... the penalty precedes the goal). Any logic that depends on ordering within a second (e.g. "state before the goal", last-event-before-stoppage, deduping) gets it wrong if it sorts by `eventId`.

**How to avoid:** Sort by `(period, sortOrder)`. For counting events, order does not matter; for anything stateful it does. Prefer stateless per-event logic (strength from the event's own `situationCode`, on-ice from the lookup) so ordering never matters.

**Phase to address:** Phase A.

## Moderate Pitfalls

### Pitfall 11: Mixing team IDs and abbreviations between feeds

**What goes wrong:** Play-by-play identifies teams by numeric `teamId` (`eventOwnerTeamId`, `rosterSpots[].teamId`); the existing shift code keys by `teamAbbrev` (`ShiftInput.team`) and the boxscore gives abbrevs. A numeric ID compared to an abbreviation is silently false and every attempt becomes "against".
**Prevention:** Resolve home/away IDs from the play-by-play (`homeTeam.id`/`abbrev`, `awayTeam.id`/`abbrev`) once, build `idToAbbrev`, and convert at the boundary. Add one test that fails if all events attribute to one side.
**Phase:** A.

### Pitfall 12: Silent `!pos` drops in shift ingestion hide missing players

**What goes wrong:** `analyzeGameLines` skips shifts whose `playerId` is not in the boxscore-derived positions map. A player missing from the boxscore lists (emergency goalie, data lag) simply never appears, shrinking on-ice sets and misattributing events to the wrong (smaller) unit.
**Prevention:** Count skipped shifts and surface them in the data-quality metric from Pitfall 9. Consider building `positions` from play-by-play `rosterSpots` (carries `teamId`, `positionCode`, both teams) so ID, position and team come from one payload.
**Phase:** A.

### Pitfall 13: Clock direction and display format confusion

**What goes wrong:** Play-by-play carries both `timeInPeriod` (elapsed) and `timeRemaining` (counting down); shift rows carry elapsed `startTime`/`endTime`; boxscore `toi` is a duration. Using `timeRemaining` against shift clocks is off by `periodLength - t`, and a hard-coded 1200 is wrong for OT (regular-season OT is 5:00, and OT ends early on a goal; one sampled game's final `timeInPeriod` was `01:33`).
**Prevention:** Use `timeInPeriod` only, through the existing `parseClock`. Do not use period length anywhere except as the existing offset; do not validate "events <= 20:00" for OT. Verified: all shift and event clocks used here are elapsed.
**Phase:** A.

### Pitfall 14: Playoff and multi-OT assumptions

**What goes wrong:** Playoffs use 20-minute sudden-death OT periods numbered 4, 5, 6... (`periodType: "OT"`), no shootout, and 5v5 in OT, not 3v3. Code that equates "OT" with 3v3 or with a 5:00 length, or "period > 3 = OT but period 5 = SO", breaks only in the playoffs, months from now.
**Prevention:** Derive everything from `periodType` and `situationCode`, never from period number or game type. One playoff fixture test before the playoffs start.
**Phase:** A (low urgency; the season is in October, so keep this as a tested assumption rather than a build target).

### Pitfall 15: Reading unit "against" stats on PP and SH tables as quality

**What goes wrong:** On a PP unit, CA is the other team's attempts *while our PP unit is on ice* (short-handed counterattacks), and on SH units CF is rare. Ratios like CF% are meaningless on PP/SH and invite the wrong conclusions about a PP1 unit being "bad". Also PP and SH time per game is small (often 1 to 4 minutes per unit), so counts are tiny.
**Prevention:** Show raw counts for/against on PP and SH, hide percentage columns there (or grey them out), and state the meaning in the legend ("team events while unit is on ice"). FEATURES.md already says to read these as team-for/against, not quality; encode that in the UI, not just the doc.
**Phase:** B.

### Pitfall 16: Trend slope on tiny, bounded, gappy series

**What goes wrong:**
- With 3 to 5 games a least-squares slope is mostly noise; one OT game, one blowout, or one injury-shortened game flips the sign. `trendSlope` returns a number for any 2+ points, which the UI then colours red/green.
- Early in the season (it is October) "last 20 games" is really 4 to 8 games, and preseason games are excluded, so a slope over a handful of points looks authoritative.
- Missed games (scratch, injury, trade, healthy scratch for a back-to-back) are indistinguishable from low-TOI games if recorded as 0, and slope over game *index* vs *date* differs when games are unevenly spaced.
- TOI is driven by game script: penalties taken (SH time), blowouts (garbage time), OT, and back-to-back rest, none of which are role changes. PP share is bounded 0-100 and noisy when team PP time is small.

**Prevention:**
- Require a minimum number of games played (e.g. at least 4) and show "n/a" below that; show the number of games used.
- Compute averages over games the player actually dressed for, and keep a distinct "did not play" state (not 0).
- Express "movement" as recent-vs-earlier comparison (FEATURES.md already proposes a delta) alongside the slope, and suppress the arrow unless the change exceeds a threshold relative to the player's own game-to-game variability, not a fixed minute count.
- Use the existing weighted `trendSlope` weights (e.g. weight PP-share points by team PP seconds) for every bounded ratio.
- Normalise TOI for OT (Pitfall 8) and mark OT/blowout games.
**Warning signs:** Arrows flipping between page loads as one new game enters the window; red/green on players with 3 games.
**Phase:** C.

### Pitfall 17: Event-stat trends on units over single games are statistical noise

**What goes wrong:** One line plays roughly 8 to 12 EV minutes per game, which is on the order of 10 to 20 attempts. A per-game CF% for a line swings from 20% to 80% by chance. Trending it (slope, sparkline) or colour-coding a single game's CF% invites false conclusions; the stated user goal is deployment (who plays with whom and how much), not performance.
**Prevention:** Keep event stats as raw counts for the *last game only*, as scoped in PROJECT.md. Do not add per-game or windowed slopes of CF/SF/GF. If percentage columns are shown, blank them when `for + against` is below a minimum (e.g. fewer than 10), and show them neutrally (no red/green).
**Phase:** B (and a guard against scope creep in C and D).

### Pitfall 18: Linemate time conflated with availability, strength, and line-change overlap

**What goes wrong:**
- Time together is computed from overlapping shift seconds. A linemate who was injured or scratched gets 0, which reads as "stopped playing with him", not "unavailable". Likewise when the *target* player misses a game.
- Overlap seconds include PP, SH, EV and 3v3 OT mixed; a PP1 partner dominates the total for a player on both PP1 and an EV line, hiding the EV line change.
- The overlap on change seconds (shifts that overlap by one second) inflates time together for adjacent lines.
- Forward linemates and D partners are in the same list unless split by position group; D partners rarely change within a game while forwards rotate.
- Absolute time together moves when the player's own TOI moves, so a TOI drop looks like a linemate change.
- 20 games x 25 linemates is a wide table: easy to build and hard to read.

**Prevention:**
- Compute per game, per situation (EV, PP, SH separately, OT excluded or separate), per linemate **position group**.
- Store both seconds together and "player dressed / linemate dressed" flags, and show absent games as blank, not 0.
- Show time together as a share of the *player's own* situation TOI as the primary measure (FEATURES.md lists this as a differentiator), with minutes as secondary.
- Use the same `t-1` / half-open second semantics for overlap as for TOI, since this is a time computation, not an event lookup (do not apply the event convention here).
- Rank linemates by total or recent time and cap the visible list.
**Warning signs:** A star's EV linemate list dominated by his PP1 unit; "new linemate" flags on players who just returned from injury.
**Phase:** D.

### Pitfall 19: Traded, called-up and changed-position players distort the roster and linemate lists

**What goes wrong:** `loadTeamResearch` merges players across the selected games, so a player who left or joined mid-window appears with null games and a default position from the most recent game. Position (C/L/R/D vs F/D group) can change game to game (a D playing forward). Grouping by the most recent position misgroups his earlier games.
**Prevention:** Keep the per-game position and the per-game dressed flag; group linemates by position *for that game*; mark pre-trade games as "not with team" rather than 0.
**Phase:** C and D.

### Pitfall 20: Load size and fan-out on a Vercel server component

**What goes wrong:** The page currently does boxscore + shifts for up to 20 games in parallel (40 requests). Adding play-by-play makes it 60 concurrent requests per page view, each parsed into per-second maps. Observed payload sizes: play-by-play ~125 to 145 KB, shift chart ~250 KB, boxscore ~13 KB, so the Next.js fetch cache's 2 MB per-entry limit is not a problem, but request count, function duration, and NHL rate limits could be. Rate-limit behaviour is untested (LOW confidence).
**Prevention:** Cap concurrency (e.g. 6 to 8 at a time); only fetch play-by-play for games in the window that need it; consider persisting per-game derived results (aggregates only) in Neon since finished games are immutable, so a window change reuses stored results instead of re-parsing. Decide this before Phase D multiplies the per-game computation.
**Warning signs:** 429s or slow first loads when selecting "last 20".
**Phase:** A (decision), C/D (reuse).

## Minor Pitfalls

### Pitfall 21: Unguarded `details` access and optional fields
Some events have no `details` (period-start/end), missed shots and goals may lack `goalieInNetId` (empty net), and `reason` strings vary (`wide-left`, `hit-right-post`, `failed-bank-attempt`, `short`, ...). **Prevention:** model `details` as optional, switch on `typeDescKey` with a safe default, and ignore unknown event types and reasons rather than throwing.

### Pitfall 22: Goal marker rows in the shift chart
Shift chart responses include `typeCode 505` rows (goal markers with `startTime == endTime`, `duration: null`, `shiftNumber: 0`). `getShiftCharts` already filters to 517. Keep that filter; do not treat the 505 rows as a second source of goal events, since play-by-play is the source of truth.

### Pitfall 23: Zero-length and overlapping shifts
Shifts with `startTime == endTime` exist; the existing `endSec <= startSec` skip handles them. Overlapping shifts (a player appearing in two shifts that overlap by a second) can produce on-ice skater counts of 11 for a team on a few events; the `situationCode` coverage check from Pitfall 9 catches this. Deduplicate by player per second when building event on-ice sets.

### Pitfall 24: Ignoring score and venue effects when comparing games
Home/away line matching and score effects change deployment. Out of scope to model, but do not call a TOI move in one game a trend (see Pitfall 16).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse the TOI second buckets for event lookup unchanged | No new data structure | Systematically wrong on 7% to 14% of attempts (Pitfall 1) | Never |
| Add a separate event-strength classifier | Quick | Two definitions of PP/SH that drift (Pitfall 5) | Never; share one function |
| Attribute events after `MIN_UNIT_SECONDS` filtering | Simple code path | Totals do not reconcile (Pitfall 7) | Never |
| Compute everything per request, no persistence | No schema work | 60 fetches per view; slow "last 20" | Acceptable for Phase B; revisit before Phase D |
| Fixed-minute thresholds for up/down arrows | Easy to explain | False signals on noisy players (Pitfall 16) | Acceptable only with a minimum-games guard |
| Zero-fill missing games | Simple arrays | Corrupts averages and slopes | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `api-web` play-by-play | Trusting `blocked-shot` owner as blocker; ordering by `eventId`; using period number for shootout | Shooter's team for direction; `sortOrder`; `periodType` |
| `api-web` play-by-play | Ignoring `situationCode` | Use it for event strength and as a free validator of on-ice counts |
| `api.nhle.com/stats` shift charts | Assuming a finished game has data, or that non-empty means complete | Treat empty/partial as a state; do not cache empties; coverage check |
| Boxscore vs play-by-play vs shifts | Mixed ids (`teamAbbrev` vs `teamId`) | Resolve once at the boundary |
| Boxscore blocked shots | Expecting player block counts to match event counts | They exclude `teammate-blocked`; use events, not boxscore, for Corsi |
| Next.js fetch cache | 1 hour `revalidate` on possibly-empty responses | Conditional caching |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 60 concurrent NHL requests per page view | Slow page, possible 429s | Cap concurrency; persist per-game aggregates | "Last 20" selected, or two users at once |
| Per-second maps for 20 games re-parsed per request | CPU time on every view | Cache derived per-game results keyed by game id | Noticeable around 20 games on cold starts |
| O(skaters^2) overlap per second for linemates | Trivial per game; adds up over 20 games x all players | Compute once per game, store pair seconds, not per view | Only if recomputed per player click |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing a user-supplied `team` or `player` query param straight into fetch paths or lookups | Malformed requests, noisy errors | Validate `team` against the known abbreviation list and `player` against the loaded roster (existing page already narrows `team`; do the same for `?player=`) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Zeros for unavailable data | User trusts a "0 CF" that is really "no shift data" | Show "no data" with a reason |
| Percentages on 3 events | False precision | Blank below a minimum count |
| Raw counts with no definition | Cannot compare to Frozen Pool | Legend: SF = SOG + goals, CF = SF + missed + blocked, empty net and shootout excluded |
| Red/green on noisy slopes | Wrong pickup/drop decisions, the core value of the app | Minimum games, threshold relative to variability, show n |
| Hiding the "other/transition" share | Tables look incomplete | Show the unattributed row or footnote |
| OT game inflating a trend | Phantom role change | Mark OT games, exclude OT seconds from EV TOI trend |

## "Looks Done But Isn't" Checklist

- [ ] **Event attribution:** reproduces boxscore `plusMinus` for every skater in at least 5 fixture games (regulation, OT, shootout, empty net, penalty shot).
- [ ] **Team totals:** summed SF per team equals boxscore `sog`; summed blocked-shot events equals boxscore blocks plus teammate-blocked count.
- [ ] **Unit reconciliation:** per situation, `sum(unit counts) + other == team total`.
- [ ] **Blocked shots:** Corsi direction follows the shooter, `teammate-blocked` is not credited as a block.
- [ ] **Empty net and shootout:** the rule is documented and applied to SF, GF and CF alike.
- [ ] **3v3 OT and 4v4:** not folded into EV unit rows or EV percentages.
- [ ] **Missing shift data:** a game with `total: 0` renders as "no data", is excluded from averages, and is not cached for an hour.
- [ ] **Coverage check:** on-ice skater counts match `situationCode` for at least 95% of attempts in each game, or the game is flagged.
- [ ] **Trends:** minimum-games guard, "n of N games" shown, did-not-play is not 0, OT marked.
- [ ] **Linemates:** per situation, per position group, absence blank not 0, share-of-own-TOI shown.
- [ ] **Period boundary:** event at `00:00` of period 2/OT does not read the prior period.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong boundary convention shipped | LOW | Change the one `onIceAt` function; rerun plusMinus fixture tests |
| CF/CA inverted from blocked-shot ownership | LOW | Fix direction in the event classifier; reconciliation test would have caught it |
| Poisoned fetch cache (empty shifts) | LOW | Revalidate by tag or wait out TTL; add conditional caching |
| Unit totals do not reconcile | MEDIUM | Re-do accumulation to attribute before filtering; add the "other" bucket |
| Trend arrows already trusted by user | LOW | Add min-games guard and delta; no data migration |
| Persisted per-game aggregates computed with a bug | MEDIUM | Version the derived data (store a `derivedVersion`) and recompute |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Half-open bucket lookup | A | Fixture plusMinus matches boxscore for all skaters |
| 2 t = 0 period boundary | A | Unit test with period 2 event at 00:00 |
| 3 Blocked-shot ownership and teammate-blocked | A | Fixtures for `blocked` and `teammate-blocked` |
| 4 SF/CF definitions | A | Team SF equals boxscore `sog` |
| 5 Empty net as PP | A | Test on `1560` / `0651` seconds; single classifier |
| 6 Shootout and penalty shots | A | SO fixture (game `2026020075`); penalty-shot fixture (`2025020500`) |
| 7 Unit totals do not reconcile | A, B | Sum-of-units plus other equals team total |
| 8 OT 3v3 / 4v4 | A, C | `1331` fixture; EV pct sums to 100% |
| 9 Missing or partial shift charts | A, C, D | Game `2026020026` renders as "no data"; coverage check |
| 10 `eventId` ordering | A | Sort by `sortOrder` |
| 11 Team ID vs abbrev | A | Not all events attribute to one side |
| 12 Silent position drops | A | Skipped-shift counter |
| 13 Clock direction | A | Elapsed-only in code review |
| 14 Playoffs and multi-OT | A | Playoff fixture before April |
| 15 PP/SH "against" read as quality | B | Percent columns hidden on PP/SH |
| 16 Trend noise | C | Min-games guard, delta, OT flag |
| 17 Event-stat trends | B | No slope on CF/SF/GF anywhere |
| 18 Linemate conflation | D | Per situation and position group; absence blank |
| 19 Traded and moved players | C, D | Per-game position and dressed flag |
| 20 Fan-out and load | A (decide), C/D (reuse) | Cap concurrency; persisted aggregates decision recorded |

## Phases Needing Deeper Research

- **Phase A:** needs a fixtures spike first (pull 5 to 6 real games: regulation, OT, shootout, penalty shot, empty net, missing shift chart) and the plusMinus/`sog`/`situationCode` reconciliation harness. This is the highest-risk phase; the conventions are now known, but they must be encoded as tests before any UI.
- **Phase B:** standard patterns once Phase A reconciles.
- **Phase C:** judgment-heavy (thresholds, minimum games); validate against a few real players' sequences from this season before fixing thresholds.
- **Phase D:** needs a decision on persistence (compute per view or store per-game pair seconds) before building, because pairwise overlap multiplies the per-game computation.

## Sources

- Live NHL API probes, 2026-10-11 (HIGH): `api-web.nhle.com/v1/gamecenter/{id}/play-by-play`, `/boxscore`, `api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={id}`; games used: 2026020075 (shootout), 2026020026 (OT, missing shift charts), 2026020002, 2026020045, 2026020058, 2025020500 (OT, penalty shot), 2025020100, 2025020300, 2025020700, 2025020900, 2025021000, 2025021100, 2023020001, 2024020500. Facts verified: blocked-shot owner is the shooter's team; `teammate-blocked` reason; boxscore SOG = shot-on-goal + goal; `situationCode` digit order and 3v3 / SO / pulled-goalie codes; boxscore plusMinus reproduced with `start < t <= end`; empty shift chart on a finished game; `eventId` vs `sortOrder`.
- Existing code (HIGH): `/Users/jwitt/Development/fantasy-hockey/lib/research/lines.ts`, `/Users/jwitt/Development/fantasy-hockey/lib/research/team-games.ts`, `/Users/jwitt/Development/fantasy-hockey/lib/nhl/client.ts`.
- Other public hockey scrapers and tools' shift-boundary and Corsi conventions (MEDIUM, recalled from general knowledge of hockey-scraper style tools and Natural Stat Trick / Evolving Hockey definitions, not re-fetched this session; superseded where my measurements above disagree).
- `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/research/FEATURES.md` (project context).
- Confidence tiers were assigned by direct measurement rather than the provider classification seam, since no search provider was used.

---
*Pitfalls research for: NHL line/deployment event attribution and trends*
*Researched: 2026-10-11*
