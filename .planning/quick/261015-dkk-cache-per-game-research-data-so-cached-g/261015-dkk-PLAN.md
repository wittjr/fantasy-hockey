---
phase: quick-261015-dkk
plan: 01
quick_id: 261015-dkk
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/research/team-games.ts
  - lib/research/team-games.test.ts
autonomous: true
requirements:
  - quick-261015-dkk

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "A second loadTeamResearch for the same team, with every game in the window complete and unexpired in the cache, makes no boxscore, shift-chart or play-by-play requests and does not wait on the pacing gap (a warm 3-game load with gapMs 1000 finishes in under 300 ms)"
    - "Games that are not in the cache are still loaded through mapPaced, newest first, MAX_CONCURRENT_GAMES at a time and GAME_START_GAP_MS apart, so a cold load keeps today's 429 protection"
    - "A game whose shift chart or play-by-play failed (null) or is unpublished (empty) is never cached and is requested again on the next load"
    - "A game whose boxscore failed (or an OT/SO game with no chart) is never cached, still appears in unavailableDates, and is requested again on the next load"
    - "A cached game expires on the same tier as finishedGameCache: 1 hour for a game under 48 h old or with no start time, 30 days for an older game"
    - "The cache holds at most MAX_CACHED_GAMES entries; storing past the limit drops the oldest stored entry"
    - "next.config.ts, lib/nhl/client.ts and app/research/page.tsx are unchanged (no Cache Components switch, no client change)"
  artifacts:
    - path: "lib/research/team-games.ts"
      provides: "In-memory per-game cache keyed by team and game id, hit/miss split in loadTeamResearch, MAX_CACHED_GAMES, clearGameCache"
      contains: "MAX_CACHED_GAMES"
    - path: "lib/research/team-games.test.ts"
      provides: "Tests for warm reload, pacing skipped on hits, incomplete/failed games retried, tier expiry, size bound"
      contains: "clearGameCache"
  key_links:
    - from: "lib/research/team-games.ts loadTeamResearch"
      to: "gameCache lookup"
      via: "every game in `recent` is looked up before mapPaced; only misses are passed to mapPaced"
      pattern: "mapPaced\\("
    - from: "lib/research/team-games.ts mapPaced callback"
      to: "finishedGameCache tier"
      via: "the same tier object is passed to loadGame and used for the entry's expiry"
      pattern: "finishedGameCache\\("
    - from: "app/research/page.tsx"
      to: "loadTeamResearch"
      via: "unchanged call loadTeamResearch(team, gameCount); every /research navigation goes through it"
      pattern: "loadTeamResearch\\(team, gameCount\\)"
---

<objective>
Cache each fully loaded research game in memory, keyed by team and game id, so a /research navigation that re-renders the same team (Close player detail, EV/PP/SH tab, sort, opening a player, switching to a smaller window) resolves cached games immediately instead of waiting 1 s per game in mapPaced and re-running analyzeGameLines, pairSeconds and buildGameEvents.

Purpose: today every navigation on /research re-runs loadTeamResearch, and mapPaced puts a 1000 ms start gap before every loadGame even when all three fetches hit Next's data cache, so a fully warm Last 20 still spends about 19 s in setTimeout. Only games that actually go to the network need that pacing.

Output: lib/research/team-games.ts with an in-memory game cache, a hit/miss split, and freshness and size rules matching finishedGameCache; lib/research/team-games.test.ts covering them.

Approach decided at planning time (record it in the SUMMARY under decisions):
- In-memory Map in lib/research/team-games.ts, chosen. It needs no serialization, so the Maps inside ResearchGame (toi, regulationToi, lines.playerSeconds, pairs, events) are cached as they are, and a hit is known before mapPaced runs, so hits skip the pacing completely.
- Next 16 `"use cache"` rejected. It needs `cacheComponents: true` in next.config.ts, which is an app-wide switch: 8 pages call `await auth()` (cookies) at the top level outside Suspense, and instant-navigation validation would require Suspense boundaries or `instant = false` opt-outs across the app. The orchestrator rule says to reject an option that forces app-wide changes.
- `unstable_cache` rejected. The Next 16 docs (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md) say `use cache` replaces it. It JSON-serializes results, so every Map in ResearchGame would need a plain-data conversion layer. It also gives no hit signal before the call, so mapPaced could not skip the gap for hits.
- Vercel trade-off, accepted. The cache lives only inside one warm function instance and resets on every deploy and on a cold start. Vercel Fluid compute reuses a warm instance across requests, so consecutive navigations on one team usually hit. A cold or different instance falls back to today's paced load, whose fetches are still served by Vercel's data cache. Correctness never depends on the cache being warm.
</objective>

<execution_context>
@/Users/jwitt/Development/fantasy-hockey/.claude/gsd-core/workflows/execute-plan.md
@/Users/jwitt/Development/fantasy-hockey/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@lib/research/team-games.ts
@lib/research/team-games.test.ts
@lib/nhl/client.ts
@app/research/page.tsx

<interfaces>
From lib/nhl/client.ts (do not modify):
- finishedGameCache(startTimeUTC: string | undefined, now = Date.now()): { next: { revalidate: number } }. revalidate is RECENT_GAME_REVALIDATE_S (3600) for a game under 48 h old or with a missing or unparseable start, and OLD_GAME_REVALIDATE_S (2592000, 30 days) otherwise.
- getShiftCharts / getPlayByPlay re-request uncached (`cache: "no-store"`) when the cached result is empty, so empty data is never pinned. The game cache must keep that rule: store only complete games.
- NhlClubGame has id, gameDate, gameState, gameType and an optional startTimeUTC.

From lib/research/team-games.ts (current shape, line numbers approximate):
- mapPaced<T, R>(items, fn, { concurrency, gapMs }): Promise<PromiseSettledResult<R>[]>. Results come back in input order, and each start is reserved at least gapMs after the previous one. Unchanged by this plan.
- loadGame(team, gameId, cache) (line ~121): Promise<{ game: ResearchGame; players: Map<number, ResearchPlayer> }>. It throws on a failed boxscore and on an OT/SO game whose shift chart failed. The local `shifts` is NhlShift[] | null and `pbp` is NhlPlayByPlay | null.
- loadTeamResearch(team, count, options: { gapMs?: number } = {}) (line ~188). It builds `recent` (oldest first), maps over `[...recent].reverse()` with mapPaced, reverses the settled results back to oldest first, and then merges them with `settled.forEach((result, i) => ... recent[i] ...)`.

Consumers of ResearchGame are read-only. Checked by grep at planning time: toi-trends.ts sorts a copy (`[...rows].sort`), linemates.ts builds its own Set and rows, and components/ToiTrends.tsx, LastGameLines.tsx and PlayerLinemates.tsx only read research.games. Cached objects can therefore be shared across requests without cloning.

Test command (package.json): `npm test` runs `tsx --test lib/**/*.test.ts`. A single file runs with `npx tsx --test lib/research/team-games.test.ts`. Baseline is 18/18 passing in team-games.test.ts and a clean `npx tsc --noEmit`. node:test MockTimers with `apis: ["Date"]` plus `tick()` works alongside the fetch stub on this Node (v24); this was checked at planning time.
</interfaces>
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end warm reload: cached complete games resolve at once and skip the pacing gap</name>
  <files>lib/research/team-games.ts, lib/research/team-games.test.ts</files>
  <behavior>
    - Warm reload: stub NHL with a `calls` array and load MTL Last 5 (gapMs 0). Empty `calls`, then load again. The second load makes exactly one request, the club-schedule-season one, with no gamecenter or shiftcharts URL. It returns game ids [1, 2, 3] oldest first, and player 8 is still "Alpha Forward".
    - Pacing skipped on hits: after a warm first load with gapMs 0, a second load with gapMs 1000 finishes in under 300 ms, measured with Date.now() around the awaited call. Without the cache, three paced games take at least 2000 ms.
    - Incomplete games retried: stub with pbpEmpty [3] and shiftChartFails [2]. Load, empty `calls`, then load again. The second load's boxscore request ids are exactly [3, 2] (misses still newest first; game 1 served from cache), and research.games ids are still [1, 2, 3].
    - Failed game not cached: stub with boxscoreFails [2]. Load twice. The second load still returns unavailableDates ["2026-10-03"], and its only boxscore request is for game 2.
    - All 18 existing tests still pass. The one change to them is that stubNhl calls clearGameCache() first, so cached state never leaks between tests.
  </behavior>
  <action>
In lib/research/team-games.ts, minimum code, no other files touched:

1. Completeness flag. loadGame returns `complete: boolean` next to `game` and `players`. It is true only when the shift chart loaded with at least one row (shifts not null and length > 0) and the play-by-play loaded with at least one play (pbp not null and pbp.plays length > 0). This mirrors the client.ts rule that never pins empty charts or play-by-play, so failed data (null) and unpublished data (empty) are retried on the next load. A game that throws (failed boxscore, or OT/SO with no chart) is a rejected result and never reaches the cache.

2. Cache. Add a module-level `gameCache` Map. The key is the template string of team and game id (`${team}:${gameId}`), because loadGame output depends on the team's perspective (home/away, our skaters, our lines and events). The value holds the loaded `{ game, players }` and an `expiresAt` epoch-ms number. Write a short doc comment on it covering four points: warm navigations skip the pacing gap and the per-game analysis; only complete games are stored, for their finishedGameCache tier; cached games are shared across requests, so consumers must not mutate them; on Vercel it lives per warm instance and resets on cold start or deploy, which is acceptable because a miss falls back to the paced load.

3. Expiry, matching finishedGameCache. In the miss path, compute `finishedGameCache(g.startTimeUTC)` once. Pass that same object to loadGame (as today) and set expiresAt to the moment of storing plus `next.revalidate * 1000`. That gives 1 hour for a game under 48 h old or with no start, and 30 days for older games, the same freshness as the fetch data cache. An entry is valid while now < expiresAt, and an expired entry is deleted when it is looked up.

4. Size bound. Export `MAX_CACHED_GAMES = 640` (32 teams x Last 20) with a one-line comment. To store, delete the key first so a re-store moves it to the end of insertion order, set it, then while size > MAX_CACHED_GAMES delete the first key (the oldest stored).

5. Test hook. Export `clearGameCache()`, which clears the map.

6. Hit/miss split in loadTeamResearch. After `recent` is computed, read Date.now() once and look up every game in `recent`. An unexpired entry is a hit and becomes a fulfilled result immediately; everything else is a miss. Pass only the misses to mapPaced, newest first, with the same MAX_CONCURRENT_GAMES and `options.gapMs ?? GAME_START_GAP_MS`, and keep the existing newest-first comment. The mapPaced callback computes the tier, awaits loadGame, stores the result when `complete`, and returns `{ game, players }`. Rebuild `settled` aligned with `recent` (oldest first) from the hits plus the miss results matched by game id, so the existing merge loop, the per-game error log, unavailableDates and the all-failed throw stay unchanged. A fully warm load calls mapPaced with zero items, which returns immediately.

7. Leave unchanged: mapPaced, GAME_START_GAP_MS, MAX_CONCURRENT_GAMES, situationSeconds, lib/nhl/client.ts, app/research/page.tsx and next.config.ts. The page still calls loadTeamResearch(team, gameCount).

In lib/research/team-games.test.ts: import clearGameCache, call it as the first line of stubNhl, and add the four behavior tests above. Use the existing Stub `calls` array; empty it between loads with `calls.length = 0`. Write the tests first (RED: the warm-reload and timing tests fail against the current code), then implement (GREEN).
  </action>
  <verify>
    <automated>npx tsx --test lib/research/team-games.test.ts</automated>
  </verify>
  <done>team-games.test.ts passes: the 18 existing tests plus the warm-reload, pacing-skipped (under 300 ms with gapMs 1000), incomplete-retried and failed-not-cached tests. `git diff --name-only HEAD -- next.config.ts lib/nhl/client.ts app/research/page.tsx` prints nothing.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Freshness tiers and size bound for the game cache</name>
  <files>lib/research/team-games.test.ts, lib/research/team-games.ts</files>
  <behavior>
    - Recent tier (1 h). Enable `t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-15T12:00:00Z") })` and use DEFAULT_GAMES (no startTimeUTC), then load. Tick 3_599_000 ms: the next load makes no gamecenter request. Tick another 2_000 ms (past 3600 s): the next load requests boxscores [3, 2, 1] again.
    - Old tier (30 days). One finished game whose startTimeUTC is 30 days before the mocked now. Load, then tick 2 hours: no gamecenter request (a 1-hour tier would have expired). Tick another 30 days: the game's boxscore is requested again.
    - Size bound. Stub the schedule with MAX_CACHED_GAMES + 1 finished games (ids 1..641, state "OFF"). Load with count MAX_CACHED_GAMES + 1 and gapMs 0, empty `calls`, and load again with the same count. The second load makes exactly 1 boxscore request: one entry was evicted and the other 640 are hits.
  </behavior>
  <action>
Add the three behavior tests to lib/research/team-games.test.ts, with Date mocked through the test context's MockTimers (`apis: ["Date"]` only; setTimeout stays real; gapMs 0 so mapPaced never waits). Import MAX_CACHED_GAMES from ./team-games. The Task 1 implementation should already satisfy these tests. If one fails, fix lib/research/team-games.ts so that:
- expiry follows the finishedGameCache tier computed at store time (valid while now < expiresAt),
- hits are decided once at the start of loadTeamResearch, so eviction during a load does not change which games are misses,
- eviction drops the oldest stored entry.
Do not add a different TTL, a background sweep, or any configuration.

Then run the full checks: the whole test suite, the TypeScript compile, and eslint on the two changed files.
  </action>
  <verify>
    <automated>npx tsx --test lib/research/team-games.test.ts && npm test && npx tsc --noEmit && npx eslint lib/research/team-games.ts lib/research/team-games.test.ts</automated>
    <human-check>Run `npm run dev`, sign in, and open /research?team=TOR&amp;games=20 (the first load is paced and takes seconds). Then click a player name, Close player detail, an EV/PP/SH tab, and a column sort. For each of those navigations, the dev-server `GET /research?... 200 in N ms` line shows N well under about 300 ms of server time once compilation is done. Before this change it was at least ~(games - 1) seconds.</human-check>
  </verify>
  <done>The recent-tier, old-tier and size-bound tests pass. The full `npm test` suite passes, `npx tsc --noEmit` is clean, and eslint reports nothing on the two changed files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| NHL public API -> server memory | Untrusted public JSON is analyzed and the result is now held in process memory across requests and users |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261015-dkk-01 | Denial of service | gameCache in lib/research/team-games.ts | low | mitigate | MAX_CACHED_GAMES (640) cap with oldest-first eviction; expired entries deleted on lookup; size-bound test in Task 2 |
| T-261015-dkk-02 | Tampering | Cached ResearchGame objects shared across requests | low | accept | Consumers are read-only (checked by grep: sorts work on copies, linemates builds its own Set/rows); the gameCache doc comment says cached games must not be mutated |
| T-261015-dkk-03 | Information disclosure | Cache shared across signed-in users | low | accept | Holds only public NHL game data keyed by team and game id; nothing per-user is stored |
</threat_model>

<verification>
- `npx tsx --test lib/research/team-games.test.ts` passes (18 existing tests plus the new cache tests).
- `npm test`, `npx tsc --noEmit` and `npx eslint lib/research/team-games.ts lib/research/team-games.test.ts` are clean.
- `git diff --name-only HEAD -- next.config.ts lib/nhl/client.ts app/research/page.tsx` prints nothing.
- Human check (end of task, laptop browser): warm /research navigations on the same team log well under about 300 ms of server time at Last 20.
</verification>

<success_criteria>
- A warm navigation on the same team does no game fetches and no pacing waits. In tests, a warm reload with gapMs 1000 finishes in under 300 ms.
- A cold load or cache miss is paced exactly as before: newest first, 3 concurrent, 1000 ms apart.
- Failed or unpublished shift charts and play-by-play are retried on the next load, and failed games still appear in unavailableDates.
- Cached games expire on the finishedGameCache tier (1 h recent, 30 days old), and the cache is bounded at 640 entries.
</success_criteria>

<output>
Create `.planning/quick/261015-dkk-cache-per-game-research-data-so-cached-g/261015-dkk-SUMMARY.md` when done. Record the cache choice and the two rejected alternatives with their reasons, plus the Vercel per-instance trade-off.
</output>
