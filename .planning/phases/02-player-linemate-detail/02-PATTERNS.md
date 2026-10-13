# Phase 2: Player Linemate Detail - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 19 (9 new, 10 modified or moved)
**Analogs found:** 19 / 19 (all tracked in git; verified via `git ls-files`)

All analogs are tracked source under `lib/research/`, `components/`, `app/research/`. No gitignored mirror paths.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/research/lines.ts` (modify: export `situationFor`, `OnIce`, `PERIOD_SECONDS`; extract `bucketOnIce`) | utility | transform | itself, lines 57-105 | exact (verbatim extraction) |
| `lib/research/pair-seconds.ts` (new) | utility | transform | `lib/research/lines.ts` `analyzeGameLines` lines 85-157 | exact |
| `lib/research/pair-seconds.test.ts` (new) | test | transform | `lib/research/lines.test.ts` lines 1-50 | exact |
| `lib/research/team-games.ts` (modify: `ResearchGame.pairs`) | model/service | request-response | itself, lines 28-46 and 113-123 | exact |
| `lib/research/linemates.ts` (new view-model + tuning constants) | utility | transform | `lib/research/toi-trends.ts` (constants 4-16, `recentDelta`, `buildTrendRows`) | role-match |
| `lib/research/linemates.test.ts` (new) | test | transform | `lib/research/toi-trends.test.ts`, `lib/research/lines.test.ts` | role-match |
| `lib/research/toi-trends.ts` (modify: `researchHref` extras, `parsePlayer`/`parseSit`/`parseAll`, `playerHref`) | utility | request-response | itself: `parseSort` 147-150, `researchHref` 186-191 | exact |
| `lib/research/game-strip.ts` (modify: widen state type / sibling detail builder) | utility | transform | itself: `gameDetail` 32-57, `detailText` 60-64 | exact |
| `lib/research/player-detail-view.test.ts` (new markup test) | test | request-response | `lib/research/toi-trends-view.test.ts` | exact |
| `components/PlayerLinemates.tsx` (new panel, server) | component | request-response | `components/ToiTrends.tsx` (section shell, footnotes) + `components/ToiGameStrip.tsx` (strip) | role-match |
| `components/PlayerLink.tsx` (new, thin) | component | request-response | `components/PendingLink.tsx` and `SortHeader` in `ToiTrends.tsx` 166-199 | role-match |
| `components/LastGameLines.tsx` (`UnitTable` + `LastGameLines` moved out of `page.tsx`, plus name links; plan 02-03 keeps `UnitTable` in this file) | component | request-response | `app/research/page.tsx` lines 151-182 (itself) | exact |
| `components/LastGameLines.tsx` (moved with UnitTable, Pitfall 2) | component | request-response | `app/research/page.tsx` lines 121-149 (itself) | exact |
| `components/ToiStripCell.tsx` (modify: widen state, WR-10) | component | event-driven | itself | exact |
| `components/ToiTrends.tsx` (modify: name link, `pl-2`, selected bar) | component | request-response | itself, lines 81-89 and `SortHeader` | exact |
| `components/ToiGameStrip.tsx` (modify only if popover span is extracted) | component | request-response | itself, lines 39-57 | exact |
| `app/research/page.tsx` (modify: parse params, render panel first) | route/page | request-response | itself, lines 29-49, 104-113 | exact |
| `lib/research/toi-trends-view.test.ts` (modify: add `pairs: null` to `fixtureGame`) | test | transform | itself, lines 17-36 | exact |
| `components/PlayerLinemates` cell helper in `lib/research/linemates.ts` (`detailText`-style source) | utility | transform | `lib/research/game-strip.ts` `gameDetail`/`detailText` | exact |

## Pattern Assignments

### `lib/research/lines.ts` (modify, verbatim extraction)

**Analog:** itself. Move lines 90-105 into `export function bucketOnIce(shifts, positions)`; `analyzeGameLines` calls it. Do not change outputs, the `GameLines` type, or `lines.test.ts`.

**Extraction source** (lines 90-105, `lines.ts`):
```typescript
  const seconds = new Map<number, Map<string, OnIce>>();
  for (const shift of uniqueShifts(shifts)) {
    const pos = positions.get(shift.playerId);
    if (!pos || shift.endSec <= shift.startSec) continue;
    const offset = (shift.period - 1) * PERIOD_SECONDS;
    for (let s = shift.startSec; s < shift.endSec; s++) {
      const t = offset + s;
      let byTeam = seconds.get(t);
      if (!byTeam) seconds.set(t, (byTeam = new Map()));
      let onIce = byTeam.get(shift.team);
      if (!onIce) byTeam.set(shift.team, (onIce = { skaters: [], goalie: false }));
      if (pos === "G") onIce.goalie = true;
      else onIce.skaters.push(shift.playerId);
    }
  }
```
Also `export` (currently private): `situationFor` (line 69), `interface OnIce` (76), `PERIOD_SECONDS` (57). `REGULATION_PERIODS` is already exported (line 15).

---

### `lib/research/pair-seconds.ts` (utility, transform)

**Analog:** `lib/research/lines.ts` `analyzeGameLines` lines 85-157.

**Per-second loop to mirror** (lines 115-126):
```typescript
  for (const byTeam of seconds.values()) {
    const mine = byTeam.get(team);
    if (!mine || mine.skaters.length === 0) continue;
    const opp = [...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? { skaters: [], goalie: false };
    const situation = situationFor(mine, opp);
    for (const id of mine.skaters) {
      let rec = playerSeconds.get(id);
      if (!rec) playerSeconds.set(id, (rec = { ev: 0, pp: 0, sh: 0 }));
      rec[situation]++;
    }
```
Differences: iterate `[t, byTeam]` entries and `continue` when `t >= REGULATION_PERIODS * PERIOD_SECONDS` (D-19); add `together` nested Map increments for every other own-team skater; record `groups` from `positions`. Return `{ self, together, groups }` per RESEARCH Pattern 1 (`GamePairs`). Import style: `import { bucketOnIce, situationFor, REGULATION_PERIODS, PERIOD_SECONDS, type PositionGroup, type ShiftInput, type Situation } from "./lines";` (relative `./` inside `lib/research`, as in `team-games.ts` line 15). Header comment style: 2-line `//` file header as `lines.ts` lines 1-2; JSDoc on exported function.

**Test oracle** (RESEARCH invariants): `self[S]` equals `lines.playerSeconds[S]` in non-OT games; `together` symmetric and `<= min(self)`.

---

### `lib/research/pair-seconds.test.ts` (test)

**Analog:** `lib/research/lines.test.ts`.

**Fixture + imports** (lines 1-24):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
// BUF: forwards 1-6, D 11-14, G 20. OPP: skaters 101-105, G 120.
const positions = new Map<number, PositionGroup>([ ...[1, 2, 3, 4, 5, 6].map((id) => [id, "F"] as [number, PositionGroup]), ... ]);
function shifts(team: string, ids: number[], startSec: number, endSec: number, period = 1): ShiftInput[] {
  return ids.map((playerId) => ({ playerId, team, period, startSec, endSec }));
}
```
Reuse the `shifts()` helper style; add an OT shift (`period = 4`) fixture to assert it is excluded.

---

### `lib/research/team-games.ts` (modify)

**Analog:** itself. Add `pairs: GamePairs | null;` to `ResearchGame` (after `lines`, lines 44-45 style with JSDoc "Null when ..."). In `loadGame` (line 122) add beside `lines`:
```typescript
    lines: shiftInputs.length > 0 ? analyzeGameLines(team, shiftInputs, positions) : null,
    pairs: shiftInputs.length > 0 ? pairSeconds(team, shiftInputs, positions) : null,
```
Required field (Pitfall 3), so update `fixtureGame` in `toi-trends-view.test.ts` line 19-35 with `pairs: null`.

---

### `lib/research/linemates.ts` (utility, transform)

**Analog:** `lib/research/toi-trends.ts`.

**Named exported constants with comment** (lines 4-16):
```typescript
export const PP_MOVER_POINTS = 15;
/** "Recent" is the team's last 2 games in the window (D-05). */
export const RECENT_GAMES = 2;
/** A delta needs at least this many included games (D-06). */
export const MIN_GAMES_FOR_DELTA = 3;
```
Define `LINEMATE_MIN_SECONDS`, `LINEMATE_CAPS`, `LINEMATE_TAG_POINTS`, `LINEMATE_NEW_EARLIER_MAX_POINTS`, `LINEMATE_SHADE_SATURATION_SHARE` per RESEARCH Pattern 3. Import `RECENT_GAMES` and `deltaCrossing` from `./toi-trends`.

**Tag rounding test to reuse** (`toi-trends.ts` lines 79-82):
```typescript
export function deltaCrossing(delta: number | null, threshold: number): -1 | 0 | 1 {
  if (delta === null || Math.round(Math.abs(delta)) < threshold) return 0;
  return delta > 0 ? 1 : -1;
}
```
**Structural input type so tests pass plain objects** (line 19-21):
```typescript
export type TrendGame = Pick<ResearchGame, "toi" | "regulationToi"> & { lines: Pick<GameLines, ...> | null };
```
Do the same: `type LinemateGame = Pick<ResearchGame, "id" | "date" | "toi" | "overtime" | ...> & { pairs: GamePairs | null }`.

**Recent/earlier split by team-game index** (lines 102-107): `p.x >= windowSize - RECENT_GAMES`. New rule at n=2: recent = latest game (D-15), so compute `rs` explicitly (RESEARCH Pattern 3) rather than reusing `recentDelta`.

**Shade formula** (mirror `game-strip.ts` `stripOpacity`, lines 9-12): `0.2 + 0.8 * clamp(share / LINEMATE_SHADE_SATURATION_SHARE, 0, 1)`.

**Cell detail builder** (mirror `game-strip.ts` lines 24-64): `GameDetail`-shaped `{ title, periodTag, rows, notes }` and `detailText(detail)` for the `aria-label`; reuse `detailText` as-is. Title built from `formatDate`, `gameLabel`, `resultLabel` (`format.ts` lines 24-32). Unknown values are notes, never 0 (see `gameDetail` lines 36-39, 46-51). Sort tie-break chain style: `toi-trends.ts` line 181 (`|| a.player.name.localeCompare(...) || a.player.id - b.player.id`).

---

### `lib/research/linemates.test.ts` (test)

**Analog:** `lib/research/toi-trends.test.ts` / `game-strip.test.ts`. Header (game-strip.test.ts lines 1-9): `import { test } from "node:test"; import assert from "node:assert/strict";` then a small cell factory. Float compare idiom: `assert.ok(Math.abs(x - 0.6) < 1e-9)`. Per RESEARCH, the SC4 line-change test uses a clean synthetic fixture and says so in its name.

---

### `lib/research/toi-trends.ts` (modify URL helpers)

**Analog:** itself.

**Allowlist parser to model on** (lines 146-150):
```typescript
/** Validates raw search params (strings, arrays or absent) against the allowlist; anything else is the default. */
export function parseSort(sort: unknown, dir: unknown): SortSpec {
  if (typeof sort !== "string" || !(SORT_KEYS as readonly string[]).includes(sort)) return DEFAULT_SORT;
  return { key: sort as SortKey, dir: dir === "asc" ? "asc" : "desc" };
}
```
Add `parsePlayer`, `parseSit`, `parseAll` (RESEARCH Code Examples).

**href builder to extend** (lines 185-191):
```typescript
/** Built only from validated values, so a request's raw params never reach a link. */
export function researchHref(team: string, games: number, sort: SortSpec): string {
  const params = new URLSearchParams({ team, games: String(games) });
  if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) params.set("sort", sort.key);
  if (sort.dir === "asc") params.set("dir", "asc");
  return `/research?${params}`;
}
```
Add optional 4th arg `extras?: { player?: number | null; sit?: Situation; all?: boolean }`, omit defaults (`sit` ev, `all` false). Default output must stay byte-identical (`toi-trends.test.ts` ~line 315: `"/research?team=MTL&games=10"`). `Situation` type import from `./lines`.

---

### `lib/research/player-detail-view.test.ts` (markup test)

**Analog:** `lib/research/toi-trends-view.test.ts`. Must sit directly in `lib/research/` (Pitfall 11: `npm test` is `tsx --test lib/**/*.test.ts`).

**Pattern** (lines 1-8, 38-53):
```typescript
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { nextOpen, type CellEvent } from "@/components/ToiStripCell";
const render = (r: TeamResearch, sort: SortSpec = DEFAULT_SORT, team = "MTL", gameCount = 5) =>
  renderToStaticMarkup(createElement(ToiTrends, { research: r, sort, team, gameCount }));
const classTokens = (tag: string) => (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
const popoverTags = (html: string) =>
  [...html.matchAll(/<span\b[^>]*>/g)].map((m) => m[0])
    .filter((t) => t.includes('aria-hidden="true"') && classTokens(t).includes("group-hover/cell:block"));
```
Use for: UnitTable Time and `%` cells unchanged (roadmap criterion 5), dismissed class ordering string pin, tag chips, empty states.

---

### `components/PlayerLinemates.tsx` (component, server)

**Analog:** `components/ToiTrends.tsx` (section shell, table classes, footnote block) and `components/ToiGameStrip.tsx` (strip/popover).

**Section + scroll wrapper + table classes** (`ToiTrends.tsx` lines 46-60):
```tsx
<section className="flex flex-col gap-3">
  <h2 className="font-medium">Ice-time trends</h2>
  <p className="text-sm text-neutral-500">...</p>
  <div className="overflow-x-auto pb-28 -mb-24">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
          <th scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">Player</th>
```
Panel root per UI-SPEC: `<section id="player-detail" aria-labelledby="player-detail-title" className="scroll-mt-4 flex flex-col gap-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">`.

**F/D divider and F-then-D row rule** (`ToiTrends.tsx` line 78): `"border-t-2 border-t-neutral-300 dark:border-t-neutral-700"`.

**Header stats formatting and mover tone: reuse `DeltaCell` logic** (`ToiTrends.tsx` lines 229-235):
```tsx
const crossing = deltaCrossing(delta, moverThreshold);
const tone = crossing === 1 ? "font-medium text-green-700 dark:text-green-400"
  : crossing === -1 ? "font-medium text-red-700 dark:text-red-400" : "";
```
`DeltaCell` is a private `<td>` helper; in the panel render the same tone inside a `<dd>` (do not export-refactor unless needed). Value formatters: `formatClock`, `formatSignedClock`, `formatSignedPoints`, `Math.round(row.ppShare)%`; unknown = `<span className="text-neutral-400 dark:text-neutral-500">—</span>` (lines 97, 109, 238).

**Footnote block, amber no-chart note** (`ToiTrends.tsx` lines 135-160):
```tsx
<div className="flex flex-col gap-1 text-xs text-neutral-500">
  <p>...</p>
  {noChartDates.length > 0 && (
    <p className="text-amber-600 dark:text-amber-400">No PP/SH data for {noChartDates.join(", ")}: no shift chart ...</p>
  )}
</div>
```
with `const noChartDates = research.games.filter((g) => !g.lines).map((g) => formatDate(g.date));` (line 43).

**Strip cells:** copy `ToiGameStrip.tsx` lines 11-58 (group div `flex gap-1`, `ToiStripCell` className string at line 31, inner fill span with inline `opacity` at 34-37, popover span at 39-57 and `PopoverRow` at 66-74). Fill goes on an inner element, never on the popover's parent (Pitfall 10). Add states: together (fill), apart (hollow, `border-neutral-200 dark:border-neutral-800`), absent (`border-dashed border-neutral-400 dark:border-neutral-600`), unknown (`border-dashed border-amber-600 dark:border-amber-400`); OT ring `" ring-1 ring-sky-500"` as in line 18. Border state selection pattern (lines 19-24).

Optionally extract the popover span (lines 39-57) and `PopoverRow` into a shared server component so classes do not drift (UI-SPEC permits).

Client boundary: keep this file a server component; only `ToiStripCell` and `PendingLink` are client.

---

### `components/PlayerLink.tsx` (component, thin)

**Analog:** `SortHeader` link use in `ToiTrends.tsx` lines 188-196 and `PendingLink.tsx`.
```tsx
<PendingLink
  href={researchHref(team, gameCount, nextSort(sort, sortKey))}
  title={title}
  scroll={false}
  className={`justify-end ${active ? "font-medium text-neutral-900 dark:text-neutral-100" : "hover:underline"}`}
>
```
Name links omit `scroll={false}` (default scroll to `#player-detail`, D-03); href = `playerHref(...)`. The already-selected name renders a plain `<a href="#player-detail" aria-current="true">` (RESEARCH Next.js Specifics, Pitfall 6), not `PendingLink`. `PendingLink` already sets `prefetch={false}` (`PendingLink.tsx` line 27) and appends the spinner slot; no change to it.

---

### `components/UnitTable.tsx` + `components/LastGameLines.tsx` (moved from `page.tsx`)

**Analog:** `app/research/page.tsx` lines 121-182, copied verbatim then edited. `page.tsx` cannot export them (generated Next type check rejects extra exports; Pitfall 2). Move `UNIT_LIMITS` (lines 14-18) and `SITUATION_LABELS` (19) with them.

**Cells that must stay unchanged** (lines 172-175, roadmap criterion 5):
```tsx
<td className="py-1 text-neutral-500">{i + 1}</td>
<td className="py-1 tabular-nums">{formatClock(u.seconds)}</td>
<td className="py-1 tabular-nums text-neutral-500">{u.pct.toFixed(1)}</td>
<td className="py-1">{u.playerIds.map(name).join(" – ")}</td>
```
Only the last cell changes: map ids to `PlayerLink` with `sit` and join with `<span aria-hidden> – </span>`. `UnitTable` needs new props: `situation`, selected id, team, gameCount, sort. Server components, no `"use client"`.

---

### `components/ToiStripCell.tsx` (modify)

**Analog:** itself. Change line 4/26 `state: StripCellState` to a widened string union (e.g. `StripCellState | LinemateCellState`). WR-10 (UI-SPEC, or deferral recorded in 01-REVIEW-DISPOSITION.md): add a dismiss event to `nextOpen`/`CellEvent` (lines 6-11), remove `aria-expanded` (line 49) and `e.currentTarget.blur()` (line 59), add `data-dismissed`. Existing `nextOpen` unit tests live in `toi-trends-view.test.ts` (imports `nextOpen`, `CellEvent` at line 5); extend them there.

---

### `components/ToiTrends.tsx` (modify)

**Analog:** itself. Name cell (lines 81-89): wrap `{row.player.name}` in `PlayerLink`; keep the `sr-only` mover span and `DNP last 2` chip. Add `pl-2` to every first-column `<th>`/`<td>` (lines 60, 81). Selected `<td>` adds `shadow-[inset_4px_0_0_0] shadow-neutral-900 dark:shadow-neutral-100`. `SortHeader` (lines 166-199) must pass `player`/`sit`/`all` into `researchHref` extras. New props: selected player id, `sit`, `all`. Call sites in `toi-trends-view.test.ts` line 40 pass `{ research, sort, team, gameCount }`; make new props optional to avoid touching existing tests.

---

### `app/research/page.tsx` (modify)

**Analog:** itself.

**Param parse** (line 29, 35, 49):
```tsx
const { team: teamParam, games: gamesParam, sort: sortParam, dir: dirParam } = await searchParams;
const sort = parseSort(sortParam, dirParam);
const href = (t: string, n: number) => researchHref(t, n, sort);
```
Extend with `player`, `sit`, `all`; per UI-SPEC, team links drop `player`/`all` and keep `sit`; window links keep `player`, `sit`, drop `all`.

**Render slot** (lines 104-113): insert the panel (or the not-in-window notice) between the `unavailableDates` paragraph and `<LastGameLines>`. Obtain the selected `TrendRow` with `buildTrendRows(research.players.values(), research.games).find(...)` (RESEARCH Pattern 5). A goalie or unknown id yields the notice, never a fetch.

**Auth gate: keep these three lines byte-identical** (lines 1, 26, 27; `webkit-strip-check.cjs` depends on them):
```tsx
import { auth } from "@/auth";
const session = await auth();
if (!session?.user) redirect("/login");
```
Error pattern in this file (lines 40-46): try/catch around `loadTeamResearch`, `console.error("Loading research for ${team} failed", e)`, fixed user copy. This phase adds no fetch, so add no new error path.

---

### `lib/research/game-strip.ts` (modify)

**Analog:** itself. `StripCellState = "played" | "dnp" | "excluded"` (line 14) is consumed by `ToiStripCell`; either widen it or add a sibling `LinemateCellState` and union in the component. `GameDetail` (lines 24-29) and `detailText` (60-64) are reused as-is by the linemate cell so popover rows and `aria-label` share one source.

---

## Shared Patterns

### Missing or unknown is `null`/blank, never 0
**Source:** `lib/research/toi-trends.ts` lines 23-36 (`PerGameCell` nulls), `game-strip.ts` lines 36-39, 46-51.
**Apply to:** `pair-seconds.ts`, `linemates.ts` cell states (`unknown`, `absent`, `apart`, `together`), the panel header stats, popover notes.
```typescript
if (cell === null) { detail.notes.push("Did not play"); return detail; }
```

### Allowlist-validated search params; hrefs built only from validated values
**Source:** `toi-trends.ts` lines 146-150 and 185-191; page.tsx line 30-33 (team allowlist via `NHL_TEAM_ABBREVS`).
**Apply to:** `parsePlayer`/`parseSit`/`parseAll`, every `PlayerLink`, tab, close, show-all, sort link. Arrays or unknown values fall to defaults.

### Single EV/PP/SH classifier
**Source:** `lines.ts` `situationFor` lines 69-74. **Apply to:** `pair-seconds.ts` only via the exported function; never reimplement.

### Pure logic in `lib/research/*.ts`, co-located `node:test` tests, no logic in components
**Source:** `game-strip.ts` + `game-strip.test.ts`, `toi-trends.ts` + `toi-trends.test.ts`. **Apply to:** `pair-seconds`, `linemates`.

### Neutral palette with dark pairs, `tabular-nums`, 20x20 bordered squares
**Source:** `ToiGameStrip.tsx` line 31 class string (copy byte-for-byte), `ToiTrends.tsx` lines 90-97. **Apply to:** all new markup. No new colors; tags are neutral (UI-SPEC).

### Imports
`@/` alias for components and cross-dir (`import { PendingLink } from "@/components/PendingLink";`, `import { formatClock, ... } from "@/lib/research/format";`); relative `./` inside `lib/research`. No barrel files.

### Next.js 16 notes
`searchParams` is a `Promise` (page.tsx line 24, 29). Read `node_modules/next/dist/docs/` before routing edits (AGENTS.md). Run any dev server in a scratch copy (it rewrites AGENTS.md/CLAUDE.md).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Tag chips (New/Rising/Fading/Out) inside `PlayerLinemates.tsx` | component | transform | No chip with solid/outlined/dashed variants exists; closest is the `DNP last 2` chip (`ToiTrends.tsx` lines 85-87: `rounded border border-neutral-300 px-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400`). Use UI-SPEC class strings. |
| Situation tabs nav | component | request-response | No tab nav exists. Closest: page.tsx team/window `PendingLink` navs (lines 64-92). Use UI-SPEC classes with `aria-current="true"` and `scroll={false}`. |
| Pair-overlap window-share/tag rules | utility | transform | New logic; follow RESEARCH Pattern 2 and 3 (decision tables). |

## Metadata

**Analog search scope:** `lib/research/`, `components/`, `app/research/`
**Files read:** lines.ts, team-games.ts, toi-trends.ts, game-strip.ts, ToiStripCell.tsx, ToiGameStrip.tsx, ToiTrends.tsx, PendingLink.tsx, page.tsx, plus heads of lines.test.ts, game-strip.test.ts, toi-trends-view.test.ts
**Pattern extraction date:** 2026-10-12
