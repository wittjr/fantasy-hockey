---
quick_id: 261014-qgu
status: complete
commits: [a5ed8c8, 29d9e72, acea10d, 2670b71]
---

# Quick 261014-qgu Summary

- **WR-06 (a5ed8c8):** unknown-value `—` in `PlayerLinemates.tsx` (header stats, Window share) and `LastGameLines.tsx` (stat cells, empty-table "None") now `text-neutral-600 dark:text-neutral-400`, matching ToiTrends.
- **Amber text (29d9e72):** all amber note text on /research (`PlayerLinemates`, `ToiTrends`, `LastGameLines`, `app/research/page.tsx`) is `text-amber-700 dark:text-amber-400`. The unknown-cell dashed border stays `amber-600`. Amber text on non-research pages (RenamePlayerForm, analysis "Gap") is untouched.
- **Specs (acea10d):** 01- and 02-UI-SPEC record the new colours; 02 gains a Revisions section.
- **Tests (2670b71):** five assertions in `player-detail-view.test.ts` / `unit-events-view.test.ts` checked the old classes; updated. `npm test` 555/555, `tsc --noEmit` and eslint clean.
- 02-REVIEW-DISPOSITION.md: WR-06 marked fixed.

Not visually checked in a browser (class-only change).
