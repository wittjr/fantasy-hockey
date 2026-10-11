# Phase 1: Ice-Time Trends Table - Research

**Researched:** 2026-10-11
**Domain:** Server-rendered Next.js 16 table over NHL shift-chart-derived ice time (pure trend math + URL-driven sort + CSS-only per-game detail)
**Confidence:** HIGH for data semantics (probed live NHL API, 110 real boxscores); HIGH for repo integration (files read this session); MEDIUM for mover thresholds (one season-slice, five teams); MEDIUM-LOW for touch behaviour of the hover/focus detail (not testable here)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Row columns & density**
- **D-01:** Primary columns, in order: Player, Pos, Avg TOI, TOI Δ, PP share %, PP share Δ, SH (small/muted), per-game strip, sparkline (see D-10, D-11). The old per-game numeric columns are removed.
- **D-02:** The PP number is **PP share %** (player PP time / team PP time over the window), not PP TOI per game.
- **D-03:** Direction is shown as the **recent-vs-window delta** (number + color). The least-squares slope (existing `trendSlope`) is kept only as a muted arrow, not as a displayed number.
- **D-04:** SH is a small, muted column (SH TOI per game) after PP, with no trend/delta.

**"Recent" window & minimum games**
- **D-05:** "Recent" = the **team's last 2 games** in the window. Delta = player's avg over the recent games he played − player's avg over his earlier games in the window.
- **D-06:** Slope arrow shows at **≥2 games played**. Delta shows only at **≥3 games played** and requires ≥1 played game in the recent part and ≥1 in the earlier part; otherwise "—". Games-played count is visible on the row.
- **D-07:** If the player missed both of the team's last 2 games, show a small muted "out" marker (e.g. "DNP last 2"); delta is "—".
- **D-08:** Window of 1 ("Last game"): show values only — no delta, slope, arrow, or tint.
- **D-09:** When slope and delta disagree, **the delta drives the color**; the slope arrow stays but muted.
- Missed games (player not in boxscore) are excluded from averages, slopes and deltas — never treated as 0 (existing `perGame: null` behavior).

**Per-game detail access**
- **D-10:** Each row gets a **mini per-game strip**: one small cell per team game in the window, shaded by that game's TOI relative to the player's own window average (darker = above, lighter = below); missed games are a distinct empty cell. Hover/focus a cell shows exact TOI, PP (and PP share), SH, date and opponent.
- **D-11:** **Keep the sparkline** alongside the strip.
- **D-12:** Games without shift charts: show boxscore TOI; PP/SH as "—" (existing "no PP/SH data" semantics).
- **D-13:** **OT games are flagged** (e.g. "OT" in the strip cell/tooltip, distinct sparkline dot) and **OT minutes are removed** — Avg TOI, delta and slope all use regulation TOI (periods 1–3) derived from shift charts. If an OT game has no shift data, exclude that whole game from Avg/delta/slope (still shown, flagged, in the strip).

**Sorting & highlighting**
- **D-14:** Default sort: Avg TOI descending within F/D groups (current behavior). Forwards always before defense regardless of sort.
- **D-15:** Sort via **clickable column headers** that set `?sort=` (keep `team` and `games` params). Sortable: Avg TOI, TOI Δ, PP share Δ.
- **D-16:** Big movers get a **subtle row tint** (green up / red down) when **either** TOI Δ or PP share Δ crosses its mover threshold; the same threshold colors the delta numbers.

### Claude's Discretion
- Row density / padding / type size — pick what reads cleanest (one line per player preferred).
- Mover thresholds for TOI Δ and PP share Δ — tune against real team data (research suggested ~±1:00 TOI, ~±10 PP-share points as a starting point). Existing slope thresholds (`TOI_TREND_THRESHOLD_SECONDS = 15`, `PP_SHARE_TREND_THRESHOLD_POINTS = 3`) still drive the muted arrow.
- Sort direction toggling, header affordances, and how null deltas sort (should sink to the bottom of their group).
- How OT is detected (boxscore/game metadata vs periods in shift charts).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Player detail via row click is already Phase 2.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRND-01 | Ice-time section is a trends table (avg TOI, PP share, SH, trend arrow, sparkline primary; per-game grid removed) | Column model in "Architecture Patterns"; `buildTrendRows` reference in "Code Examples" |
| TRND-02 | Exact per-game TOI/PP/SH still reachable (tooltip or detail) | CSS-only focus/hover popover on the strip (Pattern 4), `aria-label` carries the same text for AT |
| TRND-03 | Recent-vs-window delta for TOI and PP share | `recentDelta` (Pattern 2), measured threshold evidence |
| TRND-04 | No trend below min games; missed games are not 0; OT games flagged | Per-game cell state model (Pattern 1), OT detection + regulation TOI (verified on live data) |
| TRND-05 | Sort by trend / avg TOI / PP share; URL-persisted; F/D grouping kept | `parseSort`/`sortRows` (Pattern 3), Next 16 `searchParams` + `PendingLink` notes |
</phase_requirements>

## Summary

Phase 1 needs **no new data fetches and no new packages**. Everything the table needs is already loaded per game by `loadGame` (boxscore + shift chart); two small additions to `ResearchGame` are required: an `overtime` flag and a per-player `regulationToi` map. Both are derived from data that is already fetched. OT is reliably identified by `gameOutcome.lastPeriodType` (`"REG" | "OT" | "SO"`), present on the boxscore (which `loadGame` already fetches) and on the club schedule; across 110 real boxscores it was present in 100% of games and always agreed with `periodDescriptor.periodType`. Shootout games also contain a real 5-minute OT period (period 4) with shifts, so `SO` counts as an OT game for TOI purposes. Regulation TOI is a plain sum of shift durations for periods 1-3, and **shift-derived total TOI equals boxscore TOI exactly (max diff 0 s over 36 skaters in each of 11 games)**, so the derivation is trustworthy whenever a shift chart exists.

The most important finding for the planner is about **thresholds, not code**. On 2025-26 data (5 teams, ~24 games each, sliding windows of 5 and 10), a player's game-to-game regulation-TOI standard deviation is a median of 1:50, and the "last 2 vs earlier" TOI delta is dominated by that noise: the real distribution of `|delta|` is almost indistinguishable from a **shuffled-game-order baseline** (e.g. N=10, |ΔTOI| >= 1:00 flags 57.8% of regular players for real vs 54.2% by pure shuffling; PP share Δ >= 20 points flags 12.3% real vs 12.6% shuffled). The context-suggested starting points (±1:00, ±10 pts) would tint roughly 6 in 10 rows, defeating "stands out". Recommended constants: **TOI ±3:00 and PP share ±25 points** (about 11-14% and 7-11% of rows respectively), exposed as named constants and documented as deliberately conservative.

The rest is conventional: put the pure math in `lib/research/toi-trends.ts` (flat file next to `lines.ts`, test file `toi-trends.test.ts`, picked up by the existing `npm test` glob), render the table as a server component, drive sorting with `?sort=`/`?dir=` header links built from `PendingLink` (`scroll={false}`), and show per-game detail with a CSS-only focus/hover popover anchored to the strip's `<td>`.

**Primary recommendation:** Add `overtime` + `regulationToi` to `ResearchGame`, move `buildRows` into a tested pure `lib/research/toi-trends.ts` (regulation TOI, `recentDelta`, `sortRows`, `parseSort`), set mover thresholds to 3:00 / 25 pts, and render strip + popover with Tailwind named groups (no client component, no new dependency).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OT flag, regulation TOI per player | API/Backend (`team-games.ts` loader, server) | — | Derived from boxscore + shift chart already fetched server-side; must not ship raw shifts to the browser |
| Trend math (avg, slope, delta, mover class) | API/Backend (pure `lib/research/toi-trends.ts`) | — | Pure, unit-testable, no I/O; reused by Phase 2 |
| Sort param parsing + row ordering | API/Backend (pure fn, called from the server page) | Browser (just follows header links) | State lives in the URL, page re-renders on the server; matches existing `team`/`games` pattern |
| Table, strip, sparkline, popover rendering | Frontend Server (server components) | Browser (CSS `:hover`/`:focus` only) | No client state needed; popover is pure CSS |
| Sort header navigation + pending spinner | Browser (`PendingLink`, existing client component) | Frontend Server | Already the project's navigation primitive (`prefetch={false}`) |
| Auth gate | Frontend Server (`auth()` in page) | — | Unchanged; page already redirects unauthenticated users |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.4 [VERIFIED: package.json:18] | App Router server component page, `Link`, `searchParams` Promise | Existing stack |
| react / react-dom | 19.2.8 [VERIFIED: package.json:19-20] | Server components | Existing stack |
| tailwindcss | 4.3.3 [VERIFIED: `node -e require("tailwindcss/package.json").version`] | Styling incl. named groups (`group/cell`, `group-hover/cell:`, `group-focus/cell:`) | Existing stack |
| tsx | 4.23.13 [VERIFIED: node_modules/tsx/package.json] | Test runner (`tsx --test`) | Existing stack |

### Supporting
None. `trendSlope` (`lib/research/lines.ts`) is reused unchanged.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only popover | tiny `"use client"` tooltip component | Only needed if touch/pinning proves inadequate in UAT; adds a client boundary and state |
| CSS-only popover | native `title` attribute | Rejected: not keyboard/touch accessible, no multi-line formatting, 1-s delay |
| CSS-only popover | Popover API / CSS anchor positioning | Escapes `overflow` clipping but needs button wiring and anchor-positioning browser support; over-engineered here |
| `lastPeriodType` from boxscore | `lastPeriodType` from schedule item (`NhlClubGame`) | Both carry it; boxscore needs only a type addition in `NhlBoxscore`, schedule needs plumbing through `loadGame(team, gameId)` |

**Installation:** none. **Version verification:** no packages added.

## Package Legitimacy Audit

No external packages are installed by this phase, so the `package-legitimacy` gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
GET /research?team=MTL&games=10&sort=toiDelta&dir=asc
   │
   ▼
page.tsx (server): auth() ──(no session)──► redirect /login
   │  parse team, games (existing) + parseSort(sort, dir)  [allowlist, array-safe]
   ▼
loadTeamResearch(team, n)                     per game, in parallel (unchanged fan-out)
   │   getBoxscore ─┐
   │   getShiftCharts ┴─► loadGame
   │        ├─ toi: Map  (boxscore TOI, total incl. OT)                    [exists]
   │        ├─ lines: GameLines | null  (analyzeGameLines, whole game)     [exists]
   │        ├─ overtime  ◄── box.gameOutcome.lastPeriodType ∈ {OT, SO}     [NEW]
   │        └─ regulationToi ◄── non-OT: = toi │ OT+shifts: Σ period≤3     │ OT, no shifts: null   [NEW]
   ▼
TeamResearch { players, games[] oldest→newest }
   │
   ▼
buildTrendRows(players, games)  (lib/research/toi-trends.ts, pure)
   per player: perGame cells (null = did not dress)
     ├─ included = dressed games with regulation TOI known
     ├─ avgToi, SH avg, ppShare (pooled), toiSlope, ppShareSlope  (≥2 included)
     ├─ toiDelta, ppShareDelta (≥3 included; ≥1 recent AND ≥1 earlier; recent = last 2 team games)
     └─ dnpLast2, mover direction (either |Δ| ≥ threshold, same sign)
   ▼
sortRows(rows, {key, dir})  → F group, then D group; nulls last within group
   ▼
<ToiTrends> (server component)
   header cells = PendingLink(href with sort/dir, scroll=false), aria-sort on <th>
   row: Player │ Pos+GP │ Avg │ ΔTOI(+muted arrow) │ PP% │ ΔPP(+muted arrow) │ SH │ strip(+popover) │ sparkline
```

### Recommended Project Structure
```
lib/nhl/client.ts                 # + gameOutcome?: { lastPeriodType: "REG" | "OT" | "SO" } on NhlBoxscore
lib/research/
├── lines.ts                      # + regulationSeconds(team, shifts)  (next to analyzeGameLines; ShiftInput lives here)
├── lines.test.ts                 # + regulationSeconds test
├── team-games.ts                 # ResearchGame += overtime, regulationToi; loadGame fills them
├── toi-trends.ts                 # NEW pure: buildTrendRows, recentDelta, moverDirection, parseSort, sortRows, constants
└── toi-trends.test.ts            # NEW (flat in lib/research/ so the npm test glob finds it)
app/research/
├── page.tsx                      # parse sort/dir, extend href(), render <ToiTrends>
└── _components/ToiTrends.tsx     # OPTIONAL move (see Open Question 4): ToiTrends, TrendArrow, Sparkline, Strip
```

### Pattern 1: Per-game cell state model (the "unknown is not 0" contract)
**What:** `perGame[i]` is `null` when the player did not dress (absent from boxscore `toi` map). When he dressed it is a cell `{ totalToi, toi, pp, teamPp, ppShare, sh }` where `toi` is **regulation** TOI, or `null` for an OT game with no shift data (flagged, shown in strip, excluded from all stats). PP/SH are `null` when `lines === null`.
**Derivation of `toi` per game:** `game.regulationToi ? (game.regulationToi.get(id) ?? 0) : null`.
**"Included" games** = dressed games with `toi !== null`. All stats and the min-games gates use included games; the displayed GP count uses dressed games.
**When to use:** always; this is how TRND-04 is satisfied.

### Pattern 2: Recent-vs-earlier delta by game index
**What:** `x` = game index within `research.games` (oldest first, same x as `trendSlope`). Recent = `x >= n - 2`. Delta = weighted mean(recent) − weighted mean(earlier). TOI uses weight 1; PP share uses weight = team PP seconds that game, so the weighted mean of per-game shares equals pooled `Σpp / ΣteamPp` (identical to the window `ppShare` definition already in the page, D-02).
**Gates:** `included.length >= 3`, ≥1 point in each part (for PP: ≥1 PP-eligible game — `lines` present and `teamPp > 0` — in each part). No special case is needed for windows of 1 or 2: the "earlier" part is empty, so the delta is `null` (D-08 falls out naturally; slope is `null` because fewer than 2 included games).
**DNP marker (D-07):** `n > 2 && perGame.slice(-2).every(p => p === null)`.

### Pattern 3: Sort in the URL, validated, nulls last
**What:** `?sort=<key>&dir=asc|desc` with an allowlist (`avgToi | toiDelta | ppShare | ppDelta`; unknown or array values fall back to `avgToi desc`). `sortRows` always orders `F` before `D` first, then by key, nulls last in **both** directions, tie-break by `avgToi` desc. Header click on an inactive column sets the default direction `desc` (risers first); click on the active column flips it. The `dir` param is omitted when `desc` to keep URLs clean.
**Next 16 specifics [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:73-77, 117-119]:** `searchParams` is `Promise<{ [key: string]: string | string[] | undefined }>`, must be awaited, and is a request-time API that makes the page dynamic (already true of this page). Values can be `string[]` for repeated params, so never `String()` a param and trust it; check `typeof === "string"` and allowlist.
**Links:** use `PendingLink` with `scroll={false}`. `PendingLink` spreads `...props` onto `Link` and hard-codes `prefetch={false}` [VERIFIED: components/PendingLink.tsx:25-27 — `<Link prefetch={false} {...props} className=...>`], and `scroll` is a documented `Link` prop (`scroll={false}` → "Next.js will not attempt to scroll to the first Page element", link.md:230-236). Without `scroll={false}`, Next may jump to the top of the page when the table (far down the page, below the unit tables) is not in view. The existing team/games links are unchanged.
**href():** extend the page's `href(t, n)` helper to also carry `sort`/`dir` so switching team or window preserves the sort (cheap, expected).

### Pattern 4: Per-game strip + CSS-only focus/hover popover (D-10)
**What:** One `<td className="relative">` (the anchor) holds a flex row of cells. Each cell is a non-positioned `<span tabIndex={0} aria-label="Oct 8 vs TOR · OT · TOI 16:20 (reg) · PP 2:10 (45%) · SH 0:45" className="group/cell ...">` containing a hidden popover `<span aria-hidden className="hidden group-hover/cell:block group-focus/cell:block absolute left-0 top-full z-10 mt-1 w-max ...">` with the same facts laid out for sighted users. Because the cell itself is not `relative`, the popover positions against the `<td>`, so it can never run off the right edge of the viewport the way a per-cell centred popover would.
**Why not title/client component:** see Alternatives. `aria-label` on the focusable cell gives screen readers the exact values; the popover is `aria-hidden` to avoid double-reading.
**Shade:** use inline `style={{ opacity }}` on a fixed colour class (see Pitfall 2). `opacity = 0.2 + 0.8 * clamp((toi - avg + 120) / 240, 0, 1)` (±2:00 around the player's own average saturates); this mirrors the sparkline's "minimum range" idea so small wobbles do not look like big swings.
**States:** DNP = hollow cell (dashed border, no fill); OT game = ring/outline accent (and "OT" in popover); OT-with-no-shift-data = filled neutral with strike/“—” marker and "excluded: no shift data" in popover; no-lines non-OT game = shaded from boxscore TOI, popover shows PP/SH "—" plus the existing "no PP/SH data" wording (D-12).
**Popover content for OT games:** show regulation TOI as the primary figure and "+m:ss OT excluded" (`totalToi - toi`) so the number still reconciles with NHL.com.

### Anti-Patterns to Avoid
- **Zero-filling DNP or excluded games** — corrupts avg/slope/delta (project Pitfall 9/16). Use `null`.
- **Using period number alone to detect OT in the *schedule/boxscore* sense** — shootout is `period 5` with `periodType: "SO"` but the 5-minute OT is period 4; playoffs have OT periods 4,5,6… Use `gameOutcome.lastPeriodType`; use `period > 3` only for slicing shifts into regulation.
- **Computing the delta from the sorted/filtered window** — build rows from `research.games` order (oldest first) before sorting.
- **Dynamic Tailwind class names** (`` `bg-sky-${n}` ``) — not generated by Tailwind's static scanner.
- **Passing `Map`s (`GameLines`) into any client component** — keep everything server-side; only `PendingLink` is client.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Least-squares trend | New slope code | Existing `trendSlope` (`lib/research/lines.ts`, weighted, tested) | Already handles weights, <2 points, zero variance |
| Shift-to-TOI seconds | Re-bucket shifts per second for regulation TOI | Plain sum of `endSec - startSec` for `period <= 3` | Verified equal to boxscore TOI (diff 0 s, 36 skaters × 11 games); per-second bucketing gives the same number with more code |
| Pending state on header links | Custom client sort component | `PendingLink` | Existing, `prefetch={false}` is load-bearing (≈40 links on page must not trigger renders) |
| Query-string building | String concatenation of raw params | `URLSearchParams` over *validated* values | Escaping + allowlist |
| Tooltip positioning library | Popper/Floating UI | CSS popover anchored to the `<td>` | One fixed layout, no collision handling needed |

**Key insight:** every number needed already exists in `ResearchGame`; the work is classification (dressed / included / OT / excluded) and gating, not new computation.

## Common Pitfalls

### Pitfall 1: The delta is mostly noise, so context's ±1:00 / ±10 pts thresholds tint most of the table
**What goes wrong:** With "recent = last 2 games", the delta has a standard error comparable to the signal. Median per-player regulation-TOI SD across games is 1:50; real |ΔTOI| ≈ shuffled-order |ΔTOI|.
**Measured (2025-26 regular season, TOR/MTL/EDM/NSH/COL, games 31-54 of each team, sliding windows, regulars = played ≥70% of window; shuffle baseline = same player games in random order, 5 reps):**

| Metric | Window | Threshold | Rows flagged (real) | Rows flagged (shuffled) |
|--------|--------|-----------|--------------------|-------------------------|
| \|ΔTOI\| | 5 (n=1690) | 1:00 | 59.2% | 58.7% |
| \|ΔTOI\| | 5 | 2:00 | 29.2% | 28.1% |
| \|ΔTOI\| | 5 | 3:00 | 13.6% | 11.5% |
| \|ΔTOI\| | 10 (n=1236) | 1:00 | 57.8% | 54.2% |
| \|ΔTOI\| | 10 | 2:30 | 16.7% | 14.0% |
| \|ΔTOI\| | 10 | 3:00 | 11.2% | 8.2% |
| \|ΔPP share\| (PP regulars, share ≥10 in either part) | 5 (n=1083) | 10 pts | 51.6% | 47.9% |
| same | 5 | 20 pts | 19.0% | 17.9% |
| same | 5 | 25 pts | 11.2% | 10.3% |
| same | 10 (n=803) | 20 pts | 12.3% | 12.6% |
| same | 10 | 25 pts | 6.8% | 7.0% |

**How to avoid:** `TOI_MOVER_SECONDS = 180`, `PP_MOVER_POINTS = 25` as named constants beside the existing slope constants. Expected tint rate ≈ 1 in 5 rows or fewer. Be honest in the UI copy: the delta is an early signal, not a verdict (the arrow/slope and the strip give context). A principled upgrade (scale threshold by the player's own game-to-game SD) is out of scope for this phase.
**Warning signs:** more than ~25% of rows tinted on a normal team/window; a tint on a player whose strip is flat.

### Pitfall 2: Tailwind classes built from variables are not generated
**What goes wrong:** Strip shading via `` `bg-sky-${shade}` `` renders unstyled in production.
**How to avoid:** one static colour class + inline `style={{ opacity }}`, or a lookup object of complete class strings.

### Pitfall 3: `overflow-x-auto` wrapper clips the absolutely positioned popover
**What goes wrong:** An element with `overflow-x: auto` computes `overflow-y: auto` too, so a popover that extends below the last row is clipped or adds a scrollbar; popovers opening upward from the first row are clipped at the top.
**How to avoid:** open the popover **below** the strip (`top-full`), anchor to the `<td>`, and give the scroll wrapper bottom padding at least the popover height (e.g. `pb-28`). Verify in UAT on the last forward row, the last defense row, and "Last 20" (widest strip).

### Pitfall 4: Partial shift charts make regulation TOI look like a role drop
**What goes wrong:** A non-empty chart is not proof of completeness (project Pitfall 9). Regulation TOI is the only stat *newly* derived from shifts (non-OT games use boxscore TOI), so it is only at risk in OT/SO games (~22% of games: 24 of 110 sampled).
**How to avoid:** optional hardening in `loadGame` for OT games: compute each skater's all-period shift sum and, if several skaters differ from boxscore TOI by more than ~5 s, treat the game as having no shift data for TOI purposes (`regulationToi = null`). In 11 sampled games the sums matched exactly, so this guard should almost never fire; it only protects the failure mode. [ASSUMED that partial charts occur in practice — not observed in 110 games.]

### Pitfall 5: A player with 0:00 boxscore TOI is treated as "did not play"
**What goes wrong:** `loadGame` only sets `toi` when `parseClock` returns a truthy value (`if (secs)`), so a dressed player with `00:00` is indistinguishable from a scratch. Existing behaviour [VERIFIED: lib/research/team-games.ts:66-70]. Harmless for this phase (he has no ice time to trend); do not "fix" it.

### Pitfall 6: Raw `searchParams` values reaching `href()` or sort logic
**What goes wrong:** `sort` can be `string[]` or arbitrary text. **How to avoid:** `parseSort` returns only allowlisted literals; links are built from those literals plus the already-validated `team`/`games`.

### Pitfall 7: Mixed-sign movers
**What goes wrong:** TOI Δ up 3:30 with PP Δ down 30 pts (promoted at even strength, dropped from PP1). A tint rule of "either crosses → tint" has no single colour. **Recommendation:** tint only when every threshold-crossing delta has the same sign; otherwise no row tint (individual delta numbers still colour themselves). Needs user confirmation (Open Question 3).

### Pitfall 8: `npm test` glob depth
`"test": "tsx --test lib/**/*.test.ts"` [VERIFIED: package.json:11]. Run in `sh`, `**` behaves like `*` so only `lib/<dir>/*.test.ts` are found (confirmed: `lib/research/lines.test.ts` tests ran, 62 pass). Put `toi-trends.test.ts` directly in `lib/research/`. A `.test.tsx` or a file under `app/` is **not** matched. [ASSUMED: deeper nesting unmatched — not tested.]

### Pitfall 9: Popover left behind on touch
Tapping a `tabIndex={0}` element focuses it in most mobile browsers; tapping elsewhere blurs and hides it. iOS Safari behaviour not verified here [ASSUMED]; list as a UAT item. If it fails, fall back to a tiny client wrapper (not recommended preemptively).

## Code Examples

Reference implementation, verified logic against the data model above (reasoned, and the delta/threshold math was exercised in the research scripts). Not copy-paste final; the planner should keep it this small.

### Loader additions (`lib/research/lines.ts` + `team-games.ts` + `client.ts`)
```typescript
// lines.ts — next to ShiftInput
export const REGULATION_PERIODS = 3;
/** Seconds each of `team`'s players was on ice in periods 1-3. Equals boxscore TOI minus OT for a complete chart. */
export function regulationSeconds(team: string, shifts: ShiftInput[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of shifts) {
    if (s.team !== team || s.period > REGULATION_PERIODS || s.endSec <= s.startSec) continue;
    out.set(s.playerId, (out.get(s.playerId) ?? 0) + s.endSec - s.startSec);
  }
  return out;
}

// client.ts — NhlBoxscore (currently lines 107-113)
//   gameOutcome?: { lastPeriodType: "REG" | "OT" | "SO" };

// team-games.ts — in loadGame, ResearchGame gets two fields
const lastPeriod = box.gameOutcome?.lastPeriodType;
const overtime = lastPeriod === "OT" || lastPeriod === "SO";
// non-OT: boxscore TOI is already regulation. OT with shifts: strip OT. OT without shifts: unknown.
const regulationToi = !overtime ? toi : shiftInputs.length > 0 ? regulationSeconds(team, shiftInputs) : null;
```
Observed API shape [VERIFIED: live NHL API 2026-10-11, boxscore `gamecenter/2026020026/boxscore`]:
`"gameOutcome": { "lastPeriodType": "OT", "otPeriods": 1 }`, `"periodDescriptor": { "number": 4, "periodType": "OT", "maxRegulationPeriods": 3 }`. Shootout game `2026020075`: `{"lastPeriodType":"SO"}`, `periodDescriptor` `{"number":5,"periodType":"SO",...}`, shifts present through period 4.

### Pure trend math (`lib/research/toi-trends.ts`)
```typescript
import { trendSlope } from "./lines";

export const RECENT_GAMES = 2;
export const MIN_GAMES_FOR_SLOPE = 2;   // trendSlope returns null below 2 points anyway
export const MIN_GAMES_FOR_DELTA = 3;
export const TOI_MOVER_SECONDS = 180;
export const PP_MOVER_POINTS = 25;

type Point = { x: number; y: number; w?: number };
const wmean = (pts: Point[]) => {
  const w = pts.reduce((s, p) => s + (p.w ?? 1), 0);
  return w > 0 ? pts.reduce((s, p) => s + (p.w ?? 1) * p.y, 0) / w : null;
};

/** Mean of the team's last RECENT_GAMES minus mean of the earlier games; null unless both parts have data. */
export function recentDelta(points: Point[], windowSize: number, includedGames: number): number | null {
  if (includedGames < MIN_GAMES_FOR_DELTA) return null;
  const cut = windowSize - RECENT_GAMES;
  const recent = wmean(points.filter((p) => p.x >= cut));
  const earlier = wmean(points.filter((p) => p.x < cut));
  return recent === null || earlier === null ? null : recent - earlier;
}

const sign = (v: number | null, threshold: number) => (v !== null && Math.abs(v) >= threshold ? Math.sign(v) : 0);
export function moverDirection(toiDelta: number | null, ppDelta: number | null): "up" | "down" | null {
  const s = [sign(toiDelta, TOI_MOVER_SECONDS), sign(ppDelta, PP_MOVER_POINTS)];
  return s.includes(1) && !s.includes(-1) ? "up" : s.includes(-1) && !s.includes(1) ? "down" : null;
}

export const SORT_KEYS = ["avgToi", "toiDelta", "ppShare", "ppDelta"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export interface SortSpec { key: SortKey; dir: "asc" | "desc" }
export function parseSort(sort: unknown, dir: unknown): SortSpec {
  const key = SORT_KEYS.find((k) => k === sort);
  return key ? { key, dir: dir === "asc" ? "asc" : "desc" } : { key: "avgToi", dir: "desc" };
}

// rows: { player: { group }, avgToi, toiDelta, ppShare, ppShareDelta } — map SortKey ppDelta -> ppShareDelta
export function sortRows<R extends { player: { group: "F" | "D" | "G" }; avgToi: number | null }>(
  rows: R[], spec: SortSpec, value: (row: R, key: SortKey) => number | null,
): R[] {
  const groupOrder = { F: 0, D: 1, G: 2 };
  const mul = spec.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const g = groupOrder[a.player.group] - groupOrder[b.player.group];
    if (g) return g;
    const [va, vb] = [value(a, spec.key), value(b, spec.key)];
    if (va !== vb) {
      if (va === null) return 1;            // nulls last in both directions
      if (vb === null) return -1;
      return mul * (va - vb);
    }
    return (b.avgToi ?? -1) - (a.avgToi ?? -1);
  });
}
```

### Per-player row (core of `buildTrendRows`)
```typescript
// games: ResearchGame-compatible (oldest first). Only the fields below are read, so tests can pass plain objects.
const n = games.length;
const perGame = games.map((g) => {
  const totalToi = g.toi.get(player.id);
  if (totalToi === undefined) return null;                       // did not dress: null, never 0
  const teamPp = g.lines?.situationSeconds.pp ?? 0;
  const ps = g.lines ? g.lines.playerSeconds.get(player.id) : undefined;
  const pp = g.lines ? (ps?.pp ?? 0) : null;
  return {
    totalToi,
    toi: g.regulationToi ? (g.regulationToi.get(player.id) ?? 0) : null,   // null = excluded OT game
    pp, teamPp,
    ppShare: pp !== null && teamPp > 0 ? (pp / teamPp) * 100 : null,
    sh: g.lines ? (ps?.sh ?? 0) : null,
  };
});
const dressed = perGame.filter(Boolean).length;
const included = perGame.flatMap((p, x) => (p && p.toi !== null ? [{ x, ...p, toi: p.toi }] : []));
const ppPts = included.filter((p) => p.ppShare !== null).map((p) => ({ x: p.x, y: p.ppShare!, w: p.teamPp }));
const toiPts = included.map((p) => ({ x: p.x, y: p.toi }));
// avgToi = mean(toi) or null; toiSlope = trendSlope(toiPts); toiDelta = recentDelta(toiPts, n, included.length)
// ppShare = Σpp/ΣteamPp*100 over ppPts games; ppShareSlope = trendSlope(ppPts); ppShareDelta = recentDelta(ppPts, n, included.length)
// dnpLast2 = n > RECENT_GAMES && perGame.slice(-RECENT_GAMES).every((p) => p === null)
```
`trendSlope` is the existing function; PP slope keeps today's weighting (`w: teamPp`).

### Sort header link + page wiring (`page.tsx`)
```tsx
const { team: teamParam, games: gamesParam, sort: sortParam, dir: dirParam } = await searchParams;
const sort = parseSort(sortParam, dirParam);

const href = (t: string, n: number, s: SortSpec = sort) => {
  const q = new URLSearchParams({ team: t, games: String(n) });
  if (s.key !== "avgToi" || s.dir !== "desc") { q.set("sort", s.key); if (s.dir === "asc") q.set("dir", "asc"); }
  return `/research?${q}`;
};

// header cell
<th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} ...>
  <PendingLink scroll={false} href={href(team, gameCount, { key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}>
    Avg TOI {active ? (sort.dir === "asc" ? "▲" : "▼") : null}
  </PendingLink>
</th>
```
Source for `searchParams` shape and awaiting: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`. Note `String(...)`-style coercion in today's page (`String(teamParam)`) is safe because `team` is allowlisted; do not extend that pattern to `sort`.

### Strip cell (server component, no client JS)
```tsx
<td className="relative py-1 pr-3">
  <div className="flex gap-px">
    {cells.map((c, i) => (
      <span key={games[i].id} tabIndex={0} aria-label={detailText(c, games[i])}
            className="group/cell h-4 w-2.5 rounded-sm outline-offset-2 ..."
            style={{ opacity: c ? shade(c, avg) : 1 }}>
        <span aria-hidden className="absolute left-0 top-full z-10 mt-1 hidden w-max rounded border bg-white p-2 text-xs shadow group-hover/cell:block group-focus/cell:block dark:bg-neutral-900">
          {detailText(c, games[i])}
        </span>
      </span>
    ))}
  </div>
</td>
```
Caveat: `opacity` on the cell would also fade the popover child. Put the shaded fill on an inner element (or use `background-color` with alpha via `color-mix`/rgb alpha) so the popover stays fully opaque.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `searchParams` prop | `searchParams` is a Promise, `await` it | Next 15+; deprecated sync access noted in page.md:118 | Page already awaits it; keep |
| Colour thresholds on regression slope | Recent-vs-earlier delta drives colour; slope arrow muted | This phase (D-03, D-09) | `Slope` component loses colour/number, becomes arrow-only |

**Deprecated/outdated:** per-game numeric grid and the "TOI trend" / "PP share trend" columns with `m:ss/gm` text (to be removed).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tapping a `tabIndex={0}` span focuses it on iOS Safari / Android Chrome so `group-focus/cell:` shows the popover | Pattern 4, Pitfall 9 | Touch users cannot see per-game values; add a tiny client wrapper |
| A2 | Partial (non-empty but incomplete) shift charts occur on finished OT games | Pitfall 4 | Guard is unnecessary code; harmless |
| A3 | PP share / SH may use whole-game `lines` (including OT) while TOI is regulation-only. Measured: team PP seconds in OT were non-zero in only 4 of 26 OT games (117, 87, 29, 2 s) | Pattern 1 | Tiny PP-share distortion in rare OT PP games; fix is a second `analyzeGameLines` call on `period<=3` shifts for OT games only (≈7 ms) |
| A4 | Thresholds measured on 2025-26 games 31-54 for 5 teams generalise to early 2026-27 windows of 3-5 games | Pitfall 1 | Tint rate may differ; constants are named and easy to retune |
| A5 | Unmatched-depth glob behaviour of `lib/**/*.test.ts` under `sh` (flat `lib/research/*.test.ts` confirmed; deeper unconfirmed) | Pitfall 8 | A misplaced test file silently does not run |
| A6 | Tint only when threshold-crossing deltas agree in sign | Pitfall 7 | Visual rule differs from user expectation |

## Open Questions

1. **PP share sort key (requirement vs decision mismatch)**
   - What we know: TRND-05 and roadmap criterion 5 say sort by "trend, average TOI, or PP share"; D-15 lists "Avg TOI, TOI Δ, PP share Δ" (no plain PP share %).
   - What's unclear: whether "PP share" in the requirement means the % or the Δ.
   - Recommendation: make **four** columns sortable (`avgToi`, `toiDelta`, `ppShare`, `ppDelta`) — one extra allowlist entry; satisfies both readings.

2. **Mover thresholds**
   - What we know: ±1:00 / ±10 pts (context starting point) tints about 6 in 10 rows; real deltas barely exceed shuffled noise.
   - Recommendation: 3:00 / 25 pts; confirm with the user (this is the only place research overrides a stated starting point, and it was explicitly Claude's discretion).

3. **Mixed-sign movers (TOI up, PP down or vice versa):** recommend no row tint, individual numbers still coloured. Confirm.

4. **Extract `ToiTrends` to `app/research/_components/`?** `page.tsx` is 374 lines; the rework adds strip, popover, sortable headers (~150+ lines). ARCHITECTURE.md recommends `_components/`. The formatters `formatClock`/`formatDate`/`gameLabel` are shared with `LastGameLines`, so extraction implies exporting them (e.g. `app/research/_components/format.ts`). Recommendation: extract (Phase 2 needs it), but keep it a pure move + rewrite, not a refactor of `LastGameLines`.

5. **Arrow placement:** D-03 keeps the slope as a muted arrow; D-01 lists no separate arrow column. Recommendation: render the muted TOI-slope arrow immediately after TOI Δ and the PP-share-slope arrow after PP share Δ (glyph only, neutral colour, shown at ≥2 included games and above the existing 15 s / 3 pt thresholds, never in a window of 1).

6. **OT PP/SH handling:** see A3. Recommendation: leave PP/SH whole-game (documented), revisit only if OT-PP distortion is observed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, build | ✓ | v24.21.0 | — |
| npm / tsx | `npm test` | ✓ | tsx 4.23.13 | — |
| NHL public API (api-web.nhle.com, api.nhle.com/stats) | runtime page + manual UAT | ✓ (HTTP 200; follows a 307 redirect on `club-schedule-season/.../now`) | — | — |
| Discord OAuth session | viewing `/research` in a browser (page redirects unauthenticated users) | needs a signed-in browser | — | Manual UAT only; cannot `curl` the page |

**Missing dependencies with no fallback:** none.
**Note:** during research a burst of ~8 concurrent requests from one IP produced HTTP 429 after retries (existing risk; DATA-01 in Phase 3). Phase 1 adds **no** fetches.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner via tsx 4.23.13 (`node:test`, `node:assert/strict`) |
| Config file | none (script in package.json) |
| Quick run command | `npx tsx --test lib/research/toi-trends.test.ts` |
| Full suite command | `npm test` (baseline: 62 pass, 0 fail) |
| Static gates | `npx tsc --noEmit` (clean baseline), `npm run lint` (clean baseline for `app/research lib/research`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRND-01 | One row per dressed skater, F before D, goalies excluded; no per-game numeric columns rendered | unit (`buildTrendRows` grouping) + manual UAT for markup | `npx tsx --test lib/research/toi-trends.test.ts` | ❌ Wave 0 |
| TRND-02 | `detailText` returns exact TOI/PP/PP%/SH/date/opponent (+OT, +"excluded" wording); strip popover appears on hover and keyboard focus | unit (text builder) + manual UAT | same | ❌ Wave 0 |
| TRND-03 | `recentDelta` TOI and weighted PP delta; recent = last 2 team games; gates (≥3 included, ≥1 each part); window of 1/2 → null | unit | same | ❌ Wave 0 |
| TRND-04 | Missed games excluded (not 0); OT game uses regulation TOI; OT without shifts excluded from avg/delta/slope but present in `perGame`; `<3`/`<2` games → null; `dnpLast2`; games-played count | unit | same | ❌ Wave 0 |
| TRND-04 | `regulationSeconds` sums periods 1-3 only, ignores other team and zero-length shifts | unit | `npx tsx --test lib/research/lines.test.ts` | ✅ file exists, add test |
| TRND-05 | `parseSort` allowlist (unknown, array, missing → default); `sortRows` keeps F before D in both directions, nulls last in both directions, tie-break stable | unit | `npx tsx --test lib/research/toi-trends.test.ts` | ❌ Wave 0 |
| TRND-05 | Sort in URL survives reload, header toggles direction, team/games preserved | manual UAT (page is auth-gated) | — | manual |
| D-16 | `moverDirection` thresholds and mixed-sign → null | unit | same | ❌ Wave 0 |

Optional automated rendered-markup check: `renderToStaticMarkup` of the table component works under tsx (probe: `PendingLink` rendered to `<a ... href="/research?team=MTL&amp;sort=avg">` in a throwaway test). It would require the test to be `.tsx` and `package.json`'s glob widened, so treat it as optional; the pure-logic tests carry the load.

### Sampling Rate
- **Per task commit:** `npx tsx --test lib/research/toi-trends.test.ts lib/research/lines.test.ts`
- **Per wave merge:** `npm test && npx tsc --noEmit && npm run lint`
- **Phase gate:** full suite green, then manual UAT below before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `lib/research/toi-trends.test.ts` — covers TRND-01, 03, 04, 05, D-16 with hand-built `ResearchGame`-shaped fixtures (structural types so no NHL objects needed)
- [ ] `regulationSeconds` case in `lib/research/lines.test.ts`
- No framework install needed.

### Manual UAT checklist (cannot be automated: auth-gated page, visual behaviour)
1. `/research?team=<T>&games=10`: no per-game numeric grid; columns in D-01 order; F block then D block.
2. Hover and Tab-focus a strip cell: popover shows date, opponent, TOI/PP/PP%/SH; an OT game shows "OT" and regulation TOI with "+m:ss OT excluded"; DNP cell is visibly empty.
3. A player below 3 games: no delta, GP count visible; below 2: no arrow; Last game: no delta/arrow/tint.
4. Sort each of the four headers, toggle direction, reload, copy URL into a new tab: same order; F block always first; players with "—" at the bottom of their group.
5. Switch team and window: sort preserved.
6. Popover not clipped on the last forward row, the last defense row, and at "Last 20"; popover visible on touch (tap) if a touch device is available.
7. Tint frequency looks sane (roughly a handful of rows on a full roster, not most of them).
8. Cross-check one OT game for one forward: tooltip regulation TOI + OT excluded equals the NHL.com boxscore TOI.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing `auth()` check at top of page [VERIFIED: app/research/page.tsx:53-54] |
| V3 Session Management | no (unchanged) | next-auth DB sessions |
| V4 Access Control | no (unchanged) | Page redirects unauthenticated users; no new routes/actions |
| V5 Input Validation | **yes** | Allowlist `sort`/`dir` (`parseSort`); `team` already allowlisted via `NHL_TEAM_ABBREVS`, `games` via `GAME_COUNTS`; params may be `string[]` |
| V6 Cryptography | no | none |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected content via query string into links/markup | Tampering / XSS | Build hrefs only from validated literals via `URLSearchParams`; React escapes text; no `dangerouslySetInnerHTML` |
| Untrusted API text (player names, opponent abbrevs) in tooltips | XSS | Render as React text nodes only; `aria-label` strings are attribute-escaped by React |
| Request amplification via crafted params | DoS | `games` limited to `GAME_COUNTS`; sort adds no fetches (Data Cache serves NHL responses; `revalidate: 3600`) |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `app/research/page.tsx` (all), `lib/research/lines.ts` (all), `lib/research/team-games.ts` (all), `lib/nhl/client.ts` (all), `components/PendingLink.tsx` (all), `package.json`, `.planning/{REQUIREMENTS,STATE,ROADMAP}.md`, `01-CONTEXT.md`, `.planning/research/{PITFALLS,ARCHITECTURE,FEATURES}.md`
- Next.js 16.3.4 local docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (searchParams Promise, dynamic rendering), `.../02-components/link.md` (`scroll`, `prefetch`)
- Live NHL API probes, 2026-10-11: `api-web.nhle.com/v1/club-schedule-season/MTL/now` (schedule items carry `gameOutcome.lastPeriodType` and `periodDescriptor`), `gamecenter/{id}/boxscore` (`gameOutcome`, `periodDescriptor`, per-skater `toi`), `api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={id}`. Games: 2026020002/26/45/58/75 and 2025020100/300/500/700/900, 2025021000/1100 (shift-total vs boxscore TOI: max abs diff 0 s over 36 skaters per game, 11 games with shift data; 2026020026 is OT with an empty chart). 110 boxscores from five teams (TOR, MTL, EDM, NSH, COL, 2025-26 games 31-54): `lastPeriodType` present in 110/110 (REG 86, OT 18, SO 6), equal to `periodDescriptor.periodType` in 110/110; every OT/SO game with a chart had shifts in period 4. OT-minute inflation for top-line players in OT/SO games (box − regulation): p50 0:44, p75 1:23, max 3:49 (n=536 player-games).
- Threshold study scripts (scratchpad, not committed): sliding windows of 5 and 10 over 24 games × 5 teams using the repo's own `analyzeGameLines`, spec-exact delta (recent = last 2 team games, ≥3 played, ≥1 each part), shuffled-order baseline.
- Baselines: `npm test` 62/62 pass; `npx tsc --noEmit` and `npx eslint app/research lib/research` produce no output.
- Probe: `renderToStaticMarkup(<PendingLink .../>)` runs under `tsx --test` (throwaway file, removed).

### Secondary (MEDIUM confidence)
- Tailwind v4 named-group variants (`group/name`, `group-hover/name:`, `group-focus/name:`) from training knowledge; installed version 4.3.3 verified, variant syntax not re-read in docs this session.

### Tertiary (LOW confidence)
- Touch/focus behaviour on iOS Safari (A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all versions read from the repo/node_modules
- Architecture: HIGH — all integration points read; NHL fields probed live
- Pitfalls: HIGH for data/threshold findings (measured), MEDIUM for UI (popover clipping, touch) which needs UAT

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (NHL API shape is undocumented but has been stable; recheck `gameOutcome` presence if the NHL changes the feed)
