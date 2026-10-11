# Phase 1: Ice-Time Trends Table - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the "Ice time by game" grid on `/research` (the `ToiTrends` section of `app/research/page.tsx`) with a trends-first table: one row per skater, grouped forwards then defense, where averages and direction-of-change lead and per-game values are visual/secondary. Covers TRND-01..05: trends-first columns, per-game values still reachable, recent-vs-window delta, minimum-games/missed-game/OT handling, and URL-persisted sorting.

Not in this phase: player detail / row click (Phase 2), unit-table event stats and play-by-play (Phase 3). The `LastGameLines` section is untouched.

</domain>

<decisions>
## Implementation Decisions

### Row columns & density
- **D-01:** Primary columns, in order: Player, Pos, Avg TOI, TOI Δ, PP share %, PP share Δ, SH (small/muted), per-game strip, sparkline (see D-10, D-11). The old per-game numeric columns are removed.
- **D-02:** The PP number is **PP share %** (player PP time / team PP time over the window), not PP TOI per game.
- **D-03:** Direction is shown as the **recent-vs-window delta** (number + color). The least-squares slope (existing `trendSlope`) is kept only as a muted arrow, not as a displayed number.
- **D-04:** SH is a small, muted column (SH TOI per game) after PP, with no trend/delta.

### "Recent" window & minimum games
- **D-05:** "Recent" = the **team's last 2 games** in the window. Delta = player's avg over the recent games he played − player's avg over his earlier games in the window.
- **D-06:** Slope arrow shows at **≥2 games played**. Delta shows only at **≥3 games played** and requires ≥1 played game in the recent part and ≥1 in the earlier part; otherwise "—". Games-played count is visible on the row.
- **D-07:** If the player missed both of the team's last 2 games, show a small muted "out" marker (e.g. "DNP last 2"); delta is "—".
- **D-08:** Window of 1 ("Last game"): show values only — no delta, slope, arrow, or tint.
- **D-09:** When slope and delta disagree, **the delta drives the color**; the slope arrow stays but muted.
- Missed games (player not in boxscore) are excluded from averages, slopes and deltas — never treated as 0 (existing `perGame: null` behavior).

### Per-game detail access
- **D-10:** Each row gets a **mini per-game strip**: one small cell per team game in the window, shaded by that game's TOI relative to the player's own window average (darker = above, lighter = below); missed games are a distinct empty cell. Hover/focus a cell shows exact TOI, PP (and PP share), SH, date and opponent.
- **D-11:** **Keep the sparkline** alongside the strip.
- **D-12:** Games without shift charts: show boxscore TOI; PP/SH as "—" (existing "no PP/SH data" semantics).
- **D-13:** **OT games are flagged** (e.g. "OT" in the strip cell/tooltip, distinct sparkline dot) and **OT minutes are removed** — Avg TOI, delta and slope all use regulation TOI (periods 1–3) derived from shift charts. If an OT game has no shift data, exclude that whole game from Avg/delta/slope (still shown, flagged, in the strip).

### Sorting & highlighting
- **D-14:** Default sort: Avg TOI descending within F/D groups (current behavior). Forwards always before defense regardless of sort.
- **D-15:** Sort via **clickable column headers** that set `?sort=` (keep `team` and `games` params). Sortable: Avg TOI, TOI Δ, PP share Δ.
- **D-16:** Big movers get a **subtle row tint** (green up / red down) when **either** TOI Δ or PP share Δ crosses its mover threshold; the same threshold colors the delta numbers.

### Claude's Discretion
- Row density / padding / type size — pick what reads cleanest (one line per player preferred).
- Mover thresholds for TOI Δ and PP share Δ — tune against real team data (research suggested ~±1:00 TOI, ~±10 PP-share points as a starting point). Existing slope thresholds (`TOI_TREND_THRESHOLD_SECONDS = 15`, `PP_SHARE_TREND_THRESHOLD_POINTS = 3`) still drive the muted arrow.
- Sort direction toggling, header affordances, and how null deltas sort (should sink to the bottom of their group).
- How OT is detected (boxscore/game metadata vs periods in shift charts).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — core value (spot role changes), constraints
- `.planning/REQUIREMENTS.md` — TRND-01..05
- `.planning/ROADMAP.md` — Phase 1 success criteria

### Research
- `.planning/research/SUMMARY.md` — synthesized recommendations and phase notes
- `.planning/research/FEATURES.md` — trends-view table stakes, recent-vs-window delta, anti-features (no per-game numeric grid)
- `.planning/research/PITFALLS.md` — trend noise on small samples, missed games ≠ 0, OT inflating TOI
- `.planning/research/ARCHITECTURE.md` — suggests moving `buildRows` to `lib/research/toi-trends.ts` with tests and splitting page sections

### Framework
- `node_modules/next/dist/docs/` — this Next.js 16 has breaking changes; read before writing code (AGENTS.md)

### Inspiration
- https://frozenpool.dobbersports.com/frozenpool_last3gamelines.php?team=MTL — original reference for the research page

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildRows` / `PlayerRow` in `app/research/page.tsx`: already computes per-game TOI/PP/ppShare/SH, avgToi, ppShare, toiSlope, ppShareSlope — extend for delta, regulation TOI, OT flags.
- `trendSlope` in `lib/research/lines.ts` (weighted least squares, tested in `lines.test.ts`).
- `Slope`, `Sparkline` components in `app/research/page.tsx`.
- `situationSeconds` in `lib/research/team-games.ts`; `GameLines.playerSeconds` per situation.
- `PendingLink` (`components/PendingLink.tsx`): Link with pending spinner, prefetch off — use for sort header links.

### Established Patterns
- Page is an async server component; state lives in search params (`team`, `games`) via `href()` helper — add `sort` the same way.
- Tailwind with neutral palette and dark-mode variants; `tabular-nums` for numbers.
- Pure logic in `lib/research/*` with co-located `*.test.ts` run by tsx/node --test.

### Integration Points
- `ToiTrends` in `app/research/page.tsx` is replaced/reworked.
- `ResearchGame` (`lib/research/team-games.ts`) may need an OT flag and per-player regulation TOI (from shift charts / `analyzeGameLines`).

</code_context>

<specifics>
## Specific Ideas

- User's complaint: in the current grid "numbers run together visually" — the per-game stacked TOI / "PP 2:10 (45%) · SH 1:05" cells are the problem.
- Primary use: spotting who is moving up/down for pickups/drops.
- A scratch/injury is itself a role signal — hence the "DNP last 2" marker.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Player detail via row click is already Phase 2.)

</deferred>

---

*Phase: 01-ice-time-trends-table*
*Context gathered: 2026-10-11*
