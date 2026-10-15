---
phase: 02-player-linemate-detail
plan: 05
subsystem: research
tags: [react-server-component, next-link, tailwind, tdd, a11y, view-model]

requires:
  - phase: 02-player-linemate-detail
    provides: "buildLinemateView, LinemateView, SITUATION_ABBREV, LINEMATE_MIN_SECONDS (02-01) and the PlayerLinemates panel with StripPopover squares and the player-detail-view test fixtures (02-02)"
provides:
  - "SITUATION_WORDS, type LinemateEmptyReason, LinemateView.emptyReason and LinemateView.noChartDates in lib/research/linemates.ts"
  - "Panel header stats (Avg TOI, TOI Δ, PP share, PP share Δ) with the trends table's formatting and mover colours"
  - "EV/PP/SH situation tabs (URL-state links, scroll={false}, no hash, aria-current on the active one)"
  - "Intro, legend lines 1-2, amber no-chart footnote and the three empty-state messages"
affects: [02-06, 02-07]

actuals:
  tokens: 6200
  tasks: 2
  commits: 4
plan_head_before: 96a2ac71907356f4458f0eb6504f51bfc78acbbc
plan_head_after: 86230e83b805654b5f82be7f7f0e5bf841a04544

tech-stack:
  added: []
  patterns:
    - "The view-model owns the empty-state decision (emptyReason with fixed precedence); the component only maps the reason to copy"
    - "A small HeaderStat server component carries the DeltaCell tone rule (deltaCrossing plus sr-only Moving up/down) for the panel header"
    - "Footnote block renders only when it has something to say (legend with the table, amber note when games lack a chart)"

key-files:
  created: []
  modified:
    - lib/research/linemates.ts
    - lib/research/linemates.test.ts
    - components/PlayerLinemates.tsx
    - lib/research/player-detail-view.test.ts

key-decisions:
  - "emptyReason no-chart is judged over charted games the selected player dressed for, so a dressed player whose games all lack a chart is never told he had no time (D-24)"
  - "Legend line 2 says 'in the games they both played' (D-25 wording, matching the Window share title) instead of UI-SPEC's 'in the games he played'"
  - "With emptyReason no-chart the panel shows only the message and the tabs: no legend and no amber footnote, since the message already says the same thing"
  - "With no-situation-time or below-minimum the amber footnote still shows when some window games lack a chart, so the user can tell that missing data may explain the empty view"

patterns-established:
  - "Empty-state copy is selected by view.emptyReason from a Record<LinemateEmptyReason, string>, using SITUATION_WORDS for sentences and SITUATION_ABBREV for chips and tabs"

requirements-completed: [PLYR-02, PLYR-03]

coverage:
  - id: D1
    description: "Panel header shows Avg TOI, TOI Δ, PP share and PP share Δ with the trends table's values and formatting, green/red mover colours with sr-only Moving up/down, a muted dash for unknown values, and only the two non-Δ items in a 1-game window"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#the header stats read Avg TOI, TOI Δ, PP share and PP share Δ with the trends table's values"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a TOI Δ and a PP share Δ that cross the mover thresholds are coloured with a screen-reader word"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#unknown header stats show a muted dash, never 0:00 or 0%"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a 1-game window drops the two Δ items"
        status: pass
    human_judgment: false
  - id: D2
    description: "EV, PP and SH tab links under the header stats keep team, window, sort and player, set sit (omitted for EV), carry no hash, and mark the active tab with aria-current"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#the situation tabs are EV, PP, SH links; the active one has aria-current and a dark border"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#each tab keeps the team, window, sort and player, sets sit (omitted for EV) and carries no hash"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tab click leaves the page scroll position unchanged (scroll={false} on the tab links)"
    requirement: PLYR-02
    verification: []
    human_judgment: true
    rationale: "scroll={false} is not visible in server-rendered markup; the behaviour needs a real browser. Plan 02-07's browser backstop owns it."
  - id: D4
    description: "Intro, legend lines 1-2 (regulation-only rule, window-share denominator, listing minimum for the active situation) and the amber missing-chart footnote with formatted dates"
    requirement: PLYR-03
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#the intro names the player and explains the squares and the tabs"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#legend line 1 explains the squares and the regulation-only rule; line 2 states the denominator and the minimum for the situation"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#the amber footnote lists every window game without a shift chart and says they are left out"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#with every game charted there is no amber footnote"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty cases replace the table with the documented message (no chart, no situation time, below the listing minimum) and keep the tabs; the view-model reports the reason with the documented precedence and lists the no-chart dates"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/linemates.test.ts#emptyReason precedence is no-chart, then no-situation-time, then below-minimum"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#noChartDates lists the dates of window games without a shift chart, oldest first"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#when no game has a shift chart the panel says so, shows no table or legend and keeps the tabs"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a situation with no time says so in words, keeps the tabs and still flags a game without a chart"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#when nobody meets the minimum the panel says so with the minimum for the situation"
        status: pass
    human_judgment: false
  - id: D6
    description: "Overall look of the panel: header stats beside the strip, tab styling, legend readability and amber footnote in light and dark mode on a laptop browser"
    requirement: PLYR-02
    verification: []
    human_judgment: true
    rationale: "Visual adequacy of spacing, contrast and wording is a judgment call no test asserts; listed under Human checks for end-of-phase UAT."

duration: 25min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 05: Panel Controls Summary

**Player detail panel gains Avg TOI / TOI Δ / PP share / PP share Δ header stats with mover colours, URL-state EV/PP/SH tabs, intro and legend copy stating the regulation-only rule and share denominator, an amber missing-chart footnote, and view-model-driven empty-state messages**

## Performance

- **Duration:** 25 min (start time not recorded at launch; approximate)
- **Started:** 2026-10-12T19:17Z (approximate)
- **Completed:** 2026-10-12T19:42Z
- **Tasks:** 2 (both TDD; 4 task commits)
- **Files modified:** 4

## Accomplishments

- The view-model now says why a strip is empty (`emptyReason`: no-chart, then no-situation-time, then below-minimum) and which games lack a shift chart (`noChartDates`), plus `SITUATION_WORDS` for sentence copy. No-chart is judged over charted games the player dressed for, so unknown is never reported as zero time.
- The panel header shows the player's four deployment numbers using the trends table's formatters; a crossing Δ gets `font-medium` green or red plus sr-only "Moving up"/"Moving down" through the same `deltaCrossing` rule and Phase 1 thresholds. Unknown values show a muted dash; a 1-game window drops the two Δ items.
- EV/PP/SH tabs are `PendingLink`s with `scroll={false}`, built only by `researchHref` from validated values, with `aria-current="true"` on the active one and no `#player-detail` hash (T-02-10).
- Intro, legend line 1 (squares, shading, hollow/dashed/amber dashed, blue ring, regulation-only) and legend line 2 (window-share denominator "in the games they both played", ordering, and the listing minimum for the active situation: 2:00 EV, 0:30 PP/SH), plus an amber footnote listing formatted no-chart dates.
- Three empty-state messages replace the table (tabs stay), chosen from `view.emptyReason` and rendered only from the player's feed name, allowlisted situation words, formatted constants and formatted dates (T-02-11).

## Task Commits

TDD plan tasks, each with a RED then GREEN commit:

1. **Task 1: view-model empty reason and no-chart dates**
   - RED: `2b8eadb` (test)
   - GREEN: `6d51f2f` (feat)
2. **Task 2: header stats, tabs, legend, footnote, empty states**
   - RED: `f95d9ed` (test)
   - GREEN: `86230e8` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## RED evidence

Both RED runs used `npx tsx --test` (TAP-compatible Node runner). The plan is `type: execute` with per-task `tdd="true"`, so the plan-level `tdd-red-evidence` classifier gate was not required; the semantic assessment was done by hand.

- **Task 1 RED (`2b8eadb`):** 11 new tests failed, 23 existing passed. Failures were assertion failures on the planned behaviour (`actual: undefined` against the expected `emptyReason` / `noChartDates` / `SITUATION_WORDS` values), not load, syntax or fixture faults.
- **Task 2 RED (`f95d9ed`):** 14 new tests failed, 14 existing passed. Failures were assertion failures because the planned elements did not exist yet (no `<dl>`, no Situation nav, no intro or legend paragraphs, table still rendered for empty cases). Some failed as `undefined` property reads on helper results (for example the footnote and tab helpers returning empty arrays), which is the same absence of the planned markup, not a harness fault.

## Files Created/Modified

- `lib/research/linemates.ts` - `SITUATION_WORDS`, `LinemateEmptyReason`, `LinemateView.emptyReason` / `noChartDates`, private `emptyReason()` helper
- `lib/research/linemates.test.ts` - 11 cases for words, reason precedence, dressed-games judgement and no-chart dates
- `components/PlayerLinemates.tsx` - `HeaderStat`, header `dl`, Situation `nav`, intro, empty-state message, legend and amber footnote
- `lib/research/player-detail-view.test.ts` - header, tab, intro, legend, footnote and empty-state cases with new fixtures (`headerGames`, `unknownPpGames`) and helpers (`stats`, `tabLinks`, `footnotes`)

## Decisions Made

See `key-decisions` above. The first two follow the plan's Flagged Assumptions; the last two are small choices where the plan was silent (what shows alongside each empty reason).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing close-link test asserted every href in the panel**
- **Found during:** Task 2 (GREEN)
- **Issue:** `the close link keeps the team, games and situation in the panel and in the notice` compared all `href`s in the panel to a single expected URL. The new Situation tabs add three legitimate links, which would make that assertion fail for the wrong reason.
- **Fix:** The helper strips the `<nav>` block before collecting hrefs, so the test still asserts exactly the close link. The tabs' hrefs have their own test.
- **Files modified:** `lib/research/player-detail-view.test.ts` (changed in the Task 2 RED commit `f95d9ed`)
- **Verification:** all 28 tests in the file pass.

**2. [Rule 1 - Bug] Test fixture for the PP below-minimum case was exactly at the minimum**
- **Found during:** Task 2 (GREEN)
- **Issue:** The PP fixture shared 10 s a game over 3 games = 30 s, which meets the inclusive 0:30 minimum, so a linemate was listed and the empty message correctly did not show.
- **Fix:** Fixture now shares 9 s a game (27 s).
- **Files modified:** `lib/research/player-detail-view.test.ts` (in the GREEN commit `86230e8`)
- **Verification:** test passes; the component logic was not changed.

---

**Total deviations:** 2 auto-fixed (both test-only bugs, Rule 1)
**Impact on plan:** No production-code deviation. No scope creep.

## Issues Encountered

None.

## Known Stubs

None. Every value shown comes from the selected player's `TrendRow` or the linemate view-model.

## Threat Flags

None. No new endpoints, auth paths, file access or schema changes; T-02-10 (tab hrefs from `researchHref` only, exact hrefs and no hash asserted) and T-02-11 (copy interpolates only the feed name, allowlisted words, formatted constants and dates) are implemented as planned.

## Human checks (end-of-phase, `human_verify_mode: end-of-phase`)

Not blocking; for UAT or plan 02-07's browser backstop on a laptop browser:

1. Clicking EV, PP and SH tabs changes the strip without scrolling the page (`scroll={false}`; not observable in server markup).
2. Header stats, tab strip, intro and legend look right in light and dark mode; the amber footnote is readable.
3. The mover colours on the header Δ match the colours of the same player's row in the trends table.

## Verification

- `npx tsx --test lib/research/linemates.test.ts lib/research/player-detail-view.test.ts`: 62 pass, 0 fail (28 in the view test file, above the 16 required)
- `npm test`: 288 pass, 0 fail
- `npx tsc --noEmit`: exit 0
- `npm run build`: exit 0
- `npx eslint app/research lib/research lib/nhl components`: exit 0
- Acceptance greps all pass; `grep -c "use client" components/PlayerLinemates.tsx` is 0.
- Auth-gate lines in `app/research/page.tsx` untouched (file not modified).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 02-06 (tags, cap, show-all line, legend line 3) and 02-07 (browser backstop, including the tab scroll check). 02-06 adds to the same footnote block and table; the footnote block already hides itself when it has nothing to show, so it can append its own paragraphs inside the existing `!view.emptyReason` branch.

---
*Phase: 02-player-linemate-detail*
*Completed: 2026-10-12*

## Self-Check: PASSED

- Files modified exist: `lib/research/linemates.ts`, `lib/research/linemates.test.ts`, `components/PlayerLinemates.tsx`, `lib/research/player-detail-view.test.ts`
- Commits present on the branch: `2b8eadb`, `6d51f2f`, `f95d9ed`, `86230e8`
