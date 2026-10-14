---
quick_id: 261014-lu2
slug: fix-phase-01-ui-re-audit-warnings
status: complete
date: 2026-10-14
commits: [1a68924, f71fe3f]
---

# Quick 261014-lu2 Summary: phase-01 UI re-audit warnings

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Muted dash contrast | `muted` const and DeltaCell dash → `text-neutral-600 dark:text-neutral-400`; UI-SPEC States rows updated |
| 2 | Window of 2 | User chose to keep the columns plus the footnote; added a Window-of-2 States row and the Window-2 note copy to UI-SPEC |
| 3 | Copy drift | Contract amended to the shipped PP share title, amber note and error banner (no raw `{error}`, T-01-11); the popover line in `lib/research/game-strip.ts` now matches the legend wording |
| 4 | Pos cell `ml-1` | Removed |
| 5 | Unsigned zero Δ | `formatSignedClock` zero → `±0:00`; new `formatPointsDelta` (zero → `±0`) for PP share Δ in ToiTrends and PlayerLinemates. `formatSignedPoints` keeps `0` because the phase-3 +/- contract requires it |

Tests: new markup tests in `lib/research/toi-trends-view.test.ts` (dash classes, no GP margin, signed zero Δ), formatter tests in `toi-trends.test.ts`, updated popover strings in `game-strip.test.ts`.
Verification: `npm test` 555/555, `npx tsc --noEmit` clean (after `npx next typegen` for the worktree's generated route types), scoped eslint clean.
