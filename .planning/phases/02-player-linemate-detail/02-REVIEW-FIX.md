---
phase: 02-player-linemate-detail
fixed_at: 2026-10-12T00:00:00Z
review_path: .planning/phases/02-player-linemate-detail/02-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-12
**Source review:** .planning/phases/02-player-linemate-detail/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (0 critical, 3 warning; Info excluded by fix_scope)
- Fixed: 3
- Skipped: 0

**Verification:** Edits and per-fix tests ran in an isolated worktree (node_modules resolved from the main checkout). After the fast-forward onto `gsd/phase-1-ice-time-trends-table`, `npx tsc --noEmit` (exit 0) and `tsx --test lib/research/*.test.ts` (267 pass, 0 fail) were re-run in the main checkout. Running tsc inside the worktree alone reported `LayoutProps` missing in `app/layout.tsx`, which is a generated Next type absent from a fresh worktree and not related to these changes.

## Fixed Issues

### WR-01: pairSeconds classifies strength from a duplicate-inflated skater count, then deduplicates only the credited seconds

**Files modified:** `lib/research/pair-seconds.ts`, `lib/research/pair-seconds.test.ts`
**Commit:** d935cc1
**Applied fix:** Deduplicated the on-ice skaters before calling `situationFor`, for both own team and opponent (an opponent's overlapping rows would flip strength the same way). Removed the later per-loop `new Set`. Updated the file header to say this deliberately differs from `analyzeGameLines`, which still classifies from the raw count. `analyzeGameLines` was left unchanged (outside the finding's scope), so the oracle test still holds only for clean charts. Added two fixture tests: a player with two overlapping differing rows, and an opponent with the same. Both fail on the old code (own seconds split ev 30 / pp 30) and pass now (ev 60).
**Status:** fixed. Follow-up resolved 2026-10-12: the user chose to give `analyzeGameLines` the same dedupe. Quick task 261012-tph (`53f510b`, `1a5d2f5`) added a shared `dedupeOnIce` in `lib/research/lines.ts`, applied it in both passes, and extended the oracle test to charts with overlapping rows, so the two passes agree again. The header note above about `pairSeconds` differing no longer applies.

### WR-02: "no-earlier-data" tag note states a false cause

**Files modified:** `components/PlayerLinemates.tsx`, `lib/research/player-detail-view.test.ts`
**Commit:** 0cb6e26
**Applied fix:** Reworded the note to "has no {situation} time with a shift chart in the earlier games of this window to compare with", matching what the `no-earlier-data` reason actually checks. Updated the pinned string in the view test.

### WR-04: Footer still says linemates are sorted "most recent time together first" after D-28

**Files modified:** `components/PlayerLinemates.tsx`, `lib/research/player-detail-view.test.ts`
**Commit:** 379c17c
**Applied fix:** Changed the capped-list footer to "highest share of time together first" and updated the expected string in the view test.

---

_Fixed: 2026-10-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
