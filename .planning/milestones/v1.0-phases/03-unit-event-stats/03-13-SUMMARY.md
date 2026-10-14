---
phase: 03-unit-event-stats
plan: 13
subsystem: ui
tags: [react, tailwind, next-link, webkit, playwright, uat-gap-closure]

requires:
  - phase: 03-unit-event-stats
    provides: unit tables (03-10), WebKit harness U1-U6, teammate-blocked CF/CA fix (03-12)
provides:
  - PendingLink optional overlaySpinner (absolute, pointer-events-none, no inline space)
  - centered mx-1 en-dash separator between unit-table names
  - stat cells with pl-1 pr-3 so numbers sit 12px clear of the Goals/Shots/Corsi dividers
  - harness checks U7 (separator symmetry) and U8 (divider spacing) at 1024px, light and dark
affects: [phase-03 verification, research page]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: c53b6c36680427763da91fd590291b9b2077cbd6
plan_head_after: c913b9b266f1c04801f9e59b5f734449bc9af1e6

tech-stack:
  added: []
  patterns:
    - "Optional overlay spinner on PendingLink: default path markup is byte-identical, pinned by an exact-string test"

key-files:
  created: []
  modified:
    - components/PendingLink.tsx
    - components/PlayerLink.tsx
    - components/LastGameLines.tsx
    - lib/research/player-links-view.test.ts
    - lib/research/unit-events-view.test.ts
    - .planning/phases/03-unit-event-stats/webkit-units-check.cjs
    - .planning/phases/03-unit-event-stats/03-UI-SPEC.md

key-decisions:
  - "Spinner overlay is opt-in (overlaySpinner), so the trends table keeps its reserved slot for the DNP chip and every other PendingLink is unchanged"
  - "pr-3 applied to all nine stat cells, not only +/- and SF%, so spacing inside groups and column widths stay unchanged"

requirements-completed: [UNIT-01, UNIT-02]

duration: 25min
completed: 2026-10-14
status: complete

coverage:
  - id: D1
    description: "En dash between unit-table names is centered with equal 4px space on both sides"
    requirement: UNIT-01
    verification:
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#names in a unit are separated by an aria-hidden mx-1 dash with no spaces"
        status: pass
      - kind: e2e
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (U7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unit-table names still open the player panel and show the pending spinner without it taking inline space; other PendingLinks unchanged"
    requirement: UNIT-02
    verification:
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#a PendingLink without overlaySpinner renders exactly the markup it rendered before"
        status: pass
      - kind: e2e
        ref: "webkit-units-check.cjs (U4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "+/- and SF% numbers clear of the next divider; GF/SF/CF labels close after theirs"
    requirement: UNIT-01
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: every stat cell carries pl-1 and pr-3"
        status: pass
      - kind: e2e
        ref: "webkit-units-check.cjs (U8)"
        status: pass
    human_judgment: true
    rationale: "Whether the spacing now looks balanced is a visual judgment; the end-of-phase human check covers it"
---

# Phase 3 Plan 13: Unit table separator and divider spacing Summary

**Unit-table dash centered with 4px on each side via an opt-in overlay spinner on PendingLink, and stat cells moved to pl-1 pr-3 so numbers sit 12px clear of every Goals/Shots/Corsi divider, measured in WebKit light and dark at 1024px**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (plus a RED test commit for each)
- **Files modified:** 7

## Accomplishments
- G-03-7: `PendingLink` takes an optional `overlaySpinner`; `PlayerLink` forwards it and the unit table passes it. The spinner is `absolute left-full top-1/2 pointer-events-none`, so a name takes no trailing space and an invisible spinner cannot catch a click over the dash. The separator is `<span aria-hidden class="mx-1">–</span>`.
- G-03-3: stat `td` and header-row-2 stat `th` go from `pl-3` to `pl-1 pr-3`; colgroup headers keep `pl-3`; widths, dividers and colors untouched.
- Harness U7 and U8 added; 03-UI-SPEC updated (spacing exception, column table, body rows, long-text rows, PendingLink contract, dated Revisions entry).

## Task Commits

1. **Task 1 RED:** `aa1a163` (test) failing separator and overlay tests
2. **Task 1 GREEN:** `92a8b72` (feat) overlay spinner, centered separator, harness U7
3. **Task 2 RED:** `9b75599` (test) failing stat-cell padding test
4. **Task 2 GREEN:** `c913b9b` (feat) pl-1 pr-3, harness U8, UI-SPEC revisions

## Verification Results

- Default-path pin: the exact-markup test for a `PendingLink` without `overlaySpinner` passed before the PendingLink change (captured from the unmodified component) and after it.
- Planned RED failures: Task 1, the separator test and the overlay test (2 failures, 18 passing); Task 2, the pl-1 pr-3 test (1 failure, 52 passing).
- `npm test`: 552 tests, 0 fail. `npx tsc --noEmit` and `npm run lint`: clean.
- **`npm run build` did not run in this worktree:** it fails with Turbopack "Symlink [project]/node_modules is invalid, it points out of the filesystem root", caused only by the borrowed `node_modules` symlink. The orchestrator should run the build in the main checkout after merge.
- Harness run 1 (after Task 1): `units-check: pass=7 fail=0 skip=0`, PASS U4, U5, U7.
- Harness run 2 (after Task 2): `units-check: pass=8 fail=0 skip=0`, PASS U5, U6, U7, U8.
- **U7 details** (light and dark identical): 22 separators measured, none skipped; before and after gap both 4.0px (min 4, max 4, difference 0).
- **U8 details** (light and dark identical): 28 body rows; worst gap between the +/- or SF% text and the next divider 12px (limit 8); worst GF/SF/CF label start 20.7px after its divider (limit 24).
- Screenshots: `/var/folders/66/233hbws17zsgsmbc49t_t7nr0000gn/T/units-check-light.png` and `units-check-dark.png`. The light screenshot was viewed: dashes sit evenly between names, numbers have clear space before each divider.

## Human check (for end-of-phase verification)

On a laptop browser at about 1024px, light then dark, open `/research?team=MTL&games=5`: (1) dash centered with a small even gap; (2) +/- and SF% no longer touch the divider after them; (3) space after each Goals/Shots/Corsi divider no longer looks oversized next to the space before it.

## Deviations from Plan

**1. [Rule 3 - Blocking] Type error in the new Task 2 test**
- **Found during:** Task 2 (`tsc`)
- **Issue:** `rowsOf(table)[0]` is possibly undefined under the repo's strict indexed access.
- **Fix:** `?? ""`. **Files:** `lib/research/unit-events-view.test.ts`. Committed in `c913b9b`.

**2. Harness U8 added in Task 2, not alongside U7.** Task 1's verify forbids any FAIL line, and U8 cannot pass before the padding change, so the U8 block and header line were added with Task 2 (as the plan's task split implies).

**3. Plan commit ledger not written.** A compound shell command was refused by the worktree sandbox, so `gsd-plan-head-before-03-13` was never created. `plan_head_before` is the verified spawn base `c53b6c3`; `commits: 4` is `git rev-list --count c53b6c3..HEAD`.

**Total deviations:** 1 auto-fixed (blocking), 2 process notes. **Impact:** none on scope.

## Issues Encountered

- `npm run build` cannot run against the symlinked `node_modules` (see above). Not a code issue.

## Known Stubs

None.

## Threat Flags

None. The harness still removes the auth gate only in its temp copy and binds to 127.0.0.1; the overlay spinner carries `pointer-events-none` (T-03-33), pinned by a markup test, and U4 confirmed names still open the PP panel.

## Next Phase Readiness

Both cosmetic UAT gaps (G-03-3, G-03-7) are closed in code and measured; the human visual check and the main-checkout build remain.

## Self-Check: PASSED

- Modified files exist; commits aa1a163, 92a8b72, 9b75599, c913b9b are ancestors of HEAD.
