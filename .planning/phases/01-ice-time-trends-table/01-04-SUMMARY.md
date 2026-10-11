---
phase: 01-ice-time-trends-table
plan: 04
subsystem: ui
tags: [nextjs, searchparams, sorting, url-state, tailwind, a11y, node-test, tdd]

requires:
  - phase: 01-ice-time-trends-table
    provides: "Plan 01 TrendRow/buildTrendRows; plan 03 Δ columns and 1-game window handling in ToiTrends"
provides:
  - "Sortable Avg TOI, TOI Δ, PP share and PP share Δ headers (PendingLink, scroll={false}, aria-sort, ↑/↓)"
  - "URL-stored sort (?sort=&dir=) validated against an allowlist, kept across team and window switches"
  - "F-before-D sort with nulls last in both directions and a deterministic tiebreak (Avg TOI desc, name, id)"
  - "1-game window falls back to Avg TOI ordering and marks Avg TOI active while the URL keeps the requested sort"
  - "Header hover titles and the final UI-SPEC intro paragraph"
affects: []

actuals:
  tokens: 6700
  tasks: 2
  commits: 4

commits: 4
plan_head_before: 1a0ef796f71f3372bdb945d5d269447a1f864721
plan_head_after: a0c477cbb452a15d76479d4e5ae0d29ff14e2285

tech-stack:
  added: []
  patterns:
    - "Raw search params go through one allowlist parser (parseSort) and links are rebuilt from validated values with URLSearchParams (researchHref); nothing is interpolated"
    - "Requested sort stays in the URL; effectiveSort applies the window-size override at render time only"
    - "buildTrendRows delegates ordering to sortRows(DEFAULT_SORT) so there is one ordering implementation"

key-files:
  created: []
  modified:
    - lib/research/toi-trends.ts
    - lib/research/toi-trends.test.ts
    - lib/research/toi-trends-view.test.ts
    - components/ToiTrends.tsx
    - app/research/page.tsx

key-decisions:
  - "A new sort key starts descending and clicking the active key flips it (risers first), per UI-SPEC discretion"
  - "The URL keeps the requested sort in a 1-game window; only the rendered order and active header are overridden, so Last 10 restores a TOI Δ sort"
  - "dir=asc is the only value honoured for dir; anything else is desc"

requirements-completed: [TRND-05]

coverage:
  - id: D1
    description: "Sort by Avg TOI, TOI Δ, PP share or PP share Δ via clickable headers, F block always before D, nulls last in both directions, deterministic ties"
    requirement: "TRND-05"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#sortRows tests, nextSort"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#rows follow the chosen sort within the forwards and defense blocks"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sort lives in the URL, is validated (arrays/unknown fall back to default) and is carried by team and window links"
    requirement: "TRND-05"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#parseSort tests, researchHref"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#sort header links toggle the sort and keep team and window"
        status: pass
    human_judgment: false
  - id: D3
    description: "Active header shows ↓/↑ with aria-sort; other headers are plain; 1-game window sorts by Avg TOI; header titles and intro copy match the UI-SPEC"
    requirement: "TRND-05"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#aria-sort, 1-game fallback, titles and intro tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicking a header does not jump the page, the spinner shows while pending, and the sort survives reload and switching team/window in a real browser"
    requirement: "TRND-05"
    verification: []
    human_judgment: true
    rationale: "Scroll position, pending spinner and URL round-trips are browser behaviours that markup tests cannot assert (plan human-check)"

duration: 4min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 04: Sortable Trends Table Summary

**URL-persisted sorting of the ice-time trends table by Avg TOI, TOI Δ, PP share or PP share Δ, with allowlisted `sort`/`dir` params, forwards always above defense, nulls last, and a 1-game fallback to Avg TOI.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-11T20:11:00Z
- **Completed:** 2026-10-11T20:14:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Four header cells are PendingLinks (prefetch off, `scroll={false}`) that sort the table: an inactive header sorts descending, the active one flips. The active header shows ↓/↑ and `aria-sort`; Player, Pos, SH, Per game and TOI trend stay plain text.
- `sort` and `dir` are read from the awaited searchParams and pass through `parseSort` before any use (strings in the allowlist and exactly `asc`; arrays, unknown values and missing params give Avg TOI descending). Team and window links are built by `researchHref` and carry the current sort; the default adds no params.
- `sortRows` keeps F before D, orders by the chosen value, sinks `—` rows to the bottom of their group in both directions, and breaks ties by Avg TOI desc, name A→Z, then id. `buildTrendRows` now uses it with the default sort.
- In a 1-game window a Δ sort renders as Avg TOI descending with Avg TOI marked active, while the URL still holds the request so going back to Last 10 restores it.
- Sortable headers carry the UI-SPEC hover titles and the section intro is the approved copy.

## Task Commits

TDD cycle for each task:

1. **Task 1: Sort by any of the four headers, kept in the URL and across team/window switches**
   - RED `12c6d6d` (test): 6 view tests and the new sort unit tests failing (sortRows, parseSort, nextSort, researchHref absent; headers not links)
   - GREEN `0bae277` (feat): sort logic, SortHeader, page wiring
2. **Task 2: Sorting in a 1-game window, header hints and the final section copy**
   - RED `a242f96` (test): 5 tests failing (effectiveSort absent, no titles, old intro)
   - GREEN `a0c477c` (feat): effectiveSort, titles, intro

**Plan metadata:** committed with this SUMMARY (docs: complete plan). No REFACTOR commits were needed.

## TDD Gate Compliance

RED then GREEN commits exist for both tasks (`test(01-04)` before `feat(01-04)`). RED evidence is the project's own `tsx --test` run: named new tests failed with `TypeError ... is not a function` for missing exports and assertion failures for missing markup. Semantic assessment: every failure was on the planned behaviour; no syntax/load faults. The `check tdd-red-evidence` classifier was not run because `tdd_mode` was not enabled for this dispatch.

## Files Created/Modified
- `lib/research/toi-trends.ts` - SORT_KEYS, SortKey/SortDir/SortSpec, DEFAULT_SORT, parseSort, nextSort, effectiveSort, sortRows, researchHref; buildTrendRows delegates ordering
- `components/ToiTrends.tsx` - SortHeader, new props (sort, team, gameCount), effectiveSort applied, titles, final intro
- `app/research/page.tsx` - sort/dir params via parseSort, href helper uses researchHref, passes sort/team/gameCount
- `lib/research/toi-trends.test.ts` - parse/next/href/sortRows/effectiveSort unit tests
- `lib/research/toi-trends-view.test.ts` - render helper takes sort/team/gameCount; aria-sort, links, titles, intro, 1-game tests

## Decisions Made
- New key starts descending and the active key flips (UI-SPEC discretion: risers first).
- The URL is never rewritten for the 1-game case; the override is render-time only (flagged assumption in the plan).
- `dir` accepts only the exact string `asc`; this plus the key allowlist covers T-01-06 and T-01-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing header-order test needed the active-sort arrow**
- **Found during:** Task 1 (RED authoring)
- **Issue:** `renders headers in order` expected the bare label "Avg TOI", but the default sort now marks Avg TOI active so its header text is "Avg TOI ↓".
- **Fix:** Updated the expectation to "Avg TOI ↓".
- **Files modified:** lib/research/toi-trends-view.test.ts
- **Committed in:** 12c6d6d

**2. [Rule 1 - Bug] Dropped a vacuous "keeps scroll position" test**
- **Found during:** Task 1 (RED authoring)
- **Issue:** `scroll` is a Link prop and is absent from server-rendered HTML, so a markup test could only assert that a link exists.
- **Fix:** Removed it; `scroll={false}` is covered by the plan's acceptance grep and the end-of-phase human check.
- **Files modified:** lib/research/toi-trends-view.test.ts
- **Committed in:** 12c6d6d

---

**Total deviations:** 2 auto-fixed (2 bug, both in tests)
**Impact on plan:** No scope change. Neither affected shipped behaviour.

## Issues Encountered
None. `npm run lint` was not used because it fails at baseline on untracked `.claude/` files; the plan's scoped eslint command was used instead.

## Verification
- `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts`: 77 pass, 0 fail
- `npm test`: 154 pass, 0 fail (baseline was 130)
- `npx tsc --noEmit`, `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx` and `npm run build`: clean
- All acceptance-criteria greps pass for both tasks (including `grep -c "String(sortParam)" app/research/page.tsx` = 0 and the login redirect line unchanged)

## Known Stubs
None.

## Threat Flags
None. `sort` and `dir` are the only new inputs and are covered by T-01-06 and T-01-07 (mitigated as planned); no new endpoints, auth paths or fetches.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Last plan of the phase. The end-of-phase human check is pending: signed in at `/research?team=MTL&games=10`, click TOI Δ then again, reload and paste the URL into a new tab, try the other three headers, switch team and window (sort kept), choose Last game while sorted by TOI Δ (Avg TOI active) and go back to Last 10 (TOI Δ returns), confirm a header click does not jump the page, and that `sort=bogus` or `sort=toiDelta&sort=ppDelta` loads with the default sort and no error.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*

## Self-Check: PASSED
