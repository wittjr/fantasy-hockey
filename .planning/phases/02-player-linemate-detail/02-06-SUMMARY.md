---
phase: 02-player-linemate-detail
plan: 06
subsystem: research
tags: [react-server-component, tailwind, tdd, a11y, view-model, linemate-tags]

requires:
  - phase: 02-player-linemate-detail
    provides: "buildLinemateView, LinemateView, recentStart, LINEMATE_MIN_SECONDS (02-01); PlayerLinemates panel, tabs, legend lines 1-2, amber footnote and empty states (02-02, 02-05); parseAll and the all param on the page (02-03)"
provides:
  - "LINEMATE_CAPS, LINEMATE_TAG_POINTS (15), LINEMATE_NEW_EARLIER_MAX_POINTS (10), types LinemateTag and LinemateTagsUnavailable in lib/research/linemates.ts"
  - "LinemateRow.tag and LinemateView.tags / total / cappedCount; buildLinemateView 5th argument { all }"
  - "Tag column with neutral New/Rising/Fading/Out chips, legend line 3, 1-game note, per-reason tag notes and the Show all / Show fewer line in PlayerLinemates"
  - "all passed from app/research/page.tsx to the panel"
affects: [02-07]

actuals:
  tokens: 11300
  tasks: 2
  commits: 4
plan_head_before: c68cbe90e09a0a300db1e424944d0f81e91a4fb0
plan_head_after: c92138f0a10f291de376125328c43a38b1b2ba4e

tech-stack:
  added: []
  patterns:
    - "Tag availability is a view-model fact (tags.available / reason / dressedGames); the component only maps a reason to a footnote"
    - "The +/-15 test reuses deltaCrossing on rounded pooled shares so a tag always agrees with the displayed percentages"
    - "The cap keeps a row when its index is under the per-group cap or its tag is not null; cappedCount is reported even when all lifts the cap, so the show-all line can say 'Showing all'"

key-files:
  created: []
  modified:
    - lib/research/linemates.ts
    - lib/research/linemates.test.ts
    - components/PlayerLinemates.tsx
    - lib/research/player-detail-view.test.ts
    - app/research/page.tsx

key-decisions:
  - "Tags are neutral chips (New is the only solid one); no green or red, and nothing but time together enters the tag rules"
  - "Out is decided from game.toi alone (dressed in none of the recent-part games), so a linemate with no chart is still Out; a linemate who dressed recently but has no counted recent game gets no tag"
  - "A linemate with no counted earlier game compares against an earlier share of 0, so a newcomer or returning player with 15+ recent points is New"
  - "cappedCount stays the capped count when all=1, so 'Showing all {total}' and 'Show fewer' appear exactly when something would otherwise be hidden"
  - "Tag notes and the 1-game note render only with the table (not with an empty-state message) and are not amber"

patterns-established:
  - "Footnote block order: legend lines 1-3, then the amber no-chart note, then the 1-game note or the single tag note"

requirements-completed: [PLYR-04, PLYR-02]

coverage:
  - id: D1
    description: "Each linemate row is tagged New, Rising, Fading or Out from counted time together only; a forward who moves to a new line shows the new linemates as New above the old ones as Fading (or Out when they did not dress), at windows of 2, 3 and 5 games"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "lib/research/linemates.test.ts#line change in a 2-game window: the new linemates are New and listed first, the old ones Fading"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#line change in a 3-game window: the new linemates are New and listed first, the old ones Fading"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#line change in a 5-game window: the new linemates are New and listed first, the old ones Fading"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#line change: old linemates who did not dress in the recent games are Out, not Fading"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#the SC4 line change lists the New linemate above the Fading one in the forwards block"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tag thresholds on rounded shares (15 points, New below a 10-point earlier share), newcomer and returning-player handling, and games without a chart or a dressed player never counting"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "lib/research/linemates.test.ts#boundary on rounded shares: 40 against 25 is Rising, 39 against 25 is no tag, 10 against 25 is Fading"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#the 15-point test uses the rounded shares: 40.4 against 25.5 rounds to 40 against 26 and gets no tag"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#a 15-point rise from a rounded earlier share of 9 is New, from 10 it is Rising"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#a linemate with no counted earlier game and a 30% recent share is New, and his absent earlier game is not in the window share"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#games without a shift chart, or where a player missed, never count toward a tag's shares"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tags are unavailable, with a footnote naming the reason, for a 1-game window, a player who dressed in under 2 games, who missed every recent game, with no recent charted time, or no earlier data; the Tag column is absent in a 1-game window"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "lib/research/linemates.test.ts#tag availability: a 1-game window has no tags"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#tag availability: dressed only in the 2 recent games of 5 is no-earlier-data"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#with 3 or more games the table has a Tag column and the group rows span 4 columns; with 1 game neither"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a player who dressed in 1 game gets no tags and a note saying so"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a recent game without a shift chart explains why there are no tags, with 'latest game' in a 2-game window"
        status: pass
    human_judgment: false
  - id: D4
    description: "The list is capped at 6 forwards and 4 defense at EV and 4 and 3 at PP and SH, tagged rows always shown past the cap, Show all (all=1) lifts the cap but never the minimum, Show fewer returns, tabs keep all=1 and Close drops it"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/linemates.test.ts#a tagged forward at position 8 is shown under the cap"
        status: pass
      - kind: unit
        ref: "lib/research/linemates.test.ts#all lifts the cap but never lists a linemate below the minimum"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a capped list says how many are shown and links to Show all with all=1 kept on the other params"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#with all=1 every tab keeps it and the close link drops it"
        status: pass
    human_judgment: false
  - id: D5
    description: "Tag chip markup: neutral fills and borders (no green or red), glyphs aria-hidden with the word carrying the meaning, titles from the UI-SPEC, empty cell for an untagged row, legend line 3 whenever the Tag column shows"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#tag chips: New is the one solid chip, Rising and Fading carry an aria-hidden glyph and the word, Out is dashed"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#legend line 3 appears whenever the Tag column does, and never in a 1-game window"
        status: pass
    human_judgment: false
  - id: D6
    description: "Whether a line change reads at a glance on real team data, whether +/-15 points feels noisy (D-27), and the visual quality of the chips, notes and show-all line in light and dark mode on a laptop browser"
    requirement: PLYR-04
    verification: []
    human_judgment: true
    rationale: "Readability at a glance and tag noise on real data are judgment calls no test asserts; owned by plan 02-07's browser backstop and the phase UAT."

duration: 20min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 06: Linemate Tags and List Cap Summary

**New/Rising/Fading/Out linemate tags from rounded pooled time-together shares (+/-15 points via deltaCrossing), five tags-unavailable reasons with footnotes, a per-situation list cap that never hides a tagged row, and Show all / Show fewer through the all=1 URL param**

## Performance

- **Duration:** about 20 min (start time not recorded at launch; approximate)
- **Started:** 2026-10-12T19:30Z (approximate)
- **Completed:** 2026-10-12T19:50Z
- **Tasks:** 2 (both TDD; 4 task commits)
- **Files modified:** 5

## Accomplishments

- `buildLinemateView` now tags every listed linemate. Out means he dressed in none of the recent-part games. Otherwise the rounded recent share is compared with the rounded earlier share through `deltaCrossing` at `LINEMATE_TAG_POINTS = 15`; a rise gives New when the earlier share is under `LINEMATE_NEW_EARLIER_MAX_POINTS = 10`, else Rising; a drop gives Fading. Only counted games enter either share.
- Tags are switched off, with a reason, for a 1-game window, a player who dressed in under 2 games, who missed every recent game, who has no charted situation time recently, or who has none earlier. The reason is a view-model field; the panel maps it to the UI-SPEC footnote.
- The list is capped per group and situation (6F/4D EV, 4F/3D PP and SH) and keeps every tagged row past the cap. `all=1` lifts the cap but not the listing minimum; `total` and `cappedCount` drive the "Showing n of total" line, "Show all {total}" and "Show fewer".
- The panel renders the Tag column (only when the window has 2 or more games), neutral chips (New solid, Rising/Fading with aria-hidden glyphs, Out dashed), legend line 3, the 1-game note and the tag note. Tabs keep `all=1`; the Close link drops it. The page passes `all` through.
- The SC4 line change (new linemates New and first, old linemates Fading or Out) is a passing test at windows of 2, 3 and 5 games, and also in the rendered panel.

## Task Commits

TDD plan tasks, each with a RED then GREEN commit:

1. **Task 1: tag rules, availability and the cap**
   - RED: `b5cb8bb` (test)
   - GREEN: `a28b398` (feat)
2. **Task 2: Tag column, chips, legend line 3, tag notes, show-all line**
   - RED: `ebe94ec` (test)
   - GREEN: `c92138f` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## RED evidence

The plan is `type: execute` with per-task `tdd="true"`, so the plan-level `tdd-red-evidence` classifier was not run (same as 02-05); semantic assessment by hand. Runner: `npx tsx --test` (TAP-compatible).

- **Task 1 RED (`b5cb8bb`):** 24 of 58 tests failed, 34 passed. Failures were `ERR_ASSERTION` on the planned behaviour (tags `undefined` against the expected `New`/`Fading`/`null`, `cappedCount`/`total` absent) or `TypeError` reading `.available`/`.reason` of the not-yet-existing `view.tags`. Those are the absence of the planned property, not load, syntax or fixture faults; the file loaded and every older test still passed.
- **Task 2 RED (`ebe94ec`):** 14 of 42 tests failed, 28 passed; all 14 `ERR_ASSERTION` (no Tag header, no chips, no Showing line, tab hrefs without `all=1`, no legend line 3, no tag notes, legend footnote count 2 instead of 3).

## Files Created/Modified

- `lib/research/linemates.ts` - cap and tag constants, tag types, `tagAvailability`, `pooledShare`, `linemateTag`, cap with tagged-row bypass, `options.all`
- `lib/research/linemates.test.ts` - 24 new cases (line change at 2/3/5 games, boundaries, New vs Rising, newcomer, availability reasons, caps)
- `components/PlayerLinemates.tsx` - `all` prop, Tag column and chips, show-all line, legend line 3, 1-game and tag notes
- `lib/research/player-detail-view.test.ts` - 14 new cases plus two existing assertions adjusted for the new column (see Deviations)
- `app/research/page.tsx` - passes `all={all}` to the panel (the three auth-gate lines are untouched, each still appears once)

## Decisions Made

See `key-decisions` above. All follow the plan's Flagged Assumptions and D-14..D-18, D-20, D-26, D-27; no new product decisions were needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing tests assumed the window share was the last cell and the legend had two lines**
- **Found during:** Task 2 (RED fixtures)
- **Issue:** Two older tests read `.at(-1)` for the Window share cell, and one asserted exactly 2 footnotes when every game is charted. The planned Tag column and legend line 3 change both.
- **Fix:** The share tests now read the third cell; the footnote count is 3 (legend lines 1-3).
- **Files modified:** `lib/research/player-detail-view.test.ts` (in the Task 2 RED commit `ebe94ec`)
- **Verification:** all 42 tests in the file pass.

**2. [Rule 1 - Bug] One new Task 1 fixture put the old linemates in a recent game**
- **Found during:** Task 1 (GREEN)
- **Issue:** In the "Out, not Fading" test, game 2 of a 3-game window (a recent game) still had linemates 10 and 11 dressed, so they correctly got no tag. The fixture, not the code, was wrong.
- **Fix:** Games 2 and 3 now have only the new linemate dressed.
- **Files modified:** `lib/research/linemates.test.ts` (in the GREEN commit `a28b398`)
- **Verification:** 58 of 58 pass.

---

**Total deviations:** 2 auto-fixed (both test-only, Rule 1)
**Impact on plan:** No production-code deviation, no scope creep.

## Issues Encountered

- The plan's "missed the team's latest game" wording (2-game window) cannot be reached for the missed-recent reason: a 2-game window where the player missed the latest game means he dressed in at most 1 game, so "played only 1 game" fires first. The wording is built from the same `recentGames` phrase as the no-recent-data note (which can fire in a 2-game window) so there is no extra branch; the 2-game test covers the no-recent-data note.
- `npm run lint` was not used (fails at baseline on untracked `.claude/` files); the scoped eslint command passes.

## Known Stubs

None. Every tag, count and note is derived from the games and players passed in.

## Threat Flags

None. T-02-12 (all only lifts the per-group cap; rows stay bounded by the team's skaters) and T-02-13 (the one-prop page edit leaves the three auth-gate lines byte-identical; each appears exactly once) are implemented as planned.

## Human checks (end-of-phase, `human_verify_mode: end-of-phase`)

Not blocking; for plan 02-07's browser backstop or the phase UAT, on a laptop browser:

1. On real data, a forward who changed lines shows his new linemates as New at the top and the old ones as Fading or Out (SC4 at a glance).
2. Whether +/-15 points feels noisy; D-27 says to raise `LINEMATE_TAG_POINTS` to 20 if so.
3. Chips (solid New, outlined Rising/Fading, dashed Out) are readable in light and dark mode and are not mistaken for good/bad signals.
4. Show all / Show fewer and the tab links keep the scroll position (`scroll={false}`; not visible in server markup).

## Verification

- `npx tsx --test lib/research/linemates.test.ts lib/research/player-detail-view.test.ts lib/research/player-links-view.test.ts`: all pass (58 and 42 in the first two files)
- `npm test`: 326 pass, 0 fail
- `npx tsc --noEmit`: exit 0
- `npm run build`: compiles, route table printed (`/research` dynamic)
- `npx eslint app/research lib/research lib/nhl components`: no output
- Acceptance greps all pass; `grep -c "use client" components/PlayerLinemates.tsx` is 0; the three auth-gate lines each appear once.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 02-07 (browser backstop and UAT). The panel and view-model are feature complete for tags, cap and show-all; remaining checks are the real-data and visual ones above.

---
*Phase: 02-player-linemate-detail*
*Completed: 2026-10-12*

## Self-Check: PASSED

- Files modified exist: `lib/research/linemates.ts`, `lib/research/linemates.test.ts`, `components/PlayerLinemates.tsx`, `lib/research/player-detail-view.test.ts`, `app/research/page.tsx`
- Commits present on the branch: `b5cb8bb`, `a28b398`, `ebe94ec`, `c92138f`
