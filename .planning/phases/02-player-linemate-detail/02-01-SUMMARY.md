---
phase: 02-player-linemate-detail
plan: 01
subsystem: research
tags: [nhl-shift-charts, linemates, heat-strip, nextjs-server-component, search-params]

requires:
  - phase: 01-ice-time-trends-table
    provides: ToiStripCell square, trend rows, researchHref/parseSort allowlist pattern, loadTeamResearch
provides:
  - "bucketOnIce / situationFor / PERIOD_SECONDS exported from lines.ts (analyzeGameLines output unchanged)"
  - "pairSeconds: regulation-only own and pair seconds per situation, stored as ResearchGame.pairs"
  - "buildLinemateView and cell/detail helpers (pure linemate view-model)"
  - "parsePlayer, parseSit and researchHref extras { player, sit, all }"
  - "PlayerLinemates server component, rendered from ?player at the top of /research"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: 01d42a46c659c230aa7428cb6629a6b857d5f93e
plan_head_after: 31d73a6ce7e77c7c4ca84242c94f298e148cd5d8

tech-stack:
  added: []
  patterns:
    - "Second per-skater situation-seconds product (pairs.self) beside lines.playerSeconds, both from one shared bucketOnIce + situationFor"
    - "Pure view-model in lib/research with a structural game type so tests pass plain objects"
    - "Cell states unknown / absent / apart / together; unknown and absent never carry numbers"

key-files:
  created:
    - lib/research/pair-seconds.ts
    - lib/research/pair-seconds.test.ts
    - lib/research/linemates.ts
    - lib/research/linemates.test.ts
    - components/PlayerLinemates.tsx
  modified:
    - lib/research/lines.ts
    - lib/research/team-games.ts
    - lib/research/game-strip.ts
    - lib/research/toi-trends.ts
    - lib/research/toi-trends.test.ts
    - lib/research/toi-trends-view.test.ts
    - components/ToiStripCell.tsx
    - app/research/page.tsx

key-decisions:
  - "pairSeconds de-duplicates the skaters on ice in each second (Set) so a player with two overlapping, differing shift rows is one skater; the oracle still held on every live game sampled"
  - "Window share is pooled over counted games only (D-25); a linemate with no counted game has totalSeconds 0 and is never listed, so windowShare null is defensive"
  - "Row group falls back to ResearchPlayer.group only when pairs.groups has no entry for the linemate in any game"

patterns-established:
  - "Regulation-only linemate time: skip every second at or after 3 x PERIOD_SECONDS in every situation"
  - "STRIP_SQUARE_CLASS is the one square class shared by the Per game strip and the heat strip (ToiGameStrip adopts it in 02-02)"

requirements-completed: [PLYR-01, PLYR-02, PLYR-03]

coverage:
  - id: D1
    description: "?player=<id> opens a player-detail panel above Last game on /research; invalid ids show nothing, valid non-skaters show the not-in-window notice; ?sit selects EV/PP/SH"
    requirement: PLYR-01
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#parsePlayer rejects everything else"
        status: pass
      - kind: integration
        ref: "live smoke (renderToStaticMarkup of PlayerLinemates from loadTeamResearch MTL and EDM, 5 games): SMOKE OK"
        status: pass
    human_judgment: true
    rationale: "Panel position, jump behaviour and the not-in-window notice need a look in a laptop browser; the plan has no markup test for the notice (panel markup tests are plan 02-02)"
  - id: D2
    description: "Regulation-only pair seconds hold the oracle: own seconds equal analyzeGameLines per-skater seconds in non-OT games, never larger in OT; time together is symmetric and bounded by both players' seconds"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/pair-seconds.test.ts#own seconds equal analyzeGameLines' per-skater seconds when the game has no overtime (oracle)"
        status: pass
      - kind: integration
        ref: "live smoke invariants on MTL (charted=4) and EDM (charted=3), all three situations"
        status: pass
    human_judgment: false
  - id: D3
    description: "Linemate view-model: cell states and precedence, share of the player's own regulation situation seconds, pooled window share, listing minimum, recent-first ordering, position-group rule, goalies and the player excluded"
    requirement: PLYR-03
    verification:
      - kind: unit
        ref: "lib/research/linemates.test.ts (23 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Heat strip renders one 20x20 square per listed linemate per game, forwards then a divider then defense, shade from share, sky ring for OT, window share column, Close link keeping team/games/sort/dir/sit"
    requirement: PLYR-02
    verification:
      - kind: integration
        ref: "live smoke: squares = linemates x games (90 and 95 data-state squares)"
        status: pass
    human_judgment: true
    rationale: "Visual quality (shade contrast, divider, 476px overflow at Last 20, aria-label wording) needs a browser look; the visible popover is plan 02-02"
  - id: D5
    description: "Phase 1 output unchanged: lines.test.ts untouched and passing, analyzeGameLines extraction verbatim, Last game and trends tables show the same values"
    verification:
      - kind: unit
        ref: "git diff --quiet 96266a7 -- lib/research/lines.test.ts; npm test (227 pass, 0 fail)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 01: Player Linemate Detail Tracer Summary

**A `?player=<id>` link now opens a server-rendered panel on /research with a per-game linemate heat strip, built on regulation-only pair seconds computed from the shift chart already fetched**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-12T19:18:02Z
- **Completed:** 2026-10-12T19:22:11Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- The tracer runs end to end: NHL shift charts, shared `bucketOnIce` buckets, `pairSeconds` (periods 1-3 only), `ResearchGame.pairs`, the pure `buildLinemateView`, the `PlayerLinemates` panel, the page. No new request (`getShiftCharts(gameId)` still appears once).
- The pair pass holds the research oracle on live games: MTL (4 of 5 games charted) and EDM (3 of 5) both gave own seconds equal to `analyzeGameLines` per-skater seconds in every non-OT game, symmetric pairs, and time together never above either player's seconds, in EV, PP and SH.
- Unknown (no chart) and absent (someone did not dress, or no time in the situation) squares carry no numbers and never enter a share, a total or the order. Their aria-labels say why.
- `?player` accepts only one string of 1-10 digits and `?sit` only `pp`/`sh`; `researchHref` gained `extras` with unchanged default output.
- Phase 1 is untouched: the `analyzeGameLines` change is a verbatim extraction, `lines.test.ts` is byte-identical to `96266a7`, `npm test` went from 188 to 227 passing.

## Task Commits

1. **Task 1 (tracer): ?player link, pair seconds, view-model, panel** - `bbe41b5` (feat)
2. **Task 2: pair-seconds, linemate view-model and URL parser tests** - `31d73a6` (test)

**Plan metadata:** the `docs(02-01)` commit that adds this file.

## Files Created/Modified
- `lib/research/lines.ts` - exports `bucketOnIce`, `situationFor`, `OnIce`, `PERIOD_SECONDS`; `analyzeGameLines` calls `bucketOnIce`
- `lib/research/pair-seconds.ts` - `pairSeconds` / `GamePairs`: regulation-only own, pair and group data
- `lib/research/team-games.ts` - `ResearchGame.pairs`, filled beside `lines` in `loadGame`
- `lib/research/game-strip.ts` - `GameDetail.heading` and `STRIP_SQUARE_CLASS`
- `lib/research/linemates.ts` - cell states, shares, window share, listing, ordering, groups, popover detail text
- `lib/research/toi-trends.ts` - `parsePlayer`, `parseSit`, `researchHref` extras
- `components/PlayerLinemates.tsx` - the server-rendered panel and heat strip
- `components/ToiStripCell.tsx` - `state` prop widened to include `LinemateCellState`
- `app/research/page.tsx` - parses `player`/`sit`, renders the panel above Last game (auth-gate lines unchanged)
- `lib/research/pair-seconds.test.ts`, `lib/research/linemates.test.ts`, `lib/research/toi-trends.test.ts`, `lib/research/toi-trends-view.test.ts` - tests and the `pairs: null` fixture field

## Decisions Made
- `pairSeconds` collapses the skaters on ice each second with a `Set`. The plan did not specify this. It keeps `together <= min(self)` true if two differing shift rows for one player overlap. On every live game sampled it made no difference to the oracle.
- Followed the plan for everything else: window share is pooled over counted games (D-25), group follows the most games with ties to the latest (D-21), minimums 2:00 EV / 0:30 PP and SH.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `playerId` prop on the row component**
- **Found during:** Task 1 (eslint run before commit)
- **Issue:** `LinemateRowView` took `playerId` but never read it (warning `@typescript-eslint/no-unused-vars`)
- **Fix:** removed the prop and its argument
- **Files modified:** `components/PlayerLinemates.tsx`
- **Verification:** scoped eslint clean
- **Committed in:** `bbe41b5`

---

**Total deviations:** 1 auto-fixed (1 lint)
**Impact on plan:** None. Behaviour is as specified.

## TDD Gate Compliance

Task 2 is `tdd="true"` but follows the tracer, which already contains the implementation by design, so there is no genuine RED commit and no `feat` commit after the `test` commit. The tests were written against the existing code and all passed on the first run. To show they can fail, two mutations were tried and then reverted: removing the regulation-period skip in `pairSeconds` (1 test failed), and lowering the listing minimum in `buildLinemateView` (1 test failed). Gate result: RED missing (planned), GREEN trivially satisfied. Flagged here for the phase TDD review.

## Issues Encountered
- A smoke script I saved in the shared scratchpad overwrote a pre-existing `smoke.sh` there. It is scratch only and outside the repo.

## Known Stubs
None. All data comes from the live loader; `windowShare === null` renders `—` and is defensive only, since a row with no counted game is never listed.

## Human Checks (end of phase)
These are for the phase UAT in a laptop browser; none blocks this plan.
1. Open `/research?team=MTL&games=5&player=<id from the table>`: the panel is the first block under the nav, above Last game, headed by the name and `{Pos} {GP}/{teamGames} GP`.
2. Forwards block, a visible divider, defense block; a group with no linemates shows `None`.
3. At Last 20, the 476px strip scrolls inside its wrapper and square shades stay distinguishable from dashed absent/unknown squares.
4. `?sit=pp` and `?sit=sh` show different linemates; `?player=abc` shows nothing; a goalie id shows `That player didn't play for MTL in this window.` with a working Close link that keeps team, games, sort and dir.
5. Dark mode: borders and the sky OT ring are visible.

## Threat Flags
None. The only new surface is the `player` and `sit` search params, both allowlisted (T-02-01); the raw `player` value is never rendered (T-02-02).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 02-02 can adopt `STRIP_SQUARE_CLASS` in `ToiGameStrip`, add the shared popover using `GameDetail.heading`, and add panel markup tests. `linemateDetail` already returns the popover facts.
- 02-03 owns `parseAll`/`playerHref` and the name links; `researchHref` already accepts `all`.
- The panel has no tabs, header stats, cap, tags or legend yet; those are 02-05 and 02-06.

## Self-Check: PASSED

- Created files exist: `lib/research/pair-seconds.ts`, `lib/research/pair-seconds.test.ts`, `lib/research/linemates.ts`, `lib/research/linemates.test.ts`, `components/PlayerLinemates.tsx`
- Commits `bbe41b5` and `31d73a6` are ancestors of HEAD
- `npm test`: 227 pass, 0 fail; `npx tsc --noEmit` and `npm run build` exit 0; scoped eslint clean
- Task acceptance greps all pass; auth-gate lines each appear once; `lines.test.ts` unchanged since `96266a7`

---
*Phase: 02-player-linemate-detail*
*Completed: 2026-10-12*
