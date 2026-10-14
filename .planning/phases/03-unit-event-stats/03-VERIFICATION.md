---
phase: 03-unit-event-stats
verified: 2026-10-14T12:00:00Z
status: human_needed
score: 3/5 must-haves verified
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
  - components/LastGameLines.tsx
  - lib/nhl/client.ts
  - lib/research/events.ts
  - lib/research/lines.ts
  - lib/research/play-events.ts
  - lib/research/team-games.ts
  - lib/research/unit-events-view.ts
covered_digest: "v3:sha256:275027172bf534173324e1a2ba2b8f780ba00b770707de2da8dfdb34b1f45d40"
behavior_unverified: 1
overrides_applied: 1
overrides:
  - must_have: "Fixture tests on real games reproduce official team shots on goal and every skater's plus-minus from attributed play-by-play events"
    reason: "One skater (A. Panarin, 2025020500) differs by 1 because his shift ends on a goal second; pinned by KNOWN_BOXSCORE_DISAGREEMENTS with a cause test; all other skaters in 6 gate games match. Developer: if the shift chart lists him on ice it should count; the official 0 may be a manual league adjustment."
    accepted_by: "Jamie Witt"
    accepted_at: "2026-10-14T16:15:00Z"
behavior_unverified_items:
  - truth: "Selecting Last 20 for any team loads without failing from NHL API throttling (SC5)"
    test: "After deploying to Vercel, open /research?team=X&games=20 for two or three teams within a minute, in mid-season or against a team with 20 finished games"
    expected: "No 'Couldn't load NHL data' banner, no unavailable dates; page returns within the Vercel function time limit (about 20 s cold per team at the current 1000 ms start gap)"
    why_human: "Only 6-8 finished games per team exist in October, so a real 20-game window was never loaded; the 1 s/game figure is extrapolated. Vercel egress throttling and function duration cannot be seen from this machine. Pacing, Retry-After handling and cache tiers are present and unit-tested, but the throttling outcome is runtime/network behaviour."
human_verification:
  - test: "Boxscore cross-check (03-11 item 1): signed in on a laptop browser, open /research?team=MTL&games=5; for the Last game add SF across the EV, PP and SH Total rows of the forwards tables"
    expected: "Equals the NHL.com boxscore shots on goal for MTL, minus any penalty shot named in the exclusions note"
    why_human: "Needs a signed-in browser and the NHL.com boxscore; fixtures and live smoke prove this in code, not in the rendered page"
  - test: "Legend and exclusions wording (item 2)"
    expected: "SF, GF, CF, SF%, CF%, +/-, Other and the pulled-goalie / 4-on-4 / 3-on-3 placement in Other read clearly"
    why_human: "Judgement on copy"
  - test: "Screenshot review (item 3), light and dark at 1024 px"
    expected: "Columns align, Goals/Shots/Corsi dividers run down each table, Total row stands out"
    why_human: "Visual appearance"
  - test: "No-data game (item 4): a window containing a game with no shift chart or no play-by-play"
    expected: "Cells show a dash with the amber note, never 0"
    why_human: "Needs a live game in that state; the code path is unit-tested only"
  - test: "Post-deploy Vercel Last 20 (item 5): see behavior_unverified_items"
    expected: "No load-failed banner"
    why_human: "Needs the deployed app and a full-season window"
  - test: "Accept or reject the plus-minus exception (2025020500, A. Panarin: official 0, reproduced -1)"
    expected: "Decide whether SC1 'every skater's plus-minus' is satisfied with this one pinned, cause-checked exception (suggested override below)"
    why_human: "Judgement on whether the roadmap wording tolerates a documented exception"
---

# Phase 3: Unit Event Stats Verification Report

**Phase Goal:** User can judge each last-game unit (EV, PP, SH; forwards and defense) by its shots, goals and shot attempts for and against, with counts that reconcile with the official boxscore
**Verified:** 2026-10-14
**Status:** human_needed
**Re-verification:** No, initial verification

Note: the roadmap marks this phase `mode: mvp`, but its goal is not in "As a ..., I want ..., so that ..." form, so the MVP user-story verification was not applied. Standard goal-backward verification was used against the five roadmap success criteria.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Fixture tests on real games (regulation, OT, shootout, empty-net, penalty shot, missing chart) reproduce official team SOG and every skater's plus-minus from attributed events | UNCERTAIN (one pinned exception) | `lib/research/events.test.ts` runs 6 real gate fixtures (`fixtures/*.json`, real NHL payloads) plus missing-chart 2026020026. Team SOG reproduces on both teams of every gate game; attributed sf/sa plus penalty shots equal SOG with `unattributed == 0`. Plus-minus is recomputed from attributed goals through `onIceAt`/`situationFor` and matches every skater except A. Panarin in 2025020500 (official 0, reproduced -1). The exception is a single `KNOWN_BOXSCORE_DISAGREEMENTS` entry with a cause test (his P1 shift ends on the goal second; locked `start < t <= end` rule). All pass, I ran them. The roadmap says "every skater", so this is literally 1 miss short; see override suggestion. The gate predates the column plan (03-06 `depends_on` 03-01..03-03). |
| 2 | SC2: Every last-game unit table (EV/PP/SH x F/D) shows SF/SA, GF/GA, CF/CA plus SF%, CF%, +/-, with a dash where a unit has no events | VERIFIED | `components/LastGameLines.tsx` renders all 6 tables from `buildUnitTable` with `STAT_COLUMNS` GF GA +/- SF SA SF% CF CA CF%. `statCells` in `unit-events-view.ts`: SF%/CF% and +/- give `DASH` when for+against (or cf+ca) is 0; `events === null` gives a dash in every cell. 89 view/team-games/client tests pass. |
| 3 | SC3: A legend defines each stat and exclusions (empty-net, shootout, teammate-blocked), and an Other row makes unit totals add up to the team total | VERIFIED (with warning WR-02; wording and rendered reconciliation pending human) | `UNIT_LEGEND` (3 lines) and `exclusionsNote` rendered under the tables. Other = situation total minus listed units from raw counts and seconds (never negative; tested per fixture), Total row = `events.total[situation]`. Fixture tests show included + excluded + unattributed account for every mapped event. Caveat: empty-net goals are not excluded in code, they count (pulled-goalie events are routed to Other and the legend says so); the roadmap wording "exclusions (empty-net ...)" is read as "empty-net events are not in listed lines". WR-02: events with no shift data for that second are in no table, including Total, and nothing shows it. |
| 4 | SC4: For a game with missing shift chart or play-by-play, event stats show a dash (never 0) and the game is left out of any average or trend that would include it | VERIFIED (with warning WR-01) | `buildGameEvents` returns null on empty shifts, null pbp or no plays; `statCells(null)` is all dashes; `topNotes` and `missingPlayByPlayNote` explain it; tests cover it (fixture 2026020026, `team-games.test.ts` pbp failure keeps the game). Event stats feed no average or trend yet (`.events` is read only in `LastGameLines` and the older-dates note), so exclusion from averages is vacuously true. WR-01 confirmed by me: `buildGameEvents` throws `TypeError` on a payload without a `plays` key (the code's own `pbp.plays?.length` anticipates that case), which would drop the whole game's TOI/lines. |
| 5 | SC5: Selecting Last 20 for any team loads without failing from NHL API throttling, with play-by-play on every game | PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: `retryAfterMs` (short numeric Retry-After, max 2 retries) inside `nhlGet`; `finishedGameCache` tiers (1 h under 48 h, 30 d older) passed to boxscore, shift chart and play-by-play; `mapPaced` (3 concurrent, 1000 ms start gap, newest first) in `loadTeamResearch`; `/research` accepts `games=20`. Measured: cold 3 teams and 9 teams (about 60 games) clean at 1000 ms; 500/600/750 ms all 429'd. But no real 20-game window was ever loaded (6-8 games per team), the 20 s cold/warm time is extrapolated, and the Vercel run is unanswered. |

**Score:** 3/5 truths verified (SC2, SC3, SC4); SC1 is UNCERTAIN pending the exception decision; SC5 is 1 present, behavior-unverified.

### Suggested Override (needs the developer to accept, not applied)

SC1 looks like a defensible deviation: the single Panarin miss is root-caused to a boundary-second rule and pinned so it cannot widen. To accept:

```yaml
overrides:
  - must_have: "Fixture tests on real games reproduce official team shots on goal and every skater's plus-minus from attributed play-by-play events"
    reason: "One skater (A. Panarin, 2025020500) differs by 1 because his shift ends on a goal second; pinned by KNOWN_BOXSCORE_DISAGREEMENTS with a cause test; all other skaters in 6 gate games match"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/research/play-events.ts` | Maps play-by-play to goal/shot/miss/block events with exclusions | VERIFIED | Real mapping, exclusions for SO, penalty shot (1010/0101), teammate-blocked; used by `events.ts` |
| `lib/research/events.ts` | On-ice attribution, byUnit/total, quality flags | VERIFIED | Wired to `team-games.ts` via `buildGameEvents`; shares `creditsUnit`/`unitKey` with `lines.ts` |
| `lib/research/fixtures/*.json` | 8 real games | VERIFIED | Present; read by tests |
| `lib/nhl/client.ts` | `getPlayByPlay`, Retry-After retry, tiered cache | VERIFIED | Wired from `loadGame` |
| `lib/research/team-games.ts` | `events` per game, paced loader | VERIFIED | `loadGame` and `mapPaced` in `loadTeamResearch` |
| `lib/research/unit-events-view.ts` | View-model, legend, notes | VERIFIED | Imported by component |
| `components/LastGameLines.tsx` | 6 tables with 9 stat columns, legend, notes | VERIFIED | Rendered by `app/research/page.tsx` |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `page.tsx` | `loadTeamResearch` | await, catch to load-failed banner | WIRED |
| `loadGame` | `getPlayByPlay` | in the Promise.all, with its own catch (D-05) | WIRED |
| `loadGame` | `buildGameEvents` | `events:` field | WIRED (mapping step is outside the D-05 catch, WR-01) |
| `LastGameLines` | `buildUnitTable`, `topNotes`, `exclusionsNote`, `UNIT_LEGEND` | imports and render | WIRED |
| `analyzeGameLines` and `attributeEvents` | `creditsUnit`, `unitKey` | shared helper | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `LastGameLines` stat cells | `game.events` | NHL play-by-play plus shift chart via `loadGame` | Yes (live smoke reconciled 3 MTL games to boxscore SOG, `unattributed 0`) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `npm test` | 536 pass, 0 fail | PASS |
| Gate and attribution | `npx tsx --test lib/research/events.test.ts` | all listed tests pass, including the 6 gate games and the exception cause test | PASS |
| View/team-games/client | `npx tsx --test` on those three files | 89 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | clean | PASS |
| WR-01 reproduction | `buildGameEvents` with a pbp lacking `plays` | throws TypeError | CONFIRMED defect |

### Probe Execution

SKIPPED: no probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 03-07, 03-09, 03-11 | Last 20 without throttling failure | NEEDS HUMAN | Mechanisms present and measured on 6-8 game windows; no 20-game or Vercel run (SC5) |
| DATA-02 | 03-04, 03-05, 03-06, 03-08 | Dash, never 0, for missing chart/pbp, excluded from averages | SATISFIED (warning WR-01) | SC4 |
| DATA-03 | 03-01 to 03-05 | Counts reconcile with boxscore; fixture tests reproduce SOG and plus-minus | SATISFIED with one pinned exception | SC1 |
| UNIT-01 | 03-06, 03-10, 03-11 | SF/SA, GF/GA, CF/CA on every unit table | SATISFIED | SC2 |
| UNIT-02 | 03-06, 03-10, 03-11 | SF%, CF%, +/- with dash when no events | SATISFIED | SC2 |
| UNIT-03 | 03-06, 03-08, 03-10, 03-11 | Legend, exclusions, Other row reconciles | SATISFIED (warning WR-02; wording pending human) | SC3 |

All six phase IDs (DATA-01, DATA-02, DATA-03, UNIT-01, UNIT-02, UNIT-03) appear in plan frontmatter; none are orphaned. REQUIREMENTS.md still shows these six as `Pending`; the tracking update is left to the orchestrator.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/research/events.ts` / `play-events.ts` / `team-games.ts` | 199-201 / 30-52 / 182 | Mapping not total and outside the D-05 catch (WR-01) | Warning | A payload without `plays` or `periodDescriptor` drops the whole game, contradicting D-05 |
| `lib/research/events.ts` | 98-103 | `unattributed` written, never read (WR-02) | Warning | A few lost events understate counts silently; legend says Total is the team's total |
| `lib/research/team-games.ts` | 25-29, `mapPaced` | 1000 ms gap applied to cached games too | Warning | About 1 s per game cold or warm, about 20 s for a 20-game window versus D-19's about 10 s; design decision for the developer |
| `lib/nhl/client.ts` | 178-182 and `fetchShiftCharts` | Uncached empty re-request is a 4th request; shift chart bypasses `nhlGet` retry (IN-02) | Info | Can exceed the tuned rate budget |
| `lib/nhl/client.ts`, `components/LastGameLines.tsx` | | IN-01, IN-03 | Info | Unused fields, redundant class, undrained 429 body |

No TBD/FIXME/XXX/TODO markers in the phase's source files. All 03-REVIEW.md dispositions are still `open`.

### Human Verification Required

See `human_verification` in the frontmatter (six items): boxscore cross-check, legend wording, screenshots, no-data game, post-deploy Vercel Last 20, and the Panarin exception decision.

### Gaps Summary

No hard failures: the gate fixtures, the unit-table columns, the legend/Other/Total rows and the missing-data dashes are all present, wired, fed by real data, and backed by passing tests (536/536, tsc clean). Phase status is `human_needed` rather than `passed` because (1) SC5, the Last 20 throttling guarantee, has never been exercised on a real 20-game window or on Vercel, (2) SC1's "every skater" wording has one pinned exception that needs a developer decision, and (3) the plan 03-11 end-of-phase human checks are unanswered. Recommended before closing the phase: fix WR-01 (a few lines, contain the mapping in `loadGame`), surface `unattributed` (WR-02), and decide whether warm-load pacing of about 20 s per Last 20 is acceptable.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
