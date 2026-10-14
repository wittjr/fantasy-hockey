---
phase: 03-unit-event-stats
plan: 01
subsystem: research
tags: [nhl, play-by-play, event-attribution, fixtures, node-test, typescript]

requires:
  - phase: 01-ice-time-trends-table
    provides: bucketOnIce, dedupeOnIce, situationFor, analyzeGameLines (shift-chart timeline and strength rule)
provides:
  - "NhlPlay / NhlPlayByPlay play-by-play types"
  - "toGameEvents: pure play-by-play to GameEvent mapper with shootout, penalty-shot and teammate-blocked exclusions and a pulledGoalie flag"
  - "onIceAt / attributeEvents / buildGameEvents: event attribution per situation and unit on the shared on-ice timeline"
  - "unitKey and creditsUnit in lines.ts: the shared unit key and the one rule for which seconds and events credit a listed unit"
  - "Fixture format (lib/research/fixtures/{gameId}.json) and the DATA-03 reconciliation gate on the regulation game 2025020084"
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

plan_head_before: f4bc7500a7a6797b043ddf37d5f9c6a7b232495e
plan_head_after: f5ab57de135e6aa4871473f4814d9fe2ed6ac828

actuals:
  tokens: 18300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Second consumer of bucketOnIce/dedupeOnIce/situationFor: events use bucket t-1 (start < t <= end) via onIceAt"
    - "Committed trimmed real NHL payloads as test fixtures, loaded with readFileSync"
    - "Tolerant mapper for untrusted JSON: skip, never throw"

key-files:
  created:
    - lib/research/play-events.ts
    - lib/research/play-events.test.ts
    - lib/research/events.ts
    - lib/research/events.test.ts
    - lib/research/fixtures/2025020084.json
  modified:
    - lib/nhl/client.ts
    - lib/research/lines.ts

key-decisions:
  - "creditsUnit(situation, mine, opp) is false when either team has no goalie on ice and, at even strength, when either side is not exactly 5 skaters; an opponent with no shift rows counts as goalie out (planned decisions 1 and 2)"
  - "Pulled-goalie events are not an exclusion; they reach only the situation total (D-21)"
  - "analyzeGameLines only moves its unit-key logic into unitKey in this plan; applying creditsUnit to unit seconds stays in plan 03-02"

patterns-established:
  - "Reconciliation gate: GATE_FIXTURES drives team SOG and per-skater plus-minus tests with no exemption; later plans append fixtures"
  - "Fixture JSON: gameId, category, note, homeTeam/awayTeam {id, abbrev, sog}, plays (four shot kinds), shifts tuples, players tuples"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "On the regulation game 2025020084, each team's boxscore SOG is reproduced from raw play-by-play and from attributed situation totals plus penalty shots, with no unattributed event"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#2025020084 WPG/NSH: shots on goal from play-by-play equal the boxscore SOG"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#2025020084 WPG/NSH: attributed shots plus penalty shots equal the boxscore SOG for and against"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every skater's plus-minus recomputed from attributed goal events equals the boxscore value, with no exemption"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#2025020084: every skater's plus-minus recomputed from attributed goals equals the boxscore"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mapper's exclusions (shootout by periodType only, penalty-shot codes, teammate-blocked), pulled-goalie flag and malformed-play skips are pinned"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/play-events.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Events reach a listed unit only through the shared unitKey and creditsUnit; analyzeGameLines output is unchanged"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "npm test (existing lib/research/lines.test.ts unedited, 350 tests pass)"
        status: pass
    human_judgment: true
    rationale: "The routing of pulled-goalie and 4-on-4/3-on-3 events away from listed units is not asserted by a test in this plan; plan 03-02 adds the attribution rule tests"

duration: 15min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 01: Unit Event Stats - Event Attribution Tracer Summary

**NHL play-by-play mapped to shots and goals, attributed to situation and unit on the shift-chart timeline, and reconciled with the official boxscore (team SOG and every skater's plus-minus) on a committed real regulation game**

## Performance

- **Duration:** about 15 min (start time was not recorded at execution start; approximate)
- **Completed:** 2026-10-14T13:16:26Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Tracer: fixture 2025020084 (WPG vs NSH, 124 shot plays, 740 shifts, 40 players, 54 KB) captured live once; `toGameEvents` -> `bucketOnIce` -> `onIceAt` -> `attributeEvents` reproduces both teams' boxscore SOG (24 and 31) and all 36 skaters' plus-minus with no exemption or tolerance. A mutation check (reading bucket `t` instead of `t - 1`) makes the plus-minus test fail, so the gate is sensitive.
- `unitKey` and `creditsUnit` exported from `lib/research/lines.ts`; `analyzeGameLines` keys units through `unitKey` with identical output (`lines.test.ts` unedited, still green).
- Mapper rules pinned by 11 tests; each rule was mutation-checked (shootout by period number, a missing penalty-shot code, a missing goalie digit, the excluded-event guard and the teammate-blocked reason all make a test fail).

## Task Commits

1. **Task 1 (tracer): play-by-play mapper, on-ice attribution, boxscore reconciliation** - `008c4ca` (feat)
2. **Task 2: pin mapper exclusions, pulled-goalie flag, malformed plays** - `f5ab57d` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified

- `lib/research/play-events.ts` - `toGameEvents`, `GameEvent`, `EventKind`, `Exclusion`
- `lib/research/events.ts` - `onIceAt`, `attributeEvents`, `buildGameEvents`, `emptyCounts`, `EventCounts`, `GameEvents`
- `lib/research/lines.ts` - `unitKey`, `creditsUnit`; `analyzeGameLines` calls `unitKey`
- `lib/nhl/client.ts` - `NhlPlay`, `NhlPlayByPlay` types only (the fetch function is plan 03-05)
- `lib/research/events.test.ts` - DATA-03 reconciliation tests; constants `GATE_FIXTURES` and `ALL_FIXTURES`
- `lib/research/play-events.test.ts` - mapper rule tests
- `lib/research/fixtures/2025020084.json` - trimmed real regulation payload; sets the fixture format

## Decisions Made

None beyond the plan's recorded decisions; followed the plan as specified. `ALL_FIXTURES` is `export`ed from `events.test.ts` so it is not an unused constant under lint until plan 03-02 uses it.

## Deviations from Plan

### Auto-fixed Issues

None to the code. Two environment notes, neither a code deviation:

1. **[Rule 3 - Blocking] Worktree had no `node_modules` and no generated Next route types.** Symlinked the main checkout's `node_modules` (gitignored, nothing added or installed; `package.json` and the lockfile are untouched) and ran `npx next typegen` (writes gitignored `.next/types`) so `npx tsc --noEmit` could resolve `LayoutProps` in `app/layout.tsx`. Not committed.
2. **`npm run build` was not completed in the worktree.** Turbopack rejects the `node_modules` symlink ("points out of the filesystem root"). No file under `app/` or `components/` changed, and `tsc`, `lint` and the full test suite pass, but the plan-level `npm run build` check should be re-run in a checkout with a real `node_modules` (the orchestrator after merge).

### TDD gate note (Task 2, `tdd="true"`)

Task 2 has no RED commit. `play-events.ts` already existed from Task 1 (the plan places the mapper in the tracer and Task 2 pins it), so all 11 new tests passed on first run: an expected green, not a wrong test. As substitute RED evidence, six targeted mutations of `play-events.ts` each made at least one test fail (see Accomplishments), then the file was restored byte-for-byte. `play-events.ts` needed no fix.

**Total deviations:** 0 code deviations, 2 environment notes.

## Issues Encountered

None in the code. The capture precondition (NHL APIs reachable) held; the capture script lived in the session scratchpad outside the repo and is not committed (`git ls-files` for `*capture*` is empty).

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, or trust-boundary surface beyond the plan's threat model (T-01 mitigated by the tolerant mapper and its tests).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-02 can add the attribution rule tests (onIceAt boundaries, direction, pulled goalie, 4-on-4/3-on-3 routing, accounting, purity) and apply `creditsUnit` to unit seconds in `analyzeGameLines` (test first). Plan 03-03 appends the other gate fixtures to `GATE_FIXTURES` / `ALL_FIXTURES` in the format set here.

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: lib/research/play-events.ts, lib/research/play-events.test.ts, lib/research/events.ts, lib/research/events.test.ts, lib/research/fixtures/2025020084.json
- FOUND commits: 008c4ca, f5ab57d (ancestors of HEAD)
- `npm test` 350 pass / 0 fail, `npx tsc --noEmit` and `npm run lint` clean, `lib/research/lines.test.ts` byte-identical to 2518d44
