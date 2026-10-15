---
phase: 02-player-linemate-detail
verified: 2026-10-14T23:10:00Z
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
  - .planning/phases/02-player-linemate-detail/webkit-player-check.cjs
  - app/research/page.tsx
  - components/LastGameLines.tsx
  - components/PlayerLinemates.tsx
  - components/PlayerLink.tsx
  - components/StripPopover.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/format.ts
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
covered_digest: "v3:sha256:088aa52810e7de77794f69048454614c38cce46aae300f177bff6f65a030b590"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-06: the unknown-value dash in PlayerLinemates (HeaderStat dd, line 308; Window share cell, line 367) and in LastGameLines (lines 104, 165) still uses text-neutral-400, which is low contrast; quick task 1a68924 fixed only the ToiTrends dashes"
    category: other
    reason: "Contrast polish only. The dash still renders and means 'unknown'; no success criterion depends on its colour. Fix by using text-neutral-600 dark:text-neutral-400 and a markup test."
    evidence_status: "02-REVIEW.md WR-06; confirmed in current source"
---

# Phase 2: Player Linemate Detail Verification Report

**Phase Goal:** User can open any player from the research page and see who that player has been on ice with, game by game and by situation, so a change in linemates is obvious.
**Verified:** 2026-10-14T23:10:00Z
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-13, passed 5/5) went stale because covered source files changed afterwards: phase 03 work (unit event columns in `LastGameLines.tsx`, the shared `lines.ts`), the phase-02 review fixes, and quick task 1a68924 (contrast and copy in `PlayerLinemates.tsx`, `ToiTrends.tsx`, `format.ts`, `game-strip.ts`). Every truth was re-checked against the current source, not carried forward.

The roadmap marks this phase `mode: mvp`, but the goal is not in "As a ..., I want to ..., so that ..." form. As in the earlier reports, the goal is verified backward from the 5 roadmap success criteria, with a User Flow Coverage table.

## User Flow Coverage

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open a player | A name in the trends table or a Last game unit table opens `?player=<id>#player-detail` | `PlayerLink.tsx` builds `playerHref(...)` (`toi-trends.ts:217`); used in `ToiTrends.tsx:95` and `LastGameLines.tsx:~150`; WebKit N2, N3, N8 | ✓ |
| See the panel | Panel renders first, under the nav, from the URL | `app/research/page.tsx` renders `PlayerLinemates` from `parsePlayer(playerParam)` before `LastGameLines`/`ToiTrends`; WebKit N2 (top 16px) | ✓ |
| Game by game | One square per team game, per linemate | `LinemateRowView` maps `research.games` to `ToiStripCell` | ✓ |
| By situation | EV/PP/SH tabs carried in the URL | `parseSit`; Situation `<nav>` in `PlayerLinemates.tsx:153`; WebKit N7 | ✓ |
| Outcome: a change is obvious | New/Rising/Fading/Out chips from time together | `linemateTag`; line-change tests at 2/3/5 games pass | ✓ |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a player row in the trends table, or a name in any last-game unit table, opens that player's detail; the URL carries `?player=<id>`, so reload, back/forward and a shared link all show the same player | ✓ VERIFIED | Code: `parsePlayer` (`toi-trends.ts:186`, digits-only allowlist) feeds the panel in `page.tsx`; `PlayerLink` is used in both `ToiTrends.tsx` and `LastGameLines.tsx`; a name on its own tab is a `#player-detail` anchor (re-click jumps), otherwise a `PendingLink` to `playerHref`. Browser: WebKit run this session N2 (click adds `player` to URL, panel lands 16px from top), N4 (re-click jumps back), N5 (Back restores the previous player), N6 (reload shows the same panel), N8 (PP unit-table name opens the PP tab). 02-UAT.md test 1 is a human pass. Per locked D-02 the name is the link, not the whole row. |
| 2 | Player detail shows a linemate heat strip (rows are linemates, columns the games in the window, shade is time together as a share of the player's own situation TOI, minutes on click) with separate EV, PP and SH views and forward linemates listed apart from defense partners | ✓ VERIFIED | `PlayerLinemates.tsx` renders a `tbody` for Forwards and one for Defense (`:209-233`); each row maps every window game to `ToiStripCell` with opacity from `linemateOpacity(cell.share)` and a `StripPopover` carrying minutes together, share and the player's time (`linemateDetail`); EV/PP/SH are separate URL-driven views via `buildLinemateView(..., sit)`. WebKit H1 (squares >=20px, 24px pitch), H2 (hover and pin popover), H3 (keyboard, Escape), H5 (popover not clipped at Last 20), H7 (dark-mode shades distinct, 18 shades over 28 squares). 02-UAT.md test 3 is a human pass. |
| 3 | Each linemate's time together is also shown as a share of the player's own TOI in that situation, so a regular linemate is distinguishable from an occasional one | ✓ VERIFIED | `windowShare = together / self` over counted games (`linemates.ts`, `buildLinemateView`), rendered as the "Window share" column (`PlayerLinemates.tsx:365-371`); per-square share in the popover (`linemateDetail`). Rows sort by window share (D-28), so regular linemates lead. Test "window share pools only counted games, so a linemate's missed games do not dilute it" passes. |
| 4 | Linemates are tagged New, Rising or Fading from time together alone (no quality scoring); a forward moved to a new line in the latest game shows the new linemates as New and the old ones as Fading | ✓ VERIFIED | `linemateTag` reads only pooled time-together shares (+/-15 points; New when the earlier share is under 10; Out when the linemate dressed in none of the recent games); no quality input exists. Tagged rows bypass the cap (D-26). Named tests run this session and pass: "line change in a 2-game / 3-game / 5-game window: the new linemates are New, the old ones Fading", "old linemates who did not dress ... are Out, not Fading", "a linemate with no counted earlier game ... is New". Chips are neutral grayscale (`TAG_CHIP`), with a note that tags describe time together only. 02-UAT.md tests 2 and 5 are human passes. |
| 5 | Games whose shift chart is missing show as unknown, never 0, and do not count toward shares or tags; the existing last-game unit tables still show the same TOI and share values as before this phase | ✓ VERIFIED | `linemateCell` returns `state: "unknown"` with null seconds, share and selfSeconds when `pairs` is null; `windowShare`, the minimum and `pooledShare` all skip null cells; `linemateDetail` gives notes only ("No shift chart for this game", "Left out of shares and tags"), no 0:00. Amber dashed cell border for unknown (`CELL_BORDER`) plus an amber footnote listing the dates. Tests: "linemateCell is unknown without a shift chart even when both players dressed", "linemateDetail for absent and unknown cells ... shows no 0:00 or %" pass. Unit tables: `LastGameLines.tsx` still renders `u.time` and `u.pct` (the Time and % columns) from `buildUnitTable`, now with phase-03 event columns added beside them; `pairSeconds` shares `dedupeOnIce`/`situationFor` with the line pass, so the two passes agree. 02-UAT.md test 4 (MTL no-chart game) is a human pass. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

No truth here is a bare state-transition claim without behavioral evidence: SC1 and the popover behaviours were exercised in a real browser (WebKit 17/17 plus the human UAT), and SC4 and SC5 are pinned by named unit tests that were run.

### Plan must-haves (02-01 .. 02-07)

- **02-06 "listed first" clause for new linemates:** superseded by recorded user decision D-28 (window-share order; "the New tag, not row position, signals a line change"), approved in 02-UAT.md test 2. The code (`rows.sort` by `windowShare`, then `totalSeconds`, then id; footnote at `PlayerLinemates.tsx:257-259`) matches D-28. This is a recorded scope change, not a gap.
- **02-07 backstop truths** (jump, Back, reload, tabs, unit-table links, squares, popover clipping, Escape, dark mode): observed this session by `webkit-player-check.cjs`, 17 passed, 0 failed, 0 skipped on live NHL data (desktop WebKit, team MTL). Also covered by human UAT tests 1 and 3.
- **Prohibitions:** the two test-tier prohibitions (an unknown or absent game is never 0 and never counts toward shares or tags) have wired, passing tests (see SC5). The judgment-tier prohibition (no quality judgment, neutral chips) was resolved by a human in 02-UAT.md test 5 and is consistent with the neutral `TAG_CHIP` styling.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/research/pair-seconds.ts` | Regulation-only self and pair seconds per situation | ✓ VERIFIED | 65 lines; deduplicates on-ice skaters before classifying strength, as the line pass does; wired from `team-games.ts:181` |
| `lib/research/linemates.ts` | View-model: cells, shares, order, tags, cap | ✓ VERIFIED | 284 lines, substantive; used by `PlayerLinemates.tsx` and `LastGameLines.tsx` (`SITUATION_ABBREV`) |
| `components/PlayerLinemates.tsx` | Panel: header stats, tabs, heat strip, legend, notes | ✓ VERIFIED | 388 lines; rendered from `app/research/page.tsx` |
| `components/PlayerLink.tsx` | Name link to a player's panel | ✓ VERIFIED | Used by `ToiTrends.tsx` and `LastGameLines.tsx` |
| `components/StripPopover.tsx`, `ToiStripCell.tsx`, `ToiGameStrip.tsx` | Shared popover and cell behaviour for both strips | ✓ VERIFIED | Used by the panel and the trends Per game strip; WebKit H2/H3/H5/H6 |
| `lib/research/toi-trends.ts` | `parsePlayer`, `parseSit`, `parseAll`, `researchHref`, `playerHref` | ✓ VERIFIED | Allowlist parsers; hrefs built only from validated values |
| `lib/research/lines.ts`, `team-games.ts` | Shared line extraction; `pairs` on `ResearchGame` | ✓ VERIFIED | `pairs: shiftInputs.length > 0 ? pairSeconds(...) : null` (`team-games.ts:181`), so a missing chart is null |
| `components/LastGameLines.tsx` | Unit tables with clickable names, Time and % kept | ✓ VERIFIED | Phase-03 event columns added; Time (`u.time`) and % (`u.pct`) remain |
| Tests: `linemates`, `pair-seconds`, `player-detail-view`, `player-links-view`, `toi-trends(-view)`, `game-strip` | Behaviour pinned | ✓ VERIFIED | `npm test` 555/555 pass |
| `webkit-player-check.cjs` | Browser backstop | ✓ VERIFIED | Run this session, 17/17 pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `PlayerLinemates` | `parsePlayer(playerParam)` then render when non-null | WIRED | `page.tsx:~95-100` |
| `PlayerLinemates` | `buildLinemateView` | `(games, research.players, playerId, sit, { all })` | WIRED | `PlayerLinemates.tsx:88` |
| `team-games.ts` | `pairSeconds` | per-game `pairs` | WIRED | `team-games.ts:181` |
| `ToiTrends` / `LastGameLines` | `PlayerLink` -> `playerHref` | name links | WIRED | `ToiTrends.tsx:95`, `LastGameLines.tsx` |
| `PlayerLinemates` | `ToiStripCell` / `StripPopover` | one per game per linemate | WIRED | `PlayerLinemates.tsx:347-360` |
| Situation tabs / Show all / Close | `researchHref` | `PendingLink` | WIRED | `PlayerLinemates.tsx:124,155,241` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlayerLinemates` squares | `research.games[].pairs` | `loadTeamResearch` -> live NHL shift charts -> `pairSeconds` | Yes (WebKit run on live MTL data: 50 squares for N. Suzuki, 18 distinct shades) | ✓ FLOWING |
| Header stats | `buildTrendRows(...)` row | same research games | Yes (WebKit N2/N3 show populated panels) | ✓ FLOWING |
| Unit-table names | `game.lines` plus `research.players` | same | Yes (WebKit N8) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `npm test` (run once) | 555 tests, 555 pass, 0 fail, 0 skipped | ✓ PASS |
| Types | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| SC4/SC5/D-28 named tests | `npx tsx --test --test-name-pattern="line change\|window share\|unknown\|no shift chart\|Out" lib/research/linemates.test.ts lib/research/pair-seconds.test.ts` | 13 pass, 0 fail | ✓ PASS |
| Browser backstop | `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs` (log from this run) | 17 passed, 0 failed, 0 skipped, exit 0 | ✓ PASS |
| Debt markers | `grep -E "TBD\|FIXME\|XXX"` over the phase source | no matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no plan declares one. Not applicable.

### Requirements Coverage

Requirement IDs declared in the PLAN frontmatter: 02-01 `PLYR-01, PLYR-02, PLYR-03`; 02-02 `PLYR-02, PLYR-03`; 02-03 `PLYR-01, UNIT-04`; 02-04 `PLYR-02`; 02-05 `PLYR-02, PLYR-03`; 02-06 `PLYR-04, PLYR-02`; 02-07 `PLYR-01, PLYR-02, PLYR-04, UNIT-04`. The union is PLYR-01..04 and UNIT-04, which equals the five IDs in the ROADMAP and is exactly what REQUIREMENTS.md maps to Phase 2. There are no orphaned requirements.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLYR-01 | 02-01, 02-03, 02-07 | Click a player to open detail; `?player=<id>` survives reload and sharing | ✓ SATISFIED | SC1; WebKit N2-N6; UAT 1 |
| PLYR-02 | 02-01, 02-02, 02-04, 02-05, 02-06, 02-07 | Heat strip, split by EV/PP/SH and F vs D | ✓ SATISFIED | SC2; WebKit H1-H7; UAT 3 |
| PLYR-03 | 02-01, 02-02, 02-05 | Time together as a share of the player's own situation TOI | ✓ SATISFIED | SC3; Window share column and popover share |
| PLYR-04 | 02-06, 02-07 | New / Rising / Fading from time together only | ✓ SATISFIED | SC4 tests; UAT 2 and 5 |
| UNIT-04 | 02-03, 02-07 | Click a name in a unit table to open the player | ✓ SATISFIED | `LastGameLines.tsx` `PlayerLink`; WebKit N8 |

REQUIREMENTS.md already marks all five `[x]` and "Complete".

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/PlayerLinemates.tsx` | 308, 367 | WR-06: unknown "—" uses `text-neutral-400` (low contrast); the same fix was applied to `ToiTrends.tsx` only | ⚠️ Warning (open, advisory) | Contrast polish; the dash still renders and means unknown |
| `components/LastGameLines.tsx` | 104, 165 | Same dash colour (phase-03 code) | ⚠️ Warning (open, advisory) | Same as above |
| `lib/research/format.ts` | 17-28 | IN-10: `formatSignedPoints` doc says PP share but it also formats goal +/-; `formatPointsDelta` tests the helper's output against `"0"` | ℹ️ Info (open) | Naming and robustness only |
| `components/ToiStripCell.tsx` | 61-71 | IN-11: the hover-only Escape wiring has no regression test | ℹ️ Info (open) | The behaviour itself passes in WebKit H3/H6 |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in the phase source. The earlier WR-01 (strength classified before de-duplicating skaters) is resolved: `pair-seconds.ts:43-44` now dedupes before `situationFor`. The earlier WR-02 footnote wording now reads "has no ... time with a shift chart in the earlier games of this window to compare with" (`PlayerLinemates.tsx:99`), which is accurate for both causes.

### Human Verification Required

None outstanding. 02-UAT.md is complete (5/5 pass, 0 issues), and the browser backstop was re-run this session at 17/17. `02-VALIDATION.md` is `validated` with `nyquist_compliant: true`. The UI review (02-UI-REVIEW.md, 18/24) and the code re-review (0 critical) raise warnings only.

### Gaps Summary

There are no gaps. All 5 roadmap success criteria hold against the current source, and PLYR-01..04 and UNIT-04 are satisfied. Phase 03's changes to `LastGameLines.tsx` and `lines.ts` did not regress SC5: the unit tables still show Time and %, and the pair pass and the line pass share one on-ice definition. Open items (WR-06, IN-10, IN-11) are advisory and block no success criterion.

---

_Verified: 2026-10-14T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
