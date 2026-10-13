---
phase: 02-player-linemate-detail
verified: 2026-10-13T01:10:17Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/02-player-linemate-detail/02-01-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-01-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-02-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-02-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-03-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-03-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-04-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-04-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-05-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-05-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-06-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-06-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-07-PLAN.md
  - .planning/phases/02-player-linemate-detail/02-07-SUMMARY.md
  - .planning/phases/02-player-linemate-detail/02-CONTEXT.md
  - .planning/phases/02-player-linemate-detail/02-REVIEW-DISPOSITION.md
  - .planning/phases/02-player-linemate-detail/02-UAT.md
  - .planning/phases/02-player-linemate-detail/02-UI-SPEC.md
  - .planning/phases/02-player-linemate-detail/webkit-player-check.cjs
  - app/research/page.tsx
  - components/LastGameLines.tsx
  - components/PlayerLinemates.tsx
  - components/PlayerLink.tsx
  - components/StripPopover.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/game-strip.ts
  - lib/research/linemates.test.ts
  - lib/research/linemates.ts
  - lib/research/lines.ts
  - lib/research/pair-seconds.test.ts
  - lib/research/pair-seconds.ts
  - lib/research/player-detail-view.test.ts
  - lib/research/player-links-view.test.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.test.ts
  - lib/research/toi-trends.ts
covered_digest: v3:sha256:30b05d15beff059109e21d517a654248a5464aabda601a74b3d2fbe97e0eb1da
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "SC1: the URL carries ?player=<id>, so reload, back/forward and a shared link all show the same player (behavior confirmed by 02-UAT.md test 1, pass)"
    - "W-03 ordering decision: resolved by user decision D-28 (window-share order); implemented in ad603e9"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Player Linemate Detail Verification Report

**Phase Goal:** User can open any player from the research page and see who that player has been on ice with, game by game and by situation, so a change in linemates is obvious.
**Verified:** 2026-10-13T01:10:17Z
**Status:** passed
**Re-verification:** Yes, after human UAT (02-UAT.md, 5/5 pass) and the D-28 ordering fix (ad603e9)

The roadmap marks this phase `mode: mvp`, but the goal is not in "As a ..., I want to ..., so that ..." form. As in the initial report and Phase 1, this report verifies the goal backward from the 5 roadmap success criteria and keeps the User Flow Coverage table.

## What changed since the initial report (2026-10-12T20:12:03Z)

| Commit | Files | Effect |
|--------|-------|--------|
| `ad603e9` fix(02): order linemates by window share | `lib/research/linemates.ts`, `lib/research/linemates.test.ts` | The `recentSeconds` field and its accumulation are removed. The sort is now `windowShare` desc (null as 0), then `totalSeconds` desc, then id. Tag logic, the minimum, the cap and the D-26 tagged-row bypass are unchanged. The tests are updated: "rows order by window share, even when a newer linemate has more recent time (W-03)", "equal window share orders by window total, then by id", and the line-change tests at 2/3/5 games now assert tags by id, not by position. |
| `f870040` docs(02): UAT complete, record D-28 | `02-UAT.md`, `02-CONTEXT.md` (D-28), `02-UI-SPEC.md:163`, `02-REVIEW-DISPOSITION.md` (W-03 fixed) | Decision record only |

`grep -rn recentSeconds lib components app` finds no matches, so no consumer depended on the removed field. `git status` shows no uncommitted changes in `lib/`, `components/` or `app/`.

## User Flow Coverage

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open a player | A name in the trends table or a Last game unit table opens `?player=<id>#player-detail` | `PlayerLink.tsx` via `playerHref`; `player-links-view.test.ts`; 02-UAT.md test 1 pass | ✓ |
| See the panel | Server-rendered panel first under the nav | `app/research/page.tsx` renders `PlayerLinemates` from `parsePlayer`; UAT test 1 | ✓ |
| Game by game | One square per team game per linemate | `LinemateRowView` maps `research.games`; tests; UAT test 3 | ✓ |
| By situation | EV/PP/SH tabs in the URL | `parseSit`; Situation nav; UAT tests 1 and 3 | ✓ |
| Outcome: change is obvious | New/Rising/Fading/Out tags from time together | `linemateTag`; SC4 tests at 2/3/5 games; UAT test 2 pass (D-28: the New chip signals the change) | ✓ |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a player row in the trends table, or a player name in any last-game unit table, opens that player's detail section; the URL carries `?player=<id>`, so reload, back/forward and a shared link all show the same player | ✓ VERIFIED | Server side: `parsePlayer`, panel rendered from the URL, every name a `PlayerLink` built by `playerHref` (tests in `player-links-view.test.ts`, `toi-trends.test.ts`). Browser behaviour: 02-UAT.md test 1 (Navigation and URL state: trends click, PP unit click opens the PP tab, Back/Forward, reload, new tab, re-click) is `result: pass`. Per locked D-02, the name is the link, not the whole row. |
| 2 | Player detail shows a linemate heat strip (rows are linemates, columns are the games in the window, shade is time together as a share of the player's own situation TOI, minutes on click) with separate EV, PP and SH views and forward linemates listed apart from defense partners | ✓ VERIFIED | Unchanged code paths since the initial report (`linemateCell`, `linemateOpacity`, `StripPopover`, `parseSit`, Forwards then Defense `tbody`). Tests pass. 02-UAT.md test 3 (look, popover, tabs, light/dark, Last 20 clipping) passes. |
| 3 | Each linemate's time together is also shown as a share of the player's own TOI in that situation, so a regular linemate is distinguishable from an occasional one | ✓ VERIFIED | `windowShare` = pooled together / pooled self over counted games, shown in the "Window share" column. Under D-28 it also sets row order, so regular linemates sit at the top. Tests: "window share pools only counted games...", "rows order by window share..." pass. |
| 4 | Linemates are tagged New, Rising or Fading from time together alone (no quality scoring); a forward moved to a new line in the latest game shows the new linemates as New and the old ones as Fading | ✓ VERIFIED | `linemateTag` is unchanged by ad603e9 and reads only pooled time-together shares (±15 points, New below 10, Out when the linemate did not dress). Tagged rows still bypass the cap (D-26), so a New linemate with a low window share is never dropped. The named tests pass on their own run: "line change in a 2/3/5-game window: the new linemates are New, the old ones Fading" and "old linemates who did not dress ... are Out". 02-UAT.md test 2 passes on real data, and ±15 is kept. |
| 5 | Games whose shift chart is missing show as unknown ("—" or blank) in the heat strip, never 0, and do not count toward shares or tags; the existing last-game unit tables still show the same TOI and share values as before this phase | ✓ VERIFIED | `pairs: null` gives `unknown` cells with null seconds and share. The window share, the minimum and the tag shares skip null cells (the removed `recentSeconds` was the only other accumulator). The unit-table code is unchanged (`lines.ts` extraction is verbatim; `LastGameLines.tsx` formatting is the same). Tests pass. 02-UAT.md test 4 (MTL no-chart game: amber dashed column, no 0, unit tables keep Time and %) passes. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Plan must-haves (02-01 .. 02-07)

- **02-06 "SC4: ... his new linemates are listed first and tagged New ..."**: user decision D-28 supersedes the "listed first" clause. D-28 (02-CONTEXT.md:58) says it "supersedes D-12 ordering": rows order by window share, and "the New tag, not row position, signals a line change". The user approved this in 02-UAT.md test 2. The roadmap SC4 wording does not require row position, and its tag clauses are VERIFIED above. This is a recorded scope change, not a gap. `02-UI-SPEC.md:163` and the code match D-28.
- **02-07 backstop truths** (popover not clipped at Last 20, name click scrolls and Back returns, squares read as separate in light/dark, dark-mode shades and selected-row bar, SC1 in a real browser): the initial report abstained on these for lack of directly observed evidence. The user's direct observation in 02-UAT.md tests 1 and 3 (both pass) now supplies it. The WebKit scripts were not re-run (per instructions).
- **Prohibitions:** the two test-tier prohibitions (no-chart/absent never 0 or counted; such games never in a tag's shares, missing linemate is Out) have wired, passing tests. The judgment-tier prohibition (no quality judgment, neutral chips) was resolved by a human in 02-UAT.md test 5 (pass).

### Required Artifacts

All 26 plan artifacts from the initial report are unchanged except `lib/research/linemates.ts`, which still exists and is substantive (`buildLinemateView`, `linemateTag`, `linemateCell`) and is used by `PlayerLinemates.tsx`. There was no regression.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/research/linemates.ts` | Pure view-model (states, shares, order, tags, cap) | ✓ VERIFIED | The order is now window share (D-28); called from `PlayerLinemates.tsx` |
| `lib/research/linemates.test.ts` | Order, tag, share, cap tests | ✓ VERIFIED | Ordering tests rewritten for D-28; tag tests are order-independent |
| Other phase artifacts (`pair-seconds.ts`, `lines.ts`, `team-games.ts`, `toi-trends.ts`, `PlayerLinemates.tsx`, `PlayerLink.tsx`, `LastGameLines.tsx`, `StripPopover.tsx`, `ToiStripCell.tsx`, `webkit-player-check.cjs`) | as in the initial report | ✓ VERIFIED | Not modified since the initial verification |

### Key Link Verification

The links are unchanged from the initial report (18/18). `PlayerLinemates.tsx` still calls `buildLinemateView(games, research.players, playerId, sit, { all })`, and the change in ad603e9 is internal to that function.

### Data-Flow Trace (Level 4)

These are unchanged. The heat strip, header stats and unit-table names all come from live NHL shift charts through `loadGame` (✓ FLOWING).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `npm test` | 326 pass, 0 fail, 0 skipped | ✓ PASS |
| Types | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint (scoped) | `npx eslint lib/research components/PlayerLinemates.tsx` | exit 0, no output | ✓ PASS |
| D-28 order and SC4 tags | `npx tsx --test --test-name-pattern="window share\|line change" lib/research/linemates.test.ts` | 8 pass, 0 fail | ✓ PASS |
| Browser navigation, visuals, no-chart, neutral chips | 02-UAT.md tests 1-5 | 5 pass, 0 issues | ✓ PASS (human) |
| WebKit backstop | not run (per instructions) | covered by UAT | ? SKIP |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no plan declares one, so this step does not apply.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLYR-01 | 02-01, 02-03, 02-07 | Click a player to open detail; `?player=<id>` survives reload and sharing | ✓ SATISFIED | SC1; 02-UAT.md test 1 pass |
| PLYR-02 | 02-01, 02-02, 02-04..07 | Heat strip split by EV/PP/SH and F vs D | ✓ SATISFIED | SC2; 02-UAT.md test 3 pass |
| PLYR-03 | 02-01, 02-02, 02-05 | Time together as a share of the player's own situation TOI | ✓ SATISFIED | SC3; window share column and popover share |
| PLYR-04 | 02-06, 02-07 | New / Rising / Fading from time together only | ✓ SATISFIED | SC4 tests; 02-UAT.md tests 2 and 5 pass |
| UNIT-04 | 02-03, 02-07 | Click a name in a unit table to open the player | ✓ SATISFIED | `LastGameLines.tsx` `PlayerLink`; 02-UAT.md test 1 (PP unit name opens the PP tab) pass |

There are no orphaned requirements. REQUIREMENTS.md maps exactly PLYR-01..04 and UNIT-04 to Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/research/linemates.ts`, `linemates.test.ts` | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `lib/research/pair-seconds.ts` | 41-45 | WR-01: strength classified from the un-deduplicated skater list | ⚠️ Warning (open) | Rare overlapping shift rows only; matches `analyzeGameLines`, so SC5 holds |
| `components/PlayerLinemates.tsx` | 99 | WR-02: `no-earlier-data` footnote can state a false cause | ⚠️ Warning (open) | Copy only; tags are correctly withheld |
| `lib/research/linemates.ts` | 168 | JSDoc says "highest window share first (D-12, D-13)" and should cite D-28 | ℹ️ Info | Comment only |

### Open warnings (do not block any success criterion)

- **WR-01 (open):** `pairSeconds` classifies strength before it de-duplicates skaters. Both passes share the same behaviour, so the Last game tables are unchanged. To fix it, dedupe in both passes together and add an overlapping-rows test.
- **WR-02 (open):** the `no-earlier-data` footnote wording is wrong when earlier games exist but have no chart or no time in the situation. This is a one-line copy fix.
- **W-03:** closed. The user chose window-share ordering (D-28), it was implemented in ad603e9, and 02-REVIEW-DISPOSITION.md records it as fixed.

IN-01..IN-05 (from the review) are still open and are info level only.

## Human Verification Required

None outstanding. All five human checks in the initial report are recorded as `result: pass` in 02-UAT.md (status: complete, 5/5, 0 issues).

## Gaps Summary

There are no gaps. All 5 roadmap success criteria and PLYR-01..04 and UNIT-04 are satisfied:
- SC2 to SC5 are backed by passing tests.
- SC1 and the browser, visual and judgment checks are confirmed by the user's UAT.
- The W-03 ordering finding is closed by user decision D-28. That decision supersedes the 02-06 "listed first" clause, and ad603e9 implements it with tests.
- `npm test` (326/326), `tsc` and the scoped eslint are green.

WR-01 and WR-02 remain open warnings and do not block.

---

_Verified: 2026-10-13T01:10:17Z_
_Verifier: Claude (gsd-verifier)_
