---
phase: 01-ice-time-trends-table
verified: 2026-10-12T02:00:00Z
status: human_needed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/01-ice-time-trends-table/01-01-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-01-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-02-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-02-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-03-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-03-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-04-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-04-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-05-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-05-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-06-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-06-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-07-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-07-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-08-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-08-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-09-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-09-SUMMARY.md
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.ts
  - lib/research/format.ts
  - lib/research/game-strip.ts
  - lib/research/lines.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.ts
covered_digest: "v3:sha256:8b969bc16de9738559a3f129fa5c50b2b39edc37e6a5c2a0f9a7316c0a5fe0d2"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed:
    - "G-01-2: popover could not be opened (hover/focus only, no click or tap, no affordance, open popover covered squares below)"
    - "G-01-5: Per game strip read as one segmented bar (12x16 cells, 1px gap, 4px radius, no border, no hint)"
    - "G-01-1b: Pos cell read 'C5/5 GP'"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-05: a failed shift-chart request is worded as 'the NHL hasn't published shift charts'; for an OT/SO game the affected game drops out of Avg TOI/Delta"
    category: other
    reason: "Degraded-path copy is inaccurate on a transient upstream failure. A shown number is never wrong (the game is excluded or shown as no-PP/SH) and the cause is logged server-side. Unchanged since the previous verification; does not stop a user seeing who is gaining or losing time."
    evidence_status: "reasoned from code (team-games.ts, ToiTrends.tsx legend); not exercised"
  - finding: "WR-06: when the newest game fails to load, 'Last game' and the 'last 2 games' Delta re-anchor to the newest loaded games"
    category: other
    reason: "Partially disclosed by the amber banner naming the missing date. Needs a failed boxscore on the newest game. Unchanged since the previous verification."
    evidence_status: "reasoned from code (team-games.ts, page.tsx); not exercised"
  - finding: "WR-07: Per game square is focusable and clickable but exposed as role=img; Enter/Space do nothing, no aria-expanded, no Escape dismissal (WCAG 1.4.13)"
    category: other
    reason: "Keyboard users still get the popover: Tab focus opens it through CSS focus-visible (WebKit check D10 passes) and Tab away closes it. What is missing is Enter/Space activation, Escape, and an announced expanded state. The aria-label already carries the full per-game detail for assistive tech. Accessibility polish on a secondary drill-down, not the scan-the-table goal. Worth fixing before calling the feature accessible."
    evidence_status: "code read (ToiStripCell.tsx:35-45); keyboard-open behaviour exercised by webkit-strip-check D10"
  - finding: "WR-08: toggle / outside-click / blur / listener-cleanup behaviour of ToiStripCell has no test in npm test (static markup only)"
    category: other
    reason: "Test-coverage gap, not a behaviour gap. The behaviour is proven in a real WebKit engine by the re-runnable webkit-strip-check.cjs, which this verifier re-ran (15/15). A regression would not be caught by npm test, only by re-running that script."
    evidence_status: "webkit-strip-check.cjs re-run by this verifier, 15 passed 0 failed"
human_verification:
  - test: "Signed in, in your own Safari (and Chrome), open /research?team=MTL&games=5. Click a Per game square, click it again, click elsewhere, then open another square. Hover a square. Tab onto a square. Repeat at games=20 on the last forward row and the last defense row, and on a team with an OT game"
    expected: "Click opens that square's popover under it, a second click or an outside click closes it, opening another closes the first, hover and Tab also open it, and nothing is clipped. This is the macOS check that failed in UAT tests 2 and 5; the WebKit check runs Playwright's WebKit with the auth gate stripped, not your signed-in Safari"
    why_human: "/research is Discord-auth-gated and the automated engine is not the user's installed browser; UAT tests 2 and 5 were failed on exactly this path"
  - test: "Tap a Per game square on iOS Safari and Android Chrome"
    expected: "Tap opens the popover, tapping elsewhere or another square closes it. (UAT test 3 was blocked: no physical device)"
    why_human: "Only an emulated iPhone 13 (no hover, touch events) was driven; a physical device was never available"
  - test: "Look at the Per game column at games=5 and games=20, light and dark mode, including rows whose games are shaded very lightly"
    expected: "Each game reads as its own separate bordered square (not a segmented bar); dashed grey = did not play, dashed sky = OT with no shift data, sky ring = OT/SO; the 'Per game (click a square)' hint is noticed"
    why_human: "Whether it reads as separate squares to a person was the substance of UAT G-01-5. The code now makes it objectively separate (20x20, 4px gap, 1px border on every square, measured at >=20px size and 24px pitch in WebKit) but the judgment is visual"
---

# Phase 1: Ice-Time Trends Table Verification Report

**Phase Goal:** User can scan a team's ice-time section as a trends table and immediately see which players are gaining or losing TOI and power-play time
**Verified:** 2026-10-12
**Status:** human_needed
**Re-verification:** Yes, after the second gap-closure round (plans 01-08 and 01-09, from UAT gaps G-01-2, G-01-5, G-01-1b)

## Goal Achievement

All three UAT gaps are closed in the code and demonstrated in a real WebKit engine on the real page with live NHL data. All earlier truths still hold: since the previous verification only `components/ToiGameStrip.tsx`, `components/ToiTrends.tsx`, the new `components/ToiStripCell.tsx` and the view test changed, and no file under `lib/` other than the test moved, so the data layer (CR-01 dedupe, loader isolation, sorting, deltas) is untouched. `npm test` 186 pass / 0 fail, `tsc --noEmit` exit 0, scoped eslint exit 0. The status stays `human_needed` because the user failed UAT tests 2 and 5 in their own macOS Safari, a signed-in environment this verifier cannot reproduce; they must re-run those and the physical-touch check (test 3) themselves. No blocker found.

### UAT Gap Closure

| Gap | Status | Evidence |
| --- | ------ | -------- |
| G-01-2 popover unreachable (hover/focus only) | CLOSED in code and in WebKit | `ToiStripCell.tsx` (new `"use client"`): `onClick` toggles `data-open`, `pointerdown` listener (added only while open) closes on outside press, `onBlur` closes; `tabIndex=0`. `ToiGameStrip.tsx` popover shown by `group-hover/cell`, `group-focus-visible/cell` or `group-data-[open]/cell`, and carries `pointer-events-none` so it cannot block squares under it; squares carry `cursor-pointer` and a hover outline. Re-ran `webkit-strip-check.cjs`: D3 click opens and stays open, D4 second click closes, D5 outside click closes, D6 opening another closes the first, D7 popover does not block the square below, D8 hover, D9 sweeping 21 rows shows exactly each row's own popover, D10 Tab opens and Tab away closes, T2-T4 tap open/close in emulated iPhone |
| G-01-5 strip read as one segmented bar | CLOSED in code (visual judgment left to human) | `ToiGameStrip.tsx`: container `flex gap-1`; each square `h-5 w-5 rounded-xs border`, border solid neutral (played), dashed grey (DNP), dashed sky (OT without shift data), `ring-1 ring-sky-500` for played OT/SO. `ToiTrends.tsx` header now `Per game (click a square)`, intro ends "click, tap or hover a square", legend says dashed / blue ring. WebKit S1: every row-0 square is at least 20x20 and neighbours at least 24px apart. Popover OT half: D12 shows the OT tag and "Total (incl. OT)" with the no-shift-data note |
| G-01-1b "C5/5 GP" | CLOSED | `ToiTrends.tsx` Pos cell: `{row.player.position}{" "}<span className="ml-1 ...">{gamesPlayed}/{games} GP`. Text is "C 3/3 GP"; `toi-trends-view.test.ts:69` asserts `posText(...) === "C 3/3 GP"` |

The two UAT items that passed (test 1 layout, test 4 sort) were not changed in behaviour; the header test (`toi-trends-view.test.ts:50`) still pins the column set and sort arrow.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: one row per player with Avg TOI, PP share, SH, trend arrow and sparkline, F then D, per-game numeric grid gone (TRND-01) | VERIFIED | Header row: Player, Pos, Avg TOI, TOI Delta, PP share, PP share Delta, SH, Per game (click a square), TOI trend; header test passes; UAT test 1 passed |
| 2 | SC2: exact per-game TOI/PP/SH readable without the grid; OT visibly flagged (TRND-02, TRND-04) | VERIFIED (visual re-confirmation in the user's browser pending) | Click/tap/hover/focus open the popover (WebKit D3-D12, T2-T4); popover content unchanged and shared with aria-label via `gameDetail`; OT ring, OT tag, "OT excluded" / "Total (incl. OT)" shown (D12) |
| 3 | SC3: recent-vs-window Delta for TOI and PP share (TRND-03) | VERIFIED | `toi-trends.ts` unchanged; delta tests pass |
| 4 | SC4: below-minimum players show no trend with GP visible; missed games never 0; OT flagged (TRND-04) | VERIFIED | Unchanged logic; Pos cell now "C 3/3 GP" with a real separator; tests pass |
| 5 | SC5: sort by trend, Avg TOI or PP share, kept in the URL, F/D kept (TRND-05) | VERIFIED | `sortRows`/`researchHref`/`PendingLink` unchanged; UAT test 4 passed |
| 6 | PP share / PP Delta / SH / tint are correct for games with a shift chart (CR-01) | VERIFIED | `uniqueShifts` still used by `regulationSeconds` and `analyzeGameLines` (lines.ts:22, 38, 92); lib not modified since the live-data check in the previous verification |
| 7 | 01-08: click or tap opens a square's popover, it persists after the pointer leaves, a second click / outside press / focus loss closes it, opening another closes the first; hover and keyboard focus still work; a mouse click's leftover focus does not pin it open | VERIFIED | `ToiStripCell.tsx` logic read; real WebKit D3-D6, D8, D10, T2-T4 all PASS (re-run by this verifier). Behavioural evidence is the WebKit script, not `npm test` (see WR-08) |
| 8 | 01-08: an open popover never blocks the squares under it; every square has a pointer cursor; aria-label unchanged and popover aria-hidden; only `ToiStripCell` is client code | VERIFIED | `pointer-events-none`, `cursor-pointer`, `aria-hidden="true"` in `ToiGameStrip.tsx`; D7 and D9 PASS; `ToiGameStrip`/`ToiTrends` have no hooks or `"use client"`; props crossing the boundary are `label`, `state`, `className` and server-rendered children |
| 9 | 01-09: separate bordered 20x20 squares on a 24px pitch, header/intro/legend copy, Pos cell separator, UI-SPEC revised to what ships | VERIFIED | Classes and copy read in code; S1 PASS in WebKit; `01-UI-SPEC.md` has a Revisions entry (2026-10-11) naming G-01-2, G-01-5, G-01-1b and the shipped sizes/reveal/copy |

**Score:** 9/9 truths verified (0 present, behavior-unverified). Truths 7 and 8 are behaviour-dependent (state transition, cancellation/close ordering); they are VERIFIED on a real-engine behavioural run rather than on symbol presence.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `components/ToiStripCell.tsx` | Client wrapper with click/outside/blur close | VERIFIED | 49 lines, substantive, imported and rendered by `ToiGameStrip` |
| `components/ToiGameStrip.tsx` | Bordered 20x20 squares, popover classes | VERIFIED | `h-5 w-5`, `rounded-xs`, `gap-1`, `group-data-[open]/cell:block`, `pointer-events-none` |
| `components/ToiTrends.tsx` | Pos separator, Per game hint, intro/legend copy | VERIFIED | Present in rendered markup and view tests |
| `lib/research/toi-trends-view.test.ts` | Markup tests for the above | VERIFIED | Pos text, header, square classes, popover classes asserted; passing |
| `.planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` | Re-runnable WebKit check | VERIFIED | Re-run: 15 passed, 0 failed, 0 skipped, exit 0 |
| `.planning/phases/01-ice-time-trends-table/01-UI-SPEC.md` | Revised strip contract | VERIFIED | Revisions section present |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| ToiGameStrip | ToiStripCell | per-square `<ToiStripCell>` with label/state/className and popover children | WIRED |
| ToiStripCell `data-open` | popover visibility | `group-data-[open]/cell:block` on the popover, `group/cell` on the square | WIRED (compiled CSS works: D3 PASS in WebKit on the real page) |
| ToiTrends Per game header | ToiStripCell click | "(click a square)" hint | WIRED |
| ToiTrends | ToiGameStrip | per-row `<ToiGameStrip>` | WIRED |
| (earlier plans) team-games/lines/client/toi-trends/page | unchanged | see previous report | WIRED, no files changed |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| ToiGameStrip squares and popover | `row.perGame`, `game`, `gameDetail(cell, game)` | `buildTrendRows` over `loadTeamResearch` (NHL boxscore + shift chart) | Yes: WebKit run on live MTL data shows OT popover text and 21 rows of squares | FLOWING |
| ToiTrends numeric columns | `row.avgToi`, `ppShare`, deltas | unchanged | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm test` | 186 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Scoped lint | `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx components/ToiStripCell.tsx` | exit 0, no output | PASS |
| Strip popover in WebKit (desktop + emulated iPhone) on real page with live data | `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` | "strip-check: 15 passed, 0 failed, 0 skipped", exit 0; scratch server on 3101 stopped, port 3000 untouched | PASS |

Scope of the WebKit evidence: it is Playwright's bundled WebKit against a scratch copy with the three auth-gate lines removed, plus an emulated iPhone 13. It is not the user's signed-in Safari and not a physical touch device.

### Probe Execution

Step 7c: SKIPPED (no probes declared; the WebKit script is covered under Behavioral Spot-Checks).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRND-01 | 01-01 | Trends table, primary columns, grid removed | SATISFIED | truth 1 |
| TRND-02 | 01-02, 01-08, 01-09 | Exact per-game TOI/PP/SH reachable | SATISFIED in code and WebKit; user's own-browser re-check pending | truths 2, 7, 8, 9 |
| TRND-03 | 01-03 | Recent-vs-window delta for TOI and PP share | SATISFIED | truth 3 |
| TRND-04 | 01-01, 01-02, 01-03, 01-09 | Minimum games, missed not 0, OT flagged | SATISFIED | truths 4, 9 |
| TRND-05 | 01-04 | Sort by trend/Avg TOI/PP share, URL, F/D kept | SATISFIED | truth 5 |

All five IDs are declared in PLAN frontmatter, defined in REQUIREMENTS.md and mapped to Phase 1; no orphaned requirements. REQUIREMENTS.md still shows TRND-02, 03, 05 unchecked and "Gaps Found" in its traceability table, and TRND-01/04 as complete. That file is stale relative to the code. This verifier did not edit it; update it after the human checks pass.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `components/ToiStripCell.tsx` | 35-45 | `role="img"` on a clickable, focusable span; no Enter/Space, no `aria-expanded`, no Escape (WR-07) | Warning | Keyboard open via Tab/focus works; activation and dismissal semantics are incomplete. Not a goal blocker |
| `lib/research/toi-trends-view.test.ts` | 423-445 | Click/outside/blur behaviour covered only by the external WebKit script, not `npm test` (WR-08) | Warning | Regression would not fail `npm test` |
| `lib/research/team-games.ts` | 73-80, 133-146 | WR-05, WR-06 (open since the previous verification) | Warning | Only on upstream API failure; amber banner and server log partly disclose; no wrong number shown for a loaded game |
| `components/ToiTrends.tsx` | 56 | `pb-28 -mb-24` fixed popover reserve (IN-05) | Info | WebKit D11 checked first, last-forward and last rows at Last 20, leftmost and rightmost squares: not clipped. Largest (OT no-shift) popover on the last defense row was not singled out |
| `ToiTrends.tsx` / `ToiStripCell.tsx` | 48-51 / 43 | IN-06 (hard-coded thresholds in copy), IN-07 (on desktop a second click on a hovered square shows no visible change; hover keeps the popover up), IN-08 (accepted, ~200 tab stops) | Info | Copy drift and a mildly misleading desktop affordance; none changes what the user learns from the table |
| other | n/a | IN-01..IN-04 | Info | Edge-case hygiene, unchanged |

No TBD, FIXME or XXX markers in phase source files.

Weighing WR-07 and WR-08 against the goal: the phase goal is scanning a trends table to see who is gaining or losing TOI and PP time, which is delivered by columns, deltas, tint, sparkline and sort, all unaffected. The strip popover is the TRND-02 drill-down. WR-07 is real accessibility debt (Escape dismissal and Enter/Space), but the popover opens on keyboard focus, closes on blur, and the aria-label already exposes the same content; it does not make the drill-down unreachable. WR-08 is a coverage gap; the behaviour it would test was demonstrated end to end in a real browser engine in this verification. Neither is a blocker; both are recorded as advisory. I recommend fixing WR-07 (a small keydown handler) in the next maintenance pass rather than adding a plan to this phase. IN-07 is worth a glance during the human check because it is the very desktop path (hover, then click) the user exercises.

### Human Verification Required

See the `human_verification` list in the frontmatter (3 items): the user's own signed-in Safari retest of UAT tests 2 and 5, a physical-device tap (UAT test 3, previously blocked), and a visual judgment that the Per game squares now read as separate squares (G-01-5). None was run by this verifier; the rendering evidence above is Playwright WebKit, not the user's Safari.

### Gaps Summary

No gaps. UAT gaps G-01-2, G-01-5 and G-01-1b are closed in code and in a real WebKit engine on live data; earlier truths show no regression (no data-layer file changed, full suite green). Remaining work is the user's own-browser, physical-touch and visual confirmation, plus optional follow-up on WR-05..WR-08.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
