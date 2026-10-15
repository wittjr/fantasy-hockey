# Phase 3: Unit Event Stats - Research

**Researched:** 2026-10-13
**Domain:** NHL play-by-play to shift-chart event attribution (SF/SA, GF/GA, CF/CA per last-game unit), reconciliation fixtures, NHL API throttling, Next.js 16 fetch-cache tiering
**Confidence:** HIGH for attribution and fixtures (re-measured this session on 34 real games); MEDIUM for throttling (measured from one residential IP; Vercel egress behaviour is untested)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (already locked — do not re-ask)
- Attribution: an event at elapsed second T belongs to the skaters on ice with `start < t <= end` (REQUIREMENTS Conventions; research measured 100% on 2,644 events).
- Blocked shots count toward the shooting team's Corsi (`eventOwnerTeamId` is the shooter's team).
- Excluded from SF/GF/CF: empty-net events, shootout events (`periodType === "SO"`, never by period number), `teammate-blocked` attempts.
- One strength classifier (`situationFor` in `lib/research/lines.ts`) for both TOI and events; a 6v5 empty-net stretch is not a PP.
- Gate: event-attribution fixture tests (team SOG + every skater's plus-minus on real regulation, OT, shootout, empty-net, penalty-shot and missing-shift-chart games) pass before any plan adds event columns (ROADMAP gate).
- Unknown is never 0 (Phase 1 TRND-04, Phase 2 D-24): missing data shows "—".
- Laptop browsers only; no phone/touch UAT.

#### Caching and throttling (DATA-01)
- **D-01:** Goal is **fewer NHL calls** using Next's existing fetch cache. No Neon persistence (stays out of scope per REQUIREMENTS).
- **D-02:** **Tiered TTL by game age** for finished-game data (boxscore, shift chart, play-by-play): games **under 48 hours old revalidate every 1 hour; older games every 30 days**. Named constants. The existing empty-shift-chart uncached re-request (`getShiftCharts`) stays.
- **D-03:** **No manual refresh / cache-bypass control** on the page.
- **D-04:** When requests still fail after bounded concurrency + 429 retry, the **page always renders**; games that failed are left out and named in the existing banner (Phase 1 01-06 pattern).
- **D-05:** **Play-by-play-only failure keeps the game.** If the boxscore and shift chart loaded but play-by-play failed or is unpublished, the game stays in TOI trends and the linemate strip; only its event columns show "—", and the page notes that play-by-play is missing for that date. Same spirit as a failed shift chart today.

#### PP/SH stats
- **D-06:** **PP and SH tables show the same 9 columns as EV** (SF, SA, SF%, GF, GA, +/-, CF, CA, CF%). The legend explains that PP/SH percentages are lopsided by nature. This resolves the STATE.md Phase 3 concern.
- **D-07:** **+/- is GF − GA on every table**, PP/SH included. The legend notes it is not the official NHL plus-minus (which ignores PP goals for and SH goals against).

#### Table layout
- **D-08:** **One table per row, full width**, stacked EV-F, EV-D, PP-F, PP-D, SH-F, SH-D. This replaces the `lg:grid-cols-2` grid in `components/LastGameLines.tsx`.
- **D-09:** Stat columns use **Frozen Pool order, grouped**: Goals (GF GA +/-), Shots (SF SA SF%), Corsi (CF CA CF%), with a group header row or light dividers between groups. Existing #, Time, % and line-name columns stay.
- **D-10:** **Neutral numbers, no colour coding** on %, +/- or counts. Green/red remains reserved for Phase 1 deployment movers.
- **D-11:** **Keep the current unit caps** (`UNIT_LIMITS`: EV F4/D3, PP F2/D2, SH F3/D3). Units below the cap roll into "Other".

#### "Other" row, totals and exclusions (UNIT-03)
- **D-12:** Each table ends with an **"Other" row and a "Total" row**. "Other" = every event in that situation not on a listed unit (below-cap units, partial combos mid-change, 4v4/3v3 for EV). "Total" = the team's total for that situation, so listed + Other = Total. Total shows situation time as well.
- **D-13:** **4v4/3v3 events count as EV** and land in the EV table's "Other" row, consistent with `analyzeGameLines` counting those seconds as EV.
- **D-14:** A **one-line per-game exclusions note** under the tables, e.g. "Excluded: 1 empty-net goal, 2 shootout attempts, 3 teammate-blocked", so post-exclusion totals reconcile visibly with the official boxscore.
- **D-15:** A **legend** defines SF, GF, CF, SF%, CF%, +/- and the exclusions (UNIT-03), and states that SF%/CF% show "—" when for + against = 0 (UNIT-02).

#### Unreliable or missing data (DATA-02)
- **D-16:** If a game's shift-derived on-ice skater counts disagree with play-by-play `situationCode` on too many events, **stats are still shown with an amber warning** (e.g. "Shift data disagrees with play-by-play on N% of events; counts may be off"), reusing Phase 2's amber footnote treatment.
- **D-17:** Threshold starts at **95% match**, one named constant; the fixture spike measures real games and may tune it. Penalty-shot events are expected mismatches and should not count against a game.
- **D-18:** If the **last game has no play-by-play** (just finished, unpublished or failed), unit tables still show the units with Time/% columns; **event columns show "—" with a note**. **No fallback** to an earlier game.

### Claude's Discretion
- Concurrency cap and retry/backoff details for DATA-01 (research suggests ~6 concurrent; verify 429 behaviour in dev before production).
- Penalty shots: research says exclude them from unit attribution but keep them in team-level reconciliation. Follow that, and decide whether they appear in the D-14 exclusions note.
- Whether OT events (not shootout) count on PP/SH/EV tables. Default: yes, consistent with whole-game `lines` including OT (Phase 1). Document the choice in the legend if it matters.
- Exact legend wording and placement, the group-header styling, and the "Other"/"Total" row styling within the existing neutral visual language (`tabular-nums`, neutral palette).
- How a game's age is determined for the D-02 TTL tier (schedule date or start time) and how the TTL is passed per request.
- If a play-by-play response is too large for Next's data cache (check the per-entry size limit in `node_modules/next/dist/docs/`), choose a workaround that still meets D-01 (e.g. caching a trimmed or derived per-game result). Do not add Neon persistence.

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within phase scope. (Phase boundary: no event stats outside the last-game unit tables, no event trends, no per-60 or xG, no league-wide views.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | "Last 20" loads without failing from NHL throttling (bounded concurrency + retry on 429) | Measured: api-web throttles by request rate (burst ~50, then a ~60 s ban with `Retry-After`), NOT by concurrency; shift-chart host is not throttled. Design = tiered TTL (fewer calls) + pacing + newest-first pool + short-cap 429 retry + graceful degrade. See "Throttling" section. |
| DATA-02 | "—" (never 0) for event stats in games with missing shift chart or play-by-play; those games excluded from averages/trends | `events: GameEvents \| null` on `ResearchGame`; null when `lines === null` or play-by-play missing. No event average/trend exists in this milestone, so exclusion is structural. D-05 keeps pbp-only failures in TOI trends. |
| DATA-03 | Counts reconcile with official boxscore; fixture tests reproduce team SOG and per-skater plus-minus | Prototype harness reproduced boxscore team SOG on 34/34 games and every skater's plus-minus on 32/34 (two explained exceptions). Fixture game list and test design below. |
| UNIT-01 | SF/SA, GF/GA, CF/CA raw counts on every last-game unit table | `attributeEvents` keyed by the same unit key as `analyzeGameLines`; view-model builds rows + Other + Total. |
| UNIT-02 | SF%, CF%, +/- shown, "—" when a unit has no events | Formulas and "—" rules in "Code Examples"; +/- interpretation flagged as A3. |
| UNIT-03 | Legend defines stats and exclusions; "other" row makes totals reconcile | Other = Total − listed rows by construction; exclusions note counts per exclusion type game-wide. |
</phase_requirements>

## Summary

The attribution method already locked in CONTEXT.md is correct and was re-verified from scratch this session on 34 real 2025-26/2026-27 games. A throwaway Python harness (scratchpad, not committed) bucketed shift rows per second, looked an event up in bucket `(period-1)*1200 + t - 1` (the `start < t <= end` rule), and then (a) summed `goal` + `shot-on-goal` per team and compared with the boxscore team `sog`: **34 of 34 match exactly**; (b) recomputed every skater's plus-minus from goal events: **32 of 34 games match for all 36 skaters**; (c) compared shift-derived on-ice skater/goalie counts with each event's `situationCode`: **99-100% per game** (lowest 94/95 = 98.9%). The two exceptions are real data quirks that the fixture design must plan for (see Pitfalls 4 and 5): game 2025020500 has one skater off by one (Panarin), and game 2025020565 has a shift chart that contains ~36 foreign VGK/SJS players and triplicated rows and reproduces plus-minus for only 23/36 skaters even though 118/119 events still match `situationCode`.

The biggest new finding contradicts earlier research: **NHL throttling is a request-rate limit, not a concurrency limit, and 429s do carry `Retry-After` (50-60 s).** Measured: 12 requests fine; a 40-request burst gave 1 429; the same burst 8 s later gave 38 429s (a ~60 s penalty window); 120 requests at concurrency 6 (about 23/s) hit the wall at request 55; 150 requests paced at ~1.4/s and 150 at ~3.5/s produced zero 429s. The shift-chart host (`api.nhle.com`) took 60 concurrent requests with zero 429s. So "cap concurrency at 6 and retry after 1-3 s" (the earlier STACK.md advice) would not have protected a cold "Last 20" that follows another cold team load, and a 1-3 s retry cannot outwait a 60 s ban. The workable design is: long TTLs so most loads make zero NHL calls (D-02), a pool that paces request starts to about 4 per second, newest-game-first ordering so "Last game" survives a mid-load ban, a 429 retry that only waits when `Retry-After` is short, and D-04's graceful degradation so a reload fills in the rest (successful responses are cached; non-200 responses never are).

Everything else is integration on existing code with zero new dependencies: add `getPlayByPlay`, a pure `toGameEvents` mapper, a pure `attributeEvents` that reuses `bucketOnIce`/`dedupeOnIce`/`situationFor` and a unit-key helper extracted from `analyzeGameLines`, an `events: GameEvents | null` field on `ResearchGame`, a pure view-model for rows/Other/Total, and the `LastGameLines` re-layout. Fixtures (trimmed real API payloads, ~55 KB per game) gate the UI work.

**Primary recommendation:** Build in this order: (1) fixtures + `play-events.ts` + `events.ts` + the plus-minus/SOG reconciliation tests (the gate), (2) client changes (play-by-play fetch, tiered TTL, 429 retry, paced newest-first pool), (3) wire `events` into `loadGame`, (4) view-model + `LastGameLines` UI + legend/notes. Do not start (4) until (1) is green.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch play-by-play, tiered TTL, 429 retry | API / Backend (server module `lib/nhl/client.ts`) | CDN / Static (Next Data Cache) | Server-only fetch; the Data Cache is the "fewer calls" mechanism (D-01) |
| Bounded/paced per-game loading | API / Backend (`lib/research/team-games.ts`) | — | Runs inside the async server component request |
| Play-by-play to event list | API / Backend (pure fn) | — | Pure transform of the NHL JSON; no I/O |
| Event-to-unit attribution + reconciliation counts | API / Backend (pure fn) | — | Reuses the shift timeline; must stay server-side next to `lines` |
| Row/percent/Other/Total view-model | API / Backend (pure fn, tested) | — | Project pattern: `*-view.ts` pure modules with tests, components just render |
| Unit tables, legend, exclusions note, amber warnings | Frontend Server (SSR component `LastGameLines`) | — | Server component; no client state needed |
| Fixture data | Repo test assets | — | Static JSON beside the tests, no Neon |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js `fetch` with `next.revalidate` | 16.3.4 (installed) | Tiered finished-game cache (D-01, D-02) | Already used by `FINISHED_GAME_CACHE`; Data Cache stores only 200 responses `[CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md line 56]` |
| TypeScript + `node:test` via `tsx` | tsx ^4.23.13, Node v24.21.0 | Pure analysis modules and fixture tests | Existing runner; baseline `npm test` = 334 pass `[VERIFIED: ran npm test this session]` |

### Supporting
None. **No new packages.** In-house worker pool and retry (about 25 lines) instead of `p-limit`/`p-retry`, per AGENTS.md "minimum code".

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-house pool + pacing | `p-limit`, `p-retry` | New dependencies and a legitimacy audit for ~25 lines; neither paces by rate anyway |
| Next fetch cache (30-day TTL) | Neon persisted aggregates | Explicitly out of scope (REQUIREMENTS, D-01) |
| Fetch-cache of raw pbp (~140 KB) | Cache a trimmed derived result | Not needed: entry limit is 2 MB and pbp is ~140 KB (see below) |

**Installation:** none.

**Cache entry size check (CONTEXT discretion item):** The Data Cache rejects entries over 2 MB: `// FetchCache has upper limit of 2MB per-entry currently` and `items over 2MB can not be cached` `[VERIFIED: node_modules/next/dist/server/lib/incremental-cache/index.js:518-526]`. Measured payloads this session: play-by-play 136,763-144,145 bytes, shift chart 270,563-274,425 bytes, boxscore 13,172-13,346 bytes `[VERIFIED: curl -w %{size_download}, games 2026020075/2025020500/2026020026]`. All far below 2 MB, so no workaround is needed.

## Package Legitimacy Audit

No external packages are installed or recommended in this phase. Audit not applicable. (The `package-legitimacy` seam was not run because there is nothing to check.)

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 /research?team=X&games=20  (async server component, page.tsx)
            |
            v
 loadTeamResearch(team, count)
   getClubScheduleNow -> last N finished games (newest first for loading)
            |
   paced pool (concurrency ~3, ~400-500 ms between game starts)
            |
   per game ------------------------------------------------------------+
   |  tier TTL from startTimeUTC age: <48h -> 3600 s ; older -> 30 d     |
   |                                                                     |
   |  getBoxscore (api-web, THROTTLED) --\                               |
   |  getPlayByPlay (api-web, THROTTLED) --+-> [429?] Retry-After <= cap |
   |  getShiftCharts (api.nhle.com, free) -/        -> short retry       |
   |                                                else fail the game   |
   |                                                (-> unavailableDates)|
   |                                                                     |
   |  boxscore -> positions + toi (existing)                             |
   |  shifts   -> shiftInputs -> analyzeGameLines (existing: lines)      |
   |  pbp      -> toGameEvents(pbp)  [map team ids, classify exclusions] |
   |                    |                                                |
   |  attributeEvents(team, shiftInputs, positions, events)              |
   |     bucketOnIce -> onIceAt(period, t)  [bucket t-1, t<=0 => none]   |
   |     situationFor (same classifier as TOI) -> situation              |
   |     unitKey (shared with analyzeGameLines) -> per-unit counts       |
   |     compare shift counts vs situationCode -> match quality          |
   |  => game.events : GameEvents | null                                |
   +---------------------------------------------------------------------+
            |
            v
 LastGameLines (last game only)
   view-model: rows = listed units (UNIT_LIMITS cap) + Other (= Total - listed) + Total
   events null -> "—" + note (pbp missing / no shift chart)
   quality < threshold -> amber warning
   exclusions note + legend
```

### Recommended Project Structure
```
lib/nhl/
├── client.ts              # + getPlayByPlay, tiered cache option, 429 retry in nhlGet
└── client.test.ts         # + pbp, TTL tier, 429 retry tests
lib/research/
├── play-events.ts         # NEW pure: NHL pbp JSON -> GameEvent[] (team, kind, exclusion)
├── play-events.test.ts
├── events.ts              # NEW pure: onIceAt, attributeEvents, GameEvents types, quality
├── events.test.ts         # NEW: fixture reconciliation GATE + unit tests
├── fixtures/              # NEW: trimmed real payloads, one JSON per fixture game
├── lines.ts               # extract unitKey() (behaviour unchanged; lines.test.ts must stay green)
├── team-games.ts          # + events field, getPlayByPlay in loadGame, paced newest-first pool
├── unit-events-view.ts    # NEW pure view-model (rows, Other, Total, formatting)
└── unit-events-view.test.ts
components/
└── LastGameLines.tsx      # stacked full-width tables, grouped columns, legend, notes
```
No barrel files (CLAUDE.md). Tests co-located. Fixtures are loaded with `fs.readFileSync` in tests (the npm test glob is `lib/**/*.test.ts`).

### Pattern 1: One timeline, one strength rule, one unit key
**What:** Events reuse `bucketOnIce` + `dedupeOnIce` + `situationFor` from `lines.ts`, and a `unitKey()` helper extracted verbatim from the F/D grouping inside `analyzeGameLines`, so a unit's seconds and its events can never be keyed differently.
**When to use:** Always; this is the locked "one classifier" decision.
**Existing code being reused (read this session, `lib/research/lines.ts`):**
```ts
const EV_UNIT_SIZE = { F: 3, D: 2 } as const;
```
```ts
      const ids = mine.skaters.filter((id) => positions.get(id) === group).sort((a, b) => a - b);
      if (ids.length === 0) continue;
      if (situation === "ev" && ids.length !== EV_UNIT_SIZE[group]) continue;
      const key = ids.join(",");
```
`Unit.playerIds` is parsed back from that key (`key.split(",").map(Number)`), so `unit.playerIds.join(",")` equals the key and joins events to listed units `[VERIFIED: lib/research/lines.ts:63,151-154,164-168]`.

### Pattern 2: Attribute first, filter later; Other is arithmetic
**What:** Count every included event into `total[situation]` and into its unit key *before* `MIN_UNIT_SECONDS` / `UNIT_LIMITS` filtering. At render time `Other = Total - sum(displayed listed rows)`. Reconciliation then holds by construction for any cap.
**Why:** Pitfall 7 (units dropped by size/time filters) and D-12.

### Pattern 3: Null means unknown
**What:** `ResearchGame.events: GameEvents | null`. Null when the shift chart is missing (`lines === null`) or play-by-play failed/unpublished. The UI distinguishes the reasons: `game.lines === null` -> existing no-chart message; `game.lines && !game.events` -> "play-by-play missing" note (D-05/D-18).

### Pattern 4: Pure view-model, thin component
**What:** `unit-events-view.ts` returns `{ rows, other, total }` with display strings already formatted, tested without React, like `toi-trends-view.ts`/`player-detail-view.ts`.

### Anti-Patterns to Avoid
- **Looking events up in bucket `t`** (the TOI half-open rule): wrong on 7-14% of attempts; use `onIceAt` (bucket `t-1`, none when `t <= 0`).
- **A second strength classifier from `situationCode`** for the unit tables: use shift-derived `situationFor`; use `situationCode` only for exclusion detection and the quality check.
- **Deciding `periodType` from period number**: playoff OT is periods 4, 5, 6...; use `periodType === "SO"`.
- **Summing F-table and D-table counts**: each event is in one F unit and one D unit; both tables' Total is the team total.
- **Treating `eventId` as chronological**: not needed (counts are order independent); if ordering is ever needed use `sortOrder`.
- **Awaiting a 60 s `Retry-After`** inside a server render.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Strength (EV/PP/SH) for events | A new situationCode-based rule | `situationFor(dedupeOnIce(mine), dedupeOnIce(opp))` | Locked decision; empty-net 6v5 handled; verified exact on 34 games |
| Per-second on-ice lookup | New shift walker | `bucketOnIce` + new thin `onIceAt` | Same keys as TOI; handles verbatim duplicate rows via `uniqueShifts` |
| Unit identity | New key format | `unitKey()` extracted from `analyzeGameLines` | Prevents unit/event drift |
| Clock parsing | New parser | `parseClock` | Existing, tested |
| Caching finished games | Neon table / `unstable_cache` / `use cache` | `fetch(..., { next: { revalidate } })` | D-01; 2 MB limit not an issue |
| Concurrency/retry libs | `p-limit`, `p-retry` | ~25-line in-house pool + retry | AGENTS.md; they do not pace by rate |

**Key insight:** every difficult number (strength, unit identity, on-ice sets) already exists in `lines.ts`; the phase is mostly a faithful second consumer of that timeline plus an honest reconciliation harness.

## Verified Data Contracts (live NHL API, probed 2026-10-13)

All quoted from real responses fetched this session (`https://api-web.nhle.com/v1/gamecenter/{id}/play-by-play`, `/boxscore`, `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={id}`) `[VERIFIED: live API probe, games 2026020075, 2025020500, 2026020026 and 34 sampled 2025-26 games]`.

- Event types used: `"typeDescKey": "goal"`, `"shot-on-goal"`, `"missed-shot"`, `"blocked-shot"`.
- Blocked shot (verbatim): `"typeDescKey": "blocked-shot"` ... `"details": {... "blockingPlayerId": 8481542, "shootingPlayerId": 8481618, "eventOwnerTeamId": 8, "reason": "blocked"}`. Reasons seen across 1,157 blocked events: `blocked` 1042, `teammate-blocked` 113, `other-block` 2. Treat any reason other than `teammate-blocked` as a normal opponent block; do not throw on unknown reasons.
- `eventOwnerTeamId` equals the shooter's team (looked up through `rosterSpots`) for **4,392 of 4,392** non-shootout shot/goal events (0 mismatches).
- Shootout events: `"periodDescriptor": {"number": 5, "periodType": "SO", ...}`, `"timeInPeriod": "00:00"`, `"situationCode": "1010"`.
- `situationCode` digit order (away goalie, away skaters, home skaters, home goalie): game 2025020565 (home NJD, id 1) has an empty-net goal by BUF with `situationCode` `1560`, `goalieInNetId` absent. For the defending goalie digit: `awayGoalieDigit = code[0]` when the shooter is the home team; `homeGoalieDigit = code[3]` when the shooter is the away team.
- **Empty-net detection:** `goalieInNetId` absent <=> defending-goalie digit `0`, **18 of 18 goals and 19 of 19 missed shots**; shots on goal never occur against an empty net; blocked shots have no `goalieInNetId` field at all but 9 of 1,157 have defending-goalie digit `0`. So use the `situationCode` digit (covers all four event types), not `goalieInNetId`.
- Penalty shots: `situationCode` `1010` or `0101` inside a non-`SO` period. Found: 2025020500 goal (P1 19:08) and 2025020528 missed shot (P3 07:49).
- Shift rows: `typeCode` 517 = shift (existing filter). `startTime`/`endTime` are elapsed `MM:SS`. Boxscore skaters carry `plusMinus`; boxscore teams carry `sog` and `id`. Play-by-play `homeTeam`/`awayTeam` carry `id`, `abbrev`, `sog`.
- Schedule rows carry `startTimeUTC` (e.g. `"startTimeUTC": "2026-09-19T23:00:00Z"`) but the repo's `NhlGame` type omits it `[VERIFIED: lib/nhl/client.ts:27-34 read this session]`.
- Missing shift chart still reproduces: game 2026020026 returns `{"data":[],"total":0}` (re-fetched 2026-10-13).

## Fixture Spike Results (the DATA-03 gate)

Harness result per category (full table of 34 games in the scratchpad; summary):

| Needed category | Recommended game | Evidence this session |
|-----------------|------------------|-----------------------|
| Regulation | 2025020084 (WPG vs NSH) | SOG ok, 0/36 plus-minus mismatches, 124/124 code match, 5 teammate-blocked |
| Overtime | 2025020306 (ANA vs UTA) | `lastPeriodType: OT`, SOG ok, 0/36 mismatches, 103/103 |
| Shootout | 2026020075 (MTL vs DET) | `lastPeriodType: SO`, 12 shootout shot/goal events excluded, SOG 30/30 ok, 0/36, 129/129, 4 teammate-blocked |
| Empty-net goal | 2025020343 (COL vs NSH) | 2 empty-net goals, SOG ok, 0/36, 120/120 |
| Penalty shot | 2025020528 (SEA vs COL) | missed-shot penalty shot + 1 empty-net goal, SOG ok, 0/36 mismatches, 156/157 |
| Penalty-shot goal + OT | 2025020500 (NYR vs MTL) | PS goal at P1 19:08, SOG ok, **35/36**: A. Panarin official 0, reproduced -1 |
| Missing shift chart | 2026020026 | shift endpoint returns `{"data":[],"total":0}`; play-by-play and boxscore exist |
| Anomalous shift chart (negative test) | 2025020565 (BUF at NJD) | 2,166 rows = 722 unique x 3; 36 foreign VGK/SJS players in the chart; 13/36 plus-minus mismatches although 118/119 events match `situationCode` |

Aggregate over the 34-game sample: team SOG reconciliation 34/34; plus-minus exact in 32/34; `situationCode` match ranged 98.9%-100% per game (non-penalty-shot, non-shootout events); 8 mismatching events in the whole sample, all one-skater differences at a single event.

**Plus-minus rule that reproduces the boxscore** (use it in the test, not in the UI): for each goal that is not shootout and not a penalty shot, if the scoring team's strength (via `situationFor`, shift-derived, at bucket `t-1`) is a power play (`"pp"`) give nobody a point; otherwise +1 to the scorer's on-ice skaters and -1 to the other team's on-ice skaters. Empty-net goals count (the pulled-goalie team is `"ev"`, matching official plus-minus); short-handed goals count.

**Fixture format (recommended):** trimmed raw-shaped JSON per game, about 50-60 KB each (about 330 KB for 6 games; measured 53,840 / 50,130 / 57,656 / 52,520 / 60,527 / 56,174 bytes, 100,776 for 2025020565): `homeTeam`/`awayTeam` `{id, abbrev, sog}`, `plays` (only the four shot types with `periodDescriptor`, `timeInPeriod`, `situationCode`, `typeDescKey`, and `details` limited to `eventOwnerTeamId`, `shootingPlayerId`, `scoringPlayerId`, `reason`, `goalieInNetId`), `shifts` as `[playerId, teamAbbrev, period, startTime, endTime]` tuples **kept verbatim including duplicate rows**, and `players` as `[playerId, side, group, plusMinus]` from the boxscore. Keep the mapper and shift conversion under test by building the NHL-shaped inputs from the fixture. Capture them once with a throwaway script (not committed) and commit only the JSON.

## Throttling (DATA-01) - measured behaviour

Measured on 2026-10-13 from the dev machine, `api-web.nhle.com` boxscore/play-by-play URLs `[VERIFIED: node scripts run this session]`:

| Probe | Result |
|-------|--------|
| 12 concurrent | 12 x 200 |
| 40 concurrent (20 boxscore + 20 pbp), 5 s later | 39 x 200, 1 x 429, `Retry-After: 60` |
| 40 concurrent again, 8 s later | 2 x 200, **38 x 429**, `Retry-After` 51-52 |
| After 75 s rest, 120 requests at concurrency 6 (~23/s) | 55 x 200, then 65 x 429 starting at request index 55, `Retry-After: 60` |
| After rest, 150 requests, one at a time with 400 ms gap (~1.4/s) | 150 x 200 |
| After rest, 150 requests, 2 workers, 250 ms gap (~3.5/s, 42 s) | 150 x 200 |
| 60 concurrent shift-chart requests (`api.nhle.com`) | 60 x 200 |
| `club-schedule-season/{team}/now` | 307 redirect (fetch follows it; `curl` needs `-L`) |

Conclusions:
1. The limit is request **rate/count** per window with a ~60 s penalty, not simultaneous connections. Concurrency 6 did not help once the request count ran away.
2. `Retry-After` is present (50-60 s). STACK.md's "no Retry-After observed" is superseded `[VERIFIED: 429 responses above]`. A 1-3 s backoff will not clear a ban.
3. A cold "Last 20" is 1 schedule + 20 boxscore + 20 play-by-play = **41 api-web requests** (shift charts are on the free host). That is right at the edge of the burst budget, and a second cold team within a minute exceeds it.
4. Next's cache stores only HTTP 200 `[CITED: fetch.md line 56]`, so a 429 is never cached and a reload after the penalty completes the missing games from the cache plus fresh calls. This is what makes D-04 ("page always renders, reload to fill in") a real strategy.

**Recommended design (all constants named, tuned in dev per the ROADMAP flag):**
- `MAX_CONCURRENT_GAMES = 3` (each game fires boxscore + pbp + shift chart together, so ~6 in flight).
- `GAME_START_GAP_MS ~ 400-500` between game starts (about 4 api-web requests/s, inside the measured-safe 3.5/s). Cold "Last 20" then takes ~10 s; warm loads are instant.
- Load **newest game first** (reverse `recent` for loading, keep `games` oldest-first for output): if a ban hits mid-load, the missing games are the oldest, so "Last game" and the unit tables survive. (Today `Promise.allSettled(recent.map(...))` starts oldest-first.)
- `nhlGet`: on 429 read `Retry-After`; if it is <= a small cap (`RETRY_AFTER_CAP_S = 5`) wait and retry up to 2 times, otherwise throw immediately (`NHL API ... failed: 429 ...`, already the message shape). Also retry a thrown network error (connect timeout) with 1 s then 2 s backoff. Never sleep for the observed 50-60 s.
- Keep the empty-shift-chart uncached re-request (D-02); the shift chart host is unthrottled so this costs nothing.
- Make `sleep` injectable (default `setTimeout` promise) so tests do not wait.

**Dev verification step (mandatory before deploying, per ROADMAP):** `next dev`, clear `.next/cache`, open `/research?team=<X>&games=20` cold, then two more teams within a minute. Expected: no 429 lines in the server log, no amber "Couldn't load" banner; repeat the first team and confirm zero outbound calls (cache). If 429s still appear, lower `MAX_CONCURRENT_GAMES` / raise the gap before touching anything else. Note STACK.md's optional load reduction (drop the boxscore call; pbp `rosterSpots` and the shift chart can supply positions and TOI) would cut api-web calls by a third, but it changes working Phase 1/2 code; keep as the fallback if 429s persist.

## TTL tier (D-02)

- Age source: the schedule row's `startTimeUTC` (add `startTimeUTC?: string` to `NhlClubGame`; the repo's test stubs omit it, so treat missing as "recent"). Game age = `now - startTimeUTC`; recent when under 48 h. A game's end is ~2.5-3.5 h after the start, so this is conservative (a game is treated as recent for slightly less than 48 h after it ends). Do not use `gameDate` midnight: it overestimates age by up to ~26 hours and would pin not-yet-final data for 30 days.
- Shape: a pure `finishedGameCache(startTimeUTC, now = Date.now())` returning `{ next: { revalidate: RECENT_GAME_REVALIDATE_S | OLD_GAME_REVALIDATE_S } }`; constants `RECENT_GAME_WINDOW_MS = 48 * 3600 * 1000`, `RECENT_GAME_REVALIDATE_S = 3600`, `OLD_GAME_REVALIDATE_S = 30 * 24 * 3600`. Pass the init as a parameter: `getBoxscore(gameId, cache)`, `getPlayByPlay(gameId, cache)`, `getShiftCharts(gameId, cache)`. Default argument = the recent tier so existing callers and `client.test.ts` (`calls[0].init.next?.revalidate, 3600`) stay valid.
- Existing constant being generalized (verbatim): `const FINISHED_GAME_CACHE = { next: { revalidate: 3600 } };` `[VERIFIED: lib/nhl/client.ts:117]`.
- Next fetch rules to respect: "If two fetch requests with the same URL in the same route have different `revalidate` values, the lower value will be used" and a per-fetch `revalidate` lower than the route default decreases the route interval `[CITED: fetch.md lines 74-75]`; the research page is dynamic (auth + `searchParams`), and each URL is fetched once per request, so this is benign. `{ revalidate: 3600, cache: 'no-store' }` together is invalid, so the uncached re-request correctly omits `next` (already tested: `"next" in calls[1].init === false`).
- Pitfall: an unpublished play-by-play (`plays` empty or non-2xx) fetched for a game in the 48 h tier is cached only 1 h; but once past 48 h a response that was incomplete at fetch time would be pinned 30 days. Mitigation: treat `plays.length === 0` as missing (events null) and, like the shift chart, re-request an empty result uncached. Games older than 48 h whose first successful fetch happened <48 h ago are re-fetched hourly until the entry expires, so they are normally complete.

## Common Pitfalls

### Pitfall 1: Event lookup in the TOI bucket
**What goes wrong:** attributing an event at second `t` to bucket `t` returns the wrong skaters at line-change seconds (wrong on 7-14% of attempts; plus-minus off for 14-32 of ~36 skaters).
**How to avoid:** one function `onIceAt(buckets, period, t)` = bucket `(period - 1) * PERIOD_SECONDS + t - 1`, `undefined` when `t <= 0`. Unit tests: shift ending exactly at `t` is on ice; shift starting exactly at `t` is not; event at `00:00` of period 2 does not read period 1's last second.
**Warning signs:** plus-minus fixture mismatches; on-ice counts disagree with `situationCode`.

### Pitfall 2: Playoff / multi-OT period arithmetic
**What goes wrong:** `PERIOD_SECONDS = 1200` as an offset is fine for 20-minute playoff OT periods, but "period 5 = shootout" is not.
**How to avoid:** exclusion by `periodType === "SO"` only. Add a playoff-shaped synthetic unit test (period 5 with `periodType: "OT"` must count).

### Pitfall 3: Empty-net detection via the wrong field
**What goes wrong:** `goalieInNetId` is absent on goals and missed shots at an empty net but blocked shots never have it; a blocked attempt at an empty net would slip through.
**How to avoid:** defending-goalie digit of `situationCode` (verified 100% consistent with `goalieInNetId` where both exist).
**Scope note:** exclude only attempts directed at an empty net. Attempts *by* the pulled-goalie team at 6v5 (41 blocked, 38 missed, 54 SOG and 10 goals by a team with its goalie out in the 34-game sample) are real attempts against a goalie; they remain counted and classify as `ev`. With 6 skaters they land in "Other" for the F table unless exactly 3 forwards are out (a 3F+3D stretch still forms an F trio) and in "Other" for the D table unless exactly 2 defensemen are out (a 4F+2D stretch still forms a D pair). That is the existing unit rule and it is consistent between time and events. (Flagged as A4.)

### Pitfall 4: Plus-minus fixtures with a known exception
**What goes wrong:** 2025020500 reproduces 35 of 36 skaters (A. Panarin official `0`, reproduced `-1`; his shift 15:28-16:18 ends exactly on a P1 goal at 16:18). This is data, not an attribution bug (the other 35 skaters, including all on ice for the other 8 goals, match).
**How to avoid:** do not use this game as the all-skaters-exact gate. Either use 2025020528 for penalty shots and keep 2025020500 only for its team-SOG + penalty-shot assertions, or encode a single named, commented `KNOWN_BOXSCORE_DISAGREEMENTS` entry for that skater. Never loosen the assertion generally.

### Pitfall 5: Corrupted shift charts that `situationCode` cannot detect
**What goes wrong:** 2025020565's chart has tripled rows (de-duplicated by `uniqueShifts`, whose key ignores the row `id`), 36 foreign-team players (already dropped because `bucketOnIce` only keeps ids in the boxscore-derived `positions`), and after that still disagrees with official plus-minus for 13 skaters while 118/119 events match `situationCode`. A per-game match threshold cannot catch a one-event-wrong game.
**How to avoid:** accept this as the limit of the D-16/D-17 check; the warning copy says "may be off". Use the game as a regression test for (a) duplicate rows not changing counts and (b) foreign players being ignored, not as a plus-minus gate. Do not promise exactness in the legend.
**Measured threshold evidence for D-17:** 95% is safely below observed good games (min 98.9%). It will catch a missing period or team: removing period 2 from three good games dropped the match to 67.7%, 68.2% and 60.0%, and removing one team's shifts to 0% `[VERIFIED: harness run this session on 2025020084, 2026020075, 2025020343]`. Keep 95% as the named constant; the spike supports it. Consider asserting in a test that dropping one period from a good fixture falls below it.

### Pitfall 6: Penalty shots and shootout in the reconciliation
**What goes wrong:** boxscore `sog` includes penalty-shot shots/goals and empty-net goals (they are `goal` / `shot-on-goal` events), but unit tables exclude them.
**How to avoid:** reconcile in the test as `sum(all included SF + excluded SOG-type events, excluding shootout) == boxscore sog`. In the UI, put penalty shots in the D-14 exclusions note ("1 penalty shot") so a user reading the boxscore can reconcile (resolves the discretion item: **yes, list them**). Detect them by `situationCode` `1010`/`0101` outside `SO`; they sit in no unit, no Other, no Total.

### Pitfall 7: Unit/Other reconciliation drift
**What goes wrong:** attributing after the `MIN_UNIT_SECONDS`/cap filters drops events silently.
**How to avoid:** accumulate into `total[situation]` and the unit map in the same pass; derive Other at render. Test `listed + other == total` for every situation/group with a small synthetic game where a unit is below the cap.

### Pitfall 8: Existing EV unit rule vs D-13 (3v3 / 4v4)
**What goes wrong:** D-13 says 4v4/3v3 events land in EV "Other". `analyzeGameLines` only skips a group when its size is not 3F/2D, so a 3v3 shift of 3F+0D forms an F "unit" (and 1F+2D forms a D pair) and, because the key is only the id list, merges with the same trio's 5v5 time. This is existing TOI behaviour; events follow the same key so the tables stay mutually consistent and still reconcile.
**How to avoid:** leave it (touch only what you must). Mention nothing in the legend beyond "EV includes 4v4 and 3v3". Flag for the user as Open Question 2.

### Pitfall 9: ResearchGame literal builders break the typecheck
**What goes wrong:** adding a required `events` field fails `tsc` / `next build` in test files that build `ResearchGame` literals (tsconfig includes `**/*.ts`; baseline `npx tsc --noEmit` is clean).
**How to avoid:** add `events: null` in the builders in `lib/research/toi-trends.test.ts`, `toi-trends-view.test.ts`, `player-links-view.test.ts`, `player-detail-view.test.ts`, `linemates.test.ts`, and `team-games.test.ts` where it constructs games (grep `regulationToi:`/`pairs:`). Same pattern as Phase 2's `pairs`. Run `npx tsc --noEmit` after the type change.

### Pitfall 10: Test suite slows down with pacing
**What goes wrong:** the 400-500 ms game start gap makes `team-games.test.ts` (3 games per test) take seconds.
**How to avoid:** options object with injectable `gapMs`/`sleep` (default constants) used by tests; test the pool helper separately for max in-flight, order, and rejection isolation.

### Pitfall 11: Quality check counts the wrong events
**How to avoid:** compare only goal/shot-on-goal/missed-shot/blocked-shot events that are not `SO` and not penalty shots (both are expected mismatches, D-17); compare deduped skater counts (`dedupeOnIce`) and the goalie flag against the code digits for both teams; events with no bucket (`t <= 0`, or no shift data) count as "unattributed", not as mismatches. Expose `{ checked, matched, unattributed }` and derive the ratio in one named function with the `EVENT_MATCH_THRESHOLD = 0.95` constant.

## Code Examples

Skeletons only; the planner owns exact signatures. Discrete values below appear in the verbatim quotes above (`EV_UNIT_SIZE`, `FINISHED_GAME_CACHE`, NHL JSON keys) or are named constants this phase introduces.

### Event mapper (`play-events.ts`)
```ts
export type Exclusion = "shootout" | "penalty-shot" | "empty-net" | "teammate-blocked";
export type EventKind = "goal" | "shot-on-goal" | "missed-shot" | "blocked-shot";

export interface GameEvent {
  team: string;        // abbrev of the shooting team (eventOwnerTeamId)
  period: number;
  t: number;           // elapsed seconds in the period (parseClock of timeInPeriod)
  kind: EventKind;
  exclusion: Exclusion | null;
  situationCode: string;
}

const PENALTY_SHOT_CODES = new Set(["1010", "0101"]);
const KINDS = new Set<string>(["goal", "shot-on-goal", "missed-shot", "blocked-shot"]);

export function toGameEvents(pbp: NhlPlayByPlay): GameEvent[] {
  const abbrev = new Map([[pbp.homeTeam.id, pbp.homeTeam.abbrev], [pbp.awayTeam.id, pbp.awayTeam.abbrev]]);
  const events: GameEvent[] = [];
  for (const play of pbp.plays) {
    if (!KINDS.has(play.typeDescKey)) continue;
    const ownerId = play.details?.eventOwnerTeamId;
    const team = ownerId === undefined ? undefined : abbrev.get(ownerId);
    const t = parseClock(play.timeInPeriod);
    if (!team || t === null) continue; // unguarded details: ignore, never throw
    const code = play.situationCode;
    // [away goalie, away skaters, home skaters, home goalie]; the defending goalie is the other team's.
    const defendingGoalie = ownerId === pbp.homeTeam.id ? code[0] : code[3];
    const exclusion: Exclusion | null =
      play.periodDescriptor.periodType === "SO" ? "shootout"
      : PENALTY_SHOT_CODES.has(code) ? "penalty-shot"
      : defendingGoalie === "0" ? "empty-net"
      : play.typeDescKey === "blocked-shot" && play.details?.reason === "teammate-blocked" ? "teammate-blocked"
      : null;
    events.push({ team, period: play.periodDescriptor.number, t, kind: play.typeDescKey as EventKind, exclusion, situationCode: code });
  }
  return events;
}
```
Exclusion precedence (shootout, then penalty shot, then empty net, then teammate-blocked) makes the D-14 note counts mutually exclusive.

### Counting rules (`events.ts`)
```ts
// SF = goal + shot-on-goal; CF = all four kinds; GF = goal. Direction comes from the shooter's team.
const isShot = (k: EventKind) => k === "goal" || k === "shot-on-goal";
```

### On-ice lookup and attribution (`events.ts`)
```ts
/** Skaters on ice for an event at elapsed second `t`: the second [t-1, t), i.e. shifts with start < t <= end. */
export function onIceAt(buckets: Map<number, Map<string, OnIce>>, period: number, t: number) {
  if (t <= 0) return undefined; // 00:00 would otherwise read the previous period's last second
  return buckets.get((period - 1) * PERIOD_SECONDS + t - 1);
}

// Per included event, for the researched `team` only:
//   byTeam   = onIceAt(...); mine = dedupeOnIce(byTeam.get(team)); opp = dedupeOnIce(other team or empty)
//   situation = situationFor(mine, opp)
//   direction = event.team === team ? "for" : "against"
//   total[situation][direction counters] ++
//   for group of ["F","D"]: key = unitKey(situation, group, mine.skaters, positions); if (key) byUnit[situation][group].get(key) ++
```
`PERIOD_SECONDS = 1200` and `dedupeOnIce`/`situationFor`/`bucketOnIce` are existing exports `[VERIFIED: lib/research/lines.ts:59,71,84,93]`.

### Percent and plus-minus formatting (`unit-events-view.ts`)
```ts
// "—" when for + against is 0; one decimal like the existing % column (u.pct.toFixed(1)).
const pct = (f: number, a: number) => (f + a === 0 ? "—" : ((f / (f + a)) * 100).toFixed(1));
// +/- = GF - GA (D-07). Use the project's U+2212 minus (format.ts MINUS). "—" only when the unit has no events at all (A3).
```

### Test: team-level reconciliation (`events.test.ts`, gate)
```ts
// For each fixture: events from toGameEvents(fixture pbp), bucketOnIce from fixture shifts + positions.
// 1. SOG: per team, count(goal|shot-on-goal, not shootout) === fixture box sog  (includes empty-net + penalty shot)
// 2. Plus-minus: for every non-goalie player in fixture.players, computed === fixture plusMinus
//    (computed with onIceAt + situationFor; skip shootout/penalty-shot goals; no credit when scorer situation === "pp")
// 3. Attribution accounting: sum over situations of total counts + counts of excluded events === all events
// 4. Quality ratio >= EVENT_MATCH_THRESHOLD for the good fixtures; < threshold when one period of shifts is removed
```

### Tiered cache + 429 retry (`lib/nhl/client.ts`)
```ts
export const RECENT_GAME_WINDOW_MS = 48 * 60 * 60 * 1000;
export const RECENT_GAME_REVALIDATE_S = 3600;
export const OLD_GAME_REVALIDATE_S = 30 * 24 * 60 * 60;

export function finishedGameCache(startTimeUTC: string | undefined, now = Date.now()) {
  const start = startTimeUTC ? Date.parse(startTimeUTC) : NaN;
  const recent = Number.isNaN(start) || now - start < RECENT_GAME_WINDOW_MS;
  return { next: { revalidate: recent ? RECENT_GAME_REVALIDATE_S : OLD_GAME_REVALIDATE_S } };
}

// nhlGet: 429 handling sketch
//   const wait = Number(res.headers.get("retry-after"));
//   if (res.status === 429 && attempt < 2 && wait > 0 && wait <= RETRY_AFTER_CAP_S) { await sleep(wait * 1000); retry }
//   otherwise throw new Error(`NHL API ${path} failed: ${res.status} ${res.statusText}`)  // existing message shape
```

### Paced newest-first pool (`team-games.ts`)
```ts
// Starts at most `concurrency` loads, no two starting within `gapMs`; preserves result order; never rejects (like allSettled).
async function mapPaced<T, R>(items: T[], fn: (item: T) => Promise<R>, { concurrency, gapMs, sleep }): Promise<PromiseSettledResult<R>[]> { /* worker loop over a shared index */ }
// Call with recent reversed (newest first); build `games` oldest-first afterwards exactly as today.
```

### Unit-table row model
```ts
// Existing caps (verbatim): const UNIT_LIMITS: Record<Situation, { F: number; D: number }> = { ev: { F: 4, D: 3 }, pp: { F: 2, D: 2 }, sh: { F: 3, D: 3 } };  [VERIFIED: components/LastGameLines.tsx:9-13]
// rows  = units.slice(0, cap).map(u => ({ ...time/pct, counts: events?.byUnit[sit][grp].get(u.playerIds.join(",")) ?? ZERO }))
//   NB: a listed unit with no events when events != null is a known zero (show 0), not "—".
// other = { seconds: situationSeconds - sum(rows.seconds), counts: total - sum(rows.counts) }
// total = { seconds: situationSeconds, counts: events.total[sit] }
// events === null => every count cell "—" (rows still show Time and %); Other/Total counts "—"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Event in bucket `t` (half-open TOI rule) | Bucket `t-1` (`start < t <= end`) | Measured 2026-10-11, re-verified 2026-10-13 | Plus-minus exact on 32/34 games |
| "Retry 429 after 1-3 s, cap 6 concurrent" (STACK.md) | Pace to ~4 req/s, honor only short `Retry-After`, rely on cache + reload | Measured 2026-10-13 | Concurrency alone does not prevent the ban |
| 1 h TTL for all finished games | 1 h under 48 h old, 30 d older (D-02) | This phase | Warm loads make zero NHL calls |
| `goalieInNetId` to find empty nets | Defending-goalie digit of `situationCode` | This research | Also covers blocked attempts |

**Deprecated/outdated:** the PITFALLS.md advice to count `teammate-blocked` as a Corsi attempt is overridden by the locked decision to exclude it.

## Runtime State Inventory

Not a rename/refactor/migration phase. Omitted. (Only new fetch-cache entries are created under Next's own Data Cache; no stored data, service config, OS registrations or env vars change.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel egress IPs are shared and may hit the NHL limit sooner than the dev machine; the paced design is a mitigation, not a guarantee | Throttling | Cold "Last 20" may still partially fail in production; page degrades per D-04 and reload fills in. Verify after deploy |
| A2 | The Vercel function can run a ~10 s cold "Last 20" within its time limit (default `maxDuration` not checked) | Throttling | A paced cold load could time out; mitigation = lower gap or add `export const maxDuration` |
| A3 | UNIT-02 "—" for +/- means "show — when the unit has no shot attempts at all (CF + CA = 0); show 0 when attempts exist but no goals" | Code Examples | If the user wants "—" whenever GF + GA = 0 the rule is a one-line change |
| A4 | "Empty-net events" means attempts directed at an empty net; the pulled-goalie team's own attempts remain counted (they land in EV Other) | Pitfall 3 | If the user means the whole 6v5 stretch, exclusion rule and the legend text change; reconciliation tests need the other rule |
| A5 | Age for the TTL tier comes from `startTimeUTC`; a missing value is treated as recent | TTL tier | Only affects cache duration; worst case an extra refetch |
| A6 | An unpublished play-by-play shows as a non-2xx or an empty `plays` array (not observed: no current finished game lacked it) | TTL tier | Unpublished pbp could appear as a partial list; the match-quality warning would flag it |
| A7 | Penalty shots are listed in the D-14 note (discretion item) | Pitfall 6 | Cosmetic |
| A8 | OT (non-shootout) events count in EV/PP/SH tables (default, consistent with `lines`) | Constraints | None for this phase; legend need not mention it beyond "EV includes 4v4 and 3v3" |
| A9 | Playoff/multi-OT behaviour is correct by construction (periodType-based) but no real playoff game was fixtured | Pitfall 2 | Re-verify with one playoff game in April |

## Open Questions

1. **Does the cold-load latency (about 10 s for Last 20) feel acceptable?**
   - What we know: pacing at ~4 req/s measured safe; warm loads are instant with 30-day TTLs.
   - What's unclear: the user's tolerance; no loading skeleton exists beyond `PendingLink`.
   - Recommendation: ship paced; if too slow, raise the rate cautiously after the dev measurement, or drop the boxscore call (STACK.md fallback).
2. **Should EV 3v3 trios stay as "units"?** Existing TOI behaviour merges a 3F 3v3 stretch into the trio's 5v5 row. D-13 says 4v4/3v3 events go to Other.
   - Recommendation: leave unchanged (consistent with TOI, reconciliation still exact); revisit only if the user notices odd EV rows in OT games.
3. **+/- when the unit had shot attempts but no goals** (A3): show `0` (recommended) or `—`.
4. **Empty-net scope** (A4): confirm attempts-at-empty-net only.
5. **Which fixtures to commit when two games disagree with official plus-minus** (Pitfalls 4 and 5): recommended list in the Fixture table; confirm 2025020565 is acceptable as a negative regression fixture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, dev | yes | v24.21.0 | — |
| npm / tsx test runner | `npm test` | yes | 334 tests pass | — |
| `npx tsc` | typecheck after type changes | yes | clean baseline | — |
| NHL `api-web.nhle.com` | dev measurement, fixtures capture | yes (rate-limited) | — | Committed fixtures for tests |
| NHL `api.nhle.com` shift charts | fixtures capture | yes | — | — |
| Python 3 | not needed in the repo (harness was a throwaway) | yes | 3.14 | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` through `tsx` (`"test": "tsx --test lib/**/*.test.ts"`) |
| Config file | none |
| Quick run command | `npx tsx --test lib/research/events.test.ts` |
| Full suite command | `npm test` (baseline 334 pass, ~0.6 s) plus `npx tsc --noEmit` and `npm run lint` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-03 | Team SOG and every skater's plus-minus reproduce on regulation, OT, shootout, empty-net, penalty-shot fixtures (the gate) | fixture | `npx tsx --test lib/research/events.test.ts` | No - Wave 0 |
| DATA-03 | Unit totals: listed + Other == Total per situation/group; included + excluded == all events | unit | `npx tsx --test lib/research/events.test.ts` | No - Wave 0 |
| DATA-03 | `onIceAt` boundaries (shift ends at t, starts at t, `t<=0`, period boundary, playoff OT period) | unit | same | No - Wave 0 |
| DATA-03 | Mapper: shootout by `periodType`, penalty-shot codes, empty-net digit incl. blocked, teammate-blocked, owner = shooter, unknown reason ignored, missing details tolerated | unit | `npx tsx --test lib/research/play-events.test.ts` | No - Wave 0 |
| DATA-02 | Missing shift chart fixture (2026020026 shape) -> `events === null`; pbp-only failure -> game kept, `events === null`, `lines` intact | integration (stubbed fetch) | `npx tsx --test lib/research/team-games.test.ts` | Partly (extend) |
| DATA-02 | Match-quality: good fixtures >= 0.95; removing a period falls below; shootout and penalty shots not counted | unit | events.test.ts | No - Wave 0 |
| DATA-01 | Tier: `<48h` -> 3600, older -> 2592000, missing start -> 3600; passed to boxscore, pbp, shift chart | unit | `npx tsx --test lib/nhl/client.test.ts` | Extend |
| DATA-01 | 429 with short `Retry-After` retries then succeeds; long `Retry-After` throws without sleeping; 429 not retried more than 2 times; empty-shift re-request still uncached | unit (stub fetch, injectable sleep) | client.test.ts | Extend |
| DATA-01 | Pool: never more than N in flight, preserves order, one rejection does not stop others, newest-first start order | unit | `team-games.test.ts` (or helper test) | No - Wave 0 |
| UNIT-01/02 | View-model: counts per unit, SF%/CF% "—" at 0, +/- formatting with U+2212, null events -> all "—" | unit | `npx tsx --test lib/research/unit-events-view.test.ts` | No - Wave 0 |
| UNIT-03 | Other/Total rows, exclusions note text (singular/plural, none -> no line), legend text includes SO/empty-net/teammate-blocked | unit (view-model) + manual | same | No - Wave 0 |
| DATA-01 (SC5) | "Last 20" cold load without failures | manual dev check | see Throttling "Dev verification step" | n/a |

### Sampling Rate
- **Per task commit:** `npx tsx --test lib/research/<touched>.test.ts`
- **Per wave merge:** `npm test` and `npx tsc --noEmit`
- **Phase gate:** full suite green + `npm run lint` + manual cold "Last 20" check before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `lib/research/fixtures/*.json` - 6-7 trimmed games (capture once; ~330 KB)
- [ ] `lib/research/play-events.ts` + `.test.ts`
- [ ] `lib/research/events.ts` + `events.test.ts` (the gate; must be green before any UI plan)
- [ ] `unit-events-view.test.ts`
- [ ] Add `events: null` to the ResearchGame literal builders listed in Pitfall 9

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | existing `auth()` gate on `/research` (unchanged) |
| V3 Session Management | no change | NextAuth (unchanged) |
| V4 Access Control | no change | page already redirects when no session |
| V5 Input Validation | yes | `team` allowlisted against `NHL_TEAM_ABBREVS` (existing); game ids come from the NHL schedule, never from the URL; NHL JSON is untrusted: optional-chain `details`, ignore unknown `typeDescKey`/`reason`, skip events that cannot be mapped, never throw on a single bad event |
| V6 Cryptography | no | none |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Request amplification: one page view fans out to many outbound NHL calls | Denial of service | Tiered TTL, paced pool, bounded concurrency; rate state is per process so cache is the real control |
| Leaking upstream detail (API path/status) into markup | Information disclosure | Keep existing pattern: detail to `console.error`, fixed copy in the banner (T-01-11) |
| Malformed/hostile upstream JSON crashes render | Tampering / DoS | Defensive mapper; per-game failure isolation via `Promise.allSettled` |
| User-supplied `team`/`player` params reaching fetch paths | Tampering | Already allowlisted; do not add new URL params for this phase |
| Player names rendered from NHL data | XSS | React escapes text; no `dangerouslySetInnerHTML` |

## Project Constraints (from CLAUDE.md)

- Next.js 16 App Router, Tailwind 4, Drizzle/Neon on Vercel: keep consistent; **AGENTS.md: this is not the Next.js you know; read `node_modules/next/dist/docs/` before writing code** (fetch caching read for this research: `04-functions/fetch.md`, `incremental-cache/index.js`).
- Public unauthenticated NHL APIs only; no paid feeds.
- "Minimum code that solves the problem; touch only what's needed." No new dependencies; no speculative abstractions; clean up only your own mess.
- Don't assume, surface tradeoffs (see Assumptions and Open Questions).
- Naming: `kebab-case.ts` lib files, `PascalCase.tsx` components, verb-first camelCase functions (`getPlayByPlay`, `toGameEvents`, `attributeEvents`), UPPER_CASE constants; `*.test.ts` co-located; no barrel files; `@/*` imports; semicolons; ESLint (`eslint-config-next`).
- Errors: descriptive `throw new Error(...)` with context; `console.error("Action description", err)` for caught integration failures; degrade gracefully on Yahoo/Fantrax/NHL failures.
- Nullable per-game data means unknown (`lines`, `pairs`); follow with `events`. Unknown is never 0.
- Laptop browsers only; never block UAT on phone/touch (memory).
- GSD workflow: file edits happen through GSD commands (`/gsd-execute-phase` for this work).
- No project skills directories found (`.claude/skills`, `.agents/skills` absent).

## Sources

### Primary (HIGH confidence)
- Live NHL API probes 2026-10-13 (fetched and analysed this session): play-by-play, boxscore, shift charts for 2026020075, 2025020500, 2026020026 and 34 sampled 2025-26 games (2025020010 + 37k); club schedule `now`; burst/paced request tests against `api-web.nhle.com` and `api.nhle.com`.
- Repo source read this session: `lib/nhl/client.ts`, `lib/nhl/client.test.ts`, `lib/research/lines.ts`, `lib/research/pair-seconds.ts`, `lib/research/team-games.ts`, `lib/research/team-games.test.ts`, `lib/research/format.ts`, `components/LastGameLines.tsx`, `components/PlayerLinemates.tsx` (amber pattern), `app/research/page.tsx`, `package.json`, `tsconfig.json`, `eslint.config.mjs`.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md` (revalidate semantics, "Only responses with a `200` HTTP status code are stored") and `node_modules/next/dist/server/lib/incremental-cache/index.js:518-526` (2 MB per-entry limit).
- `.planning/` CONTEXT, REQUIREMENTS, STATE, and `research/{SUMMARY,PITFALLS,STACK,ARCHITECTURE,FEATURES}.md`.

### Secondary (MEDIUM confidence)
- Earlier research (2026-10-11) numbers (2,644 events, 429 at ~40 concurrent) were re-measured; where they disagree (Retry-After, concurrency vs rate) this document supersedes them.

### Tertiary (LOW confidence)
- Vercel runtime behaviour (egress IP sharing, function duration) not tested.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; Next cache semantics read from installed source/docs.
- Architecture: HIGH - direct reuse of read-and-tested `lines.ts` primitives; harness reproduced official numbers.
- Pitfalls: HIGH for attribution (34-game census), MEDIUM for throttling (one network vantage point).

**Research date:** 2026-10-13
**Valid until:** 2026-11-12 (NHL API is undocumented; re-verify the rate limit and the `situationCode` contract if anything fails)
