---
phase: 02-player-linemate-detail
verified: 2026-10-12T20:12:03Z
status: human_needed
score: 4/5 must-haves verified
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
covered_digest: "v3:sha256:226712ca2515cc9a829ee4834aa1bf3ad74f6304467fd89b70e45b04b7adc7eb"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "SC1: the URL carries ?player=<id>, so reload, back/forward and a shared link all show the same player (and a name click jumps to the panel)"
    test: "Signed in, open /research?team=MTL&games=5, click a name low in the Ice-time trends table, then a name in a PP Last game unit table, then Back, Forward, reload, and paste the URL into a new tab"
    expected: "Each click lands on the panel under the nav with the right player and tab; Back/Forward step through the selections; reload and the new tab show the same player and tab"
    why_human: "The server side is verified (panel renders from the validated ?player/?sit; every name link is playerHref with #player-detail). The scroll jump and history behaviour are browser navigation; the WebKit run (N1-N10) is recorded only in 02-07-SUMMARY and was not re-run here"
human_verification:
  - test: "Navigation and URL state (SC1, PLYR-01, UNIT-04): signed in, /research?team=MTL&games=5. Click a name near the bottom of the Ice-time trends table; click a name in the 'PP - Forwards' Last game table; press Back, then Forward; reload; copy the URL into a new tab; click the selected player's own name again"
    expected: "Page jumps to the panel (first block under the nav); PP name opens the PP tab; Back/Forward restore the previous/next player and tab; reload and the new tab show the same player and tab; re-clicking the selected name jumps back to the panel"
    why_human: "Browser scroll and history behaviour; not exercised by any test run during verification"
  - test: "Line change at a glance (SC4, PLYR-04): on /research?team=MTL&games=5 (or another team), pick a forward whose line changed in the latest game and open him"
    expected: "New linemates carry the solid New chip and old ones Fading (or Out if they did not dress). Decide whether it is acceptable that, when the change happened only in the latest game, the old Fading linemates are listed above the New ones (see WARNING W-03); also judge whether +/-15 points is noisy (D-27)"
    why_human: "Judgment on real data plus a product decision on ordering"
  - test: "Heat strip look and popover (SC2, SC3; 02-07 backstop truths): on the open panel, hover, click and Tab to squares in the Forwards and Defense blocks, at Last 5 and Last 20, in light and dark mode; press Escape on a focused square; switch EV/PP/SH tabs"
    expected: "Squares read as separate bordered squares with gaps and a pointer cursor; the popover opens on hover, focus and click with linemate, game, Together minutes, Share of EV/PP/SH time and the player's time, and is not clipped on the last forward and last defense rows at Last 20; Escape hides it and the next Tab continues from that square; shades are distinguishable in dark mode; the selected-row bar is visible on green and red tinted trends rows; tab clicks keep the scroll position"
    why_human: "Visual and pointer behaviour; the 02-07 backstop truths abstain without directly observed evidence"
  - test: "Missing shift chart (SC5): on /research?team=MTL&games=5 (MTL had a no-chart game on Oct 3 at the time of 02-07; otherwise use any team with an amber banner or no-chart note), open a player"
    expected: "The no-chart column is amber dashed in every row, its popover says 'No shift chart for this game' with no times, the amber footnote lists the date, and no square or share shows 0 for it. The Last game unit tables still show Time and % values next to the now-linked names"
    why_human: "Depends on live NHL data having a no-chart game; the rule itself is unit-tested"
  - test: "No quality judgment (02-06 judgment-tier prohibition): look at the Tag column and chips on any open panel"
    expected: "Chips are black/white/grey only (New solid, Rising/Fading outlined, Out dashed), never green or red, and nothing on the panel ranks linemates by points, TOI rank or fantasy value"
    why_human: "Judgment-tier prohibition; code reading supports it (TAG_CHIP neutral classes, tags computed from time together only) but the verdict is non-authoritative until a human confirms"
---

# Phase 2: Player Linemate Detail Verification Report

**Phase Goal:** User can open any player from the research page and see who that player has been on ice with, game by game and by situation, so a change in linemates is obvious.
**Verified:** 2026-10-12T20:12:03Z
**Status:** human_needed
**Re-verification:** No (initial verification)

The roadmap marks this phase `mode: mvp`, but the goal is not in "As a ..., I want to ..., so that ..." form (`user-story.validate` returns `valid: false`). Phase 1 was verified with the same goal form, so this report uses goal-backward verification against the 5 roadmap success criteria and keeps the User Flow Coverage table. Run `/gsd-mvp-phase 2` if a user-story goal is wanted.

## User Flow Coverage

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open a player | A name in the trends table or a Last game unit table opens `?player=<id>#player-detail` | `components/PlayerLink.tsx` (PendingLink to `playerHref`, native `#player-detail` anchor when already selected); used in `ToiTrends.tsx` name cell and `LastGameLines.tsx` UnitTable; tests in `player-links-view.test.ts` | ✓ (browser jump is human check 1) |
| See the panel | Server-rendered panel first under the nav | `app/research/page.tsx:105-107` renders `PlayerLinemates` before `LastGameLines` and `ToiTrends` when `parsePlayer` returns an id | ✓ |
| Game by game | One square per team game per linemate | `PlayerLinemates.tsx` `LinemateRowView` maps `research.games`; test "every listed row has one square per team game" | ✓ |
| By situation | EV/PP/SH tabs in the URL | `parseSit` allowlist; Situation `<nav>` in `PlayerLinemates.tsx`; tab tests | ✓ |
| Outcome: change is obvious | New/Rising/Fading/Out tags from time together | `linemateTag` in `linemates.ts`; SC4 tests at 2/3/5 games; verifier probe of a latest-game-only move | ✓ tags (ordering edge case is W-03) |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a player row in the trends table, or a player name in any last-game unit table, opens that player's detail section; the URL carries `?player=<id>`, so reload, back/forward and a shared link all show the same player | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Server side verified: `parsePlayer` (`toi-trends.ts:186`, 1-10 digits only), `page.tsx` renders the panel from it; trends name cell and every unit-table name are `PlayerLink`s built by `playerHref` (`researchHref` + `#player-detail`); unit links carry the table's `sit` (test "EV unit names link without sit and PP unit names link with sit=pp"). The panel is a pure function of the URL, so reload and a shared link are deterministic. Not exercised here: the scroll jump and Back/Forward in a browser (02-07 WebKit N1-N10 claimed, not re-run). Note: per locked D-02 the name, not the whole row, is the link. |
| 2 | Player detail shows a linemate heat strip (rows are linemates, columns are the games in the window, shade is time together as a share of the player's own situation TOI, minutes on click) with separate EV, PP and SH views and forward linemates listed apart from defense partners | ✓ VERIFIED | `linemateCell` share = together / `pairs.self[player][sit]` (regulation only, `pair-seconds.ts` skips t >= 3600); `linemateOpacity` 0.2 + 0.8 * min(1, share/0.75); popover via shared `StripPopover` with Together / Share of {EV} time / Player's {EV} time; click pin is the tested `nextOpen` state machine plus the pinned `group-data-[open]/cell:block` class; tabs from `parseSit`; Forwards `tbody` then Defense `tbody` with `border-t-2` divider. Tests: "a together square's popover starts with the linemate...", "with the PP situation...", "the Forwards block comes before the Defense block...", "a click toggles the popover...". |
| 3 | Each linemate's time together is also shown as a share of the player's own TOI in that situation, so a regular linemate is distinguishable from an occasional one | ✓ VERIFIED | `windowShare` = pooled together / pooled self over counted games (`buildLinemateView`), rendered as the "Window share" column (`Math.round(windowShare*100)%`, "—" when null). Tests "window share pools only counted games...", "a window share is the pooled share over counted games", "a row with no counted game shows a dash...". |
| 4 | Linemates are tagged New, Rising or Fading from time together alone (no quality scoring); a forward moved to a new line in the latest game shows the new linemates as New and the old ones as Fading | ✓ VERIFIED | `linemateTag` uses only pooled time-together shares, `deltaCrossing` at `LINEMATE_TAG_POINTS = 15`, New when earlier < 10, Out when the linemate dressed in no recent game. Tests: line change at 2/3/5 games, Out-not-Fading, rounded boundaries. Verifier probe (scratchpad, not committed) with the move in the latest game only, 67% shares: n=2 `[12 New, 13 New, 10 Fading, 11 Fading]`; n=3 and n=5 `[10 Fading, 11 Fading, 12 New, 13 New]`. Tags hold; ordering differs (W-03). |
| 5 | Games whose shift chart is missing show as unknown ("—" or blank) in the heat strip, never 0, and do not count toward shares or tags; the existing last-game unit tables still show the same TOI and share values as before this phase | ✓ VERIFIED | `pairs: null` when no shift rows (`team-games.ts:129`) gives state `unknown` with null seconds/share; `pooledShare`, window share, `recentSeconds` and the minimum all skip null cells. Tests: "linemateCell is unknown without a shift chart even when both players dressed", "a game without a shift chart never enters the share or the total", "games without a shift chart, or where a player missed, never count toward a tag's shares", "unknown and absent squares ... never show 0:00 or a percentage". Unit tables: `git diff 01d42a4 HEAD -- lib/research/lines.ts` is a verbatim `bucketOnIce` extraction plus exports; `lines.test.ts` unchanged since phase 1; `LastGameLines.tsx` keeps `formatClock(u.seconds)`, `u.pct.toFixed(1)`, `UNIT_LIMITS` identical to the pre-phase `page.tsx`; test "the #, Time and % cells keep their values". |

**Score:** 4/5 truths verified (1 present, behavior-unverified)

### Plan must-haves (02-01 .. 02-07)

All plan frontmatter truths were checked against the code and the tests named in them. They hold, with these notes:

- **02-06 "SC4: ... his new linemates are listed first ..."**: restates roadmap SC4 (the contract wording is kept above and is VERIFIED). The added "listed first" claim holds when the change spans the team's last 2 games (the tested case), but not when the move happened only in the latest game of a 3+ game window (probe above). This follows locked D-12 (order by the last 2 games, then window total). Recorded as WARNING W-03 for a human decision, not as a gap.
- **02-07 backstop truths** (popover not clipped at Last 20, name click scrolls and Back returns, squares read as separate in light/dark, dark-mode shades and selected-row bar, SC1 in a real browser): `verification: backstop`. 02-07-SUMMARY records WebKit 17/17 and Phase 1 strip 16/16, but the scripts were not re-run here, so these abstain (insufficient_spec) and are folded into human checks 1 and 3.
- **Prohibitions:** the two test-tier prohibitions (02-01 no-chart/absent never 0 or counted; 02-06 such games never in a tag's shares, missing linemate is Out) have wired, passing tests (listed under SC5 and SC4). The judgment-tier prohibition (no quality judgment, neutral chips) is supported by code (`TAG_CHIP` uses only neutral classes; tags read only time together) and is flagged for human confirmation (check 5).

### Required Artifacts

`gsd-tools verify.artifacts` on all 7 plans: 26/26 passed (01: 9/9, 02: 3/3, 03: 5/5, 04: 3/3, 05: 2/2, 06: 3/3, 07: 1/1).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/research/pair-seconds.ts` | Regulation-only own and pair seconds | ✓ VERIFIED | 63 lines; called from `team-games.ts:129` |
| `lib/research/linemates.ts` | Pure view-model (states, shares, order, tags, cap) | ✓ VERIFIED | 289 lines; used by `PlayerLinemates.tsx` |
| `lib/research/lines.ts` | `bucketOnIce`/`situationFor` extracted verbatim | ✓ VERIFIED | Diff is extraction plus `export` only |
| `lib/research/team-games.ts` | `ResearchGame.pairs` beside `lines` | ✓ VERIFIED | Same shift inputs, no new request |
| `lib/research/toi-trends.ts` | `parsePlayer`, `parseSit`, `parseAll`, `researchHref` extras, `playerHref` | ✓ VERIFIED | Used by page, links, tabs |
| `components/PlayerLinemates.tsx` | Panel, header stats, tabs, strip, tags, legend, empty states | ✓ VERIFIED | Rendered by `page.tsx` |
| `components/PlayerLink.tsx` | Name link | ✓ VERIFIED | Used by `ToiTrends.tsx` and `LastGameLines.tsx` |
| `components/LastGameLines.tsx` | Unit tables with linked names | ✓ VERIFIED | Imported by `page.tsx` |
| `components/StripPopover.tsx` | Shared popover | ✓ VERIFIED | Used by `ToiGameStrip.tsx` and `PlayerLinemates.tsx` |
| `components/ToiStripCell.tsx` | Pin/dismiss state machine, no `aria-expanded` | ✓ VERIFIED | Escape sends `escape`; no `blur()` call |
| `webkit-player-check.cjs` | WebKit backstop | ✓ EXISTS | Not run (per instructions) |

### Key Link Verification

`gsd-tools verify.key-links` on all 7 plans: 18/18 verified.

| From | To | Via | Status |
|------|----|-----|--------|
| `team-games.ts` | `pair-seconds.ts` | `pairSeconds(team, shiftInputs, positions)` | WIRED |
| `pair-seconds.ts` | `lines.ts` | `bucketOnIce` + `situationFor(` | WIRED |
| `page.tsx` | `PlayerLinemates.tsx` | `parsePlayer(playerParam)` then `<PlayerLinemates ... all={all} />` | WIRED |
| `PlayerLinemates.tsx` | `linemates.ts` | `buildLinemateView(games, research.players, playerId, sit, { all })` | WIRED |
| `ToiTrends.tsx` / `LastGameLines.tsx` | `PlayerLink.tsx` | `<PlayerLink` | WIRED |
| `PlayerLink.tsx` | `toi-trends.ts` | `playerHref(` | WIRED |
| `ToiGameStrip.tsx` / `PlayerLinemates.tsx` | `StripPopover.tsx` | `<StripPopover detail={detail} />` | WIRED |
| `ToiStripCell.tsx` | `StripPopover.tsx` | `data-dismissed` / `group-data-[dismissed]/cell:hidden` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlayerLinemates` heat strip | `view.forwards/defense[].cells` | `buildLinemateView(research.games ...)` from `game.pairs` = `pairSeconds` over `getShiftCharts(gameId)` rows in `loadGame` | Yes (live NHL shift charts; same fetch as Phase 1) | ✓ FLOWING |
| `PlayerLinemates` header stats | `row` | `buildTrendRows(research.players, research.games)` | Yes | ✓ FLOWING |
| `LastGameLines` names | `u.playerIds` | `game.lines.units` from `analyzeGameLines` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `npm test` | 326 pass, 0 fail, 0 skipped | ✓ PASS |
| Types | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint (scoped) | `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx components/ToiStripCell.tsx components/PlayerLinemates.tsx components/PlayerLink.tsx components/StripPopover.tsx components/LastGameLines.tsx` | exit 0, no output | ✓ PASS |
| SC4 with a latest-game-only move | `npx tsx scratchpad/probe/sc4.ts` (not committed) | tags New/Fading at n=2,3,5; old linemates listed first at n=3,5 | ✓ PASS (tags) / see W-03 |
| WR-01 reproduction | `npx tsx scratchpad/probe/wr01.ts` (5v5 with one overlapping differing row) | `pairs.self[1] = {ev:30, pp:30}`, `lines.playerSeconds[1] = {ev:30, pp:60}`; 30 s of 5v5 classed as PP in both passes | Confirms W-01 |
| WebKit backstop | not run (per instructions) | 02-07-SUMMARY: 17/17 and 16/16 | ? SKIP (human checks 1, 3) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no plan declares one. Step 7c: not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLYR-01 | 02-01, 02-03, 02-07 | Click a player row to open detail; `?player=<id>` survives reload and sharing | ✓ SATISFIED (browser navigation: human check 1) | `parsePlayer`, page render, name links, `playerHref` tests |
| PLYR-02 | 02-01, 02-02, 02-04, 02-05, 02-06, 02-07 | Heat strip: rows linemates, columns games, shade by time together, split by EV/PP/SH and F vs D | ✓ SATISFIED | SC2 evidence |
| PLYR-03 | 02-01, 02-02, 02-05 | Time together as a share of the player's own situation TOI | ✓ SATISFIED | SC3 evidence; per-square share in the popover |
| PLYR-04 | 02-06, 02-07 | New / Rising / Fading from time together only | ✓ SATISFIED (judgment check 5) | SC4 evidence |
| UNIT-04 | 02-03, 02-07 | Click a name in a unit table to open the player | ✓ SATISFIED | `LastGameLines.tsx` `PlayerLink` with the table's `sit`; unit-link tests |

No orphaned requirements: REQUIREMENTS.md maps exactly PLYR-01..04 and UNIT-04 to Phase 2, and every one is claimed by a plan.

### Decision Coverage

`check.decision-coverage-verify`: 27/27 CONTEXT.md decisions honored by shipped artifacts (non-blocking gate).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `pair-seconds.test.ts` | PLYR-02/03 | all | 0 | partial (oracle shares `bucketOnIce`/`situationFor` with `analyzeGameLines`) | Value | OK; the oracle proves consistency with Phase 1, not classification correctness (see W-01) |
| `linemates.test.ts` | PLYR-02/03/04, SC5 | 58 | 0 | No (hand-built fixtures) | Value | OK; SC4 fixtures move the line for the whole recent part, none for a latest-game-only move in a 3+ window |
| `player-detail-view.test.ts` | PLYR-02/03, SC5 | 42 | 0 | No | Value (rendered markup) | OK |
| `player-links-view.test.ts` | PLYR-01, UNIT-04 | 16 | 0 | No | Value | OK |
| `toi-trends.test.ts` / `toi-trends-view.test.ts` | PLYR-01, WR-10 | all | 0 | No | Value | OK |

Disabled tests on requirements: 0. Circular patterns: 0 blocking. Insufficient assertions: 0.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (14 phase source files) | - | TBD/FIXME/XXX/TODO/HACK/placeholder | none found | - |
| `lib/research/pair-seconds.ts` | 41-45 | WR-01: strength classified from the un-deduplicated skater list | ⚠️ Warning | Rare malformed charts only; see W-01 |
| `components/PlayerLinemates.tsx` | 99 | WR-02: `no-earlier-data` note states a false cause | ⚠️ Warning | Misleading footnote; see W-02 |
| `lib/research/linemates.ts` | 222 | Sort by last-2-games seconds, then window total | ⚠️ Warning | See W-03 |

`console.error` calls in `page.tsx` and `team-games.ts` are the existing error-logging convention, not stubs.

### Warnings (open review items and verifier findings)

**W-01 (review WR-01, open). Does not block a success criterion.** `pairSeconds` calls `situationFor(mine, opp)` with `mine.skaters` before the `Set` dedupe, so two overlapping, differing shift rows for one player inflate the skater count. Reproduced: 30 s of 5v5 classed as PP. `analyzeGameLines` has the same classification (it predates this phase and also credits the player twice), so the Last game tables are unchanged (SC5 holds) and the pair pass agrees with them. It only affects charts with overlapping differing rows; 02-01-SUMMARY reports no divergence on the live games it sampled. Fix both passes together (dedupe before classifying) with an overlapping-rows test, or accept it.

**W-02 (review WR-02, open). Does not block a success criterion.** When tags are unavailable for reason `no-earlier-data`, the footnote says "{name} has no earlier games in this window to compare with". The reason also fires when earlier games exist but have no chart or no time in the situation (e.g. PP tab). Tags are correctly withheld. Only the explanation is wrong, which could send the user looking for a problem that is not there. One-line copy fix (suggested wording in 02-REVIEW.md).

**W-03 (verifier finding, needs a human decision).** When a forward changes lines only in the latest game of a 3+ game window, his new linemates are tagged New and the old ones Fading (SC4 holds), but the old linemates are listed above the new ones. Both have one recent game together, so the tie goes to window total (D-12). The 02-06 plan truth and D-12's note "A line change pushes the new linemates to the top" assume the new linemates come first. The solid New chip still marks the change, and tagged rows always bypass the cap. Options: (a) accept as D-12 behaviour (add an override for the 02-06 "listed first" clause), or (b) break the recent-seconds tie with the latest game's seconds (small change in `buildLinemateView`, plus a test with a latest-game-only move).

### Info (open review items, not blocking)

IN-01 (sort/tab links carry `sit`/`all` with no player), IN-02 (Escape cannot dismiss a hover-only popover), IN-03 (Close link `aria-label` lacks its visible text), IN-04 (`sort` vs `effectiveSort` in name links), IN-05 (duplicated situation labels, an unused export, `buildTrendRows` twice per request). None affects a success criterion.

## Human Verification Required

Laptop browser, signed in. No phone or touch checks.

### 1. Navigation and URL state (SC1, PLYR-01, UNIT-04)

**Test:** Open `/research?team=MTL&games=5`. Click a name near the bottom of the Ice-time trends table. Click a name in the "PP - Forwards" Last game table. Press Back, then Forward. Reload. Copy the URL into a new tab. Click the selected player's own name again.
**Expected:** Each click jumps to the panel, the first block under the nav. The PP name opens the PP tab. Back and Forward restore the previous and next player and tab. Reload and the new tab show the same player and tab. Re-clicking the selected name jumps back to the panel.
**Why human:** Browser scroll and history behaviour.

### 2. Line change at a glance (SC4, PLYR-04), plus the W-03 decision

**Test:** On `/research?team=MTL&games=5` (or another team), open a forward whose line changed in the latest game.
**Expected:** New linemates have the solid New chip; old ones have Fading (or Out if they did not dress). Decide whether old Fading linemates listed above the New ones is acceptable when the change happened only in the latest game (W-03). Judge whether ±15 points is noisy (D-27).
**Why human:** Judgment on real data, plus a product decision.

### 3. Heat strip look and popover (SC2, SC3, 02-07 backstops)

**Test:** On the open panel, hover, click and Tab to squares in both blocks, at Last 5 and Last 20, in light and dark mode. Press Escape on a focused square. Switch EV, PP and SH.
**Expected:**
- Squares read as separate, clickable bordered squares.
- The popover opens on hover, focus and click. It shows the linemate, the game, Together minutes, Share of {EV/PP/SH} time and the player's time.
- The popover is not clipped on the last forward and last defense rows at Last 20.
- Escape hides the popover, and the next Tab continues from that square.
- Shades are distinguishable in dark mode.
- The selected-row bar is visible on green and red tinted trends rows.
- Tab clicks keep the scroll position.

**Why human:** Visual and pointer behaviour.

### 4. Missing shift chart (SC5)

**Test:** Open a player on a team with a no-chart game in the window. At 02-07 time this was MTL on Oct 3. Otherwise, use a team that shows the amber no-chart note.
**Expected:** The no-chart column is amber dashed in every row. Its popover says "No shift chart for this game" with no times. The amber footnote lists the date. Nothing shows 0 for that game. The Last game unit tables still show Time and % next to the linked names.
**Why human:** Needs live data with a no-chart game. The rule itself is unit-tested.

### 5. No quality judgment (judgment-tier prohibition)

**Test:** Look at the Tag column on any open panel.
**Expected:** Chips are black, white or grey only, never green or red. Nothing ranks linemates by points, TOI rank or fantasy value.
**Why human:** Judgment-tier prohibition. Code reading supports it, but that verdict is not authoritative.

## Gaps Summary

No blocking gaps. All 5 roadmap success criteria are implemented and wired. SC2 to SC5 are backed by passing tests. SC1's server side is verified, and its browser navigation needs the human check. `npm test` (326/326), `tsc` and the scoped eslint are green. All 26 artifacts and 18 key links pass. 27/27 CONTEXT decisions are honored. The two open review warnings (WR-01 classification on overlapping shift rows, WR-02 footnote wording) do not break a success criterion. A new ordering finding (W-03) needs a product decision. Status is `human_needed` for the five checks above.

---

_Verified: 2026-10-12T20:12:03Z_
_Verifier: Claude (gsd-verifier)_
