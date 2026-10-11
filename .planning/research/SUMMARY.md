# Project Research Summary

**Project:** Fantasy Hockey Draft Prep — Line Research Page
**Domain:** NHL analytics on a Next.js server-rendered sports web app
**Researched:** 2026-10-11
**Confidence:** HIGH

## Executive Summary

This is a data-integration project, not a technology choice project. The app will fetch the NHL's public play-by-play endpoint (new), join it to existing shift-chart data (per-second state), and derive per-unit event statistics (shots, goals, Corsi). The tricky part is not the API or the library stack — it's the event-to-second mapping convention and the suite of edge cases around empty nets, shootouts, and missing data.

**The recommended approach:** zero new dependencies, keep the existing caching model, add one small concurrency limiter to prevent NHL API throttling, and gate everything on a fixture test that reproduces boxscore plus-minus and shot totals. The measured convention (event at elapsed second T belongs to bucket T-1, not T) resolves the "ambiguous at line-change seconds" worry completely — it is 100% accurate on 2,644 measured events.

**Key risks are known and mitigable:** throttling (solved with ~10 lines of bounded concurrency), permanently empty shift charts for some games (handle as "unknown", never as zero), and the one-off event convention (encode it in one named function with tests). All have explicit recovery steps. The highest-risk phase (event attribution) has a clear acceptance gate: reproducing official plus-minus and SOG totals on fixture games before any UI ships.

## Key Findings

### Recommended Stack

**Zero new dependencies.** The existing tech stack (Next.js 16, React 19, TypeScript, Tailwind, Drizzle/Neon) is sufficient. One new NHL endpoint (`play-by-play` on `api-web.nhle.com`) is already on a host the app calls; it returns 126–144 KB per game, far below Next.js's 2 MB per-entry cache limit.

**Core technologies:**
- **Next.js 16.3.4 fetch with `revalidate`** — caching: keep the existing model (`{ next: { revalidate: 3600 } }`). Do NOT enable `cacheComponents`, `use cache`, or DB persistence in v1. Derived stats (unit tables, linemate overlap) compute in memory per request (~150 ms for 20 games, negligible vs network latency).
- **Pure TypeScript in `lib/research/`** — hand-typed interfaces for the play-by-play response (matching how `NhlBoxscore` and `NhlShift` are already typed), no Zod validation. The response is read-only and the existing NHL client does not validate.
- **Concurrency limiter (10 lines, no library)** — bounded concurrency (cap at ~6) around per-game loads in `loadTeamResearch`. Measured issue: 40 concurrent requests (20 boxscore + 20 play-by-play) returned 9 HTTP 429s. 60 boxscore requests caused connect timeouts. Solution: loop-based worker pool, 2–3 retry attempts on 429/timeout with 1–3 s backoff.

**Why NOT:** `cacheComponents`, `use cache`, `unstable_cache`, Zod, `p-limit`, `p-retry`, DB persistence, chart libraries. The fetch-cache model is proven on this app; other solutions either force whole-app changes (PPR migration), add cost with no gain (Zod parsing 140 KB payloads), or solve problems not yet measured (DB persistence if cold-load latency becomes unacceptable). The principles in AGENTS.md ("minimum code that solves the problem") rule them out for v1.

### Expected Features

**Must have (table stakes):**
- Unit tables with GF, GA, SF, SA, CF, CA as raw counts alongside TOI and % — this is the Frozen Pool baseline; user explicitly requested it
- Percentage columns (SF%, CF%, +/-) — raw counts alone are hard to scan
- Same stats on EV, PP, and SH tables — user's explicit decision
- Clear up/down signal on ice-time trends (arrow + colour + threshold) — matches every deployment tool
- Player detail opened by row click with linemate time-together trends — core user request ("who is he playing with"); deep-linkable via `?player=<id>`

**Should have (competitive advantage):**
- Trends view re-layout: averages and slopes prominent, raw per-game times de-emphasized — fixes the stated readability complaint
- Per-player delta (recent vs window average) alongside slope — slope alone is slow to react in a 5-game window; delta catches "just promoted yesterday"
- Linemate heat strip: rows = linemates, columns = games, cell shade = minutes together — unique to this app, no reference tool does per-game linemate time per situation
- New/rising/fading tags on linemates — directly answers "starting to get time with different linemates"

**Defer (v2+):**
- League-wide movers list — user deferred; requires all-team loads (rate limits, cost) before single-team page is refined
- League ownership overlay (rostered/available) — user wants this in the league view, not the research page
- Linemate quality scores (fantasy value, xG, TOI rank) — user chose to judge quality themselves
- Sortable trends table, time-together as share of own TOI, per-60 rates, xG metrics — post-MVP polish

### Architecture Approach

**One timeline, three pure consumers:** extract "who is on ice, in which situation, per second" into a single `buildTimeline()` function in a new `lib/research/timeline.ts`. Feed the same timeline to three consumers (TOI aggregation, event attribution, pair-time overlap) so unit keys and situation definitions cannot drift. This is the biggest structural change: it prevents the silent bugs where unit CF disagrees with unit TOI because they use different strength rules or second-bucketing.

**Pure core with one I/O seam:** every new computation is a pure function over plain inputs. Only `lib/nhl/client.ts` and `lib/research/team-games.ts` touch the network. Data flows one way: network → raw types → pure functions → `ResearchGame` (plain data, no `Map`s shipped outside the server).

**Player detail via URL search param, server-rendered:** `?player=<id>` + `<Link scroll={false}>` per row in trends. No new client component, no serialization concerns (`GameLines` has `Map`s). Deep-linkable and back-button friendly. If the post-click spinner is ever slow in production (> ~1 s), the upgrade path is a small `"use client"` component receiving precomputed plain-object pair arrays (tens of KB).

**Major components and their responsibilities:**
1. `lib/research/timeline.ts` (new, extracted) — `buildTimeline(team, shifts)`: per-second state (situation, skaters, unit keys). Single source of truth for on-ice classification.
2. `lib/research/lines.ts` (refactored) — `analyzeGameLines(..., events?)`: unit TOI/%, player seconds, pair seconds, optional event counts merged onto units.
3. `lib/research/events.ts` (new) — `attributeEvents(timeline, events)`: per-unit, per-situation event counts; diagnostics for unattributed events.
4. `lib/research/play-events.ts` (new) — raw play-by-play JSON → `GameEvent[]`: filter shootout/penalty shots, map team IDs, handle blocked-shot ownership.
5. `lib/research/linemates.ts` (new) — `buildLinemateRows(game, playerId, situation)`: linemate time-together per game, trend, "new" flag.
6. `app/research/_components/*` (new, server) — `LastGameLines`, `ToiTrends`, `PlayerDetail`, `UnitTable`, `Slope`, `Sparkline`.

### Critical Pitfalls and How to Avoid Them

1. **Event-to-second bucketing is NOT the existing TOI half-open rule** — an event at elapsed second T belongs to bucket T-1, not T. Measured on 2,644 events across 14 games: bucket T-1 is 100% accurate, bucket T is 96.5%. This single rule resolves the "ambiguous at line changes" worry. Encode it in one named function (`onIceAt(period, t)`) with a test for shifts starting/ending exactly at the event second. Accept gate: reproduce boxscore plus-minus for every skater on 5 fixture games.

2. **Blocked shots are credited to the SHOOTING team for Corsi, not the blocking team** — folklore says otherwise. Verified on all blocked shots in 5 games: `eventOwnerTeamId` = shooter's team always. Separately, exclude `details.reason === "teammate-blocked"` (blocker is same team as shooter; 2–4 per game). Boxscore block counts exclude them; event stats must too. Encode both in the raw-events mapper (`play-events.ts`), test with fixtures for both `blocked` and `teammate-blocked` reasons.

3. **Empty-net 6v5 is NOT a power play** — `situationCode` shows `1560` (six skaters, goalie 0), which a naive "more skaters = PP" rule misclassifies. The app already has the correct rule in `situationFor` (goalie on ice? yes → skater count; no → skater count minus one, even-strength). Share this one classifier for both TOI and events; do not write a second strength rule for play-by-play. Test with a `1560` fixture second; verify EV pct sums to 100% in an empty-net game.

4. **Shootout and penalty-shot events leak into Corsi if period filtering is wrong** — playoff OT is periods 4, 5, 6... (`periodType: "OT"`), so "period 5 = shootout" is a landmine in playoffs. Exclude events where `periodType === "SO"`, never by period number. Exclude penalty shots (both `situationCode` `1010`/`0101` and the fewer mid-period ones) from unit attribution but keep them in team-level reconciliation. Test with a shootout fixture (`2026020075`) and a mid-period penalty shot (`2025020500`).

5. **Missing or permanently empty shift charts are a main path, not an error** — verified: finished game `2026020026` (8 days old) still returns zero shift rows while play-by-play and boxscore exist. The existing `lines: null` handling extends to: event counts render as "—" (unknown, never 0), missed games are blank in linemate tables (not 0), and they are excluded from trend slopes (not averaged in as 0). Count events: must all three payloads (boxscore, play-by-play, shifts) be present to compute event stats. If any is missing, render "—".

## Implications for Roadmap

Based on research, a five-phase structure:

### Phase 1: Trends View Re-layout + Components
**Rationale:** Fixes the stated readability complaint ("numbers run together"); delivers immediately visible value; fully independent of new data sources; unblocks the clickable rows needed for player detail.
**Delivers:** Ice-time section with average TOI, trend slope, recent-vs-window delta, and sparkline as the main columns; per-game raw times demoted to tooltip/detail; PP share and its trend; colour + arrow for up/down signal; no new data fetches.
**Addresses (FEATURES.md):** Trends re-layout, per-game demoted (P1); recent-vs-window delta (P1); player detail row click pattern (P1).
**Stack elements:** Existing `trendSlope` logic refactored into `lib/research/toi-trends.ts` with tests; server-rendered `ToiTrends` and `Slope` components.
**Avoids (PITFALLS.md):** Pitfall 16 (trend slope noise on tiny series) with a minimum-games guard; Pitfall 19 (traded/moved players) by reading position per-game.
**Research flags:** None; pure refactoring of existing logic.

### Phase 2: Timeline Extraction + Linemate Time-Together
**Rationale:** Prerequisite for both event attribution (Phase 3) and player detail (Phase 4); refactoring existing code with a regression gate (`lines.test.ts` passes unchanged); low risk because the new `timeline` is extracting existing logic, not changing it; linemate time-together adds ~15 increments per second (~doubles a 7 ms per-game cost, still negligible).
**Delivers:** `lib/research/timeline.ts` with `buildTimeline()` as the single source of truth for on-ice state; `pairSeconds` accumulated alongside `playerSeconds`; linemate time per game, per situation (EV/PP/SH), per position group (F/D), as a share of the player's own situation TOI.
**Addresses (FEATURES.md):** Linemate time-together per game (P1); EV/PP/SH split, F/D split (P1); time-together share of own TOI (P2).
**Uses (ARCHITECTURE.md):** Pattern 1 (single timeline, multiple consumers); Pattern 3 (pair time eager computation in the same loop).
**Avoids (PITFALLS.md):** Pitfall 7 (unit totals that do not reconcile) by having one timeline; Pitfall 1 (wrong bucket convention) is sidestepped because this phase is the regression gate.
**Research flags:** None; it is refactoring with tests.

### Phase 3: Play-by-Play Fetch + Event Attribution
**Rationale:** Highest risk, most brittle (depends on the 10 critical pitfalls all being handled correctly); should be gated by a detailed fixture-test harness before any UI ships; refactoring the acceptance gate itself is safer than coding the UI.
**Delivers:** `lib/nhl/client.ts` + `getPlayByPlay(gameId)` using `FINISHED_GAME_CACHE` revalidate; `lib/research/play-events.ts` mapping raw play-by-play JSON → `GameEvent[]` with shootout/penalty-shot filtering, team-id-to-abbrev resolution, blocked-shot ownership; `lib/research/events.ts` with `attributeEvents(timeline, events)` returning `EventCounts` per unit per situation; bounded concurrency limiter in `loadTeamResearch` (cap ~6).
**Addresses (FEATURES.md):** Unit event stats SF/SA/GF/GA/CF/CA (P1); derived %, legend, definitions (P1).
**Uses (STACK.md):** New NHL play-by-play endpoint, concurrency limiter, event-attribution convention (T-1 bucket).
**Implements (ARCHITECTURE.md):** Pattern 2 (event-to-second mapping), Pattern 4 (degrade per feed), Pattern 5 (player detail seam).
**Acceptance gate:** 5 fixture games (regulation, OT, shootout, empty net, penalty shot, missing shift chart); reproduce boxscore plus-minus exactly for every skater; summed SF per team equals boxscore SOG; summed block-events equals boxscore blocks + teammate-blocked count; on-ice skater counts match `situationCode` on ≥95% of events per game. Do not merge to main until these tests pass.
**Avoids (PITFALLS.md):** All 10 critical pitfalls (1–5, plus 6, 7, 8, 9, 10). Pitfalls 11–20 (moderate) handled in code review per the integration checklist.
**Research flags:** HIGH risk; needing the fixture-test spike. Concurrency limiter is a new piece; measure NHL rate-limit response in a dev environment before going to Vercel production.

### Phase 4: Player Detail + Linemate Heat Strip
**Rationale:** Depends only on Phase 2 (timeline, pair time, position per-game); can ship before Phase 3 if scope is cut (linemate trend is the core value; event stats are a later UI enhancement); server-rendered so no client state migration.
**Delivers:** `lib/research/linemates.ts` view-model; `PlayerDetail` server component showing linemate time-together per game with per-situation, per-position-group split; heat strip with shade intensity proportional to minutes, then tags (new/rising/fading).
**Addresses (FEATURES.md):** Player detail by row click (P1); linemate time-together per game (P1); heat strip presentation (P1); new/rising/fading tags (P2).
**Uses (ARCHITECTURE.md):** Pattern 5 (URL search param, server-rendered).
**Avoids (PITFALLS.md):** Pitfall 18 (linemate conflation) by splitting per-situation, per-position; Pitfall 9 (missing data) by showing blank not 0; Pitfall 19 (moved players) by tracking position per-game; Pitfall 16 (noisy trends) with minimum-games and "n of N" shown.
**Research flags:** None; dependent data is mature by Phase 2.

### Phase 5: Event Columns on Unit Tables
**Rationale:** UI only; depends on Phase 3 (event attribution) and Phase 1 (unit table structure); lowest risk because event numbers are already computed; just needs column layout and legend.
**Delivers:** SF/SA, GF/GA, CF/CA columns on `LastGameLines` unit tables for EV/PP/SH; "—" when events are null (missing feed or shift chart); legend footnote explaining definitions and exclusions (empty net, shootout, teammate-blocked).
**Addresses (FEATURES.md):** Unit event stats (P1); legend definitions (P1); unit minimum-time guard dimming (P1); unit rows link to player detail (P3).
**Uses (ARCHITECTURE.md):** Merged `unit.events` from Phase 3.
**Avoids (PITFALLS.md):** Pitfall 15 (reading PP/SH "against" as quality) by hiding percent columns there; Pitfall 17 (event-stat trends on single games as noise) by showing raw counts only, no slope; Pitfall 7 (unit totals do not reconcile) by showing an explicit "other/transition" row or footnote count.
**Research flags:** None; standard UI pattern once data is available.

### Phase Ordering Rationale

1. **Phase 1 first** because it delivers immediate user value (the readability fix) with zero risk and unblocks the row-click pattern.
2. **Phase 2 second** because it is a regression gate for Phase 3 and enables Phase 4 in parallel; it is the lowest-risk phase in the sequence.
3. **Phase 3 and 4 in parallel** (after Phase 2): Phase 3 (event attribution) is the highest-risk and longest; Phase 4 (linemate detail) is fully independent and can ship first if time is short. Phase 3 acceptance gate is the sole dependency.
4. **Phase 5 last** because it is pure UI given Phase 3's data; it is fast to build and its only value is completing the unit tables.

**Phases 1–2 are guaranteed low risk.** Phases 3–4 are the substance: Phase 3 is where the pitfall research lives and where the bulk of testing goes. Phase 4 is where the user's core request (linemate visibility) lands.

### Research Flags

**Phase 3 needs a fixture-test spike before main build:**
- Pull 5–6 real games: regulation, OT, shootout, penalty shot, empty-net goal, and a game with missing shift chart
- Build a test harness that compares event attribution against boxscore plus-minus, SOG, block counts, and `situationCode` cross-checks
- Reason: The 10 critical pitfalls all converge here; the conventions are now known, but they must be encoded as tests before any UI ships

**Phase 3 measure NHL rate-limit response in dev:**
- Reason: The 40-concurrent-429s finding is from live-API testing; verify that the bounded concurrency cap (~6) actually prevents throttling before deploying to Vercel

**Phases 1, 2, 4, 5 have standard patterns (skip research-phase):**
- Refactoring existing logic (Phase 1, 2); server-component UI patterns (Phase 4, 5); linemate computation is a pure loop over existing data (Phase 2)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; fetch caching verified against Next.js 16.3.4 installed source; concurrency-limiter pattern is a loop, not a library; NHL endpoints verified live on 14 games |
| Features | MEDIUM-HIGH | Frozen Pool fetched directly (HIGH for structure); reference tools (Daily Faceoff, Left Wing Lock, MoneyPuck, NST) are search-snippet level (MEDIUM). Presentation recommendations are judgment; validate on real players in Phase 4. |
| Architecture | HIGH | Read from the repo; Next.js 16 local docs; event-timing convention measured on 2,644 events across 14 games; data flow is straightforward integration onto existing code |
| Pitfalls | HIGH | Live NHL API probes on 14 games spanning 2023-24 to 2026-27; boxscore/shift/play-by-play reconciliation tested; all 10 critical pitfalls have measured evidence and recovery steps |

**Overall confidence:** HIGH

The project is data integration and edge-case handling, not technology or design risk. All known pitfalls are well-defined and preventable. The highest-risk phase (event attribution) has a clear acceptance gate before any UI ships. The remaining phases are refactoring or UI composition using proven patterns.

### Gaps to Address

1. **Concurrency limiter behavior under sustained load:** the 40-concurrent-429s finding is from one measurement window. Verify that cap ~6 actually prevents throttling on a Vercel instance with multiple concurrent users (Phase 3 measurement before production deploy).

2. **Shift-chart data completeness:** confirmed one game with permanently empty shifts; unclear how often this occurs or when NHL backfill happens. During Phase 3 fixture testing, record a per-game coverage fraction (on-ice skater match to `situationCode`); decide the ≥95% threshold for flagging a game's event stats as unreliable.

3. **PP/SH "against" interpretation in the UI:** Architecture and Features agree to show raw counts for/against on PP/SH, hide percentages, and document the meaning. Pitfalls warns against reading CA as "quality". Validate in Phase 1 / Phase 5 UI review with one real team's PP1 unit (should not be labeled "good" or "bad").

4. **Early-season trend noise:** it is October; "last 20 games" is really 4–8 games. Pitfalls recommends minimum-games guard and showing "n of N games used". Phase 1 should implement and default to e.g. 4+ games to show a slope; Phase 4 should carry this through to linemate slopes.

5. **Playoff and multi-OT handling:** Pitfalls Pitfall 14 warns about the assumption that OT = 3v3 or period > 3 = shootout. The season is in October; keep this as a tested assumption before April, not a build target. Phase 3 fixture should include one playoff OT game if available.

## Sources

### Primary (HIGH confidence)
- **Live NHL API verification, 2026-10-11:** `api-web.nhle.com/v1/gamecenter/{id}/play-by-play`, `/boxscore`, `/club-schedule-season/{team}/now`; `api.nhle.com/stats/rest/en/shiftcharts` for MTL games 2026020002/045/058/075, 2026020026 (empty shifts), and 10 EDM 2025-26 games. Facts verified: play-by-play fields, `eventOwnerTeamId` for blocked shots, `teammate-blocked` reason, event-to-second bucketing convention (2,644 events, 100% accuracy with T-1 rule), boxscore SOG reconciliation, `situationCode` digit order, empty shift response.
- **Next.js 16.3.4 local docs** (`node_modules/next/dist/docs/`): fetch caching, `revalidate` behavior, Data Cache per-entry limit, `unstable_cache` deprecation, `searchParams` dynamic rendering, private folders, server-component boundaries.
- **Existing code:** `lib/research/lines.ts`, `lib/research/team-games.ts`, `lib/nhl/client.ts`, `app/research/page.tsx`, `components/PendingLink.tsx`.

### Secondary (MEDIUM confidence)
- **Reference tools fetched directly:** Dobber Frozen Pool last-3-game lines structure; Daily Faceoff, Left Wing Lock, MoneyPuck, Natural Stat Trick layouts via search summary (not direct fetches; presentational details are MEDIUM).
- **Community NHL API reference:** `github.com/Zmalski/NHL-API-Reference` documents play-by-play URL and some types, but NOT event codes or `situationCode` digits (verified empirically instead).

### Tertiary (MEDIUM)
- **Shift-chart edge case frequency:** one confirmed permanently-empty game (2026020026); other public hockey tools' conventions recalled (not re-fetched) and superseded where direct measurement disagrees.

---
*Research completed: 2026-10-11*
*Ready for roadmap: yes*
