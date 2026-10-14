---
phase: 03-unit-event-stats
verified: 2026-10-14T18:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/03-unit-event-stats/03-01-PLAN.md
  - .planning/phases/03-unit-event-stats/03-01-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-02-PLAN.md
  - .planning/phases/03-unit-event-stats/03-02-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-03-PLAN.md
  - .planning/phases/03-unit-event-stats/03-03-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-04-PLAN.md
  - .planning/phases/03-unit-event-stats/03-04-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-05-PLAN.md
  - .planning/phases/03-unit-event-stats/03-05-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-06-PLAN.md
  - .planning/phases/03-unit-event-stats/03-06-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-07-PLAN.md
  - .planning/phases/03-unit-event-stats/03-07-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-08-PLAN.md
  - .planning/phases/03-unit-event-stats/03-08-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-09-PLAN.md
  - .planning/phases/03-unit-event-stats/03-09-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-10-PLAN.md
  - .planning/phases/03-unit-event-stats/03-10-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-11-PLAN.md
  - .planning/phases/03-unit-event-stats/03-11-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-12-PLAN.md
  - .planning/phases/03-unit-event-stats/03-12-SUMMARY.md
  - .planning/phases/03-unit-event-stats/03-13-PLAN.md
  - .planning/phases/03-unit-event-stats/03-13-SUMMARY.md
  - components/LastGameLines.tsx
  - components/PendingLink.tsx
  - components/PlayerLink.tsx
  - lib/nhl/client.ts
  - lib/research/events.ts
  - lib/research/fixtures/2026020092.json
  - lib/research/lines.ts
  - lib/research/play-events.ts
  - lib/research/team-games.ts
  - lib/research/unit-events-view.ts
covered_digest: "v3:sha256:b0d09695647c956a82c0d87961d2e7eec6e6b83ebf9aaa94e8b9a58441d79a90"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Fixture tests on real games reproduce official team shots on goal and every skater's plus-minus from attributed play-by-play events"
    reason: "One skater (A. Panarin, 2025020500) differs by 1 because his shift ends on a goal second; pinned by KNOWN_BOXSCORE_DISAGREEMENTS with a cause test; all other skaters in 6 gate games match. Developer: if the shift chart lists him on ice it should count; the official 0 may be a manual league adjustment."
    accepted_by: "Jamie Witt"
    accepted_at: "2026-10-14T16:15:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 3/5 must-haves verified
  gaps_closed:
    - "UAT G-03-1: unit CF/CA now count teammate-blocked attempts (L1 EV CF 11, L3 EV CA 6 on 2026020092)"
    - "UAT G-03-3: stat cells pl-1 pr-3, numbers 12px clear of the Goals/Shots/Corsi dividers (measured)"
    - "UAT G-03-7: unit-table en dash centered, 4px each side (measured)"
    - "SC1 exception: override accepted by the developer (UAT test 6)"
    - "SC5 behavior-unverified: developer ran Last 20 on the deployed Vercel app, no load banner (UAT test 5 pass); local WebKit U1 re-run clean"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "03-13 spacing, light then dark, laptop browser at about 1024 px: open /research?team=MTL&games=5"
    expected: "(1) the dash between names is centered with a small even gap; (2) +/- and SF% numbers no longer touch the divider after them; (3) the space after each Goals/Shots/Corsi divider no longer looks oversized next to the space before it"
    why_human: "Visual balance is a judgement. Measured in WebKit by the harness (U7 4px/4px on 22 separators, U8 12px before dividers on 28 rows, header start 20.7px), and I viewed both screenshots (they look balanced), but G-03-3 and G-03-7 were raised by the developer's own eye, so the developer closes them."
---

# Phase 3: Unit Event Stats Verification Report

**Phase Goal:** User can judge each last-game unit (EV, PP, SH; forwards and defense) by its shots, goals and shot attempts for and against, with counts that reconcile with the official boxscore
**Verified:** 2026-10-14
**Status:** human_needed
**Re-verification:** Yes, whole phase including gap-closure plans 03-12 and 03-13 after UAT

Note: the roadmap marks this phase `mode: mvp`, but the goal is not in "As a ..., I want ..., so that ..." form, so the MVP user-story verification was not applied. Standard goal-backward verification was used against the five roadmap success criteria (SC3 as amended by 03-12).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Fixture tests on real games (regulation, OT, shootout, empty-net, penalty shot, missing chart) reproduce official team SOG and every skater's plus-minus from attributed events | PASSED (override) | Override accepted by Jamie Witt 2026-10-14 (UAT test 6). `lib/research/events.test.ts` runs the 6 gate fixtures plus the missing-chart game; all pass in the 552/552 run. Single pinned exception A. Panarin 2025020500 with a cause test. 03-12 added fixture 2026020092 to `ALL_FIXTURES` only; blocked shots never reach SF or GF, so SOG and plus-minus cannot move (test confirms deltas for gf/ga/sf/sa are 0). |
| 2 | SC2: Every last-game unit table (EV/PP/SH x F/D) shows SF/SA, GF/GA, CF/CA plus SF%, CF%, +/-, with a dash where a unit has no events | VERIFIED | Live render (I re-ran the WebKit harness against the real `/research?team=MTL&games=5`; screenshots viewed): six tables, 13 column headers, dashes in rows with no events (for example PP Forwards line 2 `+/-` `SF%` `CF%` all `—`). U3 PASS. |
| 3 | SC3: A legend defines each stat and exclusions (shootout and empty-net; teammate-blocked count in CF/CA, UAT G-03-1), and an Other row makes unit totals add up to the team total | VERIFIED | `UNIT_LEGEND` (3 lines) and `exclusionsNote` render under the tables; the page showed "Excluded from these tables: 4 shootout attempts." and the legend ends "shootout attempts and penalty shots are left out." No production reference to teammate-blocked remains outside tests (grep). Other and Total rows on all six tables; no negative Other (U3). Developer passed the wording (UAT test 2). Forwards EV+PP+SH Total SF is 29+6+3 = 38 = boxscore SOG (also confirmed by the developer in UAT test 1). Caveat unchanged: empty-net events count and route to Other; WR-02 below. |
| 4 | SC4: For a game with missing shift chart or play-by-play, event stats show a dash (never 0) and the game is left out of any average or trend that would include it | VERIFIED (with warning WR-01) | `buildGameEvents` returns null on empty shifts, null pbp or empty plays; `statCells(null)` is all dashes; `topNotes`/`missingPlayByPlayNote` explain it; covered by fixture 2026020026 and `team-games.test.ts`. Developer passed the no-data game check (UAT test 4). Event stats feed no average or trend, so exclusion from averages is vacuous. WR-01 (a payload without `plays` still throws outside the D-05 catch) is unchanged. |
| 5 | SC5: Selecting Last 20 for any team loads without failing from NHL API throttling, with play-by-play on every game | VERIFIED (human-confirmed) | Mechanisms present and wired (`retryAfterMs` in `nhlGet`, tiered `finishedGameCache`, `mapPaced` at 3 concurrent / 1000 ms gap, newest first). I re-ran harness U1 this session: cold Last 20 for MTL, TOR, EDM in 20.7 s total, no banner, no 429 (U1 PASS); U2 warm reload made only the two by-design uncached empty-chart re-requests. The developer ran Last 20 on the deployed Vercel app with no load banner (UAT test 5 pass). Residual: only 6-8 finished games per team exist in October, so a full 20-game window is still extrapolated; not a verification gap, a note for later in the season. |

**Score:** 5/5 truths verified (SC1 via the accepted override); 0 behavior-unverified.

### UAT Gap Closure (03-12, 03-13)

| Gap | Fix | Evidence | Status |
|-----|-----|----------|--------|
| G-03-1 teammate-blocked excluded from CF/CA | `play-events.ts` exclusion is shootout or penalty-shot only; `Exclusion` has two members; `events.ts` `excluded` has `shootout` and `penaltyShot`; note and legend narrowed | 6 `G-03-1` tests pass by name (L1 EV CF 11, L3 EV CA 6, delta CF/CA +2/+1 for MTL and +1/+2 for BUF with gf/ga/sf/sa delta 0, SOG reconciliation for both teams). Live page shows L1 Suzuki-Caufield-Slafkovský CF 11 and L3 Kreider-Anderson-Newhook CA 6, the exact numbers the developer reported from other sites. | CLOSED |
| G-03-3 stat group divider spacing | `LastGameLines.tsx` stat `td` and header-row-2 `th` use `pl-1 pr-3`; colgroup headers keep `pl-3` | Markup test passes; harness U8: worst number-to-divider gap 12 px (limit 8), worst label start 20.7 px after its divider (limit 24), light and dark | CLOSED in code and measured; visual sign-off pending (human item) |
| G-03-7 en dash separator | `<span aria-hidden className="mx-1">–</span>`, name links use opt-in `overlaySpinner` (absolute, `pointer-events-none`) so a name takes no trailing space | Tests: dash markup, overlay classes on unit names only, trends table unchanged, default `PendingLink` markup byte-identical. Harness U7: 22 separators, 4 px before and after in light and dark; U4 names still open the PP panel | CLOSED in code and measured; visual sign-off pending (human item) |

### Assessment of the Known Items

**03-12 deviation (plan expected BUF SOG 17, fixture stores 16): accepted, the plan was wrong, not the code.** I checked independently three ways. (1) The live NHL boxscore for 2026020092 returns MTL 38 / BUF 16 (`lastPeriodType: SO`). (2) Counting the fixture's own plays: BUF goal+shot-on-goal plays are 16 in REG plus 1 in SO (17 including the shootout shot); MTL is 33 REG + 5 OT + 3 SO (41 including shootout versus 38 official). So 17 is the play-by-play count that includes a shootout attempt, which the phase deliberately excludes. (3) The reconciliation tests assert attributed shots plus penalty shots equal the boxscore SOG for both teams with `unattributed == 0`, and pass. The fixture format requires the official boxscore value, so 16 is correct; the literal `sog===17` check should not be run. No impact on SC1 or SC3.

**03-13 open human check (spacing at about 1024 px, light and dark): carried as the one human item.** Evidence short of a human: harness U5-U8 pass on the live page in WebKit light and dark, and the light and dark screenshots show evenly spaced dashes and numbers clear of each divider. It stays a human item because both cosmetic gaps were raised by the developer's eye.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/research/play-events.ts` | Maps play-by-play to goal/shot/miss/block events, exclusions shootout and penalty shot | VERIFIED | Teammate-blocked branch removed; used by `events.ts` |
| `lib/research/events.ts` | On-ice attribution, byUnit/total, quality flags | VERIFIED | Wired to `team-games.ts` via `buildGameEvents`; shares `creditsUnit`/`unitKey` with `lines.ts` |
| `lib/research/fixtures/*.json` | 9 real games including 2026020092 | VERIFIED | Read by tests; 2026020092 values match the live boxscore |
| `lib/nhl/client.ts` | `getPlayByPlay`, Retry-After retry, tiered cache | VERIFIED | Wired from `loadGame` |
| `lib/research/team-games.ts` | `events` per game, paced loader | VERIFIED | `loadGame` and `mapPaced` in `loadTeamResearch` |
| `lib/research/unit-events-view.ts` | View-model, legend, notes | VERIFIED | Imported by the component |
| `components/LastGameLines.tsx` | 6 tables, 9 stat columns, legend, notes, centered separator, `pl-1 pr-3` cells | VERIFIED | Rendered by `app/research/page.tsx` |
| `components/PendingLink.tsx`, `PlayerLink.tsx` | Opt-in `overlaySpinner` | VERIFIED | Prop destructured, never reaches the DOM; default markup pinned |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `page.tsx` | `loadTeamResearch` | await, catch to load-failed banner | WIRED |
| `loadGame` | `getPlayByPlay` | in the Promise.all with its own catch (D-05) | WIRED |
| `loadGame` | `buildGameEvents` | `events:` field | WIRED (mapping outside the D-05 catch, WR-01) |
| `LastGameLines` | `buildUnitTable`, `topNotes`, `exclusionsNote`, `UNIT_LEGEND` | imports and render | WIRED |
| `LastGameLines` | `PlayerLink` -> `PendingLink` | `overlaySpinner` prop forwarded | WIRED |
| `analyzeGameLines` and `attributeEvents` | `creditsUnit`, `unitKey` | shared helper | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `LastGameLines` stat cells | `game.events` | NHL play-by-play plus shift chart via `loadGame` | Yes: live render of MTL 2026020092 shows CF 11 / CA 6, forward Total SF sums to 38 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `npm test` | 552 pass, 0 fail | PASS |
| G-03-1 regression | `npx tsx --test --test-name-pattern="G-03-1" lib/research/events.test.ts` | 6 pass | PASS |
| 03-13 markup pins | `--test-name-pattern="pl-1|mx-1|overlay|renders exactly"` on the view and links tests | 5 pass | PASS |
| Types and lint | `npx tsc --noEmit`, `npm run lint` | clean | PASS |
| Live page, WebKit | `node .planning/phases/03-unit-event-stats/webkit-units-check.cjs` | `units-check: pass=8 fail=0 skip=0` (U1-U8) | PASS |
| Live boxscore | NHL boxscore for 2026020092 | MTL 38, BUF 16, matches fixture | PASS |
| Build | `npm run build` | reported passed by the orchestrator post-merge; not re-run by me | Not independently verified |

### Probe Execution

SKIPPED: no probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 03-07, 03-09, 03-11 | Last 20 without throttling failure | SATISFIED | SC5: mechanisms, U1/U2 re-run, developer's Vercel pass (UAT 5) |
| DATA-02 | 03-04, 03-05, 03-06, 03-08 | Dash, never 0, for missing chart/pbp, excluded from averages | SATISFIED (warning WR-01) | SC4 |
| DATA-03 | 03-01 to 03-05, 03-12 | Counts reconcile with boxscore; fixture tests reproduce SOG and plus-minus | SATISFIED with one accepted exception | SC1; 03-12 reconciliation tests on 2026020092 |
| UNIT-01 | 03-06, 03-10, 03-11, 03-12, 03-13 | SF/SA, GF/GA, CF/CA on every unit table | SATISFIED | SC2; G-03-1 numbers confirmed live |
| UNIT-02 | 03-06, 03-10, 03-11, 03-13 | SF%, CF%, +/- with dash when no events | SATISFIED | SC2 |
| UNIT-03 | 03-06, 03-08, 03-10, 03-11, 03-12 | Legend, exclusions, Other row reconciles | SATISFIED (warning WR-02) | SC3; REQUIREMENTS UNIT-03 wording matches the shipped rule |

All six phase IDs appear in plan frontmatter (03-01..03-13); none orphaned. REQUIREMENTS.md still lists DATA-01..03 and UNIT-01..03 as unchecked/`Pending` and the ROADMAP progress line is not final; tracking updates are left to the orchestrator.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/research/events.ts`, `play-events.ts`, `team-games.ts` | 199-201 / 30-52 / 182 | Mapping not total and outside the D-05 catch (WR-01, still open) | Warning | A payload with no `plays` or `periodDescriptor` would drop the whole game's TOI and lines. No such payload has been observed from the live API; unpublished games return empty `plays`, which is handled. |
| `lib/research/events.ts` | 98-103 | `unattributed` written, never read by production code (WR-02, still open) | Warning | A few events in seconds with no shift data would silently understate counts while the legend says Total is the team's total. `unattributed` is 0 on every fixture and on the live smoke. |
| `components/LastGameLines.tsx` | 178-184 | Separator has no whitespace (IN-04, new) | Info | Names copy as "A–B–C"; wrap points are only link edges; irrelevant at laptop widths. While a link navigates, its 12 px overlay spinner briefly sits over the following dash (pointer-events-none, cosmetic only). |
| `lib/research/team-games.ts` | `mapPaced` | 1000 ms start gap also applied to cached games | Warning | About 1 s per game even warm; harness cold 3-team Last 20 took 20.7 s total; a design call, not a defect. |
| `lib/nhl/client.ts` | 178-182, `fetchShiftCharts` | Uncached empty re-request; shift chart bypasses `nhlGet` retry (IN-02) | Info | Can exceed the tuned rate budget |
| `lib/nhl/client.ts` | `NhlPlay.details` | Unused declared fields (IN-01) | Info | Comment and type disagree |

No TBD/FIXME/XXX/TODO/HACK markers in the files changed by this phase's gap-closure plans. All entries in `03-REVIEW-DISPOSITION.md` remain `open`; none blocks a success criterion.

### Human Verification Required

1. **03-13 spacing, light then dark** (see `human_verification` in the frontmatter). Open `/research?team=MTL&games=5` at about 1024 px and confirm: dash centered with a small even gap, +/- and SF% clear of the next divider, gap after each Goals/Shots/Corsi divider no longer oversized.
   - Expected: balanced spacing in both color schemes.
   - Why human: visual judgement; measured and screenshot-checked, but the gaps were raised by the developer's eye.

### Gaps Summary

No gaps. Every success criterion is met in code and on the live page: the three reported UAT gaps are closed, the full suite (552/552), tsc, lint and the 8-check live WebKit harness pass, and the previously unanswered items (SC1 exception, SC5 on Vercel, legend wording, no-data game) were answered by the developer in UAT. The one remaining item is the developer's visual sign-off on 03-13 spacing. Recommended but not blocking: fix WR-01 (contain `buildGameEvents` in `loadGame`) and surface `unattributed` (WR-02) before relying on the page for unusual games.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
