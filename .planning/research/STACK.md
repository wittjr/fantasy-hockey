# Technology Stack

**Project:** Fantasy Hockey Draft Prep - Line research (unit event stats, trends view, player detail)
**Researched:** 2026-10-11
**Overall confidence:** HIGH (endpoint behavior verified against the live API on 2026-10-11 using 14 real games; Next.js caching verified against `node_modules/next/dist/docs` and `node_modules/next/dist/server/lib/patch-fetch.js` for the installed 16.3.4)

## Bottom Line

- **Zero new dependencies.** One new NHL endpoint (`play-by-play`) on the host the app already calls, plus pure TypeScript.
- **Keep the existing caching model** (`fetch` with `next: { revalidate }`). Do NOT enable `cacheComponents`, do NOT adopt `use cache`, do NOT add DB persistence for v1.
- **The real risks are not libraries.** They are (1) the NHL API throttling bursts (429 / connect timeouts), (2) permanently empty shift charts for some finished games, and (3) one off-by-one convention when joining events to shifts. All three are solved below.

## Recommended Stack

### Core Framework (unchanged, no additions)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.3.4 (installed) | Server-rendered research page | Already in place. Page is dynamic because of `auth()`; keep it that way |
| React | 19.2.8 (installed) | UI; player detail panel | Detail view can be a server-rendered section keyed off a `?player=` search param (no client state lib needed) |
| TypeScript | 5.x (installed) | Event attribution logic | Pure functions next to `lib/research/lines.ts`, tested with the existing `tsx --test` runner |

### NHL Data Endpoints

| Endpoint | Host | New? | Purpose | Payload (verified) |
|----------|------|------|---------|--------------------|
| `GET /v1/gamecenter/{gameId}/play-by-play` | `api-web.nhle.com` | **NEW** | Shot attempts, goals, event owner, situation code, roster positions | 126-144 KB per game |
| `GET /stats/rest/en/shiftcharts?cayenneExp=gameId={id}` | `api.nhle.com` | existing | Who was on ice (also drives linemate time-together) | 250-282 KB per game |
| `GET /v1/gamecenter/{gameId}/boxscore` | `api-web.nhle.com` | existing | Per-player TOI, final score, names | ~13 KB per game |
| `GET /v1/club-schedule-season/{team}/now` | `api-web.nhle.com` | existing | Last N finished games (307-redirects to the season URL; `fetch` follows it) | ~180 KB |

All payloads are far below Next's 2 MB per-entry Data Cache limit (limit confirmed in `next/dist/server/lib/incremental-cache/index.js`; over-limit entries silently fail to cache with a warning).

**Confidence: HIGH** (live-verified). Note the community reference (github.com/Zmalski/NHL-API-Reference) documents the play-by-play URL but NOT event type codes, `situationCode`, or rate limits, so everything below was verified empirically rather than taken from docs.

### Play-by-play fields to consume (verified 2026-10-11)

Top level: `homeTeam.{id,abbrev,score,sog}`, `awayTeam.{id,abbrev,score,sog}`, `gameState`, `plays[]`, `rosterSpots[]`.

`rosterSpots[]`: `{ teamId, playerId, firstName.default, lastName.default, sweaterNumber, positionCode }` with `positionCode` in `C | L | R | D | G`. This covers positions and names for both teams, so pbp alone can replace the boxscore for position lookup.

`plays[]` each have: `eventId`, `typeCode`, `typeDescKey`, `sortOrder`, `periodDescriptor.{number,periodType}`, `timeInPeriod` ("MM:SS", elapsed), `timeRemaining`, `situationCode`, `details{}`.

| Event (`typeDescKey`) | `typeCode` | Counts as | Player field | Team field |
|-----------------------|-----------|-----------|--------------|-----------|
| `shot-on-goal` | 506 | SF + CF | `details.shootingPlayerId` | `details.eventOwnerTeamId` = shooting team |
| `missed-shot` | 507 | CF (includes post/crossbar) | `details.shootingPlayerId` | `eventOwnerTeamId` = shooting team |
| `blocked-shot` | 508 | CF for the shooting team | `details.shootingPlayerId` (+ `blockingPlayerId`) | `eventOwnerTeamId` = **shooting** team (verified 38/38 against roster) |
| `goal` | 505 | GF + SF + CF | `details.scoringPlayerId` (+ `assist1PlayerId`, `assist2PlayerId`) | `eventOwnerTeamId` = scoring team |

Other types present (ignore for this milestone): `faceoff` 502, `hit` 503, `giveaway` 504, `penalty` 509, `stoppage` 516, `takeaway` 525, `delayed-penalty` 535, `period-start` 520, `period-end` 521, `game-end` 524, `shootout-complete` 523.

Derived stat definitions (confirmed against official totals):
- **SOG = `shot-on-goal` events + `goal` events.** Goals are NOT also emitted as `shot-on-goal`. Checked on 4 games: computed SOG equals `homeTeam.sog` / `awayTeam.sog` exactly.
- **Corsi attempt = shot-on-goal + missed-shot + blocked-shot + goal**, credited to `eventOwnerTeamId`'s side (CF) and the other side's on-ice players (CA).
- **Exclude `blocked-shot` events whose `details.reason === "teammate-blocked"`** (11 of 120 blocked shots in sample; both shooter and blocker are on the same team, so it is not a shot attempt against anyone). All other blocked shots have `reason: "blocked"`.
- **Exclude shootout events.** Filter `periodDescriptor.periodType !== "SO"`. Shootout goals and shots appear as ordinary `goal`/`shot-on-goal` events in period 5 and would corrupt every number.
- **Empty-net goals** have no `details.goalieInNetId`. They are still goals; do not special-case them for counting.

### `situationCode` (verified)

4 digits: `[awayGoalie][awaySkaters][homeSkaters][homeGoalie]`.
- `1551` = 5v5, `1451` = away 4 / home 5 (home PP), `1331` = 3v3 OT, `1560` = home goalie pulled (6 skaters), `1460` = home pulled goalie while on PP.
- Shootout codes (`1010`, `0101`) are irrelevant once SO is filtered.

**Recommendation:** classify an event's EV/PP/SH with the app's existing `situationFor()` logic applied to the shift-derived on-ice state (so unit tables and event counts share one definition of strength), and use `situationCode` only as a test oracle. They agreed on 450/450 events (4 MTL-season-start games), using the same rule the app already uses (goalie on ice => skater count; goalie pulled => skaters minus one).

### Joining events to shifts (the one subtle rule) - HIGH confidence

`timeInPeriod` marks the END of the elapsed second. The shift convention that matches is **`start < T <= end`**, which is exactly "the event belongs to the one-second bucket `T - 1`" in `analyzeGameLines`, whose buckets are `[s, s+1)` for `s` in `[startSec, endSec)`.

Measured on 1,597 shot/goal events across 14 games (4 early-season games with all-team detail; 10 EDM 2025-26 regular-season/playoff games):

| Rule | Shooter found on ice |
|------|----------------------|
| `start <= T < end` (naive, same as bucket T) | 433 / 450 (96.2%) |
| `start < T <= end` (bucket T-1) | **450 / 450 and 1147 / 1147 (100%)** |
| `start <= T <= end` (inclusive) | 100% but over-counts skaters (404 / 450 skater-count agreement with `situationCode`) |

With bucket `T-1`, skater counts per team agreed with `situationCode` on 449/450 events, and skaters plus goalie-on-ice flags agreed on 1133/1147 (98.8%). So the "ambiguous at line-change seconds" worry in PROJECT.md is mostly resolved by using the right boundary rule; the residual ~1% is goalie shift timing and is acceptable ("approximate, as on Frozen Pool").

Clamp bucket to `max(0, T - 1)`. Period offset is unchanged: `(period - 1) * 1200`, which is already correct for OT (period 4) and playoff OT periods.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | - | - | Do not add anything. See "What NOT to Use" |

Hand-write minimal TypeScript interfaces for the pbp response in `lib/nhl/client.ts`, matching how `NhlBoxscore` and `NhlShift` are already typed. Do not validate with Zod: the existing NHL client does not, and the response is only read, never written. Fail soft instead (skip an event whose `details` lack the player id).

## Caching on Vercel (Next.js 16.3.4, `cacheComponents` NOT enabled)

`next.config.ts` has no `cacheComponents` flag, so the "previous model" applies (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`). Recommendation: **stay on it.**

| Decision | Choice | Why |
|----------|--------|-----|
| Raw NHL responses | `fetch(url, { next: { revalidate: N } })` | Verified in `patch-fetch.js`: a positive numeric `revalidate` is an explicit cache opt-in (`isCacheableRevalidate`), so it caches in the Vercel Data Cache even though the page calls `auth()` first. This is the same mechanism `getBoxscore` and `getShiftCharts` already use, so `getPlayByPlay` is a one-liner copy |
| Which status is cached | Only HTTP 200 | Documented in `fetch.md`; 429s are never cached, so a throttled burst does not poison the cache |
| TTL for finished games | Reuse `FINISHED_GAME_CACHE` (3600 s). Optional improvement: 86400 s for games older than ~2 days | Finished play-by-play only changes on scorer corrections |
| Derived stats (unit event tables, linemate matrix) | Compute in memory per request, no cache | Tens of thousands of array ops on ~1000 events/game; negligible next to network time. Caching derived data adds invalidation bugs for no gain |
| `unstable_cache` | Do not use | Deprecated in 16 per its own doc ("replaced by `use cache`"); no need since inputs are already cached |
| `use cache` / `cacheLife` / `cacheTag` | Do not use | Requires enabling `cacheComponents`, which switches the whole app to PPR/dynamic-by-default semantics and forces Suspense restructuring of every route that touches `auth()` or `searchParams`. Large blast radius for a feature that does not need it |
| Route-level `revalidate` / `dynamic` exports | Do not add | Page is already dynamic via `auth()`; the lowest `fetch` revalidate would otherwise leak into route behavior |
| Neon persistence of per-game stats | Defer | Would make cold loads instant and immune to NHL outages, but adds schema, migrations, and backfill. Revisit only if cold-load latency or throttling proves unacceptable after the mitigations below |

**Empty shift charts are cached too.** `getShiftCharts` caches `{"data":[],"total":0}` for the full hour. That is acceptable for just-finished games. Optionally pass `revalidate: 300` when a game finished less than ~6 hours ago so late-published charts show up sooner (the cache TTL cannot be set conditionally on the response, so decide from the schedule's game date before calling).

**Confidence: HIGH** for fetch-cache behavior (read from the installed Next source); MEDIUM on exact Vercel Data Cache regional/eviction behavior (not testable locally; entries can be evicted before TTL under memory pressure, so treat the cache as an optimization, never a correctness dependency).

## Reliability of the NHL APIs (live findings, 2026-10-11)

| Finding | Evidence | Impact |
|---------|----------|--------|
| **Burst throttling on `api-web.nhle.com`** | 40 concurrent requests (20 pbp + 20 boxscore): 9 returned **HTTP 429** (body is HTML, not JSON). 60 concurrent boxscore requests: connect timeouts. 20 concurrent pbp alone: all 200 | Adding pbp doubles the `api-web` load per page view (20 boxscore + 20 pbp for a 20-game view), exactly the pattern that tripped the limit. Existing `loadTeamResearch` uses an unbounded `Promise.all` |
| 429 handling | No `Retry-After` header observed | Use bounded concurrency plus short retry/backoff |
| Shift host is not throttled the same way | `api.nhle.com` shift calls all returned 200 in the same burst; `cf-cache-status: DYNAMIC` | Shift charts are the slow call (up to ~1.8 s), not the flaky one |
| **Permanently empty shift charts for some finished games** | PIT-MTL `2026020026` (Oct 3, state `OFF`, checked again 8 days later): `{"data":[],"total":0}` while pbp and boxscore are complete | Per-unit and linemate stats cannot be computed for that game ever. The existing `lines: null` handling must be extended: event stats render as "-" for such games, and trend math must skip them rather than treat them as zero |
| Edge caching | pbp/boxscore `cache-control: max-age=18-19, s-maxage=19` via Cloudflare | Irrelevant for finished games once the Data Cache holds them |
| Schema stability | `play-by-play` field names and type codes match what the community has used since the late-2023 API rewrite; undocumented, so it can change without notice | Keep all pbp parsing in one function in `lib/nhl/client.ts` / one module; test it with a trimmed fixture |

**Required mitigation (zero-dep):** add a tiny concurrency limiter (about 10 lines, a worker-pool loop over an index) around per-game loads in `loadTeamResearch`, cap at roughly 6, and retry a 429 or network error up to 2-3 times with 1-3 s backoff inside `nhlGet`. Do not add `p-limit` or `p-retry`.

**Optional load reduction:** the pbp response already contains `rosterSpots` (positions, names, team ids), `homeTeam/awayTeam` (abbrev, score), and the game date. The only boxscore-only field the app uses is per-player `toi`, which the shift chart can supply by summing shift durations. Dropping the boxscore call would cut `api-web` requests per page view by a third. This changes working code, so flag it for the planner rather than doing it by default; it is the first thing to try if 429s persist after concurrency limiting.

## Linemate time-together (no new endpoint)

Pairwise and per-linemate on-ice time comes entirely from data already fetched: shift charts. `analyzeGameLines` already materializes who is on ice each second; accumulating a `Map<playerId, Map<linemateId, seconds>>` per game (for EV, split by F and D if wanted) is a few lines in the same loop. No play-by-play and no extra fetch for this feature. Trend slopes reuse the existing `trendSlope()`.

**Confidence: HIGH.**

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Event source | `api-web.nhle.com` play-by-play | `api.nhle.com/stats/rest/en/...` event/summary reports | Season aggregates by situation, not per-event with timestamps; cannot be joined to shifts, so cannot produce per-unit numbers |
| Event source | NHL play-by-play | Scraping HTML reports (`nhl.com/scores/htmlreports`) | Legacy, brittle parsing, adds a parser dependency; JSON feed is cleaner and the shifts API already covers the TOI side |
| Third-party stats | None | Natural Stat Trick / Moneypuck / Frozen Pool scraping | Violates the "public unauthenticated NHL APIs only" constraint; terms and stability unknown |
| Strength classification | Shift-derived (existing `situationFor`) | `situationCode` from each event | Equivalent here (450/450 agreement), but shift-derived keeps unit TOI and unit event counts on one definition, and it is already tested |
| Cache layer | Next.js `fetch` Data Cache | `use cache` + `cacheComponents` | Whole-app migration for no functional gain |
| Cache layer | Next.js `fetch` Data Cache | Persist in Neon via Drizzle | Extra schema and backfill; reserve as a later optimization |
| Concurrency | In-house worker loop | `p-limit` / `p-retry` | New dependency for ~10 lines; conflicts with "minimum code" |
| Validation | Hand-typed interfaces | Zod schemas for pbp | Existing NHL client does not validate; read-only data; Zod would add parse cost on ~140 KB payloads x 20 games |
| Charts for trends | Existing inline sparklines | chart library (Recharts, visx) | Not needed; sparkline code already exists on the page |

## Installation

```bash
# Nothing to install.
```

## What NOT to Use

- **`cacheComponents` / `use cache` / `cacheTag` / `cacheLife`**: forces PPR semantics across an app whose pages are dynamic through `auth()`; this milestone does not need it.
- **`unstable_cache`**: marked replaced in Next 16 docs; adds nothing over `fetch` revalidate here.
- **Unbounded `Promise.all` over 20+ games x 3 NHL calls**: reproduced 429s and connect timeouts. Bound it.
- **Counting events with the naive `[start, end)` rule keyed on `timeInPeriod`**: drops ~4% of shooters off the ice. Use bucket `T - 1`.
- **Counting `period 5 / periodType "SO"` events, or `teammate-blocked` blocks**: both silently corrupt CF/CA and goals.
- **Treating a missing shift chart as "zero events"**: render unavailable and exclude from trend slopes.
- **Treating `eventOwnerTeamId` on `blocked-shot` as the blocking team**: in this API it is the shooting team (verified against roster for all `reason: "blocked"` events).

## Sources

- Live API verification, 2026-10-11 (HIGH): `https://api-web.nhle.com/v1/gamecenter/{id}/play-by-play`, `/boxscore`, `/club-schedule-season/{team}/now`, and `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={id}` for MTL games 2026020002/045/058/075 (shifts present), 2026020026 (shifts empty), and 10 EDM 2025-26 games.
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` and `.../03-api-reference/04-functions/fetch.md`, `unstable_cache.md`, `.../05-config/01-next-config-js/cacheComponents.md` (HIGH, installed 16.3.4).
- `node_modules/next/dist/server/lib/patch-fetch.js` (numeric `revalidate` cache opt-in) and `.../incremental-cache/index.js` (2 MB per-entry limit) (HIGH).
- https://github.com/Zmalski/NHL-API-Reference (MEDIUM; confirms the play-by-play URL only, no event-code or `situationCode` documentation).
- Existing code: `lib/nhl/client.ts`, `lib/research/lines.ts`, `lib/research/team-games.ts`.
