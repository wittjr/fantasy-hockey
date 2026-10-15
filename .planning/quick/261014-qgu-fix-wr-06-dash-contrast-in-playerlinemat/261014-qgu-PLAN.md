---
quick_id: 261014-qgu
type: quick
files_modified:
  - components/PlayerLinemates.tsx
  - components/LastGameLines.tsx
  - components/ToiTrends.tsx
  - app/research/page.tsx
  - .planning/phases/01-ice-time-trends-table/01-UI-SPEC.md
  - .planning/phases/02-player-linemate-detail/02-UI-SPEC.md
---

# Quick 261014-qgu: WR-06 dash contrast + amber footnote text

Source: STATE.md blocker (Phase 2 re-review WR-06 open) and 02-UI-REVIEW.md Top Fixes 1 and 2.

## Task 1: Placeholder dash / "None" contrast (WR-06)
- files: components/PlayerLinemates.tsx (HeaderStat dash, Window share dash), components/LastGameLines.tsx (StatCells DASH tone, empty-table "None")
- action: `text-neutral-400 dark:text-neutral-500` (and bare `text-neutral-400`) -> `text-neutral-600 dark:text-neutral-400`, matching ToiTrends.tsx.
- verify: `grep -n 'text-neutral-400 dark:text-neutral-500\|"py-1 text-neutral-400"' components/PlayerLinemates.tsx components/LastGameLines.tsx` returns nothing; `npx tsc --noEmit`; `npm run lint`.

## Task 2: Amber text below AA
- files: components/PlayerLinemates.tsx, components/ToiTrends.tsx, components/LastGameLines.tsx, app/research/page.tsx
- action: amber note/footnote *text* `text-amber-600` -> `text-amber-700`; keep `dark:text-amber-400`. Keep `border-amber-600` on unknown cells (non-text, 3:1 suffices). Pages outside /research untouched.
- verify: `grep -rn 'text-amber-600' components/PlayerLinemates.tsx components/ToiTrends.tsx components/LastGameLines.tsx app/research/page.tsx` returns nothing.

## Task 3: Specs follow code
- files: 01-UI-SPEC.md, 02-UI-SPEC.md
- action: Caution token text -> amber-700/400 (border stays amber-600); 02 header-stat dash -> neutral-600/400; footnote copy rows -> amber-700. Add a dated amendment note in 02 like 01's.
