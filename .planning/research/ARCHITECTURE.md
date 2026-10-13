# Architecture Research

**Domain:** NHL line/deployment research page (derived hockey analytics on a Next.js 16 server-rendered app)
**Researched:** 2026-10-11
**Confidence:** HIGH for structure and Next.js behavior (read from the repo and `node_modules/next/dist/docs/`); MEDIUM for event-timing convention (measured on 5 real games, one team mostly)

Scope: how event attribution (SF/SA, GF/GA, CF/CA per unit), pairwise linemate time, a clickable player detail, and caching fit onto the existing per-second on-ice model. This is an integration design, not a greenfield one: `lines.ts`, `team-games.ts`, and `page.tsx` stay the spine.

## Headline Recommendations

1. **One timeline, three consumers.** Extract "who is on ice, in which situation, in which unit, each second" into a single pure `buildTimeline()` and feed TOI/units (existing), event attribution (new), and pair time (new) from it. Unit keys and EV/PP/SH classification then cannot diverge between time-on-ice and event counts.
2. **Pure core, one I/O seam.** Every new computation is a pure function over plain inputs (`ShiftInput[]`, `GameEvent[]`, `ResearchGame[]`). Only `lib/nhl/client.ts` (fetch) and `team-games.ts` (orchestration and raw-to-pure mapping) touch the network.
3. **Player detail = URL search param, server-rendered.** `?player=<id>` plus a `<Link scroll={false}>` per row. No new client component, no data shipped to the browser. This is the same pattern the page already uses for `team` and `games`.
4. **Do not add a derived-data cache.** Measured 7.4 ms per game for `analyzeGameLines` (780 shifts); about 150 ms for 20 games, and raw NHL responses are already in Next's Data Cache. Revisit only with a measured problem.
5. **Event timestamp convention: an event at elapsed `MM:SS` belongs to the second that just completed (bucket `T-1`).** Measured, not assumed (see Pattern 2).

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  app/research/page.tsx   (server)  auth, parse ?team ?games ?player   │
│  ├─ _components/LastGameLines.tsx   unit tables (+ SF/SA GF/GA CF/CA)  │
│  ├─ _components/ToiTrends.tsx       trends-first ice-time table        │
│  │     row name cell = <PendingLink ?player=id scroll={false}>         │
│  └─ _components/PlayerDetail.tsx    linemate time-together per game    │
│        (all server components; PendingLink is the only client code)    │
├──────────────────────────────────────────────────────────────────────┤
│  VIEW-MODEL BUILDERS (pure, lib/research, unit-tested)                │
│  toi-trends.ts (buildRows moved out of page.tsx)  linemates.ts         │
├──────────────────────────────────────────────────────────────────────┤
│  PURE CORE (lib/research, no I/O)                                     │
│  timeline.ts ──► lines.ts (units, playerSeconds, pairSeconds)         │
│       │      └─► events.ts (attribute GameEvent[] onto timeline)      │
│  play-events.ts (raw NHL play-by-play JSON ──► GameEvent[])           │
├──────────────────────────────────────────────────────────────────────┤
│  ORCHESTRATION / I/O SEAM                                             │
│  team-games.ts  loadTeamResearch → loadGame (boxscore+shifts+PBP)     │
│  lib/nhl/client.ts  getBoxscore, getShiftCharts, getPlayByPlay (new)  │
├──────────────────────────────────────────────────────────────────────┤
│  Next.js Data Cache (fetch next.revalidate: 3600)  ◄── NHL public APIs │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Purity |
|-----------|---------------|-------------------|--------|
| `lib/nhl/client.ts` (`getPlayByPlay` added) | Fetch raw NHL JSON, `FINISHED_GAME_CACHE` revalidate | Network only | I/O |
| `lib/research/team-games.ts` | For each game: fetch 3 feeds, map raw to pure inputs, call analyzer, assemble `ResearchGame` | client.ts, play-events.ts, lines.ts | I/O + orchestration |
| `lib/research/play-events.ts` (new) | Raw play-by-play to `GameEvent[]`: keep `shot-on-goal`/`missed-shot`/`blocked-shot`/`goal`, drop shootout, map `eventOwnerTeamId` to abbrev | Called by team-games.ts | Pure |
| `lib/research/timeline.ts` (new, extracted from `analyzeGameLines`) | Bucket shifts per second, derive situation, skaters, F-unit key, D-unit key for the team | Consumed by lines.ts, events.ts | Pure |
| `lib/research/lines.ts` | `analyzeGameLines(team, shifts, positions, events?)`: unit seconds/pct, `playerSeconds`, new `pairSeconds`, optional per-unit event counts; `trendSlope` unchanged | timeline.ts, events.ts | Pure |
| `lib/research/events.ts` (new) | `attributeEvents(timeline, team, events)` returns per-unit, per-situation `EventCounts` plus a diagnostics count | timeline.ts types | Pure |
| `lib/research/linemates.ts` (new) | `buildLinemateRows(research, playerId)`: per-linemate per-game shared seconds, share of the player's TOI, trend, "new linemate" flag | `ResearchGame[]`, `trendSlope` | Pure |
| `lib/research/toi-trends.ts` (moved from page.tsx when the trends view is rebuilt) | `buildRows` and slope/threshold logic, testable | `ResearchGame[]`, `trendSlope` | Pure |
| `app/research/page.tsx` | Auth, parse and validate params, `loadTeamResearch`, error shell, compose sections | _components, team-games.ts | Server |
| `app/research/_components/*` | Presentational server components; no data loading | view-models | Server |
| `components/PendingLink.tsx` (existing) | Link with pending spinner, `prefetch={false}` | Next router | Client |

### Data Flow

```
request /research?team=TOR&games=10&player=8479318
   │
   ▼
page.tsx: auth → validate params → loadTeamResearch(team, 10)
   │
   ▼  per game, in parallel (Promise.all):
   getBoxscore ─┐
   getShiftCharts ─┼─► team-games.loadGame
   getPlayByPlay ──┘   (.catch → null, so PBP failure never breaks the page)
   │                     │
   │      shifts ──► buildTimeline ──► analyzeGameLines ──► { situationSeconds, units, playerSeconds, pairSeconds }
   │      pbp ─► toGameEvents ─► attributeEvents(timeline) ─► merged into units[sit][grp][i].events
   ▼
TeamResearch { players, games[] }   (plain data, Maps stay on the server)
   │
   ├─► LastGameLines(last game)           renders units + event columns
   ├─► toi-trends.buildRows → ToiTrends   renders trends; name cell links ?player=
   └─► if ?player valid: linemates.buildLinemateRows → PlayerDetail
```

Data flows one way: network to raw types, raw to pure inputs (team-games.ts only), pure core to `ResearchGame`, `ResearchGame` to view-models, view-models to server components. Nothing in `lib/research/*.ts` other than `team-games.ts` may import `lib/nhl/client.ts`.

## Recommended Project Structure

```
lib/nhl/client.ts                    # + getPlayByPlay(gameId), NhlPlay types
lib/research/
├── timeline.ts                      # NEW (extracted): buildTimeline, situationFor, unit keying
├── lines.ts                         # analyzeGameLines now consumes the timeline; + pairSeconds, + events?
├── lines.test.ts                    # unchanged; must still pass untouched (regression guard)
├── events.ts / events.test.ts       # NEW: attributeEvents
├── play-events.ts / .test.ts        # NEW: raw PBP -> GameEvent[]
├── linemates.ts / .test.ts          # NEW: linemate view-model
├── toi-trends.ts / .test.ts         # MOVED from page.tsx when ToiTrends is reworked
└── team-games.ts                    # + PBP fetch, + events plumbing, + pairSeconds helper
app/research/
├── page.tsx                         # thin: auth, params, load, compose
└── _components/                     # LastGameLines, UnitTable, ToiTrends, PlayerDetail, Slope, Sparkline
```

### Structure Rationale

- **timeline.ts extracted, `lines.ts` re-exports types:** `events.ts` and `lines.ts` would otherwise import each other (circular). Extraction is a verbatim move of the first half of `analyzeGameLines` plus `situationFor`/`OnIce`; `lines.test.ts` imports stay valid. This is the one refactor of existing code that the feature set justifies.
- **Pure mapper `play-events.ts` separate from `team-games.ts`:** `team-games.ts` is untestable without network. The raw-JSON-to-event mapping (shootout filter, team-id to abbrev, blocked-shot ownership) is where the subtle bugs are, so it must be testable.
- **`_components/` private folder:** documented App Router convention (`_folderName`, see `01-getting-started/02-project-structure.md`). `page.tsx` is 374 lines before any of this lands; it cannot absorb a player-detail section, event columns, and a trends rewrite.

## Architectural Patterns

### Pattern 1: Single timeline, multiple pure consumers

**What:** `buildTimeline(team, shifts, positions)` returns, for each absolute second `t = (period-1)*1200 + s`, `{ situation, skaters, fKey, dKey }` for the team (same logic as today's loop, including EV 3F/2D filter, sorted-id keys). All aggregations read it.
**When to use:** Always; this is the core change. Same unit key text (`ids.sort().join(",")`) is used for TOI and for events, so the UI joins event stats to unit rows by key.
**Trade-offs:** One extra array/Map of ~3,600 small objects per game (negligible). Slight indirection in `analyzeGameLines`; mitigated by keeping its public signature (`events?` is a new optional 4th param).

```typescript
// timeline.ts
export interface SecondState {
  situation: Situation;
  skaters: number[];
  unitKey: { F: string | null; D: string | null }; // null when not a valid unit this second (e.g. EV with 4F)
}
export type Timeline = Map<number, SecondState>; // key = absolute second

// events.ts
export interface GameEvent {
  period: number;
  sec: number; // elapsed seconds in period, from timeInPeriod
  team: string; // abbrev of the SHOOTING team
  kind: "goal" | "sog" | "miss" | "block";
}
export interface EventCounts { sf: number; sa: number; gf: number; ga: number; cf: number; ca: number }
// SF = sog+goal, CF = sog+goal+miss+block, GF = goal. "For" when event.team === team.
```

### Pattern 2: Event-to-second mapping is a measured convention

**What:** An event with `timeInPeriod` elapsed `T` is attributed to timeline second `max(T-1, 0)` (the just-completed second). Also keep an `unattributed` counter in the result (events whose second is missing from the timeline).
**Evidence (measured 2026-10-11, public NHL APIs):** across 4 TOR games with shift charts (487 shots/misses/blocks/goals), the event's shooter was on ice at bucket `T-1` in 487/487 (100%) versus bucket `T` in 470/487 (96.5%); in one MTL game 129/129 at both. 17 of 487 shooters were on ice at `T-1` but not `T`; none the other way. Use `T-1`.
**When to use:** `attributeEvents` only. Do not hand-tune per event; a shooter-on-ice rate below roughly 98% in a game is a signal that the convention or data is off, not that attribution is "approximate".
**Trade-offs:** Still approximate for the non-shooting players on ice when a change happens at that exact second (about 7% of events sit on a shift edge: 9 of 129 in the MTL game); accepted per PROJECT.md ("approximate, as on Frozen Pool").

### Pattern 3: Pair time computed eagerly, in the same pass as player time

**What:** Inside the existing per-second loop in `analyzeGameLines`, for every pair of the team's skaters on ice, add one second to `pairSeconds: Map<string, Record<Situation, number>>`, key `"minId,maxId"`. Output ~190 pairs per game at most.
**When to use:** Always compute; select per player in the view-model. Store per situation so the detail can show EV (default) and PP without recomputation.
**Trade-offs:** About 15 increments per on-ice second; roughly doubles a 7 ms per-game cost. Lazy per-player computation would require retaining the full timeline on every `ResearchGame` to save a few milliseconds; not worth it.
**Denominator:** share is `shared seconds / player's own situation seconds that game` (from `playerSeconds`), so 100% means "always with this linemate". Games the player did not dress, or with `lines: null`, are `null`, never 0 (mirrors `situationSeconds()` today).
**Default filter:** same position group only (F with F, D with D); keep all-skater pairs in the data in case F-D pairings matter later.

### Pattern 4: Degrade per feed, not per page

**What:** `getPlayByPlay(...).catch(() => null)` inside `loadGame`. `events === null` yields `—` in event columns while the shipped TOI/units/trends keep rendering. Boxscore/shifts failures remain fatal as today.
**Why:** Existing behavior is `Promise.all` fail-all; adding a third feed to that without isolation would let the newest, least-proven feed take down the page.

### Pattern 5: Player detail via URL search param, server rendered

**What:** The name cell in `ToiTrends` is `<PendingLink href={`/research?team=${t}&games=${n}&player=${id}`} scroll={false}>`; the row gets `relative` and the link an `after:absolute after:inset-0` pseudo-element so the whole row is clickable without a client component or invalid `<a>`-around-`<tr>` markup. `page.tsx` reads `player` from `searchParams`, validates it is an id in `research.players`, and renders `<PlayerDetail>` below the trends table (`id="player-detail"`).
**Why this over client state:**
- It is what the page already does (`team`, `games` are search params with `PendingLink`), so no new pattern.
- `searchParams` makes the page dynamic already (Next 16 docs: "Request-time API ... opt the page into dynamic rendering"), and Next re-renders the server tree on a search-param-only navigation. The expensive part, the NHL fetches, hits the Data Cache (1 h), so the re-render costs CPU only (~150 ms for 20 games measured).
- Deep-linkable and back-button friendly; no serialization concerns (`GameLines` contains `Map`s; keep them off the RSC boundary).
- `Link` defaults to preserving scroll position but may scroll to the top of the page element if it is out of view; `scroll={false}` (documented in `03-api-reference/02-components/link.md`) prevents jumping. `PendingLink` spreads props, so no change to it is needed, and its `prefetch={false}` is load-bearing: ~40 row links in the viewport must not each trigger a page render.
**Link-building rule:** `href()` helper in `page.tsx` drops `player` on team change (the id will not exist on the new team), keeps it on game-count change.
**When to flip to client state (not now):** only if the post-click spinner is perceptibly slow in production (rule of thumb > 1 s warm). The upgrade path is a small `"use client"` `<PlayerDetailSwitcher>` receiving plain-object, precomputed pair arrays as props (serializable; roughly 190 pairs x games x 3 numbers, tens of KB). Do not pre-ship that now.

## Data Flow: Caching Layers

| Layer | What | Policy | Notes |
|-------|------|--------|-------|
| L1 Next Data Cache (exists) | Raw NHL `fetch` bodies: boxscore, shift charts; add play-by-play | `{ next: { revalidate: 3600 } }` via existing `FINISHED_GAME_CACHE` | Samples: PBP ~144 KB, shifts ~270 KB per game. Per-entry cap in Next's fetch cache is documented elsewhere as 2 MB (not found in the local docs; verify if a playoff OT game is ever large) |
| L2 Derived per-game data | `GameLines`, pairs, event counts | **No cache** | 7.4 ms/game measured with `tsx` on a dev machine. `unstable_cache` would require converting `Map`s to plain objects (it JSON-serializes), a version key for logic changes, and a way not to freeze `lines: null` games whose shift charts are published late |
| L3 Page | Route | Dynamic (already) | Do not opt into `cacheComponents`; it is an app-wide change (Request-time access then needs Suspense boundaries) and the repo precedent (`lib/fantrax/cached-projections.ts`) deliberately uses `unstable_cache` to avoid it |

Cold-load cost: `Last 20` is now 60 parallel fetches (was 40). Acceptable on a single-user app and cached for an hour after; if the NHL rate-limits, add a small concurrency limiter in `loadTeamResearch` (not before).

**Empty shift charts are normal, not transient.** Verified: of the last 6 finished TOR games, 2 (2026-09-30, 2026-10-03) return HTTP 200 with `total: 0` shift rows 8-11 days later, while play-by-play exists. The existing `lines: null` handling is therefore a main path early in the season. New event columns and linemate detail must treat `lines === null` as "unknown" (render `—`), never as zero. The 1 h revalidate means such games are re-checked hourly, which is sufficient.

## Anti-Patterns

### Anti-Pattern 1: Attributing events with a second, separate bucketing pass

**What people do:** Write `attributeEvents(shifts, events)` that re-buckets shifts itself.
**Why it's wrong:** Two implementations of "who is on ice / which situation / which unit" drift; unit CF would stop matching unit TOI (different EV filter, different goalie-pulled rule).
**Do this instead:** Both read the same `Timeline` (Pattern 1).

### Anti-Pattern 2: Deriving situation from the play-by-play `situationCode` for unit stats

**What people do:** Use `situationCode` (e.g. `"1551"`) on each play as the EV/PP/SH label.
**Why it's wrong:** Shift-derived situation is what unit TOI/percent use; mixing sources makes the same second EV in one table and PP in another, and `situationCode` exists even for games with no shift data, tempting a half-correct fallback.
**Do this instead:** Situation from the timeline only. `situationCode` is acceptable as a test cross-check (digits observed as away goalie, away skaters, home skaters, home goalie; MEDIUM confidence, from observed values and community docs, not official docs).

### Anti-Pattern 3: Client component holding the whole `TeamResearch`

**What people do:** Pass `TeamResearch` (with `Map`s and 20 games of `GameLines`) into a `"use client"` page to get instant row clicks.
**Why it's wrong:** Props must be serializable; the payload is far larger than the visible detail; and it makes the existing server page a client tree.
**Do this instead:** Pattern 5; if client state is ever needed, ship only a precomputed plain array for the player detail.

### Anti-Pattern 4: Treating "no data" as zero

**What people do:** `playerSeconds.get(id)?.[sit] ?? 0` for a game with `lines: null`.
**Why it's wrong:** A missing-feed game then looks like "played with no linemates"/"0 shots against" and creates false trends, which is the opposite of the product's purpose.
**Do this instead:** Keep the `situationSeconds()` contract (null means unknown) in every new helper; exclude null games from slopes.

### Anti-Pattern 5: Counting shootout or period-5 events

**What people do:** Include all plays with a shot type.
**Why it's wrong:** The sampled MTL game's only `goal` play is a shootout goal (`periodType: "SO"`, `00:00`); there are no shifts for period 5 (shifts only periods 1-4), so it can never be attributed and would be miscounted as a team goal.
**Do this instead:** `toGameEvents` drops `periodDescriptor.periodType === "SO"`.

## Play-by-Play Semantics Used by the Design (verified on live data)

| Fact | Evidence | Confidence |
|------|----------|------------|
| `goal` is a separate play type from `shot-on-goal`; SF = `shot-on-goal` + `goal` | TOR 26+2 = 28, MTL 21+3 = 24, matching boxscore `sog` 28/24 | HIGH |
| `eventOwnerTeamId` on `blocked-shot` is the **shooting** team (CA goes to the blocking team's on-ice players) | 38/38 blocked shots in one game: `shootingPlayerId` is on the owner team | MEDIUM (one game) |
| Missed shots and blocked shots both carry `shootingPlayerId`; goals carry `scoringPlayerId` | Sample plays | HIGH |
| `eventOwnerTeamId` maps to team via `homeTeam.id/abbrev`, `awayTeam.id/abbrev` in the same response | Response shape | HIGH |
| Shift charts cover periods 1-4 (no shootout); OT in the offset scheme `(period-1)*1200` is fine because shifts and events use the same scheme | 4:517 shifts exist, period 5 none | HIGH |
| Corsi blocked-shot credit: CF for the shooter's team | Standard definition; pairs with the ownership row above | MEDIUM |

Unit stats only exist for combinations listed in the unit tables (`MIN_UNIT_SECONDS` = 10 and the EV 3F/2D shape). Unit-level counts will not sum to team totals. Show counts, not percentages or per-60 rates, on short samples (a last-game unit often has under 10 minutes), and do not label a column total as "team total".

## Scaling Considerations

Single-user personal app; the realistic constraint is NHL request fan-out and per-request CPU, not user count.

| Concern | 1 user (actual) | Dozens of users | Notes |
|---------|-----------------|------------------|-------|
| NHL fan-out | 60 fetches cold for Last 20, then Data Cache | Same entries shared across users (Data Cache is global) | Add concurrency limiter only if rate-limited |
| Per-request CPU | ~150 ms for 20 games | Linear in concurrent requests | Introduce `unstable_cache` of plain-object derived data only after measuring |
| Memory | 20 games x ~3,600 small objects transient per request | Same | Timeline is not retained on `ResearchGame` |

## Suggested Build Order (dependencies)

```
(1) Components + trends view  ──────────────┐   independent of data work; unblocks row links
(2) timeline.ts extraction + pairSeconds ───┼─► (4) Player detail (needs 1 for row links, 2 for data)
        │                                   │
        └─► (3) PBP client + play-events + events.ts ─► (5) Event columns on unit tables
```

1. **Page decomposition and trends-first ice-time view.** Move `LastGameLines`, `UnitTable`, `ToiTrends`, `Slope`, `Sparkline` into `app/research/_components/`; move `buildRows` to `lib/research/toi-trends.ts` with a test. Pure restructuring plus the readability requirement; no new data. Must precede the clickable rows.
2. **Timeline extraction and `pairSeconds`.** Regression gate: `lines.test.ts` passes unchanged. New tests: pair seconds symmetric, sum over a player's pairs equals `skaters-on-ice x seconds` consistency, EV/PP split matches `playerSeconds`. This is a prerequisite for both 4 and 5.
3. **Play-by-play ingestion and attribution.** `getPlayByPlay`, `toGameEvents`, `attributeEvents`, wired through `loadGame` with feed isolation. Tests with hand-built timelines (shot at a line change second, shootout filtered, blocked-shot ownership, pulled goalie, `unattributed`), plus one small recorded real-game fixture for the shooter-on-ice rate.
4. **Player detail.** `linemates.ts` view-model and `PlayerDetail`; needs only step 2 data, so it can ship before step 5. Prioritize it over event columns if scope must be cut: the project's core value is spotting role changes, and linemate trend is more directly that than CF/CA.
5. **Event columns on unit tables.** UI only; `UnitTable` gains SF/SA, GF/GA, CF/CA cells reading `unit.events` (`—` when null).

Steps 3 and 4 are parallelizable after step 2. Step 1 can start immediately.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `api-web.nhle.com/v1/gamecenter/{id}/play-by-play` | New `getPlayByPlay` in `client.ts` using `FINISHED_GAME_CACHE` | Contains `plays[]`, `homeTeam`/`awayTeam` with ids, `rosterSpots`. `typeDescKey` values observed: `shot-on-goal`, `missed-shot`, `blocked-shot`, `goal`, plus many irrelevant types. Undocumented API; the project already depends on this family |
| `api.nhle.com/stats/rest/en/shiftcharts` | Existing | Often empty for finished early-season games (see above) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `team-games.ts` to pure core | Function calls with plain inputs | Only place raw NHL shapes are translated; keep `ShiftInput`/`GameEvent` as the contract |
| `lines.ts` to `events.ts` | `analyzeGameLines(..., events?)` merges `EventCounts` onto `Unit` objects (`Unit.events?`) keyed by unit key | Optional param keeps current callers and tests intact |
| `ResearchGame` to view-models | Read-only; `lines.pairSeconds`, `lines.playerSeconds`, `lines.units` | Add a `pairSeconds(game, a, b, situation)` helper beside `situationSeconds()` returning `null` when `lines === null` |
| `page.tsx` to `_components` | Props of plain/derived data | Components never call `loadTeamResearch` |

## Sources

- Repo: `lib/research/lines.ts`, `lib/research/team-games.ts`, `lib/nhl/client.ts`, `app/research/page.tsx`, `components/PendingLink.tsx`, `lib/fantrax/cached-projections.ts` (HIGH, read directly)
- Next.js 16.3.4 local docs (HIGH): `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`searchParams` is a Promise and opts the page into dynamic rendering); `.../02-components/link.md` (`scroll`); `.../04-functions/unstable_cache.md` (superseded by `use cache` under Cache Components; JSON-serialized results); `.../02-guides/caching-without-cache-components.md`; `.../01-getting-started/02-project-structure.md` (private folders); `.../02-guides/server-and-client-boundary.md` (props must be serializable)
- Live NHL API measurements run 2026-10-11 (MEDIUM, public/unauthenticated, small sample): play-by-play and shift charts for TOR games 2026020002/44/65/80 (shifts present), 2026020008/23 (shifts empty), MTL game 2026020075 (OT + shootout); boxscore `sog` cross-check on 2026020002; `analyzeGameLines` timing on 2026020002 via `tsx`
- Community NHL API reference (`github.com/Zmalski/NHL-API-Reference`, already cited in `client.ts`) for `situationCode` digit meaning (LOW-MEDIUM, not re-verified against official docs)

---
*Architecture research for: NHL line/deployment research page*
*Researched: 2026-10-11*
