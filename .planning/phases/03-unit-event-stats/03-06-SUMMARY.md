---
phase: 03-unit-event-stats
plan: 06
subsystem: ui
tags: [react, tailwind, nextjs, node-test, view-model, hockey-analytics]

requires:
  - phase: 03-unit-event-stats
    provides: "GameEvents, EventCounts and ResearchGame.events from plans 03-01 to 03-05"
provides:
  - "lib/research/unit-events-view.ts: pure view-model (UNIT_LIMITS, DASH, statCells, buildUnitTable and row types)"
  - "Last game unit tables with Goals, Shots and Corsi columns and reconciling Other and Total rows"
affects: [03-08, 03-10]

actuals:
  tokens: 7500
  tasks: 2
  commits: 4

plan_head_before: e8d2aad5f53a99d353480e712f29b07fa6714b71
plan_head_after: 3cd9f26e2166bca4c9977bb4d2d53caa60260f1c

tech-stack:
  added: []
  patterns:
    - "Pure string view-model (buildUnitTable) with a print-only server component"
    - "Unknown events are null and render as a dash; Other is derived from raw seconds and counts, never rounded percentages"

key-files:
  created:
    - lib/research/unit-events-view.ts
    - lib/research/unit-events-view.test.ts
  modified:
    - components/LastGameLines.tsx
    - lib/research/player-links-view.test.ts

key-decisions:
  - "The component prints the view-model's strings only; UNIT_LIMITS moved from the component into the view-model"
  - "Dash cells use neutral-400/500 and win over the derived-percent neutral-500 so no cell carries two text colours"
  - "Other is not clamped at zero: a negative count would signal a data drift and should stay visible"

patterns-established:
  - "Markup tests parse renderToStaticMarkup output by tr/td/th regexes (cellsOf, rowsOf, rowLabelled)"

requirements-completed: [UNIT-01, UNIT-02, UNIT-03, DATA-02]

coverage:
  - id: D1
    description: "Every unit table shows GF GA +/- | SF SA SF% | CF CA CF% under Goals, Shots, Corsi group headers for EV, PP and SH, forwards and defense"
    requirement: UNIT-01
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: every table has Goals, Shots, Corsi group headers over 13 column headers in order"
        status: pass
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: six tables in situation-then-group order, stacked full width in overflow wrappers"
        status: pass
    human_judgment: false
  - id: D2
    description: "Count, SF%, CF% and +/- formatting: known zero is 0, unknown is a dash, shares to one decimal, signed +/- with U+2212"
    requirement: UNIT-02
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#statCells formats counts, shares to one decimal and a signed +/-"
        status: pass
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#statCells of a known zero: 0 counts, dash shares and dash +/- (D-20)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Other and Total rows reconcile: listed plus Other equals Total for time and every count; F and D tables share a Total"
    requirement: UNIT-03
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#Other is the situation total minus the listed rows for every counter, so listed plus Other equals Total"
        status: pass
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: the F and D tables of one situation print the same Total stats"
        status: pass
    human_judgment: false
  - id: D4
    description: "With events null every stat cell is a dash while Time and % stay real; no earlier game's events are used"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: with events null every stat cell in listed, Other and Total rows is a dash and Time and % are real"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual result at 1024px width in light and dark: continuous group dividers, readable Total row, no clipping"
    verification: []
    human_judgment: true
    rationale: "Layout and contrast are browser-level checks; they run as WebKit checks in plan 03-10 (UI-SPEC backstops)"

duration: 5min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 06: Unit event columns and Other/Total rows Summary

**Last game unit tables now show goals, shots and Corsi for and against with SF%, CF% and +/-, plus Other and Total rows that reconcile, all from a pure tested view-model.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-14T13:33:37Z
- **Completed:** 2026-10-14T13:38:08Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `lib/research/unit-events-view.ts` holds `UNIT_LIMITS`, `DASH`, `statCells` and `buildUnitTable`; rows are capped and ordered by `lines.units`, Other is the situation total minus the listed rows from raw seconds and counts, and Total is the team's situation total.
- `components/LastGameLines.tsx` stacks the six tables full width (EV, PP, SH; forwards then defense) with a Goals/Shots/Corsi group header row, 13 columns, Other and Total rows and an unchanged `PlayerLink` name column.
- Unknown events (null) show a dash in every stat cell of listed, Other and Total rows while Time and % stay real; a situation with neither time nor events shows only the None row.
- 31 view-model and markup tests; full suite 499 passing, `tsc --noEmit` and lint clean.

## Task Commits

1. **Task 1 RED: failing tests for unit event columns** - `3881e0a` (test)
2. **Task 1 GREEN: GF GA +/- SF SA SF% CF CA CF% on every unit table** - `0535e90` (feat)
3. **Task 2 RED: failing tests for Other and Total rows** - `a113cb8` (test)
4. **Task 2 GREEN: Other and Total rows so each table reconciles** - `3cd9f26` (feat)

**Plan metadata:** committed after this summary (docs: complete plan)

## TDD Gate Compliance

Plan type is `execute` with `tdd="true"` tasks. Each task has a `test(03-06)` commit followed by a `feat(03-06)` commit.

- **Task 1 RED:** the new test file ran against a signature-only stub (`statCells` returned empty strings, `buildUnitTable` returned no rows) and the old component. 14 of 16 tests failed on the planned assertions (dash/zero/share formatting, capped rows, 13 headers, group headers, titles, stacked layout). The two that passed (no green/red classes, lines-null message) hold in the old layout too. Semantic assessment: failures were assertion failures for the intended behavior, not load or syntax faults.
- **Task 2 RED:** 11 of 31 failed on the Other/Total assertions (Other time and counts, null events dashes, border-l cells, row classes); the 20 earlier and vacuously true cases passed.

## Files Created/Modified
- `lib/research/unit-events-view.ts` - view-model: capped rows, Other, Total and formatted stat strings
- `lib/research/unit-events-view.test.ts` - formatting rules, reconciliation and markup tests
- `components/LastGameLines.tsx` - stacked tables, group header row, stat cells, Other and Total rows
- `lib/research/player-links-view.test.ts` - three UNIT-04 assertions adjusted for the extra header row (see deviation)

## Decisions Made
- Dash cells take `text-neutral-400 dark:text-neutral-500` instead of the derived-percent `text-neutral-500`, so a cell never has two competing text colours.
- Other is left unclamped: the view-model does not hide a count that would go negative; plan 03-10's live-data check rejects a negative Other.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing unit-table tests counted raw `<tr>` elements**
- **Found during:** Task 1 (full `npm test` after the re-layout)
- **Issue:** `lib/research/player-links-view.test.ts` asserted `<tr` counts (2 for the None table, 5 for four listed units) and indexed the second `<tr` for a name cell. The new group header row and, after Task 2, Other and Total rows change those counts. The tested behavior (None row without a link, cap of 4 units, name links per player id) is unchanged.
- **Fix:** counted `>None<` occurrences, counted rows that contain a name link, and located the twin-names row with the existing `rowHtml` helper.
- **Files modified:** lib/research/player-links-view.test.ts
- **Verification:** `npm test` reports 499 pass, 0 fail
- **Committed in:** `0535e90`

---

**Total deviations:** 1 auto-fixed (1 test brittleness)
**Impact on plan:** No behavior change; the file was outside `files_modified` but is exercised by the re-laid-out component.

## Issues Encountered
- `npm run build` was not run: the worktree uses a symlinked `node_modules`, under which Turbopack cannot build. The orchestrator runs the build after merge; `tsc --noEmit`, `npm run lint` and `npm test` all pass here.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. The legend, exclusions note and amber reliability notes are intentionally plan 03-08; the live-data render check and browser backstops are plan 03-10.

## Next Phase Readiness
- Plan 03-08 can add `UNIT_LEGEND`, the notes and the footnotes block to `unit-events-view.ts` and `LastGameLines`.
- Plan 03-10 owns the 1024px light/dark checks, divider continuity, UNIT-04 click-through and the negative-Other check on live data.

## Self-Check: PASSED

- FOUND: lib/research/unit-events-view.ts, lib/research/unit-events-view.test.ts, components/LastGameLines.tsx
- FOUND commits 3881e0a, 0535e90, a113cb8, 3cd9f26 (all ancestors of HEAD)
- `npx tsx --test lib/research/unit-events-view.test.ts`: 31 pass, 0 fail; `npm test`: 499 pass, 0 fail; `npx tsc --noEmit` and `npm run lint` exit 0
- Acceptance greps: UNIT_LIMITS exported from the view-model and absent from the component; no `lg:grid-cols-2`; no `use client`; `scope="colgroup"`, `colSpan={13}`, Other, Total and the Total-row classes present

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
