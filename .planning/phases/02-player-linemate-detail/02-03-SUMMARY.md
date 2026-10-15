---
phase: 02-player-linemate-detail
plan: 03
subsystem: research
tags: [nextjs-server-component, link-hash-scroll, url-contract, unit-tables, aria-current]

requires:
  - phase: 02-player-linemate-detail
    provides: "parsePlayer / parseSit / researchHref extras, PlayerLinemates panel with id=player-detail (02-01)"
provides:
  - "parseAll (all is on only for exactly '1') and playerHref (researchHref + '#player-detail')"
  - "PlayerLink: PendingLink to the player's panel, or a native #player-detail anchor for the selected name on his own tab"
  - "Trends-table names are links; selected row has a neutral 4px inset bar, font-medium name and hidden 'Selected'"
  - "Last game unit tables moved to components/LastGameLines; every name links to the panel on that table's own situation tab"
  - "Nav URL contract: team links drop player/all and keep sit; window links keep player/sit and drop all; sort links keep player/sit/all"
affects: [02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 8400
  tasks: 3
  commits: 7
plan_head_before: 62146d58c1d72d6eeff788edd2972bb2d728d368
plan_head_after: 0a9d25786c8732a4134cd91d897d1307ee14eba9

tech-stack:
  added: []
  patterns:
    - "Name links built only from validated values via playerHref; the #player-detail hash is a constant in one place"
    - "Selected name on his own tab is a native hash anchor (jumps every click); elsewhere a PendingLink so it can switch tabs"
    - "Private page.tsx components moved to components/ so they can be rendered in fixture tests"

key-files:
  created:
    - components/PlayerLink.tsx
    - components/LastGameLines.tsx
    - lib/research/player-links-view.test.ts
  modified:
    - lib/research/toi-trends.ts
    - lib/research/toi-trends.test.ts
    - components/ToiTrends.tsx
    - app/research/page.tsx

key-decisions:
  - "Name links never carry all, so a newly opened player starts capped (planner decision, UI-SPEC silent)"
  - "aria-current='true' is applied literally wherever the selected player appears, including his PendingLink in another situation's unit table"
  - "A mover row and a DNP-last-2 row cannot coincide (a delta needs recent games played), so the name-first ordering is tested on separate rows"

requirements-completed: [PLYR-01, UNIT-04]

coverage:
  - id: D1
    description: "Trends-table names link to ?player=<id>#player-detail keeping team, games, sort, dir and the current sit; the selected name is a plain #player-detail anchor with aria-current"
    requirement: PLYR-01
    verification:
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#an unselected name links to the player's panel on the current tab"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#playerHref builds the name-link URL with the panel hash"
        status: pass
    human_judgment: true
    rationale: "The page jump to the panel (including from the last row and on re-click) and Back behaviour need a laptop browser; plan 02-07 owns that backstop check"
  - id: D2
    description: "Selected trends row: neutral inset bar on the name cell, font-medium name, hidden 'Selected', row tint unchanged; pl-2 on first-column cells"
    requirement: PLYR-01
    verification:
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#the selected row's name cell has the neutral bar, a Selected note, and a font-medium #player-detail anchor"
        status: pass
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#a mover row keeps its tint and its screen-reader text, and the name link comes first"
        status: pass
    human_judgment: true
    rationale: "Bar visibility on green and red tinted rows in light and dark themes is a visual backstop check (UI-SPEC)"
  - id: D3
    description: "Every Last game unit-table name (EV, PP, SH; F and D) links to the panel on that table's situation tab; EV omits sit, PP/SH carry it; Time, %, order and per-table limits unchanged"
    requirement: UNIT-04
    verification:
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#EV unit names link without sit and PP unit names link with sit=pp"
        status: pass
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#the #, Time and % cells keep their values"
        status: pass
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#an EV forward list of 5 units renders 4 rows"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sort, window and team links follow the URL contract (sort keeps player/sit/all; window keeps player/sit, drops all; team drops player/all, keeps sit); parseAll is exact-'1' only"
    requirement: PLYR-01
    verification:
      - kind: unit
        ref: "lib/research/player-links-view.test.ts#sort headers keep the selection, tab and show-all state"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#parseAll is on only for the exact string 1"
        status: pass
    human_judgment: true
    rationale: "Team and window nav links are built in page.tsx (an auth-gated async server component) and have no markup test; they are verified by grep of the exact researchHref calls and by the build"

duration: 25min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 03: Name Links and Selected Row Summary

**Every player name on /research (Ice-time trends and all six Last game unit tables) now links to `?player=<id>#player-detail`, with the selected row marked by a neutral bar and a native hash anchor that re-jumps to the panel; nav links follow the keep/drop URL contract**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-12T19:33Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- `parseAll` (exact `"1"` only) and `playerHref` (`researchHref` + constant `#player-detail`) in `lib/research/toi-trends.ts`.
- Team links use `researchHref(t, gameCount, sort, { sit })`; window links use `researchHref(team, n, sort, { player, sit })`; the old two-argument `href` helper is gone.
- `components/PlayerLink.tsx`: PendingLink with default scroll (so Next jumps to the panel), or a native `<a href="#player-detail" aria-current="true">` when the name is the selected player on his own tab.
- `ToiTrends` accepts `selected`, `sit`, `all` (defaults null, "ev", false), links each name, marks the selected row (inset bar on the name cell, `font-medium`, hidden "Selected"), adds `pl-2` to the Player th and name td, and passes `{ player, sit, all }` into every sort header.
- `components/LastGameLines.tsx`: `UnitTable`, `LastGameLines`, `UNIT_LIMITS`, `SITUATION_LABELS` moved out of `page.tsx`; names are `PlayerLink`s carrying the table's situation, separated by `aria-hidden` " – ".

## Task Commits

1. **Task 1: parseAll, playerHref, nav links** (TDD) - `fff6299` (test, RED), `7d100e8` (feat, GREEN)
2. **Task 2: trends-table links and selected row** (TDD) - `c89f349` (test, RED), `cc095dd` (feat, GREEN)
3. **Task 3: Last game unit-table links** (TDD) - `d095746` (refactor, verbatim move), `e03072d` (test, RED), `0a9d257` (feat, GREEN)

**Plan metadata:** committed after this file (docs: complete plan)

## TDD Gate Compliance

All three TDD tasks have a `test(02-03)` commit before the `feat(02-03)` commit; no REFACTOR gate commit was needed beyond the planned verbatim move.

- **RED, Task 1:** `parseAll`/`playerHref` tests fail with `TypeError: ... is not a function` (the target functions did not exist). Semantic assessment: the three target tests ran and failed for the intended reason (missing behavior), not on setup or import faults. The `gsd_run check tdd-red-evidence` classifier was not run (this plan's RED was inspected from the real `tsx --test` output instead).
- **RED, Task 2:** 7 of 7 new tests failed on assertions for the planned markup (missing links, bar, `pl-2`, sort extras). Two tests first passed vacuously (`indexOf("<a")` of -1 is less than any index), so they were tightened to require the anchor before RED was committed.
- **RED, Task 3:** 5 link tests failed on assertions. Four more (Time/%, None row, 4-row limit, no-chart note) passed on purpose: they pin behavior that must not change (roadmap SC5).
- **GREEN:** all of each task's tests pass; `npm test` is 260 pass, 0 fail.

## Files Created/Modified
- `components/PlayerLink.tsx` - name link (PendingLink or native hash anchor)
- `components/LastGameLines.tsx` - Last game unit tables with linked names
- `lib/research/player-links-view.test.ts` - 16 markup tests (trends table and unit tables)
- `lib/research/toi-trends.ts` - `parseAll`, `playerHref`
- `lib/research/toi-trends.test.ts` - parseAll/playerHref cases
- `components/ToiTrends.tsx` - linked names, selected-row marking, sort extras
- `app/research/page.tsx` - parses `all`, nav URL contract, imports the moved component (auth-gate lines untouched)

## Decisions Made
- Name links drop `all`, so a newly opened player starts capped.
- `aria-current="true"` is applied wherever the selected player appears, including his PendingLink in a unit table of another situation (that link switches tabs).
- Mover and DNP-last-2 cannot share a row by construction, so the name-before-badge ordering is tested on one row of each kind.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verbatim move as its own `refactor` commit before the Task 3 RED**
- **Found during:** Task 3
- **Issue:** The RED tests import `LastGameLines`, which did not exist; a missing module would fail the whole test file at load (INVALID_RED), not on the planned assertions.
- **Fix:** Moved the unit tables out of `page.tsx` verbatim (same props, no behavior change) in `d095746`, then wrote RED against the real component.
- **Files modified:** components/LastGameLines.tsx, app/research/page.tsx
- **Verification:** `tsc`, eslint and `npm test` (251 pass) green on that commit.
- **Committed in:** `d095746`

---

**Total deviations:** 1 auto-fixed (1 blocking, ordering only). **Impact on plan:** none on the end state; one extra commit.

## Issues Encountered
- A test helper's `<th[^>]*>` regex also matched `<thead>`; fixed to `<th\b` in the same GREEN commit as Task 2 (test-only).

## Verification Run
- `npx tsx --test lib/research/toi-trends.test.ts` 53 pass; `player-links-view` + `toi-trends-view` 55 pass; `npm test` 260 pass, 0 fail.
- `npx tsc --noEmit` exit 0; `npm run build` compiled; `npx eslint app/research lib/research lib/nhl components` exit 0.
- `lib/research/toi-trends-view.test.ts` untouched since the phase started. The three auth-gate lines in `page.tsx` each occur exactly once, unchanged.
- No live NHL calls were made (the dev server on port 3000 was not touched).

## Human Checks (end-of-phase, listed not blocking)
- Click a trends-table name far down the page (including the last row): the page jumps to the panel under the nav; re-clicking the same name jumps again; Back returns to the prior state.
- Click a PP-table unit name: the panel opens on the PP tab; a name in the EV table opens EV.
- The selected row's bar is visible on green and red tinted rows in light and dark themes, and the name does not shift when a row is selected.
- Unit-table names wrap cleanly with the spinner slots at laptop widths.

## Known Stubs
None.

## Threat Flags
None. Hrefs come only from `researchHref`/`playerHref` with a numeric id, allowlisted `sit`, team and window; `all` is exact-`"1"` (T-02-05, T-02-06, T-02-07 mitigated; package files not touched).

## Next Phase Readiness
- 02-04 can add the show-all and tab behavior on the panel; `all` already round-trips through the page, sort links and `ToiTrends`.
- Ready for the next plan in the phase.

## Self-Check: PASSED

---
*Phase: 02-player-linemate-detail*
*Completed: 2026-10-12*
