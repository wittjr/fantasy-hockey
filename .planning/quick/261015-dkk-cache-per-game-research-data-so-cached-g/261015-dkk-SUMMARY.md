---
phase: quick-261015-dkk
plan: 01
subsystem: research
tags: [cache, performance, research, nhl]
requires: []
provides:
  - In-memory per-game research cache (team:gameId) with hit/miss split in loadTeamResearch
affects: [lib/research/team-games.ts]
tech-stack:
  added: []
  patterns: [in-memory module cache, bounded Map with oldest-first eviction]
key-files:
  created: []
  modified:
    - lib/research/team-games.ts
    - lib/research/team-games.test.ts
decisions:
  - "In-memory Map in team-games.ts: no serialization of the Maps inside ResearchGame, and hits are known before mapPaced so they skip the pacing gap entirely"
  - "Rejected Next 16 use cache: needs cacheComponents: true, an app-wide switch (8 pages await auth() outside Suspense), forcing app-wide changes"
  - "Rejected unstable_cache: deprecated in favor of use cache, JSON-serializes results so every Map in ResearchGame needs a conversion layer, and gives no hit signal before the call"
  - "Vercel trade-off accepted: cache lives per warm function instance and resets on cold start or deploy; a miss falls back to today's paced load, so correctness never depends on a warm cache"
status: complete
metrics:
  completed: 2026-10-15
actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: 710e78c0b92a3dd1b49744142aaf22996658d5a3
plan_head_after: 034a64bac73e4bd953188117ff297d7d1e10b1ee
---

# Phase quick-261015-dkk Plan 01: Cache per-game research data Summary

In-memory per-team-and-game cache in `loadTeamResearch` so a warm /research navigation resolves cached games at once, with no fetches and no 1 s pacing gap.

## What changed

- `loadGame` now returns `complete` (shift chart loaded with rows AND play-by-play loaded with plays). Only complete games are cached, mirroring the client.ts rule that never pins empty or failed data.
- `gameCache` (`team:gameId` key) stores `{ game, players, expiresAt }`. Expiry follows the same `finishedGameCache` tier as the fetch cache (1 h recent or no start time, 30 days old), computed once per game and shared with `loadGame`.
- `loadTeamResearch` decides hits once up front, passes only misses (newest first) to `mapPaced`, then rebuilds results aligned with `recent` so the merge loop, error log, `unavailableDates` and all-failed throw are unchanged.
- `MAX_CACHED_GAMES = 640` with oldest-first eviction (delete then set so a re-store moves to the end); `clearGameCache()` test hook.
- Unchanged: `mapPaced`, pacing constants, `lib/nhl/client.ts`, `app/research/page.tsx`, `next.config.ts`.

## Verification

- `npx tsx --test lib/research/team-games.test.ts`: 25/25 (18 existing + 7 new: warm reload, pacing skipped under 300 ms with gapMs 1000, incomplete retried, failed boxscore not cached, 1 h tier, 30-day tier, size bound).
- `npm test`: 564/564 pass. eslint clean on both files.
- `npx tsc --noEmit`: only error is pre-existing `app/layout.tsx(20,50) Cannot find name 'LayoutProps'` (Next-generated types absent in the fresh worktree, unrelated to this change; verified file untouched).
- `git diff --name-only` vs base shows only the two planned files.

## Deviations from Plan

None - plan executed as written. RED for Task 1 was the missing `clearGameCache` export, which failed every test at `stubNhl` rather than only the new ones.

## Pending

- Human check (skipped per orchestrator instruction): run `npm run dev`, open `/research?team=TOR&games=20`, then click a player, Close player detail, EV/PP/SH tab and a column sort; each warm navigation should log well under about 300 ms server time.

## Known Stubs

None.

## Threat Flags

None. T-261015-dkk-01 mitigated (640 cap, expiry on lookup, size-bound test).

## Self-Check: PASSED

- lib/research/team-games.ts and lib/research/team-games.test.ts present; commits 57117f6 and 034a64b are ancestors of HEAD.
