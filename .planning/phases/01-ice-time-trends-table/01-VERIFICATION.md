---
phase: 01-ice-time-trends-table
verified: 2026-10-14T20:00:00Z
status: passed
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
  - components/PlayerLink.tsx
  - components/StripPopover.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.ts
  - lib/research/format.ts
  - lib/research/game-strip.ts
  - lib/research/lines.ts
  - lib/research/team-games.test.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.ts
covered_digest: "v3:sha256:253bf011dd42fb139040c70ed0e540243298506dce38ece5d0000faa23fbd494"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 9/9
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "UI re-audit (01-UI-REVIEW.md, 2026-10-14, 19/24): muted-dash contrast, all-dash Δ columns at a 2-game window, and copy drift from the UI-SPEC"
    category: other
    reason: "Polish findings. The 2-game all-dash case is explained by an on-page legend line, so no number is wrong or missing. None breaks a must-have."
    evidence_status: "01-UI-REVIEW.md; legend branch read in ToiTrends.tsx"
  - finding: "Popover note still says 'No PP/SH data (shift chart not published)' (game-strip.ts:51) while the legend says 'not published yet, or it failed to load' (ToiTrends.tsx)"
    category: other
    reason: "Cosmetic wording on a degraded path; the value shown is a dash, never a wrong number."
    evidence_status: "code read"
  - finding: "IN-11: newestMissing does not cover a failed second-newest game"
    category: other
    reason: "The amber banner still names the missing date; only the re-anchoring sentence is omitted."
    evidence_status: "code read (page.tsx:50-52)"
  - finding: "ToiStripCell DOM wiring (outside-pointerdown, blur, hover-Escape listener) has no unit test (no DOM test library); webkit-strip-check.cjs could not run this session"
    category: other
    reason: "The pure transitions (nextOpen, nextDismissed) are unit-tested and pass. The DOM wiring was proven in a real WebKit run on 2026-10-12 (16/16 incl. D13, recorded in 02-04-SUMMARY) and by the user in UAT 01-6 and 02-3. The only later change to the file (2574b76) adds a hover-only Escape listener and leaves click, outside and blur paths untouched."
    evidence_status: "git show 2574b76; 02-04-SUMMARY.md; 01-UAT.md test 6; 02-UAT.md test 3. Script not re-run (3 s readiness probe shorter than the ~5 s render; WebKit build not installed)"
  - finding: "IN-01, IN-02 (Phase 1 numbering), IN-05, IN-06, IN-07, IN-09, IN-10 (carried info items)"
    category: other
    reason: "Hygiene / copy / contrast-margin items already dispositioned as open info; none affects a requirement."
    evidence_status: "01-REVIEW.md, 01-REVIEW-DISPOSITION.md"
---

# Phase 1: Ice-Time Trends Table Verification Report

**Phase Goal:** User can scan a team's ice-time section as a trends table and immediately see which players are gaining or losing TOI and power-play time
**Verified:** 2026-10-14
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-12) went stale after phases 02 and 03 changed files it covered. This pass re-reads the current code.

## Goal Achievement

The goal holds against the code as it stands now. I read `components/ToiTrends.tsx`, `ToiGameStrip.tsx`, `ToiStripCell.tsx`, `StripPopover.tsx`, `app/research/page.tsx`, `lib/research/toi-trends.ts`, `game-strip.ts`, `team-games.ts` and the `lines.ts` / `nhl/client.ts` hooks, rather than relying on the earlier report or on SUMMARY claims.

### Later-phase changes judged against the current design

Phases 02 and 03 deliberately changed some phase-01 behaviour. None of these changes removes a phase-01 must-have, so I treated them as the intended design and not as regressions:

- Player names in the trends table are now `PlayerLink` links (`ToiTrends.tsx:97-106`); the name, selected-row bar and "Moving up/down" sr-only text are all still present.
- Strip squares are `role="button"` with an Escape-dismiss `data-dismissed` flag and no `aria-expanded` (`ToiStripCell.tsx:66-100`). This closes the old WR-10 advisory (aria-expanded vs hover/focus state).
- The popover markup moved to the shared `StripPopover` component. It keeps `pointer-events-none`, `right-0 top-full`, and the reveal classes `group-hover/cell:block group-focus-visible/cell:block group-data-[open]/cell:block`, plus `group-data-[dismissed]/cell:hidden`. Content (heading, title, OT tag, rows, notes) is the same as before for the Per game strip, where `heading` is absent.
- `loadGame` now also fetches play-by-play and builds `pairs` and `events`. A play-by-play failure yields `events = null` and never fails the game, and the shift-chart and OT handling used by TOI, PP and SH is unchanged (`team-games.ts:117-160`).
- Sort links and name links carry `player`, `sit` and `all` through `researchHref`; the default URL stays free of extra params.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: one row per skater with Avg TOI, PP share, SH, trend arrow and sparkline, F then D, goalies out, per-game numeric grid gone (TRND-01) | VERIFIED | `ToiTrends.tsx:60-79` header Player, Pos, Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend. `buildTrendRows` skips `group === "G"` and rows with 0 games played. `sortRows` keeps F (0) before D (1). One value per cell, no stacked per-game text. Page renders `ToiTrends` (`page.tsx:111`). Full suite green. |
| 2 | SC2: exact per-game TOI/PP/SH readable without the grid, via click, hover and keyboard focus; OT visibly flagged (TRND-02, TRND-04) | VERIFIED | `gameDetail`/`detailText` give the popover content and the aria-label; `StripPopover` reveals on hover, focus-visible and `data-open`. OT flagged by sky ring (`ToiGameStrip.tsx:19`), OT/SO tag and "OT excluded +m:ss" (`game-strip.ts:40-43`, `StripPopover.tsx:31`), and hollow sky sparkline dot (`ToiTrends.tsx:279-284`). Markup tests pass. Real-engine and user evidence listed under truth 7. |
| 3 | SC3: recent-vs-window Δ for TOI and PP share on every row (TRND-03) | VERIFIED | `recentDelta` (last 2 games by index vs earlier, min 3 included games), PP share Δ weighted by team PP; `DeltaCell` renders signed values with muted slope arrow; mover colour and row tint from `deltaCrossing` at 120 s / 15 pts. `toi-trends.test.ts` boundary tests pass (one step either side). |
| 4 | SC4: below-minimum players show no trend with GP visible; missed games never 0; unknown never 0; OT flagged (TRND-04) | VERIFIED | `buildCell` returns `null` for a missed game, `toi: null` for OT with no chart, `pp/sh: null` without a chart; `included` filters on `toi !== null`. Δ gated at `includedGames < 3`; slope needs 2 points. Pos cell shows `n/N GP`; unknown renders `—`. `team-games.ts:136-148` drops an OT game whose chart failed to load instead of letting it enter an average. Tests in `toi-trends.test.ts` and `team-games.test.ts` pass. |
| 5 | SC5: sort by trend, Avg TOI or PP share, kept in the URL, F/D kept (TRND-05) | VERIFIED | `parseSort` allowlist, `nextSort`, `effectiveSort` (1-game window falls back), `sortRows` (group first, nulls last, deterministic ties), `researchHref` carries sort through team, window, player and sit links; `SortHeader` sets `aria-sort` and `scroll={false}` via `PendingLink`. Sort tests pass. UAT 1-4 pass. |
| 6 | PP share / PP share Δ / SH / tint correct for games with a shift chart (CR-01) | VERIFIED | `uniqueShifts` in `lines.ts:22` is used by both `regulationSeconds` (`:40`) and `analyzeGameLines` (`:98`); `lines.test.ts` duplicate-row and PP-invariant tests pass. `getShiftCharts` re-requests an empty cached chart uncached (`client.ts:210-213`). |
| 7 | 01-08: click/tap opens a square's popover, it persists, second click / outside press / blur closes, opening another closes the first; hover and keyboard focus still work | VERIFIED | `ToiStripCell.tsx` implements the transitions through `nextOpen` / `nextDismissed` (unit-tested, passing); outside-pointerdown effect closes an open square, so opening another closes the first; blur closes. Behaviour-dependent, so backed by evidence beyond presence: real WebKit run on the Per game strip after the Phase 2 rewrite (16/16 including D3-D10, D13, per `02-04-SUMMARY.md`), user UAT `01-UAT.md` test 6 pass and `02-UAT.md` test 3 pass on the shared component. Only later edit (`2574b76`) is an additive hover-Escape listener. The WebKit script could not be re-run this session and is not counted either way. |
| 8 | 01-08: open popover never blocks squares under it; pointer cursor; aria-label unchanged; only `ToiStripCell` is client code | VERIFIED | `StripPopover` has `pointer-events-none` and `aria-hidden`; `STRIP_SQUARE_CLASS` has `cursor-pointer` and the hover/focus outline; label comes from `detailText(detail)`; `ToiGameStrip`, `StripPopover` and `ToiTrends` have no `"use client"`, only `ToiStripCell` does, and it receives strings plus server-rendered children. View tests assert these. |
| 9 | 01-09: separate bordered 20x20 squares on a 24px pitch, header/intro/legend copy, Pos separator | VERIFIED | `STRIP_SQUARE_CLASS` is `h-5 w-5 rounded-xs border`; strip container is `flex gap-1`; per-state borders (solid, dashed grey, dashed sky) at `ToiGameStrip.tsx:20-25`. Header "Per game (click a square)", intro ends "click, tap or hover a square for exact per-game times.", legend says "A blue ring means overtime; OT minutes are excluded.", Pos cell renders `{position}{" "}<span>n/N GP</span>`. UAT 7 and 8 pass. |

**Score:** 9/9 truths verified (0 present, behavior-unverified).

### Deferred Items

None. No gap was moved to a later phase.

### Advisory (New Scope, Unevidenced)

Findings that do not block the goal. See the frontmatter `advisory:` list for evidence.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | UI re-audit 19/24: muted-dash contrast, all-dash Δ at a 2-game window, copy drift | other | Polish. The 2-game case has an on-page explanation; no value is wrong |
| 2 | Popover note "shift chart not published" narrower than the legend wording | other | Copy on a degraded path |
| 3 | IN-11: `newestMissing` ignores a failed second-newest game | other | Banner still names the date |
| 4 | `ToiStripCell` DOM wiring untested in jsdom; WebKit script not re-runnable this session | other | Pure logic tested; real-engine run (16/16) and two UATs cover the wiring |
| 5 | Carried info items IN-01/05/06/07/09/10 | other | Hygiene |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `components/ToiTrends.tsx` | Trends table, tint, Pos GP, legend, sort headers | VERIFIED | 298 lines, imported by `page.tsx`, renders `ToiGameStrip`, `PlayerLink`, `PendingLink` |
| `components/ToiGameStrip.tsx` | Strip squares | VERIFIED | Wired from `ToiTrends`; wraps each square in `ToiStripCell` with a `StripPopover` child |
| `components/ToiStripCell.tsx` | Client wrapper for click/keyboard/Escape state | VERIFIED | Substantive; imported by `ToiGameStrip` and the view test |
| `components/StripPopover.tsx` | Shared popover | VERIFIED | Used by `ToiGameStrip` (and the heat strip) |
| `lib/research/toi-trends.ts` | Row builder, delta, slope, sort, URL builder | VERIFIED | Pure, tested |
| `lib/research/game-strip.ts` | Cell state, shade, detail | VERIFIED | Pure, tested |
| `lib/research/team-games.ts` | Loader with OT / failed-chart / failed-game handling | VERIFIED | `unavailableDates` surfaced by `page.tsx` banner |
| `lib/research/lines.ts`, `lib/nhl/client.ts`, `lib/research/format.ts` | De-duplicated shifts, shift-chart caching, formatters | VERIFIED | Read; tests pass |
| `app/research/page.tsx` | Page wiring, banners | VERIFIED | Calls `loadTeamResearch`, renders `ToiTrends` |
| Six phase-01 test files | Coverage | VERIFIED | Included in the 552/552 suite run |
| `webkit-strip-check.cjs` | Real-engine check | NOT RUN | Could not run this session; not counted |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `page.tsx` | `loadTeamResearch` then `ToiTrends` | server data flow | WIRED | `page.tsx:34-42, 111` |
| `ToiTrends` | `buildTrendRows` / `sortRows` | rows from `research.players` and `research.games` | WIRED | `ToiTrends.tsx:41` |
| `ToiTrends` | `ToiGameStrip` | per-row `<ToiGameStrip row games>` | WIRED | `ToiTrends.tsx:150` |
| `ToiGameStrip` | `ToiStripCell` + `StripPopover` | per-square wrapper, popover as children | WIRED | `ToiGameStrip.tsx:28-43` |
| `ToiStripCell` open state | popover visibility | `data-open` / `data-dismissed` to `group-data-[...]/cell` | WIRED | `ToiStripCell.tsx:68-69`, `StripPopover.tsx:17` |
| `SortHeader` | URL sort state | `researchHref(nextSort(...))` | WIRED | `ToiTrends.tsx:196` |
| `loadGame` failed chart | `unavailableDates` and amber banner | throw on OT with null chart, `allSettled` rejection | WIRED | `team-games.ts:137, 205-210`; `page.tsx:88-94` |
| `row.mover` | tint and "Moving up/down" | class and sr-only span | WIRED | `ToiTrends.tsx:84, 102` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ToiTrends` rows, strip, popover | `row.avgToi`, deltas, `row.perGame` | `loadTeamResearch` then NHL boxscore and shift chart via `getBoxscore` / `getShiftCharts` | Yes: values derive from fetched boxscore TOI and shift seconds; no hardcoded literals | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite (run once) | `npm test` | 552 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Scoped lint | `npx eslint app/research lib/research lib/nhl components/Toi*.tsx components/StripPopover.tsx` | exit 0 | PASS |
| Real-engine strip behaviour | `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` | could not run (readiness probe vs render time; WebKit build absent) | SKIP (not counted) |

### Probe Execution

Step 7c: SKIPPED (no probes declared in the phase plans).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRND-01 | 01-01, 01-05, 01-06 | Trends table, primary columns, grid removed | SATISFIED | truth 1, 6 |
| TRND-02 | 01-02, 01-07, 01-08, 01-09 | Exact per-game TOI/PP/SH reachable | SATISFIED | truths 2, 7, 8, 9 |
| TRND-03 | 01-03, 01-05, 01-07 | Recent-vs-window Δ for TOI and PP share | SATISFIED | truth 3 |
| TRND-04 | 01-01, 01-02, 01-03, 01-05, 01-06, 01-09 | Minimum games, missed/unknown never 0, OT flagged | SATISFIED | truths 4, 6, 9 |
| TRND-05 | 01-04, 01-07 | Sort by trend/Avg TOI/PP share, URL, F/D kept | SATISFIED | truth 5 |

All five IDs appear in PLAN frontmatter, are defined in `.planning/REQUIREMENTS.md` (lines 18-22, marked `[x]`) and map to Phase 1 in the traceability table (lines 80-84). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `lib/research/game-strip.ts` | 51 | Popover note "shift chart not published" narrower than legend | Info | Copy drift on a degraded path |
| `app/research/page.tsx` | 50-52 | `newestMissing` ignores a failed second-newest game (IN-11) | Info | Banner still names the date |
| `components/ToiTrends.tsx` | 56 | `pb-28 -mb-24` fixed popover reserve (IN-05) | Info | UAT 6 saw no clipping |

No TBD, FIXME or XXX markers, and no TODO, HACK or placeholder markers, in the phase source files.

### Human Verification Required

None. UAT (`01-UAT.md`, complete) confirmed the human-facing behaviour. Tests 2 and 5 reported issues that were closed by 01-08 and 01-09 and re-tested as passing (tests 6, 7, 8); test 3 (phone) is a recorded deferral because the site targets laptop browsers.

### Gaps Summary

No gaps. All five requirements are satisfied and all nine must-haves hold against the current code. The intentional phase 02 and 03 changes (PlayerLink names, role="button" squares with Escape-dismiss and no aria-expanded, shared StripPopover, play-by-play in the loader) leave the phase-01 goal intact. The old WR-10 advisory is closed by the 02-04 change. `npm test` (552/552), `tsc` and scoped `eslint` are clean. The WebKit script is the one piece of evidence that could not be refreshed, so truths 7 and 8 rest on its last passing run plus two user UATs plus current unit and markup tests.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
