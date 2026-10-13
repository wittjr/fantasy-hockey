# Phase 3: Unit Event Stats - Pattern Map

**Mapped:** 2026-10-13
**Files analyzed:** 14 (7 new code, 5 modified code, fixtures, test-literal builders)
**Analogs found:** 14 / 14 (fixtures and the pool helper are role-match only)

Precedence: CONTEXT D-19..D-23 override RESEARCH where they differ. Two consequences for patterns below: (1) pulled-goalie events are NOT an `empty-net` exclusion; they are counted in Other and Total, never in a listed unit (D-21). The research `Exclusion` union should drop `"empty-net"`. (2) `analyzeGameLines` must stop crediting pulled-goalie seconds to listed units (D-22), so `lines.ts` and `lines.test.ts` are modified.

All analog paths below are git-tracked (`git ls-files` checked for `lib/nhl/client.ts`, `lib/research/pair-seconds.ts`, `lib/research/linemates.ts`; all other `lib/research/*` and `components/*` are listed in `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/nhl/client.ts` (modify: `getPlayByPlay`, tiered cache, 429 retry, `startTimeUTC`) | service (API client) | request-response | itself (`getBoxscore`, `fetchShiftCharts`, `nhlGet`) | exact |
| `lib/nhl/client.test.ts` (modify) | test | request-response | itself (`stubFetch`) | exact |
| `lib/research/play-events.ts` (new: `toGameEvents`) | utility (pure mapper) | transform | `lib/research/team-games.ts` shift mapping (lines 107-113) + `parseClock` | role-match |
| `lib/research/play-events.test.ts` (new) | test | transform | `lib/research/lines.test.ts` | role-match |
| `lib/research/events.ts` (new: `onIceAt`, `attributeEvents`, quality, shift sanity check) | utility (pure analysis) | transform / batch | `lib/research/pair-seconds.ts` | exact |
| `lib/research/events.test.ts` (new, the gate) + `lib/research/fixtures/*.json` | test | transform | `lib/research/lines.test.ts` (shape); no analog for committed JSON fixtures | role-match |
| `lib/research/lines.ts` (modify: extract `unitKey`, pulled-goalie seconds to Other per D-22) | utility | transform | itself | exact |
| `lib/research/lines.test.ts` (modify deliberately, D-22) | test | transform | itself (lines 56-62 empty-net test) | exact |
| `lib/research/team-games.ts` (modify: `events` field, pbp in `loadGame`, paced newest-first pool) | service | request-response / batch | itself (`loadGame`, `loadTeamResearch`) | exact |
| `lib/research/team-games.test.ts` (modify) | test | request-response | itself (`stubNhl`) | exact |
| `lib/research/unit-events-view.ts` (new view-model) + test | utility (pure view-model) | transform | `lib/research/linemates.ts` (`buildLinemateView`, constants + `SITUATION_ABBREV`) | role-match |
| `components/LastGameLines.tsx` (modify) | component (server) | request-response | itself; amber note from `components/PlayerLinemates.tsx:270-275` | exact |
| 5 test files with `ResearchGame` literals (add `events: null`) | test | n/a | `pairs: null` at `toi-trends-view.test.ts:35`, `player-links-view.test.ts:33` | exact |
| `lib/research/format.ts` (reuse, likely unchanged) | utility | transform | itself | exact |

## Pattern Assignments

### `lib/nhl/client.ts` (service, request-response)

**Analog:** itself. Add `getPlayByPlay` next to `getBoxscore`; generalize `FINISHED_GAME_CACHE`.

**Existing client + cache** (lines 6-12, 116-121):
```typescript
async function nhlGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NHL_BASE}/${path}`, { ...init, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`NHL API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
// Finished games only change for stat corrections; an hour keeps them fresh enough.
const FINISHED_GAME_CACHE = { next: { revalidate: 3600 } };
export async function getBoxscore(gameId: number): Promise<NhlBoxscore> {
  return nhlGet<NhlBoxscore>(`gamecenter/${gameId}/boxscore`, FINISHED_GAME_CACHE);
}
```
New: `getBoxscore(gameId, cache = finishedGameCache(undefined))`, `getPlayByPlay(gameId, cache = ...)` hitting `gamecenter/${gameId}/play-by-play`, and `getShiftCharts(gameId, cache = ...)`. Keep the default argument at the recent tier so existing `client.test.ts` (`calls[0].init.next?.revalidate, 3600`) stays green. Constants and `finishedGameCache` skeleton: RESEARCH "Tiered cache + 429 retry". Add `startTimeUTC?: string` to `NhlClubGame` (line 84-86), optional because test stubs omit it.

**Interface style to copy for the pbp types** (lines 94-114): exported `Nhl*` interfaces with only the fields used, `gameOutcome?:` style optional fields. Make `details?` optional on plays (untrusted JSON).

**Uncached empty re-request (keep, lines 134-152):** `fetchShiftCharts(gameId, init)` then `shifts.length > 0 ? shifts : fetchShiftCharts(gameId, { cache: "no-store" })`. Copy this shape for pbp: `plays.length === 0` re-requested with `{ cache: "no-store" }` (never combine with `next`).

**Error handling:** descriptive `throw new Error(\`NHL API ${path} failed: ${res.status} ${res.statusText}\`)`; the 429 retry goes inside `nhlGet` before this throw, with an injectable `sleep` (RESEARCH sketch). `fetchShiftCharts` uses its own `fetch` (unthrottled host); leave it without 429 retry.

---

### `lib/nhl/client.test.ts` (test)

**Analog:** itself, lines 14-24 (`stubFetch`), 26-35 (cache assertion), 37-47 (uncached re-request, `"next" in calls[1].init === false`).
```typescript
function stubFetch(t: TestContext, queue: Array<{ body: unknown; status?: number }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    assert.ok(next, "unexpected extra fetch call");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  return calls;
}
```
For 429 tests, extend the queue entry with optional `headers` (`new Response(body, { status, headers })`). Tier tests: call with `finishedGameCache` outputs and assert `calls[0].init.next?.revalidate`.

---

### `lib/research/play-events.ts` (utility, transform)

**Analog:** the shift mapping in `lib/research/team-games.ts` lines 107-113 (tolerant mapper: bad rows are skipped via `flatMap`, never thrown) plus `parseClock` from `lines.ts:66-69`.
```typescript
const shiftInputs = (shifts ?? []).flatMap((s) => {
  const startSec = parseClock(s.startTime);
  const endSec = parseClock(s.endTime);
  return startSec === null || endSec === null
    ? []
    : [{ playerId: s.playerId, team: s.teamAbbrev, period: s.period, startSec, endSec }];
});
```
Copy the skip-do-not-throw idiom. Use the full `toGameEvents` skeleton in RESEARCH "Event mapper", with this D-21 change: remove the `"empty-net"` exclusion; instead keep `situationCode` (or a derived `pulledGoalie: boolean`) on the event so attribution can route it to Other. Exclusion precedence stays shootout, penalty-shot, teammate-blocked. Imports: `import { parseClock } from "./lines"; import type { NhlPlayByPlay } from "@/lib/nhl/client";`. Test style: `lines.test.ts` (`node:test`, `assert/strict`, small builder helpers like `shifts(...)` at lines 22-24).

---

### `lib/research/events.ts` (utility, transform) - core attribution

**Analog:** `lib/research/pair-seconds.ts` (second consumer of `bucketOnIce` + `dedupeOnIce` + `situationFor`).

**Header and imports to copy** (lines 1-14, 25):
```typescript
// A second pass over the same on-ice seconds as analyzeGameLines, classified by the same situationFor.
import {
  bucketOnIce, dedupeOnIce, PERIOD_SECONDS, situationFor,
  type OnIce, type PositionGroup, type ShiftInput, type Situation,
} from "./lines";
const NO_ONE: OnIce = { skaters: [], goalie: false };
const emptyRecord = (): Record<Situation, number> => ({ ev: 0, pp: 0, sh: 0 });
```

**Core per-bucket pattern** (pair-seconds lines 39-45) - events replace the iteration over buckets with a lookup at `onIceAt`:
```typescript
const rawMine = byTeam.get(team);
if (!rawMine || rawMine.skaters.length === 0) continue;
const mine = dedupeOnIce(rawMine);
const opp = dedupeOnIce([...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? NO_ONE);
const situation = situationFor(mine, opp);
```
`onIceAt` bucket key is `(period - 1) * PERIOD_SECONDS + t - 1`, undefined for `t <= 0` (RESEARCH Pitfall 1). Counting rules and pass structure: RESEARCH "On-ice lookup and attribution" and Pattern 2 (accumulate `total[situation]` and the unit map in the same pass, before any cap/min-time filter). Return shape: plain objects/Maps, null-means-unknown handled by the caller (`events: GameEvents | null` in `ResearchGame`).

**D-21 pulled-goalie routing (new, no existing analog):** detect from `OnIce.goalie === false` for either team at that second (shift-derived, matching D-22 "no goalie shift covering that second") and count in `total[situation]` only, not in the unit map. The same predicate must be used by `analyzeGameLines` for seconds (see lines.ts below); export it from `lines.ts` so both consume one function.

**D-23 sanity check (no analog):** pure function over `ShiftInput[]` plus the two team abbrevs: flags (a) any `shift.team` not in `{home, away}` and (b) identical-row repeats beyond the duplicate rate in good fixtures. Build on `uniqueShifts` key (`lines.ts:22-30`: `${team}:${playerId}:${period}:${startSec}:${endSec}`): compare `shifts.length` vs `uniqueShifts(shifts).length`. Note the shift list passed in must be the raw, un-filtered list (before `bucketOnIce` drops foreign ids). Quality ratio and `EVENT_MATCH_THRESHOLD = 0.95` per RESEARCH Pitfall 11.

---

### `lib/research/lines.ts` (modify: D-22, `unitKey`)

**Analog:** itself. Two touches only.

1. Extract the key logic from lines 150-157 into an exported `unitKey(situation, group, skaters, positions): string | null` returning null where the code `continue`s:
```typescript
const ids = mine.skaters.filter((id) => positions.get(id) === group).sort((a, b) => a - b);
if (ids.length === 0) continue;
if (situation === "ev" && ids.length !== EV_UNIT_SIZE[group]) continue;
const key = ids.join(",");
```
Behaviour unchanged; `analyzeGameLines` calls it.

2. D-22: in the loop at lines 136-158, after computing `situation`, when either team's `goalie` flag is false skip the `unitSeconds` accumulation (lines 150-157) but keep `situationSeconds[situation]++` and `playerSeconds` (player totals are unchanged per D-22). Existing guard style to copy: `if (!rawMine || rawMine.skaters.length === 0) continue;` (line 138). Mind that `opp` falls back to a no-goalie `{ skaters: [], goalie: false }` when the other team has no shifts (line 140); decide whether "other team missing entirely" counts as pulled, and cover it in a test.

---

### `lib/research/lines.test.ts` (modify, deliberate per D-22)

**Analog:** itself. Builders at lines 13-24 (`positions`, `shifts(team, ids, startSec, endSec, period)`). Existing test to update/extend, lines 56-62:
```typescript
test("an empty net counts as even strength, not a power play", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 4, 11, 12], 0, 30), // goalie pulled, 6 skaters
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 30),
  ];
  assert.deepEqual(analyzeGameLines("BUF", input, positions).situationSeconds, { ev: 30, pp: 0, sh: 0 });
});
```
`situationSeconds` stays `ev: 30` (strength unchanged), but add an assertion that `units.ev.F` / `units.ev.D` are empty for that stretch. Note the earlier test at lines 33-54 uses goalie 20 on every shift so it should not change; grep the rest of the file for shifts without a goalie (e.g. lines 64-70 omit goalie 20 for BUF in the blip) and update those expectations deliberately.

---

### `lib/research/team-games.ts` (service, request-response / batch)

**Analog:** itself.

**Add the pbp fetch to the parallel load** (lines 81-87), same failure idiom as the shift chart (null on failure, logged):
```typescript
const [box, shifts] = await Promise.all([
  getBoxscore(gameId),
  getShiftCharts(gameId).catch((err: unknown) => {
    console.error(`Loading shift chart for game ${gameId} (${team}) failed`, err);
    return null;
  }),
]);
```
Add a third entry `getPlayByPlay(gameId, cache).catch(...)` returning null (D-05: pbp failure keeps the game). Thread the per-game `cache` from `finishedGameCache(g.startTimeUTC)` by passing it into `loadGame`.

**Game literal** (lines 119-130): add `events: shiftInputs.length > 0 && pbp ? attributeEvents(...) : null`, in the same style as `lines:` / `pairs:`. Document the field with the same JSDoc style as `pairs` (lines 47-51). Distinguish "pbp missing" from "no chart" in the UI via `lines` null vs `events` null.

**Pool** (lines 142-156): replace `Promise.allSettled(recent.map(...))` with the paced newest-first helper but keep the post-processing loop's contract (oldest-first `games`, `unavailableDates`, `console.error(\`Loading game ${recent[i].id} for ${team} failed\`, result.reason)`, and the "none loaded" throw at 157-159). Preserve result index alignment with `recent` since `settled.forEach((result, i)` indexes `recent[i]`; if loading newest-first, reverse the results back before that loop. Make `gapMs`/`sleep` injectable via an options argument (RESEARCH Pitfall 10) with defaults as named constants.

---

### `lib/research/team-games.test.ts` (modify)

**Analog:** itself, `stubNhl` (lines 46-65): url-regex dispatch with per-case failure lists. Add a `play-by-play` branch with `pbpFails?: number[]` and a canned minimal pbp body, using the same `json(body, status)` helper and `stub.xFails?.includes(id)` idiom:
```typescript
const box = url.match(/gamecenter\/(\d+)\/boxscore/);
if (box) {
  const id = Number(box[1]);
  return stub.boxscoreFails?.includes(id) ? json({}, 503) : json(boxscore(id, stub.lastPeriod?.[id] ?? "REG"));
}
```
Note the stub throws `unexpected request` for unknown URLs, so every existing test breaks until a pbp branch exists. Pass `gapMs: 0` / a no-op `sleep` in these tests.

---

### `lib/research/unit-events-view.ts` + `unit-events-view.test.ts` (view-model, transform)

**Analog:** `lib/research/linemates.ts` (pure view-model with named exported constants, `SITUATION_ABBREV`, `Pick<ResearchGame, ...>` input types, and string-ready output) and its tests; formatters from `lib/research/format.ts`.

**Constants/style to copy** (`linemates.ts` lines 11-25):
```typescript
export const LINEMATE_CAPS: Record<Situation, { F: number; D: number }> = { ev: { F: 6, D: 4 }, pp: { F: 4, D: 3 }, sh: { F: 4, D: 3 } };
export const SITUATION_ABBREV: Record<Situation, string> = { ev: "EV", pp: "PP", sh: "SH" };
export type LinemateGame = Pick<ResearchGame, "id" | "date" | "home" | "opponent" | "score" | "overtime" | "toi" | "pairs">;
```
Move `UNIT_LIMITS` here from `LastGameLines.tsx` (it is currently a private const at lines 9-13; export it so the view-model applies the cap and Other = Total - listed). Formatters to reuse: `formatClock`, `formatSignedPoints` (U+2212 minus already handled, `format.ts:8-22`), `formatDate`. Percent: `pct.toFixed(1)` with "—" at zero denominator (RESEARCH "Percent and plus-minus formatting"; D-20 +/- is "—" only when CF + CA = 0). Also build the exclusions note and amber note strings here with the exact copy in `03-UI-SPEC.md` "Copywriting Contract". Other `%` is computed from seconds, not subtraction of rounded percentages.

Test style: `node:test` + small builders as in `lines.test.ts`; table-render tests may use `renderToStaticMarkup` as `player-detail-view.test.ts:1-10` does (imports `createElement`, `renderToStaticMarkup`, components via `@/components/...`).

---

### `components/LastGameLines.tsx` (component, server)

**Analog:** itself plus Phase 2 amber note.

**Replace the grid** (lines 45-58) with `<div className="flex flex-col gap-6">`, keeping the situation-then-group iteration and the `link` props. Keep `PlayerLink` rendering exactly (lines 100-116) for UNIT-04. Keep the null-lines message (line 43) verbatim and branch on `game.lines` then `game.events` null-ness only.

**Existing header/cell classes to extend** (lines 80-99): `border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800`, `py-1 font-medium`, cells `py-1 tabular-nums`, derived percent `text-neutral-500`, `None` row `colSpan={4} className="py-1 text-neutral-400"` (becomes `colSpan={13}`). Row rule `border-b border-neutral-100 dark:border-neutral-900`. Stat cells, group header row, Other and Total row classes: `03-UI-SPEC.md` "Layout & Columns" (do not restate; copy exactly).

**Amber note classes** (`components/PlayerLinemates.tsx:270-275`):
```tsx
{showNoChartNote && (
  <p className="text-amber-600 dark:text-amber-400">
    No linemate data for {view.noChartDates.map(formatDate).join(", ")}: no shift chart is available ...
  </p>
)}
```
In Phase 3 use `text-xs text-amber-600 dark:text-amber-400` on a `<p>` as the UI-SPEC specifies. Imports to keep: `Fragment`, `PlayerLink`, `formatDate/gameLabel/resultLabel`, `SITUATION_ABBREV`, `TeamResearch`, `SortSpec`; add the view-model import. `Time` and `formatClock` formatting moves to the view-model (component prints strings only). The component needs the older-dates-without-pbp list; derive it from `research.games` (`g.lines && !g.events`) or have the loader supply it, whichever the plan picks.

---

### Test files that build `ResearchGame` literals (add `events: null`)

**Analog:** how `pairs: null` is added: `lib/research/toi-trends-view.test.ts:35`, `lib/research/player-links-view.test.ts:33`, plus `lib/research/linemates.test.ts:61` (`pairs: pair`), `lib/research/player-detail-view.test.ts` (builders at lines ~49 and ~310), `lib/research/toi-trends.test.ts`, `lib/research/team-games.test.ts` only if it builds literals. Run `npx tsc --noEmit` after the type change (tsconfig includes tests).

---

## Shared Patterns

### One timeline, one strength rule
**Source:** `lib/research/lines.ts:71-113` (`situationFor`, `dedupeOnIce`, `bucketOnIce`) and `lib/research/pair-seconds.ts:39-45`.
**Apply to:** `events.ts`, and the D-22 change in `analyzeGameLines`. Never classify strength from `situationCode`; use it only for pulled-goalie/penalty-shot/quality checks.

### Null means unknown ("—", never 0)
**Source:** `ResearchGame.lines` / `pairs` nullable fields in `lib/research/team-games.ts:45-51`; `situationSeconds()` returns null at line 163-166.
**Apply to:** `events: GameEvents | null`, every view-model count cell. A known zero shows `0` (D-20), unknown shows `—`.

### Per-game failure isolation and logging
**Source:** `lib/research/team-games.ts:83-86, 143-156`.
```typescript
getShiftCharts(gameId).catch((err: unknown) => {
  console.error(`Loading shift chart for game ${gameId} (${team}) failed`, err);
  return null;
}),
```
**Apply to:** the pbp fetch (log and null, D-05) and the paced pool (never rejects as a whole).

### Pure functions with co-located `node:test` tests
**Source:** `lib/research/lines.test.ts:1-24` (`import { test } from "node:test"; import assert from "node:assert/strict";`, builder helpers), runner `tsx --test lib/**/*.test.ts`.
**Apply to:** all new `.ts` modules. No barrel files; imports via `./x` inside `lib/research`, `@/lib/...` from components.

### Fetch stubbing in tests
**Source:** `lib/nhl/client.test.ts:14-24` and `lib/research/team-games.test.ts:46-65` (`t.mock.method(globalThis, "fetch", ...)`, `console.error` silenced via `t.mock.method(console, "error", () => {})`).
**Apply to:** pbp, tier, 429 tests.

### Next.js fetch cache semantics
**Source:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md` (only 200 responses cached; `revalidate` with `cache: "no-store"` is invalid) and `incremental-cache/index.js:518-526` (2 MB limit; pbp is ~140 KB). Per AGENTS.md read the doc before citing; RESEARCH already verified it.

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|---|---|---|---|
| `lib/research/fixtures/*.json` | test asset | static data | Repo has no committed JSON fixtures; tests build inline literals. Use RESEARCH "Fixture format" (trimmed tuples, shifts kept verbatim) and load with `fs.readFileSync` in tests. |
| Paced newest-first worker pool (`mapPaced`) | utility | batch | No existing concurrency limiter; only `Promise.allSettled`. Use the RESEARCH skeleton. |
| Shift-chart sanity check (D-23) | utility | transform | New concept; build from `uniqueShifts` key. Thresholds come from fixtures, including negative fixture 2025020565. |
| 429 retry with `Retry-After` in `nhlGet` | service | request-response | No retry logic anywhere in the repo. Use RESEARCH sketch with injectable `sleep`. |
| Group header row / Other / Total rows | component | render | No grouped-header table exists; classes are specified in `03-UI-SPEC.md`. |

## Metadata

**Analog search scope:** `lib/research/`, `lib/nhl/`, `components/` (LastGameLines, PlayerLinemates), test files under `lib/research/`.
**Files read:** `lines.ts`, `pair-seconds.ts`, `team-games.ts`, `client.ts`, `format.ts`, `LastGameLines.tsx`, targeted ranges of `lines.test.ts`, `client.test.ts`, `team-games.test.ts`, `player-detail-view.test.ts`, `PlayerLinemates.tsx`, `linemates.ts` (exports).
**Pattern extraction date:** 2026-10-13
