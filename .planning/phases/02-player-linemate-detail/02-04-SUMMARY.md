---
phase: 02-player-linemate-detail
plan: 04
subsystem: research
tags: [react-client-component, a11y, wcag-1.4.13, tailwind-group-data, webkit-check]

requires:
  - phase: 02-player-linemate-detail
    provides: "ToiStripCell accepting LinemateCellState and the shared StripPopover (02-01, 02-02)"
provides:
  - "nextDismissed(dismissed, event) and a 'leave' CellEvent in components/ToiStripCell.tsx"
  - "data-dismissed on the square and group-data-[dismissed]/cell:hidden on the popover: Escape hides a hover, focus or pinned popover without blurring"
  - "aria-expanded removed from every strip square (WR-10)"
  - "WebKit check D13 (Escape without blur, re-arm on blur, pinned Escape)"
affects: [02-05, 02-06, 02-07]

actuals:
  tokens: 2400
  tasks: 2
  commits: 3
plan_head_before: 0d46cfe03eb74e310636ec3948a23591198c8f6c
plan_head_after: 5bbb68c010fb039d1e3035cd2f279262d8a49367

tech-stack:
  added: []
  patterns:
    - "One local send(event) helper in the client component applies every pure transition function (nextOpen, nextDismissed) to its own state"
    - "A dismiss flag as a data attribute plus a group-data variant on the server-rendered popover, so CSS (not JS) hides it while focus stays put"

key-files:
  created: []
  modified:
    - components/ToiStripCell.tsx
    - components/StripPopover.tsx
    - lib/research/toi-trends-view.test.ts
    - .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs
    - .planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md

key-decisions:
  - "Outside pointerdown leaves the dismissed flag alone (it can only fire while pinned, and the pin is cleared separately)"
  - "A pointer leaving a square keeps a pin (nextOpen('leave') returns the current value) but clears the dismissed flag, so hover shows the popover again on re-entry"
  - "WR-10 disposition cites the GREEN commit ad76e51 as the fix commit"

patterns-established:
  - "Escape dismiss: Escape never calls blur(); hiding is a CSS variant keyed on data-dismissed, which also beats :hover and :focus-visible because Tailwind 4.3.3 emits it after them"

requirements-completed: [PLYR-02]

coverage:
  - id: D1
    description: "Escape hides a strip popover (hover, focus or pinned) without moving keyboard focus off the square, on both strips via the shared square"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#Escape dismisses the popover, an outside pointerdown leaves the flag alone, and every other event clears it"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every popover is hidden while its square is dismissed"
        status: pass
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs (PASS D13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Click, Enter, Space, outside pointerdown, blur, hover and focus-visible behave as in Phase 1; squares no longer carry aria-expanded"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every strip square shows a pointer cursor, is a named group and starts closed"
        status: pass
      - kind: e2e
        ref: "webkit-strip-check.cjs D3-D10 (16 passed, 0 failed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Escape on the heat strip (shares ToiStripCell) behaves the same in a real browser"
    verification: []
    human_judgment: true
    rationale: "The heat strip exists only on the player panel; WebKit D13 ran on the Per game strip. Plan 02-07 re-checks Escape on the heat strip (H3) and the Per game strip (H6)."

duration: 3min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 04: Escape dismiss for strip squares (WR-10) Summary

**Escape now hides a strip popover through a `data-dismissed` flag and a `group-data-[dismissed]/cell:hidden` variant instead of blurring the square, and `aria-expanded` is gone, fixing WR-10 once for both the Per game and linemate heat strips.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-12T19:34:26Z
- **Completed:** 2026-10-12T19:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `components/ToiStripCell.tsx`: `CellEvent` gains `"leave"`; `nextOpen` returns the current value for it; new exported `nextDismissed`; a `dismissed` state, a single `send(event)` helper applied to every handler (click, Enter, Space, Escape, blur, pointer leave) and the outside-pointerdown effect; `data-dismissed` rendered as an empty string when set; the Escape branch no longer calls the element's blur method; `aria-expanded` deleted. `role="button"`, `tabIndex`, `aria-label` and `data-open` kept.
- `components/StripPopover.tsx`: single token `group-data-[dismissed]/cell:hidden` appended right after `group-data-[open]/cell:block`, and the JSDoc notes it.
- Tests: the closed-start test asserts no `aria-expanded`, `data-dismissed` or `data-open`; new tests for the `nextOpen` "leave" case, `nextDismissed`, and the dismiss token (including its position directly after the open token, which is what makes it win the cascade).
- WebKit check D13 added to the Phase 1 harness, and WR-10 marked fixed in `01-REVIEW-DISPOSITION.md`.

## TDD Gate Compliance

- **RED** (`d6ed1f1`, `test(02-04)`): 4 target tests failed on their planned assertions (aria-expanded still present; dismiss token absent; `nextOpen(true, "leave")` returned false; `nextDismissed` is not a function). The 47 other tests in the file passed. The evidence was read from the runner output by hand; `gsd_run check tdd-red-evidence` was not run because the plan is `type: execute`, not `type: tdd`.
- **GREEN** (`ad76e51`, `feat(02-04)`): all 65 tests in the two target files pass; full `npm test` 263/263.
- **REFACTOR:** none needed.

## Task Commits

1. **Task 1 RED:** `d6ed1f1` (test)
2. **Task 1 GREEN:** `ad76e51` (feat)
3. **Task 2:** `5bbb68c` (test: D13 and WR-10 disposition)

## Verification

- `npx tsx --test lib/research/toi-trends-view.test.ts lib/research/player-detail-view.test.ts`: 65 pass, 0 fail
- `npx tsc --noEmit`: exit 0; `npm run build`: compiled
- `npx eslint app/research lib/research lib/nhl components`: clean
- `npm test`: 263 pass, 0 fail
- Acceptance greps: `aria-expanded` 0 hits and `blur()` 0 hits in `ToiStripCell.tsx`; the `open...dismissed` token pair is present in `StripPopover.tsx`.
- `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs`: "strip-check: 16 passed, 0 failed, 0 skipped", including `PASS D13` and the emulated-iPhone T2-T4. D13 recorded: after Escape on a Tab-focused square the popover is hidden, focus is still on the square, `data-dismissed` is set and there is no `aria-expanded`; Tab then Shift+Tab shows it again with the flag cleared; a click pins it, and Escape then hides it while the pointer is still over it (so dismissed beats both hover and the pin), unpins it and keeps focus. That confirms the Tailwind 4.3.3 cascade order flagged as RESEARCH A8. The scratch server was stopped (nothing listening on 3101) and its temp copy removed.

## Deviations from Plan

None - plan executed exactly as written. The `send` helper and the matching change in the outside-pointerdown effect follow the plan's "route every event through one local helper".

## Issues Encountered

None.

## Human Checks (end-of-phase)

- On the player panel's linemate heat strip, Tab to a square, press Escape: the popover hides and the focus ring stays on the square; Tab away and back shows it again. (Plan 02-07, H3 and H6, re-checks both strips.)

## Known Stubs

None.

## Threat Flags

None. T-02-08: the document pointerdown listener is still added only while pinned and cleaned up in the same effect; the new pointerleave handler only changes local state. T-02-09: the harness safeguards (temp copy outside the repo, loopback bind, no `.env*`, minimal environment) were not touched.

## Next Phase Readiness

Ready for 02-05. PlayerLinemates renders `ToiStripCell` and `StripPopover` unchanged and does not depend on the removed expanded attribute.

## Self-Check: PASSED

- FOUND: components/ToiStripCell.tsx, components/StripPopover.tsx, lib/research/toi-trends-view.test.ts, webkit-strip-check.cjs, 01-REVIEW-DISPOSITION.md
- FOUND commits: d6ed1f1, ad76e51, 5bbb68c
