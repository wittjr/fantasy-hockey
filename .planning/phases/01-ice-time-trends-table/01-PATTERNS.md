# Phase 1: Ice-Time Trends Table - Pattern Map

**Mapped:** 2026-10-11
**Files analyzed:** 8 (3 new, 5 modified)
**Analogs found:** 8 / 8 (all analogs are git-tracked; verified with `git ls-files`)

Note: thresholds per D-18 are TOI 120 s and PP 15 pts (NOT the 180/25 in RESEARCH code examples). D-17 gives four sort keys. D-19: mixed-sign = no tint. D-20: arrow right after each delta.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/research/toi-trends.ts` (new) | utility (pure logic) | transform | `buildRows` in `app/research/page.tsx` L196-240 + `lib/research/lines.ts` `trendSlope` | exact (logic moves) |
| `lib/research/toi-trends.test.ts` (new) | test | transform | `lib/research/lines.test.ts` | exact |
| `lib/research/lines.ts` (mod: `regulationSeconds`) | utility | transform | `analyzeGameLines` / `trendSlope` in same file | exact |
| `lib/research/lines.test.ts` (mod) | test | transform | existing tests, `shifts()` helper L14-16 | exact |
| `lib/research/team-games.ts` (mod: `overtime`, `regulationToi`) | service/loader | request-response | `loadGame` in same file | exact |
| `lib/nhl/client.ts` (mod: `gameOutcome`) | model/type | request-response | `NhlBoxscore` L107-113 | exact |
| `app/research/page.tsx` (mod: sort params, `href`, new `ToiTrends`) | component (server) | request-response | existing `ToiTrends`, `Slope`, `Sparkline`, `href` | exact |
| `app/research/_components/ToiTrends.tsx` (optional new) | component (server) | request-response | `ToiTrends` in page.tsx; `UnitTable` | role-match (pure move + rewrite; export `formatClock`/`formatDate`/`gameLabel`) |

## Pattern Assignments

### `lib/research/toi-trends.ts` (utility, transform)

**Analog:** `app/research/page.tsx` `buildRows` (L196-240) and `lib/research/lines.ts` (`trendSlope` L129-142).

**Imports pattern:** project uses `@/` alias in app code, relative imports within `lib/research` (`team-games.ts` L8: `from "./lines"`):
```typescript
import { trendSlope } from "./lines";
import type { ResearchGame, ResearchPlayer } from "./team-games";
```

**Core pattern to relocate** (page.tsx L207-240; "unknown is not 0", PP only from games with lines):
```typescript
const perGame = research.games.map((g) => {
  const toi = g.toi.get(player.id);
  if (toi === undefined) return null;
  const pp = situationSeconds(g, player.id, "pp");
  const teamPp = g.lines?.situationSeconds.pp ?? 0;
  return { toi, pp, teamPp,
    ppShare: pp !== null && teamPp > 0 ? (pp / teamPp) * 100 : null,
    sh: situationSeconds(g, player.id, "sh") };
});
const played = perGame.flatMap((p, x) => (p ? [{ x, ...p }] : []));
if (played.length === 0) continue;
const withPp = played.filter((p) => p.ppShare !== null);
const teamPpTotal = withPp.reduce((s, p) => s + p.teamPp, 0);
// ppShare = teamPpTotal > 0 ? (Σpp / teamPpTotal) * 100 : null
// toiSlope: trendSlope(played.map((p) => ({ x: p.x, y: p.toi })))
// ppShareSlope: trendSlope(withPp.map((p) => ({ x: p.x, y: p.ppShare!, w: p.teamPp })))
```
Change: `toi` becomes regulation TOI (`g.regulationToi` map, null for OT-without-shifts => excluded from stats but kept in `perGame`); keep `totalToi` for the popover ("+m:ss OT excluded"). Goalies skipped (`if (player.group === "G") continue;`). Constants live beside existing slope thresholds (page.tsx L17-21 style: named consts with a comment): `TOI_MOVER_SECONDS = 120`, `PP_MOVER_POINTS = 15`, plus the slope consts (move 15 / 3 here if arrow logic moves).

**Sort pattern** (replace page.tsx L238-239):
```typescript
const groupOrder = { F: 0, D: 1, G: 2 };
return rows.sort((a, b) => groupOrder[a.player.group] - groupOrder[b.player.group] || b.avgToi - a.avgToi);
```
Extend per RESEARCH "Pure trend math" (`parseSort`, `sortRows`, `recentDelta`, `moverDirection`) with D-17 keys `avgToi|toiDelta|ppShare|ppDelta`, nulls last both directions, F before D always. Use `moverDirection` returning null for mixed sign (D-19).

---

### `lib/research/toi-trends.test.ts` (test)

**Analog:** `lib/research/lines.test.ts` (must live flat in `lib/research/`; npm glob is `lib/**/*.test.ts`).

**Imports/structure** (L1-3, L14-16):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGameLines, parseClock, trendSlope, type PositionGroup, type ShiftInput } from "./lines";
...
test("parseClock parses MM:SS and rejects junk", () => {
  assert.equal(parseClock("03:30"), 210);
});
```
Use hand-built `ResearchGame`-shaped plain objects (structural types), `assert.deepEqual`/`assert.equal`; one `test("...")` per behavior (gates, DNP, OT exclusion, window of 1, sort nulls last, mixed-sign movers).

---

### `lib/research/lines.ts` + `lines.test.ts` (`regulationSeconds`)

**Analog:** same files. Add `regulationSeconds(team, shifts: ShiftInput[])` next to `analyzeGameLines`; test with the `shifts(team, ids, startSec, endSec, period)` helper (lines.test.ts L14-16), which already takes `period`. Code in RESEARCH "Loader additions" is the target.

---

### `lib/research/team-games.ts` (loader)

**Analog:** `loadGame` L52-92.

**Core pattern** (L66-90) — add after `shiftInputs` (L72-78) and extend the `game` literal (L82-90):
```typescript
const toi = new Map<number, number>();
for (const p of [...mine.forwards, ...mine.defense]) {
  const secs = parseClock(p.toi);
  if (secs) toi.set(p.playerId, secs);
}
...
const game: ResearchGame = {
  id: gameId, date: box.gameDate, opponent: them.abbrev, home,
  score: ..., toi,
  lines: shiftInputs.length > 0 ? analyzeGameLines(team, shiftInputs, positions) : null,
  // NEW: overtime, regulationToi
};
```
Also add the two fields to `ResearchGame` (L21-31) with JSDoc comments in the existing style. OT: `box.gameOutcome?.lastPeriodType` is `"OT"|"SO"`; `regulationToi = !overtime ? toi : shiftInputs.length > 0 ? regulationSeconds(team, shiftInputs) : null`. Do not "fix" the `if (secs)` zero-TOI behavior.

---

### `lib/nhl/client.ts`

**Analog:** `NhlBoxscore` L107-113. Add one optional field:
```typescript
gameOutcome?: { lastPeriodType: "REG" | "OT" | "SO" };
```

---

### `app/research/page.tsx` (page wiring, header links)

**Analog:** itself.

**searchParams / validation** (L48-60) — keep; add `sort`/`dir` via `parseSort` (do NOT `String()` them; values may be `string[]`):
```typescript
const { team: teamParam, games: gamesParam } = await searchParams;
const gameCount = GAME_COUNTS.includes(Number(gamesParam)) ? Number(gamesParam) : DEFAULT_GAME_COUNT;
```

**href helper** (L72) — replace with URLSearchParams version carrying sort (RESEARCH "Sort header link"):
```typescript
const href = (t: string, n: number) => `/research?team=${t}&games=${n}`;
```
Existing team/games nav links (L83-109) use `<PendingLink key href className={... "font-semibold underline" : "text-neutral-500 hover:underline"}>`; sort headers copy this with `scroll={false}`, plus `aria-sort` on `<th>`. `<ToiTrends research={research} />` (L124) needs `sort` and `href` passed in.

**Table styling to copy** (L254-258, L275-281): `overflow-x-auto` wrapper (add bottom padding for popover), `border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800` header, row `border-b border-neutral-100 dark:border-neutral-900`, group divider `border-t-2 border-t-neutral-300 dark:border-t-neutral-700` when `rows[i-1].player.group !== row.player.group`, numbers `tabular-nums`, missing `text-neutral-300 dark:text-neutral-700` "—".

**Colors for delta/tint** (Slope L339-345): `text-green-700 dark:text-green-400`, `text-red-600 dark:text-red-400`, `text-neutral-500`. Slope becomes arrow-only/muted placed right after each Δ (D-20); delta drives color (D-09). Static class strings only (no `bg-${x}`); strip shading via fixed color class + inner element with inline `opacity` (popover must not inherit opacity).

**Sparkline** (L355-374): keep; extend to flag OT points (distinct dot) and skip excluded games (pass `null` for excluded). Keep `SPARKLINE_MIN_RANGE_SECONDS`.

**Shared formatters** (L29-46): `formatClock`, `formatDate`, `gameLabel` are also used by `LastGameLines`/`UnitTable`; if extracting to `_components/`, export them rather than duplicating. Leave `LastGameLines` untouched.

---

## Shared Patterns

### Auth gate (unchanged)
**Source:** `app/research/page.tsx` L53-54
```typescript
const session = await auth();
if (!session?.user) redirect("/login");
```

### URL-state links
**Source:** `components/PendingLink.tsx` L25-31 — client component, hard-codes `prefetch={false}` and spreads remaining props onto `Link` (so `scroll={false}` passes through). Only client boundary in the table; never pass `Map`s into it.

### Missed games are null, never 0
**Source:** page.tsx L213 (`if (toi === undefined) return null;`), `situationSeconds` (team-games.ts L109-112 returns null when no `lines`). Apply to all stats, slope, delta, strip.

### Pure logic + co-located tests
**Source:** `lib/research/lines.ts` + `lines.test.ts`; JSDoc comments on exported functions; `node:test` via `tsx --test`.

## No Analog Found

| File/Feature | Role | Data Flow | Reason |
|---|---|---|---|
| CSS-only hover/focus popover on strip cells | component | CSS | No tooltip/popover in codebase; use RESEARCH Pattern 4 (Tailwind named groups `group/cell`, `group-hover/cell:block`, `group-focus/cell:block`, anchor to `<td className="relative">`). |
| `recentDelta` / `moverDirection` / `parseSort` | utility | transform | New logic; use RESEARCH "Pure trend math" with D-17/D-18/D-19 overrides. |

## Metadata

**Analog search scope:** `app/research`, `lib/research`, `lib/nhl`, `components/PendingLink.tsx`
**Files scanned:** 7 (all read in full or targeted ranges)
**Pattern extraction date:** 2026-10-11
