---
phase: 02-player-linemate-detail
fixed_at: 2026-10-12T00:00:00Z
review_path: .planning/phases/02-player-linemate-detail/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-12
**Source review:** .planning/phases/02-player-linemate-detail/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (0 critical, 1 warning, 8 info; fix_scope all; IN-06 is accepted by design and not in this review)
- Fixed: 8
- Skipped: 1

**Verification:** Edits and per-fix `tsx --test lib/research/*.test.ts` ran in an isolated worktree (node_modules resolved from the main checkout). After the fast-forward onto `gsd/phase-1-ice-time-trends-table`, the gates were re-run in the main checkout: `npx tsc --noEmit` clean, `npx eslint components lib/research` clean, and `tsx --test lib/research/*.test.ts` 273 pass, 0 fail (271 before, plus 2 new tests).

**Browser spot-check suggested** (UI behaviour touched): IN-02 (Escape over a hovered strip square), IN-03 (close link accessible name, no visual change), IN-04 (name-link URLs in a 1-game window with a delta sort), WR-05 (footnote wording).

## Fixed Issues

### WR-05: Window-share footnote still says linemates are "ordered by the team's last 2 games, then by the whole window"

**Files modified:** `components/PlayerLinemates.tsx`, `lib/research/player-detail-view.test.ts`
**Commit:** 44ae424
**Applied fix:** The footnote now says linemates are "ordered by window share, highest first"; the pinned string in the view test was updated to match.

### IN-02: Escape cannot dismiss a popover that is open by mouse hover alone

**Files modified:** `components/ToiStripCell.tsx`
**Commit:** 2574b76
**Applied fix:** The square tracks hover (`onPointerEnter` / `onPointerLeave`). While hovered, a `document` `keydown` listener applies the existing `escape` transitions (`nextOpen`, `nextDismissed`), so Escape hides a hover-only popover without needing focus. No unit test covers the effect (the repo has no DOM test harness); the pure transition functions are unchanged. Needs a browser spot-check.

### IN-03: Close link's accessible name does not contain its visible text

**Files modified:** `components/PlayerLinemates.tsx`
**Commit:** 5410486
**Applied fix:** `aria-label` is now `Close player detail: ${name}`, which contains the visible text "Close player detail". The UI-SPEC copywriting row still lists the old label; it may want a matching edit.

### IN-04: Name links get different `sort` values depending on which table they are in

**Files modified:** `components/ToiTrends.tsx`, `lib/research/player-links-view.test.ts`
**Commit:** 8b7ba09
**Applied fix:** Chose the raw requested sort everywhere for name links: the trends-table `PlayerLink` now gets `requestedSort`, matching `LastGameLines` and `PlayerLinemates`. Sort-header links still use the effective sort (they must, to flip direction on the visible column). Added a test for a 1-game window with `sort=toiDelta`; it fails without the change.

### IN-05: Duplicated situation labels and an export with no consumers

**Files modified:** `components/LastGameLines.tsx`
**Commit:** f48d638
**Applied fix:** Removed the local `SITUATION_LABELS` and imported `SITUATION_ABBREV` from `lib/research/linemates.ts`. Not applied: removing the `LinemateRowView` export, because `lib/research/player-detail-view.test.ts` imports it, so the "no consumers" claim does not hold. Not applied: the double `buildTrendRows` call, which the review marks as a duplication note only.

### IN-07: Line-change tests no longer assert ordering

**Files modified:** `lib/research/linemates.test.ts`
**Commit:** 3b33d35
**Applied fix:** Added a 5-game line-change test asserting the full ordered `[id, tag]` list (10, 11, 12, 13) by window share then id.

### IN-08: `regulationSeconds` still double-counts overlapping differing rows, so OT-game TOI no longer matches the line passes

**Files modified:** `lib/research/lines.ts`
**Commit:** 657e73f
**Applied fix:** Took the review's documentation option rather than adding interval-merge code for an anomalous-feed, OT/SO-only case. The `regulationSeconds` doc comment now states that non-identical overlapping rows are summed and that the result can exceed the line passes' per-player total by the overlap. Behaviour is unchanged. Status: fixed (documented as deliberate).

### IN-09: `analyzeGameLines` doc comment now describes only the dedupe, not the function

**Files modified:** `lib/research/lines.ts`
**Commit:** 657e73f (shared with IN-08, same file)
**Applied fix:** The JSDoc now leads with what the function returns (per-situation seconds, EV/PP/SH units, per-skater seconds), then keeps the dedupe note. The optional move of the dedupe into `bucketOnIce` was not done.

## Skipped Issues

### IN-01: Sort/tab links carry `sit` and `all` when no player is selected

**File:** `components/ToiTrends.tsx:218`, `app/research/page.tsx:64`
**Reason:** Skipped as a design decision, not a defect. The UI-SPEC (Interaction section) says team links "keep `sit`", and the close link keeps `sit`. `player-detail-view.test.ts` pins that ("the close link keeps the team, games and situation"). Emitting `sit`/`all` only when a player is set would reverse that spec and break the pinned tests, which goes beyond the finding. The review itself calls the extra params harmless and allowlisted. If the user wants cleaner URLs, change the spec first, then `researchHref`.
**Original issue:** `researchHref` emits `sit` and `all` even when no `player` is set, so stale `?all=1` / `?sit=pp` persist through sort and team links.

---

_Fixed: 2026-10-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
