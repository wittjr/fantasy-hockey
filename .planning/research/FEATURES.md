# Feature Research

**Domain:** NHL line / deployment research for fantasy hockey (single-team Line research page)
**Researched:** 2026-10-11
**Confidence:** MEDIUM (Frozen Pool page fetched directly = HIGH for its layout; Daily Faceoff, Left Wing Lock, MoneyPuck, Natural Stat Trick = search-snippet level, MEDIUM/LOW for UI details; presentation recommendations are judgment)

## How the reference tools actually work

| Tool | What it shows | Relevant takeaway |
|------|---------------|-------------------|
| Dobber Frozen Pool "last 3 game lines" (fetched) | Five blocks per team: EV-F, EV-D, PP-F, PP-D, SH. Each unit row has TOI, % of situation time, GF, GA, +/-, SF, SA, SF%, CF, CA, CF%. Raw counts, not per-60. Date nav (yesterday/today/tomorrow), team logo picker, player-news strip. Legend explains SF% / CF%. | This is the target. Raw counts for one-to-three games with a percentage column is the accepted format; nobody shows per-60 at this sample size. No trends, no player drill-down: that is the gap this app fills. |
| Daily Faceoff line combinations | Projected (not historical) F lines, D pairs, PP1/PP2, PK units, goalies, injuries/scratches, per team. Fantasy pitch: "who is moving up the lineup". Plus a paid "line matching" tool. | Expected behavior is "current role at a glance" with PP1/PP2 labels. It is editorial/projected, so it answers "what is the role" not "how did it change". Our derived-from-shifts data is the evidence layer behind it. |
| Left Wing Lock (Season Pass) | "Line Changes" (who moved up/down daily), "Player Usage", "Line Production" (per-combo SAT%, tEVSH%, zone starts), "Line Matching", game-day vs past-game lines. | Closest competitor to the core value ("who is moving up/down"). Their movers framing is a list of changes, not a per-player trend line. Confirms that up/down is THE fantasy use case and is paywalled elsewhere. |
| MoneyPuck lines/pairings | Scatter/table of line TOI vs xGF%, filter by position (F/D), minimum-TOI threshold, highlight by team. | Minimum-TOI filter is the standard noise control. Quality metrics (xG) are what we are deliberately not doing. |
| Natural Stat Trick line tool / WOWY | Pick up to 5 players, get TOI, CF/60, CA/60, CF%, GF/60, GA/60, GF%, on-ice SH%/SV%, with/without teammates, strength and score filters, min-TOI. | WOWY there is a performance comparison (with vs without). Our requirement is much narrower: TOI together by game. Do not drift into with/without performance. |

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unit tables carry GF, GA, SF, SA, CF, CA as raw counts alongside existing TOI and % | Frozen Pool is the reference and shows exactly these; user asked for them | MEDIUM | Needs NHL play-by-play fetch per game plus per-second on-ice attribution. `analyzeGameLines` already builds per-second on-ice sets, so event attribution is a lookup by event second. |
| Derived percentage columns: SF%, CF% (and +/- for goals) | Frozen Pool shows CF%, SF%, +/-; for/against counts alone are hard to scan | LOW | Pure arithmetic; show "-" when for+against = 0. |
| Same stat columns on EV, PP and SH tables, F and D | Explicit decision in PROJECT.md; Frozen Pool does it | LOW (once attribution exists) | On PP/SH, read "for" and "against" as team-for/team-against, not as a quality judgment. |
| Consistent event definitions, documented in a footnote/legend | Frozen Pool has a legend; CF without a definition is ambiguous | LOW | SF = goals + shots on goal; CF = SF + missed + blocked. Exclude shootout and empty-net-affected events consistently. State "approximate, events at line-change seconds are ambiguous". |
| Ice-time view leads with average TOI, recent value and trend direction | Core value is "who is moving up/down" | LOW-MEDIUM | `buildRows` already computes avgToi, toiSlope, ppShare, ppShareSlope. This is mostly re-layout. |
| Per-game raw times demoted from the main grid | Explicit user complaint: numbers run together. N-column grid at 20 games is unreadable | LOW | Remove per-game columns from the main table; the sparkline already encodes per-game shape; exact values go to the player detail or a tooltip. |
| Clear up/down signal (arrow + colour + threshold) | Every deployment tool flags direction; exists today with thresholds | LOW | Keep `Slope` and thresholds; ensure colour is not the only cue (arrow already present). |
| PP and SH role in the trends view (PP avg, PP share, SH) | PP1/PP2 status is the most-used fantasy deployment signal (Daily Faceoff leads with it) | LOW | Already computed; keep PP share and its trend, drop per-game PP/SH text. |
| Click a player row to open detail; selection survives reload/share | User-specified; deep link is expected on a stat site | MEDIUM | In a server-component page, simplest robust approach is a `?player=<id>` search param plus row links (consistent with existing `PendingLink` nav). Avoids a client-state rewrite. |
| Player detail: linemates by name with TOI together per game across the selected games | The user-specified feature | MEDIUM | Computed from the same per-second on-ice sets (overlap seconds between target player and each teammate, per situation). No new data source. |
| Linemates split by situation (EV / PP / SH) and by role (F linemates vs D partners) | Mixed totals hide the PP1-to-PP2 move; every tool separates strengths | MEDIUM | EV default; PP and SH as toggles or separate blocks. |
| Sample-size honesty: missed games shown as missing, games without shift data flagged | Existing behaviour (the "no PP/SH data" label); trend on 1-2 games is noise | LOW | Keep. Show trends only with more than one game (already done). |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-player trend with slope AND recent-vs-window comparison (e.g. last game / last 2 vs window average, shown as a delta) | Slope alone is slow to react in a 5-game window; a delta catches "just promoted yesterday" | LOW-MEDIUM | Delta = recent average minus earlier average of the window. Cheap, and the fastest-reacting signal for pickups. |
| Sortable trends table (by trend, avg TOI, PP share) with default grouping F/D | Lets the user bring risers to the top without a league-wide list | MEDIUM | Sort via search param keeps it server-rendered. Not a cross-team movers list (deferred). |
| Linemate heat strip: rows = linemates, columns = games, cell shade = minutes together, plus window average and trend | Makes "started getting time with better linemates" visible without any quality score; this is the page's unique feature (no reference tool does per-game linemate time) | MEDIUM | Shade intensity does the work so numbers need not be read. Order linemates by total (or recent) time together. |
| "New / rising / fading" tags on linemates (first appeared in recent games, or recent time-together well above window average) | Directly answers "starting to get time with different linemates" and is not a quality judgment (pure time-based) | MEDIUM | Reuse the same slope/delta logic with a minimum-seconds guard. Comes after the heat strip. |
| Time-together as a share of the player's own situation TOI | Normalises for TOI changes: 6:00 with a linemate means different things at 12 min vs 18 min | LOW | Show as secondary figure next to minutes. |
| Unit-table minimum-time guard (dim or hide units under a threshold) | MoneyPuck/NST both use min-TOI filters; stops 12-second units with 0-0 counts cluttering | LOW | Existing `MIN_UNIT_SECONDS`=10 is lenient; consider dimming rows below a few minutes. |
| Tie unit rows back to the trends (click a name in a unit table opens that player) | Moves from "who played" to "how has he been trending" in one click | LOW | Link only; depends on player detail existing. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Linemate quality score (TOI rank, points, fantasy value, xG) | "Tell me if the new linemate is better" | User explicitly chose to judge himself; scores add opinion, extra data joins, and false precision on 3-20 game samples | Names + time only; optionally the existing player position and nothing else. |
| Full NST-style WOWY (with/without performance, CF% with a teammate) | NST users expect it | Sample sizes tiny, attribution approximate, large scope, not the deployment question | Time-together trend only. |
| Per-60 rates and xG metrics on unit tables | Analytics sites show them | Meaningless on one game or a few minutes; xG needs a model/location data | Raw counts plus %; add a footnote about small samples. |
| Heavy per-game numeric grid for N=20 | Feels thorough | The exact complaint driving this milestone | Averages, trend, sparkline up front; raw values in detail/tooltip. |
| Predicting future lines / projected lineups | Daily Faceoff territory | Editorial/practice-report data, no public API, not derivable from shift charts | Link out to Daily Faceoff if ever wanted. |
| League-wide movers list | Wanted, but explicitly deferred | Needs all-team loads (rate limits, cost) before single-team page is validated | Defer; design the row metrics (slope, delta) so they can be reused later. |
| Showing ownership/availability on this page | Handy for pickups | Decided: belongs in the league view; keeps research page league-agnostic | Revisit as a toggle later. |
| Zone starts, line matching, matchup tools | LWL Season Pass staples | Needs faceoff/PBP context and opponent logic; scope creep | Out of scope. |
| Real-time / auto-refresh | "Live lines" | Data only meaningful after game shift charts post; complexity with Vercel | Rely on page load; show "shift charts not yet published". |

## Feature Dependencies

```
Play-by-play fetch per game (new data layer)
    └──requires──> Event attribution to on-ice players by second
                       └──requires──> Per-second on-ice sets (exists in analyzeGameLines)
                       └──enables──> SF/SA/GF/GA/CF/CA per unit
                                         └──enables──> SF%/CF%/+/- columns and legend

Per-second on-ice sets (exists)
    └──enables──> Pairwise overlap seconds per situation
                       └──enables──> Linemate time-together per game
                                         └──requires──> Player detail view (row selection, ?player=)
                                                            └──enables──> Heat strip
                                                                              └──enables──> New/rising/fading tags

Trends re-layout (avg, last, delta, slope, sparkline) ──independent of──> event stats
Trends re-layout ──enhances──> Player detail (row click lives in this table)

Linemate tags ──conflicts──> Linemate quality scoring (explicitly out of scope)
League-wide movers ──requires──> Trends re-layout metrics (reuse), deferred
```

### Dependency Notes

- **Unit event stats are the only feature needing a new data source** (play-by-play). Fetch cost scales with games selected (up to 20 per team), so caching is part of this feature, not an afterthought.
- **Linemate time needs no new data.** It is a second pass over the shift-derived on-ice sets already built for units, so it is cheaper than the event stats and can ship first.
- **Trends re-layout is fully independent** and the lowest risk; it also provides the row that opens the detail.
- **Player detail requires an identity/selection mechanism** (search param) before heat strip or tags are worth building.
- **Event attribution affects EV unit definition:** `analyzeGameLines` counts 4v4/3v3 seconds as "ev" in situation totals but only full 3F/2D combos form units, so unit event counts will not sum to team totals. Document, do not "fix".

## MVP Definition

### Launch With (this milestone, suggested order)

- [ ] Trends re-layout (avg, last, delta vs window, trend + sparkline, PP share, remove per-game columns) — fixes the stated readability complaint, zero new data
- [ ] Player detail via row click with linemate time-together heat strip, EV/PP/SH, F/D split — delivers the core "who is he playing with" question from existing data
- [ ] Unit table event stats (SF/SA, GF/GA, CF/CA + SF%/CF%/+/-) for all situations — needs PBP; largest and riskiest item

### Add After Validation (v1.x)

- [ ] New/rising/fading linemate tags — once the heat strip shows what "noisy" looks like in real data
- [ ] Sortable trends table — when scanning a full roster feels slow
- [ ] Time-together share of own TOI — if raw minutes mislead
- [ ] Click a name in unit tables to open player detail

### Future Consideration (v2+)

- [ ] League-wide movers list — deferred by user
- [ ] League-ownership overlay — belongs in league view

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Trends re-layout, per-game demoted | HIGH | LOW | P1 |
| Recent-vs-window delta | HIGH | LOW | P1 |
| Player detail by row click (URL state) | HIGH | MEDIUM | P1 |
| Linemate time-together per game (EV/PP/SH, F/D) | HIGH | MEDIUM | P1 |
| Heat strip presentation of linemate time | HIGH | MEDIUM | P1 |
| Unit event stats SF/SA/GF/GA/CF/CA | MEDIUM-HIGH | HIGH | P1 (last) |
| Derived %, legend, definitions | MEDIUM | LOW | P1 |
| New/rising/fading linemate tags | HIGH | MEDIUM | P2 |
| Sortable trends table | MEDIUM | MEDIUM | P2 |
| Time-together share of own TOI | MEDIUM | LOW | P2 |
| Unit rows link to player detail | LOW-MEDIUM | LOW | P3 |
| League-wide movers | HIGH | HIGH | deferred |

**Priority key:** P1 must have this milestone; P2 should have when possible; P3 nice to have.

## Presentation Guidance (how to make it readable)

- **Unit tables:** keep Frozen Pool's column order (TOI, %, then GF-GA, SF-SA, CF-CA with a % beside CF and SF). Tabular numerals, right-aligned, for/against columns adjacent, muted colour on counts and stronger weight only on the % columns. Group the three pairs under spanning headers so 6 stat columns do not run together. Show EV/PP/SH as separate blocks as today; consider dimming rows under a small minimum TOI.
- **Trends view:** one row per player, roughly 6-8 columns: Player, Pos, Avg TOI, Last game, Delta vs window, Trend (sparkline + signed slope with arrow), PP avg / PP share (+ trend), SH avg. Colour only for the up/down signal. Per-game values live in the sparkline `title`/tooltip and the player detail.
- **Linemate history:** rows are linemates (name only), columns are games (date/opponent header), cell is minutes together with background shade scaled to the cell value (shade carries the pattern; digits secondary), then window average and trend. Sort by recent-weighted time together. Separate EV forwards, EV defense partners, PP, SH. Games the player missed render as an empty cell, not zero.

## Competitor Feature Analysis

| Feature | Frozen Pool | Daily Faceoff / LWL | Our Approach |
|---------|-------------|---------------------|--------------|
| Unit stats SF/SA/GF/GA/CF/CA | Yes, raw counts, last 3 games | LWL Line Production (SAT%, zone starts), paywalled | Match Frozen Pool columns, any window (1-20 games) |
| Role-change detection | No | LWL Line Changes (paid), DF projected lines | Per-player slope + recent delta from derived data, free |
| Linemate history | No | Not found | Per-game time-together heat strip (unique) |
| Linemate quality | No | LWL line production per combo | Deliberately none |
| Projected lines | No | Yes (DF) | Not built |

## Sources

- Dobber Frozen Pool last-3-game lines (MTL): https://frozenpool.dobbersports.com/frozenpool_last3gamelines.php?team=MTL — fetched directly, HIGH for its structure
- Left Wing Lock Season Pass tool descriptions: https://leftwinglock.com/seasonpass/ — fetched, MEDIUM (marketing copy)
- Daily Faceoff line combinations pages (via search): https://www.dailyfaceoff.com/teams/montreal-canadiens/line-combinations — LOW/MEDIUM (search summary only)
- MoneyPuck lines/pairings page and Natural Stat Trick line tool/WOWY (via search summaries; NST and MoneyPuck pages not fetched directly) — LOW/MEDIUM
- Existing implementation: `app/research/page.tsx`, `lib/research/lines.ts`, `.planning/PROJECT.md`

Caveats: the research-plan/cache seam was not used. Open question for the stack/pitfalls researchers: confirm in the NHL play-by-play feed which team `eventOwnerTeamId` points to for `blocked-shot` events (shooter vs blocker) before computing CF/CA. Not verified here.

---
*Feature research for: NHL line/deployment research page*
*Researched: 2026-10-11*
