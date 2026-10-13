---
phase: "3"
slug: "unit-event-stats"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-13"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `03-RESEARCH.md` § Validation Architecture, then reconciled on 2026-10-13 with CONTEXT.md D-19 to D-23 (recorded after research). Where research and CONTEXT.md differ, CONTEXT.md wins.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner via tsx (`node:test`, `node:assert/strict`). Markup tests use `renderToStaticMarkup(createElement(...))` in `.ts` files |
| **Config file** | none. The `npm test` script is `tsx --test lib/**/*.test.ts`, which only reaches one directory level, so new tests must sit directly in `lib/research/` or `lib/nhl/`. Fixture JSON can live in `lib/research/fixtures/` (not matched by the glob) |
| **Quick run command** | `npx tsx --test lib/research/events.test.ts` (per task: list only the test files the task touches, plus `npx tsc --noEmit`) |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run lint && npm run build` |
| **Estimated runtime** | ~1 s for `npm test` (baseline 334 pass on 2026-10-13), ~1.5 s typecheck, ~4 s lint, build ~10-20 s |

Note: `npm run lint` passes at baseline since commit 442d4cd (GSD tooling excluded from eslint), so the whole-repo lint is used, not Phase 2's scoped `npx eslint ...` list.

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` commands (the quick run for the test files it touches) plus `npx tsc --noEmit`
- **After every plan wave:** the full suite command above
- **Before `/gsd-verify-work`:** full suite green, then the manual checks below (the cold "Last 20" check is mandatory before deploying to Vercel)
- **Max feedback latency:** 15 seconds per task, excluding the build

---

## Per-Task Verification Map

Filled in by the planner (2026-10-13); renumbered the same day when the fixture gate was split across plans 03-01 and 03-02 (per-plan file budget), and renumbered again the same day when every plan was split to fit the user's 60k-token per-plan budget. Old → new: 03-01 → 03-01 (T1 tracer, T2 mapper rules) and 03-02 (T1 attribution rules, T2 unit Time); 03-02 → 03-03; 03-03 → 03-04; 03-04 → 03-05; 03-05 → 03-06 (T1, T2) and 03-08 (old T3 as T1 legend/exclusions and T2 amber notes); 03-06 → 03-07 (T1, T2) and 03-09-T1 (old T3); 03-07 → 03-09-T2 (harness, U1, U2), 03-10 (U3 to U6) and 03-11 (Phase 2 regression, end of phase). Task IDs are `{plan}-T{n}`; every task's own `<automated>` commands are in its PLAN.md.

| Task | Requirement / SC | Behavior | Test Type | Automated Command | File Exists | Status |
|------|------------------|----------|-----------|-------------------|-------------|--------|
| 03-01-T1 | DATA-03 / SC1 (gate, part 1) | Team SOG and every skater's plus-minus reproduce on the regulation fixture 2025020084, with no exemption | fixture | `npx tsx --test lib/research/events.test.ts` | ❌ W0 (created by the task) | ⬜ pending |
| 03-01-T2 | DATA-03 | Mapper: shootout by `periodType`, penalty-shot codes, pulled-goalie flag from either goalie digit (incl. blocked shots), teammate-blocked, owner = shooter, unknown reason ignored, missing `details` tolerated | unit | `npx tsx --test lib/research/play-events.test.ts lib/research/events.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-T1 | DATA-03 / SC3 (gate, part 2) | Unit totals: byUnit never exceeds Total per situation, group and counter; included + excluded + unattributed == all events (every fixture in `ALL_FIXTURES`) | unit + fixture | `npx tsx --test lib/research/play-events.test.ts lib/research/events.test.ts` | ✅ (from 03-01) | ⬜ pending |
| 03-02-T1 | DATA-03 (D-13, D-21) | Every event while either goalie is out (situationCode digit 0 or no goalie shift, incl. an opponent with no rows) and every 4-on-4/3-on-3 event is in its situation's Total only, never in a listed unit | unit | same | ✅ | ⬜ pending |
| 03-02-T1 | DATA-03 | `onIceAt` boundaries: shift ends at t, starts at t, `t <= 0`, period boundary, playoff OT period | unit | same | ✅ | ⬜ pending |
| 03-02-T1 | DATA-02 / DATA-03 | `buildGameEvents` returns null (unknown, never zeros) for an empty shift list, a null play-by-play or one with no plays | unit | same | ✅ | ⬜ pending |
| 03-02-T2 | SC1 / Phase 2 regression (D-13, D-22) | `analyzeGameLines` unchanged after extracting `unitKey()` except that unit Time credits pulled-goalie, opponent-missing, 4-on-4 and 3-on-3 seconds to Other (the creditsUnit check lands here, test first); player seconds and pair seconds unchanged | unit (existing, additive) | `npx tsx --test lib/research/lines.test.ts lib/research/events.test.ts lib/research/pair-seconds.test.ts lib/research/linemates.test.ts` | ✅ assertions only added | ⬜ pending |
| 03-03-T1 | DATA-03 / SC1 (gate, part 3) | Team SOG reproduces on the overtime, shootout, empty-net and penalty-shot fixtures, and every skater's plus-minus with one documented, cause-checked exception (2025020500, A. Panarin; see Known Exceptions); missing-chart fixture 2026020026 gives `events === null` | fixture | `npx tsx --test lib/research/events.test.ts lib/research/play-events.test.ts` | ✅ (from 03-01) | ⬜ pending |
| 03-03-T2 | DATA-03 | Exclusion counters on real games (shootout attempts on 2026020075, one penalty shot each on 2025020528 and 2025020500); the gate set is pinned to the six games | fixture | same | ✅ | ⬜ pending |
| 03-04-T1 | DATA-02 (D-16, D-17) | Match quality: good fixtures >= 0.95; removing period 2 falls below; shootout and penalty shots not counted | fixture + unit | `npx tsx --test lib/research/events.test.ts` | ✅ (from 03-01) | ⬜ pending |
| 03-04-T2 | DATA-03 (D-23) | Shift-chart sanity check flags 2025020565 and no gate fixture; its repeated and foreign shift rows change no count | fixture | `npx tsx --test lib/research/events.test.ts` | ✅ | ⬜ pending |
| 03-05-T1 | DATA-02 | `getPlayByPlay`: cached 3600 in one request; empty plays re-requested uncached; 503 rejects | unit (stub fetch) | `npx tsx --test lib/nhl/client.test.ts` | ✅ extend | ⬜ pending |
| 03-05-T2 | DATA-03 (live) / Types | Every game carries `events` or null; live games reconcile with boxscore SOG; `events` compiles in every test builder | live smoke + typecheck | `npx tsc --noEmit && npm test`; `npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts` | ❌ (script created by the task) | ⬜ pending |
| 03-05-T3 | DATA-02 / SC4 | Missing shift chart gives `events === null`; play-by-play failure or empty play-by-play keeps the game with `events === null` and `lines` intact | integration (stubbed fetch) | `npx tsx --test lib/research/team-games.test.ts` | ✅ extend | ⬜ pending |
| 03-06-T1 | UNIT-01 / UNIT-02 / SC2 | View-model: counts per unit, SF%/CF% "—" at 0, +/- with U+2212 (`0` with attempts but no goals, "—" with no events, D-20), null events → all "—"; 13 columns and group headers in markup | unit + markup | `npx tsx --test lib/research/unit-events-view.test.ts` | ❌ W0 | ⬜ pending |
| 03-06-T2 | UNIT-03 / SC3 | Other and Total rows: listed + Other == Total for time and every count; omitted rows; F and D Totals equal | unit + markup | same; full suite command | ✅ | ⬜ pending |
| 03-07-T1 | DATA-01 | TTL tier: under 48 h → 3600, older → 2592000, missing start → 3600; passed to boxscore, play-by-play and shift chart; 429 with short `Retry-After` retries, long fails fast, at most 2 retries; empty re-requests uncached | unit (stub fetch, Retry-After "0") | `npx tsx --test lib/nhl/client.test.ts` | ✅ extend | ⬜ pending |
| 03-07-T2 | DATA-01 | Pool: never more than N in flight, output order preserved, one rejection does not stop others, newest-first start order, per-game cache tier | unit | `npx tsx --test lib/research/team-games.test.ts` | ✅ extend | ⬜ pending |
| 03-08-T1 | UNIT-03 | Exclusions note (singular/plural, none → no line) and legend lines (pulled-goalie events in Other, D-21) under the tables | unit + markup | `npx tsx --test lib/research/unit-events-view.test.ts` | ✅ (from 03-06) | ⬜ pending |
| 03-08-T2 | UNIT-03 / DATA-02 | Amber notes D-18/D-23/D-16/D-05 in order above the tables and the older-dates note under them (the live render check is 03-10-T1 U3) | unit + markup | same; full suite command | ✅ | ⬜ pending |
| 03-09-T1 | DATA-01 / SC5 | Cold Last 20 for three teams back to back (no fetch cache): no 429, no unavailable date; pacing constants tuned from the run | live | `npx tsx .planning/phases/03-unit-event-stats/cold-last20-check.ts` | ❌ (script created by the task) | ⬜ pending |
| 03-09-T2 | DATA-01 / SC5 | In-app cold Last 20 for three teams (U1) and warm reload with no api-web call (U2) | WebKit | `node .planning/phases/03-unit-event-stats/webkit-units-check.cjs` | ❌ (script created by the task) | ⬜ pending |
| 03-10-T1 | UNIT-01..03, UNIT-04 backstop | Table structure rendered from live data with no negative Other count (U3, the phase's live render evidence); name links open the player panel on the PP tab (U4) | WebKit | `node .planning/phases/03-unit-event-stats/webkit-units-check.cjs` | ✅ (from 03-09) | ⬜ pending |
| 03-10-T2 | UNIT-01..03 backstops | 1024px light/dark without clipping (U5); dividers and Total row (U6); the whole U1-U6 run passes | WebKit | same | ✅ | ⬜ pending |
| 03-11-T1 | Phase 2 regression | Phase 2 harness passes with N8 updated (out-of-phase file, rationale in 03-11-PLAN.md) | WebKit | `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs` | ✅ | ⬜ pending |
| 03-11-T2 | DATA-03 (live) + end of phase | Live smoke; full suite; human check | live + manual | `npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts`; full suite command | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Known Exceptions

Carried into phase verification. Each is pinned by a test and must be reported, never silently counted as a pass.

| Requirement / SC | Exception | Cause | Pinned by |
|------------------|-----------|-------|-----------|
| DATA-03 / SC1 (plus-minus) | Game 2025020500, A. Panarin: official 0, reproduced -1. The only skater in the six gate fixtures whose plus-minus does not match | His P1 shift 15:28-16:18 ends on the P1 goal at 16:18; the locked `start < t <= end` rule counts him on ice for it and the official record does not (research Pitfall 4). The rule is not changed for him | Plan 03-03: the single `KNOWN_BOXSCORE_DISAGREEMENTS` entry and its cause test in `lib/research/events.test.ts`; reported in 03-03-SUMMARY.md `## Known exceptions` |

SC1 is therefore reported as "team SOG reproduces on every gate game; every skater's plus-minus reproduces with one documented exception", not as "all skaters reconcile".

---

## Wave 0 Requirements

- [ ] `lib/research/fixtures/*.json`: trimmed raw-shaped fixtures for the games in `03-RESEARCH.md` § Fixture Spike Results (captured once by a throwaway script that is not committed; only the JSON is committed; shift rows kept verbatim, duplicates included). Committed in three steps: 2025020084 by 03-01, the other five gate games and 2026020026 by 03-03, 2025020565 by 03-04
- [ ] `lib/research/play-events.ts` + `lib/research/play-events.test.ts`
- [ ] `lib/research/events.ts` + `lib/research/events.test.ts`: the DATA-03 gate; must be green before any plan that adds event columns to the unit tables runs
- [ ] `lib/research/unit-events-view.test.ts`
- [ ] Add `events: null` to the `ResearchGame` literal builders listed in `03-RESEARCH.md` Pitfall 9
- No framework install needed.

---

## Manual-Only Verifications

Desktop browser only (laptop target); no phone or touch checks.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A cold "Last 20" loads without NHL throttling failures, even for a second and third team within a minute; a warm reload makes no outbound calls | DATA-01 / SC5 | Needs the live NHL API and its real rate limit | `next dev`, clear `.next/cache`, open `/research?team=<X>&games=20` cold, then two more teams within a minute. Expect no 429 lines in the server log and no amber "Couldn't load" banner. Reload the first team and confirm zero outbound calls. If 429s appear, lower `MAX_CONCURRENT_GAMES` or raise the start gap before changing anything else |
| Event columns, legend and Other row read correctly on real games; the Total row matches the official boxscore | UNIT-01, UNIT-02, UNIT-03 | Judgment and cross-check against NHL.com on live data | Signed in, open `/research?team=MTL&games=5`; check every Last game table (EV, PP, SH; forwards and defense) has SF/SA, GF/GA, CF/CA, SF%, CF%, +/-; compare the team's shots on goal with the NHL.com boxscore |
| A game with no shift chart or no play-by-play shows "—" (never 0) and is left out of any average or trend | DATA-02 / SC4 | Needs a real affected game in the window | Pick a team whose window includes a game with no shift chart; confirm "—" in its event stats and that the rest of the page still renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
