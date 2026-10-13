---
phase: quick-261012-tph
plan: 01
subsystem: research
tags: [shift-charts, dedupe, wr-01]
status: complete
requirements: [WR-01]
key-files:
  modified:
    - lib/research/lines.ts
    - lib/research/lines.test.ts
    - lib/research/pair-seconds.ts
    - lib/research/pair-seconds.test.ts
decisions:
  - "Dedupe in analyzeGameLines (not bucketOnIce) via a shared exported dedupeOnIce, matching d935cc1"
actuals:
  tokens: 6000
  tasks: 2
  commits: 3
plan_head_before: 5c29a14ba73ff45a29cc37250352f99b70fd5de6
plan_head_after: 1a5d2f5ec6f7cba4e68c01c14d8627e3f4db9dea
completed: 2026-10-12
---

# Quick 261012-tph: Dedupe skaters in analyzeGameLines (WR-01 follow-up) Summary

analyzeGameLines now dedupes own and opponent on-ice skaters (shared `dedupeOnIce`, exported from `lib/research/lines.ts`) before strength classification, so overlapping non-identical shift rows no longer flip EV/PP/SH, double a player's seconds, or repeat an id in a unit key. pairSeconds uses the same helper.

## Tasks

| Task | Commits | Notes |
| ---- | ------- | ----- |
| 1 (tracer, TDD) | 2e78124 (RED tests), 53f510b (GREEN fix) | Tests A-C failed before the fix, pass after. JSDoc for analyzeGameLines and bucketOnIce updated. |
| 2 | 1a5d2f5 | pairSeconds imports dedupeOnIce, local helper removed, header updated, oracle test on overlapping rows added. |

## Verification

- `npx tsx --test lib/research/*.test.ts`: 271 pass, 0 fail.
- `npx tsc --noEmit`: only `app/layout.tsx(20,50): Cannot find name 'LayoutProps'`, the known pre-existing missing Next-generated type in a fresh worktree (unrelated, not fixed).

## Deviations from Plan

None - plan executed as written. (RED tests were committed separately from the GREEN fix.)

## Known Stubs

None.

## Self-Check: PASSED

Files modified exist; commits 2e78124, 53f510b, 1a5d2f5 are in HEAD history.
