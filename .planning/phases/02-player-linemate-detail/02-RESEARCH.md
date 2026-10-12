# Phase 2: Player Linemate Detail - Research

**Researched:** 2026-10-12
**Domain:** Pair-overlap ("time together") from NHL shift charts, a server-rendered linemate heat strip on a Next.js 16 App Router page, URL-state player selection
**Confidence:** HIGH for code seams, Next.js behaviour and Tailwind ordering (read and executed this session); MEDIUM for the tuning constants (measured on 120 real games, but judgment calls); the data-sample caveats are in the Assumptions Log

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the detail opens**
- **D-01:** The detail is a **panel at the top of the page, above the trends table**. It is server-rendered from `?player=<id>`, and the trends table stays below it.
- **D-02:** In the trends table, **the player's name is the link** that opens the detail, not the whole row. This avoids clashing with the clickable per-game squares and the sort headers.
- **D-03:** After a click, the page **jumps to the panel**, even when the clicked row is far down the table.
- **D-04:** The panel has a **close (×) link that clears `?player`**. Clicking another name swaps the player, and browser back/forward works because the selection lives in the URL. Selecting a player keeps the existing `team` / `games` / `sort` / `dir` params.
- **D-05:** The panel header shows the **player's name, position, and his trends-row numbers** (Avg TOI, TOI Δ, PP share, PP share Δ), reusing the existing `TrendRow` values and formatting. The linemate change then sits next to his deployment change.
- **D-06:** The selected player's row in the trends table gets a **subtle neutral highlight** (an outline or neutral background) that does not clash with the green/red mover tint.

**Heat strip readout**
- **D-07:** Each cell (one linemate × one game) is **shade only**. Minutes together and share appear in a popover on click, hover or keyboard focus, reusing the Phase 1 per-game strip pattern (`ToiStripCell` + popover).
- **D-08:** Cell shade is driven by **share of the player's own situation TOI that game**: time together ÷ the selected player's regulation seconds in that situation. A full-time linemate is dark whether the player had 12 or 20 minutes.
- **D-09:** Each linemate row ends with a summary: his **window share** (time together ÷ the player's situation seconds, across the games the player played) and his **tag**. Minutes appear only in the popover.
- **D-10:** EV / PP / SH are **tabs, EV by default**. The selected tab lives in the URL (e.g. `?sit=pp`, allowlisted like `sort`), so it survives reload and sharing.
- **D-11:** Only **linemates with meaningful time** are listed. Line-change noise below a minimum is hidden. The list is capped at roughly 6 forwards and 4 D at EV, with fewer for PP/SH, and has a "show all" link. The exact minimum and caps are Claude's discretion.
- **D-12:** Rows are ordered by **recent time first** (the recent games defined in D-15), then by window total. A line change pushes the new linemates to the top.
- **D-13:** **One strip with two groups.** The forwards block comes first, then a divider, then the D block, all sharing the same game columns. This matches the trends table's F-then-D layout.

**New / Rising / Fading / Out tags (time together only)**
- **D-14:** **New:** meaningful time together in the recent games, and little or none in the earlier games of the window. Example: a forward moved to a new line in the latest game shows his new linemates as New.
- **D-15:** **Recent vs earlier.** With 3 or more games, "recent" is the team's last 2 games (Phase 1 D-05). With exactly 2 games, recent is the latest game and earlier is the game before it. Tags need at least 2 games in which the selected player played. In a 1-game window there are no tags.
- **D-16:** **Rising / Fading:** the linemate's share of the player's situation TOI in the recent games, compared with the earlier games. **Rising at +15 share points or more, Fading at −15 or less** (the same threshold as the Phase 1 PP-share movers). Smaller changes get no tag. Fading also covers a linemate who played but no longer shares ice with the player.
- **D-17:** **A linemate who missed the recent games** (scratched or injured) is tagged **Out**, never Fading, like Phase 1's "DNP last 2". His missed games are blank, never 0.
- **D-18:** **When the selected player missed games**, those columns are blank and excluded from both the recent and earlier parts. If he missed all of the recent games, no New / Rising / Fading tags are shown.

**OT, trades and edge cases**
- **D-19:** **Linemate time is regulation only**, periods 1–3, in every situation. OT games stay in the strip, marked as in Phase 1, and their regulation seconds count. For consistency, the share denominator is also the player's regulation situation seconds. Note this differs from Phase 1's PP/SH, which use whole-game `lines` including OT.
- **D-20:** **A traded or called-up linemate** shows **blank "not with team"** for games when he wasn't on the team, never 0. Those games don't count toward his share or tags. A newly acquired player who gets real time shows as New.
- **D-21:** A player whose position group changed during the window is **listed once, under the group he played most** in the window.
- **D-22:** **Clicking a name in a Last game unit table (UNIT-04)** opens his detail **on that table's situation tab** (EV, PP or SH).
- **D-23:** **Skaters only.** Goalies can't be selected and aren't listed as linemates.
- **D-24:** **Missing shift charts** (unpublished, or a failed request) show as unknown/blank in the heat strip, never 0, and don't count toward shares or tags (roadmap criterion 5; DATA-02 spirit).

### Claude's Discretion
- The minimum time together that counts as "meaningful" for listing and for New, and the exact list caps per situation (D-11, D-14). Tune these on real team data.
- The visual design of the panel, tabs, divider, close link, row highlight and heat-strip colour, within the Phase 1 visual language (neutral palette, `tabular-nums`, squares and popovers like `ToiGameStrip`).
- What happens to `?player` when the team or window changes. Suggested: drop it when the player isn't on the new team's roster for the window, and keep it otherwise. This wasn't discussed.
- How the jump to the panel is done (a fragment anchor, `scroll` behaviour on links), provided it works with server rendering and the existing `PendingLink`.
- The tag glyphs and wording, as long as "New", "Rising", "Fading" and "Out" read clearly.
- Whether pair seconds come from extending `analyzeGameLines` or from a new timeline helper (research ARCHITECTURE suggests `timeline.ts` + `pairSeconds` + `lib/research/linemates.ts`).

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within phase scope.

Not in this phase (CONTEXT domain boundary): unit event stats and play-by-play (Phase 3); linemate quality scoring of any kind; league ownership on the research page. The existing Last game unit tables must keep showing the same TOI and share values (roadmap success criterion 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLYR-01 | Click a player to open detail; selection in the URL (`?player=<id>`) survives reload and sharing | URL contract and allowlist parsing (Architecture Patterns 4, Code Examples); Link hash-scroll behaviour verified in Next 16.3.4 and in WebKit + Chromium (Next.js Specifics); validation of `player` against the loaded roster (Security) |
| PLYR-02 | Linemate heat strip: rows linemates, columns games, shade = time together, split EV/PP/SH and F vs D | Regulation-only pair-seconds pass (Pattern 1), cell-state model (Pattern 2), constants validated on real data (Real-Data Validation) |
| PLYR-03 | Time together as a share of the player's own situation TOI | Denominator = regulation `self` seconds from the same pair pass (Pattern 1, Pitfall 1); window share pooling rule (Pattern 3) |
| PLYR-04 | New / Rising / Fading tags from time together only | Full tag decision table (Pattern 3) validated against 120 real games; thresholds and their firing rates (Real-Data Validation) |
| UNIT-04 | Click a name in a unit table to open that player's detail | `UnitTable` must move out of `page.tsx` (Pitfall 2); `sit` carried per table; link contract (Next.js Specifics) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Sources: `/Users/jwitt/Development/fantasy-hockey/CLAUDE.md` (imports `AGENTS.md`) and `.claude/CLAUDE.md`. Treated with the same authority as locked decisions.

- **Next.js is not the Next.js you know** (AGENTS.md): read `node_modules/next/dist/docs/` before writing code and heed deprecations. Done for `searchParams`, `Link` scroll/hash, `page.tsx` exports, `useLinkStatus`; the planner should cite those docs in tasks that touch routing.
- **Principles:** do not assume or hide confusion, surface tradeoffs (see Open Questions); minimum code that solves the problem, nothing speculative (no cache layer, no new library, no `timeline.ts` refactor); touch only what you must, clean up only your own mess (`lines.ts` changes are a verbatim extraction only).
- **Stack is fixed:** Next.js 16 App Router, Tailwind 4, Drizzle/Neon, Vercel; public unauthenticated NHL APIs only; no paid feeds.
- **Naming:** library files `kebab-case.ts`, components `PascalCase.tsx`, tests `*.test.ts` co-located; functions verb-first (`build*`, `compute*`, `parse*`), constants `UPPER_CASE`, booleans `is*/has*/should*`; no barrel files, import directly; `@/*` path alias.
- **Style:** semicolons, ESLint `eslint-config-next` (core-web-vitals + typescript), JSDoc on public functions, inline comments only for non-obvious decisions; plain objects/Maps returned from pure helpers; `null` for "not found / unknown".
- **Errors and logging:** throw descriptive errors on validation failure; catch and log integrations with `console.error("Action description", err)`; this phase adds no fetch and no new error state.
- **Architecture:** pure logic in `lib/research/*.ts`, server components for pages, client components only where state demands it (here: `PendingLink`, `ToiStripCell`).
- **GSD workflow enforcement:** file edits start from a GSD command (`/gsd-execute-phase` for this phase); no direct repo edits outside it.
- **Project memory:** the site targets laptop browsers; never block UAT on phone/touch tests (so the browser script drops the iPhone context).
- **Task constraints for this run:** research only, do not modify source; never stage or commit `.claude/`, `.planning/config.json`, `.planning/state.json`, `.planning/milestone.lock`.

## Summary

Phase 2 needs one new piece of data and several view layers on top of code that already exists. The data is "regulation-only seconds the selected skater shared the ice with each teammate, per game and per situation, plus his own regulation seconds per situation as the share denominator". It is a second pass over the same on-ice second buckets `analyzeGameLines` builds. I prototyped the pass against 131 cached real game files (120 unique games; 16 team windows) and it holds three invariants on every game: own-regulation seconds equal `lines.playerSeconds` exactly in every non-OT game (and are smaller in OT games, as intended); pair seconds are symmetric; a pair never exceeds either player's own seconds. The pass costs about 7 ms per game (the same as `analyzeGameLines`), so no cache is needed. [VERIFIED: measured in scratch prototype this session; method in Sources]

The recommended seam is minimal and keeps roadmap criterion 5 safe: move the bucketing loop out of `analyzeGameLines` into an exported `bucketOnIce` (verbatim) and export `situationFor`, put the new pass in `lib/research/pair-seconds.ts`, store the result on `ResearchGame` as `pairs: GamePairs | null`, and leave `analyzeGameLines` outputs, the `GameLines` type and `lines.test.ts` untouched. The view-model (shares, states, ordering, caps, tags) is a separate pure module `lib/research/linemates.ts`; components only render it. All of this stays server-side, so nothing new crosses the RSC boundary except strings.

Real data changed several things the UI-SPEC assumed. (1) At EV a forward's non-linemates still share 15 to 30 percent of his ice (line-change overlap), so the caps do the filtering, not the 2:00 minimum; the saturation constant 0.75 and the 2:00/0:30 minimums are fine as written. (2) With the locked ±15 point threshold, about one third of displayed EV rows get a tag and about 89 percent of players show at least one (window 5): tags are frequent, not rare. (3) A genuinely new linemate gets "New" only about 39 percent of the time with "little or none" = under 5 points, because adjacent-line overlap gives a 5 to 20 point baseline; a named constant of 10 points raises that to 51 to 63 percent and still leaves every other genuine new linemate tagged Rising. (4) Recent-first ordering plus the cap hides 97 percent of "Out" tags and 27 percent of change tags in the default view. (5) In the 2026-27 sample, 17 of 45 games (38 percent) have no shift chart at all, versus 0 of 75 last season, so the `unknown` state is a main path right now, not an edge case. (6) A plain click on the already-selected name does not jump (verified), contrary to the UI-SPEC sentence; a native `#player-detail` anchor for the selected name does.

**Primary recommendation:** Add `bucketOnIce`/`situationFor` exports to `lines.ts`, a pure `pairSeconds` pass stored as `ResearchGame.pairs`, a pure `buildLinemateView` view-model with the tag rules in Pattern 3 (constants named and exported), render with the UI-SPEC components, and move `UnitTable` out of `page.tsx` before linking its names.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch shift charts / boxscores | API / Backend (server component, `lib/nhl/client.ts`) | CDN / Static (Next Data Cache, 1 h) | Already how Phase 1 works; no new fetch in this phase |
| Pair-seconds computation | API / Backend (pure `lib/research/*`, run in `loadGame`) | — | Needs raw shifts, which are not retained on `ResearchGame`; ~7 ms/game |
| Share, state, ordering, caps, tags | API / Backend (pure view-model `lib/research/linemates.ts`) | — | Pure functions over `ResearchGame[]`; unit-testable without React |
| `?player` / `?sit` / `?all` parsing and href building | Frontend Server (SSR, `page.tsx` + `toi-trends.ts` helpers) | — | Search params are read server-side; hrefs built only from validated values |
| Panel, tabs, heat strip, tag chips, name links | Frontend Server (server components) | Browser / Client (`PendingLink`, `ToiStripCell` only) | Matches the existing pattern: no data logic in components; client code limited to spinner and popover state |
| Jump to the panel | Browser / Client (Next router + native `scrollIntoView`) | Frontend Server (renders `id="player-detail"`) | Next's Link applies the hash scroll after the server render; the section id and `scroll-mt-4` live in markup |
| Popover show/hide, pin, Escape-dismiss | Browser / Client (`ToiStripCell`) | CSS (Tailwind `group-*` variants) | Needs focus, hover and pointer state |

## Standard Stack

No new dependency. Everything below is already installed and in use. [VERIFIED: package.json, node_modules versions read this session]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.4 | App Router, `Link`, server rendering of the panel | Existing app; read `node_modules/next/dist/docs` and the router source per AGENTS.md |
| react / react-dom | 19.2.8 | Server components, `renderToStaticMarkup` in view tests | Existing |
| tailwindcss + @tailwindcss/postcss | 4.3.3 | All styling; `group-data-[...]` variants for the popover | Existing; ordering of the generated rules verified (Pitfall 9) |
| typescript | ^5 | Strict typing; `tsc --noEmit` is the type gate (clean baseline, about 3 s) | Existing |
| tsx | 4.23.13 | Runs `node:test` suites: `tsx --test lib/**/*.test.ts` | Existing; 188 tests pass in under 1 s |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright-core (npx cache, not installed in the repo) | found at `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core` | WebKit/Chromium browser check, same as `webkit-strip-check.cjs` | Backstop checks the UI-SPEC lists (jump, popover, clipping, dark mode) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New pass beside `analyzeGameLines` (recommended) | Add `pairSeconds` to the `GameLines` return | Mixes a regulation-only product into an OT-inclusive function whose outputs must not change; every `GameLines` fixture then needs the field. Rejected. |
| New pass beside it (recommended) | Full `timeline.ts` extraction (ARCHITECTURE.md) | Bigger refactor of working code for no Phase 2 gain; the verbatim `bucketOnIce` extraction gives the same single classifier |
| New pass with its own bucketing | Copy the loop into `pair-seconds.ts` | Two EV/PP/SH classifiers drift (PITFALLS Pitfall 5). Rejected. |

**Installation:** none. **Version verification:** versions above were read from `node_modules/*/package.json` and `tsx --version` this session; there is nothing to look up on a registry.

## Package Legitimacy Audit

This phase installs no external packages, so the legitimacy gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | No install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Note for whoever commits: `git status` currently shows `package.json` and `package-lock.json` modified (a new `@opengsd/gsd-core` dependency line and about 1,300 lock-file lines). I did not make that change (this research only read the repo and wrote scratch files outside it). It looks like a GSD installer side effect. It must not be staged with Phase 2 work.

## Architecture Patterns

### System Architecture Diagram

```
request /research?team=T&games=N&sort..&player=ID&sit=pp&all=1
  |
  v
page.tsx (server): auth gate -> allowlist parse (team, games, sort, dir, player, sit, all)
  |
  v
loadTeamResearch(team, N)  -- per game, parallel (unchanged fetches, Data Cache 1 h) -->
  getBoxscore + getShiftCharts
        |
        +--> shiftInputs --> analyzeGameLines()  ----------------> game.lines   (UNCHANGED, OT included)
        |         |
        |         +-- shares bucketOnIce() + situationFor() (verbatim extraction)
        |
        +--> shiftInputs --> pairSeconds()  (regulation only) ---> game.pairs   (NEW: self + together + groups)
        |
        +--> null when no shift chart (lines and pairs both null)
  |
  v
TeamResearch { players, games[] }   (Maps stay on the server)
  |
  +--> buildTrendRows (existing) --> selected TrendRow (header numbers) + ToiTrends rows
  |
  +--> if player valid:  buildLinemateView(games, playerId, sit, {all})
  |         per game: unknown | absent | apart | together   (seconds, share)
  |         per linemate: group, window share, tag, recent/total seconds; capped + ordered
  |         tags: {available, reason}; emptyReason; noChart dates
  |
  v
render order: nav -> [PlayerLinemates panel #player-detail] -> LastGameLines (UnitTable + PlayerLink)
              -> ToiTrends (name cell PlayerLink)
  |
  v
browser: PlayerLink click -> Next router -> server re-render (Data Cache hits) -> scrollIntoView(#player-detail)
         ToiStripCell squares: hover/focus/click/Escape (client state only)
```

### Recommended Project Structure
```
lib/research/
├── lines.ts                  # CHANGE (verbatim): export situationFor/OnIce; extract bucketOnIce(); analyzeGameLines calls it
├── lines.test.ts             # UNCHANGED (regression gate for roadmap criterion 5)
├── pair-seconds.ts           # NEW pure: pairSeconds(team, shifts, positions) -> GamePairs
├── pair-seconds.test.ts      # NEW
├── team-games.ts             # CHANGE: ResearchGame.pairs; computed beside lines in loadGame
├── linemates.ts              # NEW pure view-model + exported tuning constants
├── linemates.test.ts         # NEW
├── toi-trends.ts             # CHANGE: researchHref extras, parsePlayer/parseSit/parseAll, playerHref
├── game-strip.ts             # CHANGE (small): widen the cell state type or add a sibling type
└── player-detail-view.test.ts# NEW markup tests (must sit directly in lib/research/, see Pitfall 11)
components/
├── PlayerLinemates.tsx       # NEW server: panel
├── PlayerLink.tsx            # NEW thin server: PendingLink (or native anchor for the selected name)
├── UnitTable.tsx             # MOVED out of app/research/page.tsx (Pitfall 2) + name links
├── ToiStripCell.tsx          # CHANGE: widen state; WR-10 behaviour
├── ToiTrends.tsx             # CHANGE: name cell link, pl-2, selected bar
└── ToiGameStrip.tsx          # CHANGE only if the popover span is extracted to a shared component
app/research/page.tsx         # CHANGE: parse params, render panel first; keep the three auth-gate lines byte-identical (Pitfall 12)
```

### Pattern 1: Regulation-only pair seconds, one more pass over the same buckets
**What:** `bucketOnIce(shifts, positions)` is the first half of `analyzeGameLines` moved verbatim (uses `uniqueShifts`, skips unknown positions and empty shifts, offsets by period). `pairSeconds` walks the buckets, skips every second at or after `REGULATION_PERIODS * PERIOD_SECONDS`, classifies the second with the shared `situationFor`, then for each own-team skater adds one second to his `self[sit]` and one to `together[a][b][sit]` for every other own-team skater on ice.
**Why this shape:** `self` and `together` come from the same loop, so `together <= self` by construction and the share can never exceed 100 percent. The denominator is `self`, never `lines.playerSeconds` (Pitfall 1). Half-open `[start, end)` seconds mean two shifts that touch (one ends at 60, the next starts at 60) do not overlap, so change seconds are not double-counted; this is the same time-computation convention as TOI, not the event convention (PITFALLS Pitfall 18).
**Quoted values this relies on** (read this session):
- `lines.ts:4` `export type Situation = "ev" | "pp" | "sh";`
- `lines.ts:5` `export type PositionGroup = "F" | "D" | "G";`
- `lines.ts:15` `export const REGULATION_PERIODS = 3;`
- `lines.ts:57` `const PERIOD_SECONDS = 1200;` (`PERIOD_SECONDS` is not exported today; export it or use the literal in the extracted helper)
- `team-games.ts:122` `lines: shiftInputs.length > 0 ? analyzeGameLines(team, shiftInputs, positions) : null,`
**Example** (shape proven on 131 real game files; values from the quotes above):
```typescript
export interface GamePairs {
  /** Regulation seconds each own-team skater was on ice, per situation. */
  self: Map<number, Record<Situation, number>>;
  /** Regulation seconds both skaters were on ice together, per situation. Symmetric: together.get(a).get(b) equals together.get(b).get(a). */
  together: Map<number, Map<number, Record<Situation, number>>>;
  /** Group of every own-team skater who was on ice in regulation, for D-21 (group played most). */
  groups: Map<number, PositionGroup>;
}

export function pairSeconds(team: string, shifts: ShiftInput[], positions: Map<number, PositionGroup>): GamePairs {
  const self: GamePairs["self"] = new Map();
  const together: GamePairs["together"] = new Map();
  const groups: GamePairs["groups"] = new Map();
  for (const [t, byTeam] of bucketOnIce(shifts, positions)) {
    if (t >= REGULATION_PERIODS * PERIOD_SECONDS) continue; // D-19: regulation only, any number of OT periods
    const mine = byTeam.get(team);
    if (!mine || mine.skaters.length === 0) continue;
    const opp = [...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? { skaters: [], goalie: false };
    const situation = situationFor(mine, opp);
    for (const a of mine.skaters) {
      /* self[a][situation]++, groups.set(a, positions.get(a)), and for every other b: together[a][b][situation]++ */
    }
  }
  return { self, together, groups };
}
```
**Measured:** 780-shift game, `analyzeGameLines` 6.57 ms, `pairSeconds` 7.00 ms, 290 nested entries; 20 games add about 140 ms CPU per request. [VERIFIED: scratch benchmark]. No cache layer.

### Pattern 2: Cell states, from the data, in one pure function
Per game `i`, for selected player P, linemate L, situation S (UI-SPEC state table):

| State | Condition |
|-------|-----------|
| `unknown` | `game.pairs === null` (no shift chart; boxscore still tells who dressed, so `Out` does not depend on charts) |
| `absent` | not unknown, and (P did not dress, or P's regulation `self[S]` is 0, or L did not dress for the team). Reason precedence for the popover note: P missed, then P had no S time, then L not with team |
| `apart` | counted game (P dressed, `self[S] > 0`, L dressed) and `together = 0` |
| `together` | counted game and `together > 0` |

"Dressed" is `game.toi.has(id)`. Note `loadGame` only puts a skater in `toi` when `parseClock(p.toi)` is truthy (`team-games.ts:93`, `if (secs) toi.set(...)`), so a 0:00 line (open finding IN-01) reads as did-not-dress. That is acceptable here.
Share per cell is `together / self[S]`; shade is `0.2 + 0.8 * clamp(share / 0.75, 0, 1)` (UI-SPEC:97). A "counted" game for a linemate is one in the table's `apart`/`together` rows; only counted games enter window share, recent/earlier shares, totals and tags.

### Pattern 3: Window share, ordering, listing, tags (the rules the planner should freeze)
Let `n` = games in the window (oldest first), `rs` = start of the recent part: `n >= 3 -> n - 2` (matches `RECENT_GAMES = 2`, `toi-trends.ts:14`), `n === 2 -> 1`, `n === 1 -> none` (D-15; note this differs from Phase 1's Δ, which has no earlier part at n = 2).
- **Window share** = sum of `together` over the linemate's counted games divided by sum of P's `self[S]` over the same games (pooled, like Phase 1's PP share). `—` when there are no counted games.
- **Listed** when the sum of `together` over counted games is at least `LINEMATE_MIN_SECONDS[S]`; **group** = the group he played most in the window using `pairs.groups`, ties to the latest (D-21).
- **Order** = recent-part counted `together` seconds descending, then window total descending, then id (deterministic). Cap per group after ordering (`all=1` lifts the cap, never the minimum).
- **Tags available** only if all of: `rs` exists; P has at least 2 counted games; at least 1 counted game in the recent part (D-18); at least 1 counted game in the earlier part. The last clause is not in the UI-SPEC: with P absent from every earlier game there is nothing to compare (Open Question 2). Reason order for the footnote: one-game, played-fewer-than-2, missed-recent, no-earlier.
- **Out** = L did not dress in any team game of the recent part (independent of charts).
- Otherwise `recent` and `earlier` shares are pooled over the linemate's counted games in each part; no counted recent game gives no tag; no counted earlier game means earlier = 0 (a new acquisition or a returning player, D-20). With `r`, `e` the rounded point values and `delta = r - e`:
  - **New**: `delta >= 15` and `e < 10`
  - **Rising**: `delta >= 15`
  - **Fading**: `delta <= -15` (this also covers "played but no longer shares ice", D-16)
  Reuse `deltaCrossing` for the ±15 test (`toi-trends.ts:79-82`: `if (delta === null || Math.round(Math.abs(delta)) < threshold) return 0;`), so the tag agrees with what rounded numbers show, exactly as the Phase 1 movers do.
- Constants (proposed names; values come from the UI-SPEC except the New bound, which is a recommendation):
```typescript
export const LINEMATE_MIN_SECONDS: Record<Situation, number> = { ev: 120, pp: 30, sh: 30 };
export const LINEMATE_CAPS: Record<Situation, { F: number; D: number }> = {
  ev: { F: 6, D: 4 }, pp: { F: 4, D: 3 }, sh: { F: 4, D: 3 },
};
export const LINEMATE_TAG_POINTS = 15;            // D-16; separate from PP_MOVER_POINTS (= 15 today, toi-trends.ts:11) so tuning one never moves the other
export const LINEMATE_NEW_EARLIER_MAX_POINTS = 10; // recommended; see Real-Data Validation
export const LINEMATE_SHADE_SATURATION_SHARE = 0.75; // UI-SPEC:97
```

### Pattern 4: URL contract and allowlists (extends `researchHref`)
Today: `export function researchHref(team: string, games: number, sort: SortSpec): string {` (`toi-trends.ts:186`), and the page destructures `const { team: teamParam, games: gamesParam, sort: sortParam, dir: dirParam } = await searchParams;` (`page.tsx:29`). Extend with an optional fourth argument so the existing default-case outputs and tests are byte-identical (`"/research?team=MTL&games=10"` at `toi-trends.test.ts:315`). Add `parsePlayer(v: unknown): number | null` (single string, `/^\d{1,10}$/`, then `Number`), `parseSit(v: unknown): Situation` (allowlist, default `ev`, arrays to default), `parseAll(v: unknown): boolean` (exactly `"1"`). The panel's player must also be found among `buildTrendRows` rows (skater who dressed in the window); a valid-format id that is not found renders the notice, never a fetch. A separate `playerHref(...)` appends the constant `#player-detail`.

### Pattern 5: Selected-player validation reuses the trend rows
`buildTrendRows(research.players.values(), research.games)` already skips goalies and players with zero games (`toi-trends.ts:196-200`), and its `TrendRow` is exactly the header data (D-05). Call it once in `page.tsx` to get the selected row. Calling it twice (the page and inside `ToiTrends`) is a few milliseconds of pure work; lifting `rows` into a prop would touch every existing `ToiTrends` test call, so don't.

### Anti-Patterns to Avoid
- **Denominator from `lines.playerSeconds`:** it includes OT (including 3v3 OT counted as `ev`), so shares in OT games understate. Use `pairs.self` only.
- **Computing the pair pass lazily per click:** shifts are not kept on `ResearchGame`; compute in `loadGame` while they are in hand.
- **A second EV/PP/SH classifier:** always call the shared `situationFor`.
- **Zero-filling absent or unknown games:** four distinct states, none of which is 0 (D-17, D-20, D-24).
- **Linking from `UnitTable` while it still lives in `page.tsx`:** see Pitfall 2.
- **A native anchor for every name:** a plain `<a href="#...">` bypasses Next's history bookkeeping; use it only for the already-selected name (see Next.js Specifics).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EV/PP/SH classification of a second | A second strength rule | `situationFor` exported from `lines.ts` | Pulled-goalie extra attackers must stay EV; one definition (PITFALLS Pitfall 5) |
| Duplicate shift rows | Own de-duplication | `uniqueShifts` inside `bucketOnIce` | CR-01 already fixed this once |
| Rounded ±15 test | Inline `Math.abs(x) >= 15` | `deltaCrossing(delta, LINEMATE_TAG_POINTS)` | Tag agrees with the displayed rounded number |
| URL param validation | `Number(x)` on raw params | `parsePlayer` / `parseSit` / `parseAll` modelled on `parseSort` | Arrays, `__proto__`, long digit strings already handled by the pattern |
| Square + popover | A new tooltip/heat-map component or library | `ToiStripCell` + the Phase 1 popover span | UI-SPEC: no new dependency; Phase 1 already hit the touch/hover/clipping bugs |
| Time formatting | New formatters | `formatClock`, `formatDate`, `gameLabel`, `resultLabel`, `formatSignedClock`, `formatSignedPoints` | Same strings as the table |
| Scroll to the panel | JS `scrollIntoView` in a client component | Next `Link` default scroll plus `id="player-detail"` and `scroll-mt-4` | Verified to work in WebKit and Chromium (Next.js Specifics) |
| Scroll position kept on tab/sort/close | Manual scroll restore | `scroll={false}` on those links | Verified to keep `scrollY` unchanged |

**Key insight:** every hard part (classification, de-duplication, popover state, scroll, formatting) already exists in this repo; Phase 2's new logic is the pair pass and the tag rules, and both are pure functions with a strong oracle (the three invariants).

## Runtime State Inventory

Not applicable: this is an additive feature, not a rename/refactor/migration. No stored data, service configuration, OS registration, secrets or build artifacts carry a renamed string. (The phase adds no database table; "Persisting derived stats in Neon" is explicitly out of scope in REQUIREMENTS.md.)

## Real-Data Validation

Method: 16 team windows (8 teams x current season 20262027 up to 10 games, plus the same 8 x last 10 games of 20252026, including playoff games), 131 game loads, 120 unique games, fetched sequentially with 250 ms spacing from `api-web.nhle.com` and `api.nhle.com/stats` (no 429s). The prototype used the repo's own `analyzeGameLines`, `uniqueShifts` and `parseClock` and a faithful copy of the bucketing loop; analysis scripts and the cached JSON live in the session scratchpad, not the repo. [VERIFIED: executed this session; sample caveats in Assumptions Log A6]

**Invariants (use as the test oracle):**
| Invariant | Result |
|-----------|--------|
| `pairs.self[S] == lines.playerSeconds[S]` for every skater in every non-OT game | 5,852 equal, 0 violations |
| `pairs.self[S] <= lines.playerSeconds[S]` everywhere (OT only reduces) | 250 strictly smaller, all in OT games, 0 violations |
| `together(a,b)[S] == together(b,a)[S]` and `<= min(self(a), self(b))` | 0 violations over all pairs |
| Position group of a skater is constant across a 10-game window (boxscore lists by listed position) | 0 changes among 358 skaters, so D-21 is nearly dead code; still store `groups` (cheap) |
| Games with no shift chart | 2026-27: 17 of 45 unique games (38 percent); 2025-26: 0 of 75 |

**Q2: OT effect on the header versus the strip.** In 4 of 19 OT games (21 percent) a skater has PP or SH seconds in the OT period (OT penalties; examples EDM 2025021289: 235 s regulation vs 301 s whole-game SH). Phase 1's PP share and PP share Δ use whole-game `lines`; the PP/SH tab uses regulation. EV is not shown in the header at all, so EV never visibly disagrees; Avg TOI is regulation, so it agrees. So the only places the panel header can look inconsistent with the strip:
1. PP share (and PP share Δ) in the header can include a few OT PP seconds the PP tab excludes (rare, small).
2. The header "PP share" is a share of the **team's** PP time; the strip's "Window share" is a share of the **player's own** PP time. Same unit, different denominators, both percentages (the label difference and the `title` text carry it; legend line 2 states the denominator).
3. Header "5/5 GP" counts games dressed, including games with no shift chart; the strip counts only chart games. The amber footnote lists the dates.
4. At a 2-game window the header Δ items show `—` (Phase 1 needs 3 games) while tags exist (D-15 gives them a latest-vs-previous split). Legend line 3 already explains the 2-game rule.
Recommendation: denominator is `pairs.self` (regulation). No extra footnote is needed for item 1 (the legend already says "only regulation time counts").

**Q3a: minimums and caps (window 5 and 10, all players with at least 2 games).** Listed counts after the minimum, before the cap:
| Situation, minimum | Window 5: F median / p90, capped% | Window 5: D median / p90, capped% | Window 10: F median / p90, capped% |
|---------------------|----------------------------------|----------------------------------|-------------------------------------|
| EV 2:00 | 9 / 13, 67% | 6 / 7, 76% | 10 / 14, 76% |
| EV 4:00 | 6 / 13, 44% | 6 / 7, 67% | 8 / 13, 62% |
| PP 0:30 | 4 / 7, 37% | 1 / 3, 2% | 4 / 8, 47% |
| PP 1:00 | 3 / 6, 23% | 1 / 2, 0% | 4 / 7, 34% |
| SH 0:30 | 3 / 6, 31% | 3 / 5, 42% | 3 / 7, 33% |
| SH 1:00 | 2 / 6, 23% | 2 / 5, 30% | 2 / 6, 27% |
Reading: at EV the cap, not the minimum, bounds the list (window-share by rank: F1 61 percent, F2 49, F3 31, F4 25, F5 to F12 each 15 to 22 percent; D1 48, D2 37, D3 32, then 21 to 30). A forward's non-linemates overlap 15 to 30 percent because lines change on the fly. Keep the UI-SPEC minimums (2:00 / 0:30 / 0:30) and caps (6F/4D, 4F/3D, 4F/3D): they show the real line plus the next few, and a New linemate clears 2:00 (in every real line-change case checked, 35, 32 and 42 cases at windows 2, 3 and 5, all new linemates were listed). Raising the EV minimum to 4:00 only trims incidental rows. PP and SH minimums matter: at 0:30, 17 to 24 percent of players with some PP/SH time have nothing listed (the "below minimum" message must be reachable).

**Q3b: saturation constant.** Per-game EV cell shares: the player's top two forwards p10/p50/p90 = 36/71/90 percent; all other forwards = 1/9/28 percent. PP: top two = 83/99/100, others 0/0/85. SH: top two 9/56/96, others 0/0/18. With `LINEMATE_SHADE_SATURATION_SHARE = 0.75` a regular EV linemate is at opacity about 0.96 and an incidental one about 0.29. Keep 0.75.

**Q3c: tag firing rates at ±15 (displayed EV rows after the default cap).**
| Window | Rows tagged | Players with at least 1 displayed tag | Tag mix (Rising / Fading / New / Out) |
|--------|-------------|--------------------------------------|---------------------------------------|
| 3 | 37% | 90% | 395 / 365 / 171 / 8 |
| 5 | 33% | 89% | 420 / 341 / 163 / 6 |
| 10 | 30% | 85% | 410 / 306 / 147 / 7 |
Sensitivity (window 5): ±20 tags 24% of rows (77% of players), ±25 19% (67%), ±30 16% (59%). So the locked ±15 is a high-frequency signal; tags will be on roughly every third row. This is not a bug (EV lines do shuffle) but it affects how loud the tag column feels. Keep ±15 per D-16 in one named constant; ±20 is the first value worth considering if UAT finds it noisy (Open Question 4).

**Q3d: does a just-changed line produce New/Fading (SC4)?** I found real cases where both of a forward's top-2 linemates in the latest game differ from his top-2 over the earlier games (window 2: 35 cases, window 3: 32, window 5: 42, across the 16 windows):
| Window | `New` bound (points) | New linemates tagged New | Old linemates tagged Fading or Out | New among all displayed EV rows |
|--------|----------------------|--------------------------|-------------------------------------|----------------------------------|
| 2 | < 5 | 39% | 99% | 7.7% |
| 2 | < 10 | 51% | 99% | 9.9% |
| 2 | < 20 | 67% | 99% | 16.6% |
| 5 | < 5 | 38% | 75% | 5.8% |
| 5 | < 10 | 61% | 75% | 8.8% |
| 5 | < 20 | 79% | 75% | 13.0% |
Every other genuinely new linemate is tagged Rising (delta >= 15), never untagged: new-linemate tag mix at window 5 and bound 5 = New 32, Rising 38, none 11, Fading 3. The reason is the baseline overlap above; "little or none" cannot mean literally under 5 points on real lines. Recommendation: `LINEMATE_NEW_EARLIER_MAX_POINTS = 10`. In the same cases the new linemates were inside the default cap 100 percent of the time and the old linemates 83 to 94 percent of the time. For the SC4 test, use a clean synthetic fixture (earlier overlap about 0), not live data, and say so in the test name.

**Q3e: what the cap hides (window 5, EV).** Mean rows shown with the default cap: 9.4. Hidden by the cap: 335 of 1,259 change tags (27 percent) and 192 of 198 Out tags (97 percent), because Out linemates have zero recent time and sort last (D-12). Exempting rows tagged New/Rising/Fading from the cap raises the mean to 10.5 rows (max 16). This is optional and touches D-11/UI-SPEC wording; planner default is the UI-SPEC behaviour, with this as a flagged decision (Open Question 5).

## Next.js 16 Specifics

- **`searchParams` is a Promise.** `searchParams: Promise<{ [key: string]: string | string[] | undefined }>` and it is awaited in the page already (`page.tsx:24` and `:29`). Using it makes the page dynamic. [CITED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md, lines 67-120]. Nothing changes for this phase; keep array-valued params to the default.
- **Hash scroll mechanism (read in source, then proven in a browser).** `navigation.js:467-473`: `scrollBehavior !== _routerreducertypes.ScrollBehavior.NoScroll && url.hash !== '' ? decodeURIComponent(url.hash.slice(1)) : oldState.focusAndScrollRef.hashFragment` sets the hash target; `layout-router.js:130-138` resolves it with `document.getElementById(hashFragment) ?? document.getElementsByName(hashFragment)[0] ?? null`; `layout-router.js:196-199` scrolls with `domNode.scrollIntoView()`, which honours CSS `scroll-margin-top` ([CITED: link.md line 972]). A missing target is a handled no-op (`layout-router.js:160-164`). The default case only scrolls when the navigation creates new route segments (`navigation.js:440-451` comment: "a refresh where the route structure didn't change" leaves scroll alone).
- **Scratch-app experiment** (copy of `PendingLink` with `prefetch={false}`, a `#player-detail` link per row, `scroll-mt-4` section; Next dev 16.3.4; Playwright WebKit 2336 and Chromium 1234; both engines gave identical results):
  | Action | Result |
  |--------|--------|
  | First open from a far-down row (scrollY 1720) | panel top at 16 px (scroll-mt-4 respected) |
  | Click a different far-down name | jumps, panel top 16 px |
  | **Re-click the same name (URL identical including `#player-detail`)** | **no jump** (panel top stayed at -1218 px) |
  | Click a tab/sort-style link with `scroll={false}` while scrolled | scrollY unchanged |
  | After a tab click (URL has no hash), re-click the same name | jumps (hash-only change is force-scrolled, `navigation.js:420-433`) |
  | Fresh load of a shared URL with `#player-detail` | native browser jump to the panel |
  | Back after player A -> player B | URL and rendered player both restore (in dev a read 700 ms after Back still showed the old player; after 2.5 s it was correct, so wait for the re-render in any automated check) |
  | Native `<a href="#player-detail">` as the selected player's name, clicked repeatedly | jumps every time, including with the hash already in the URL |
  So the UI-SPEC sentence "clicking the selected player's own name ... re-jumps to the panel" is false for a `PendingLink`. Recommended fix: render the selected player's own name (only) as a plain `<a href="#player-detail" aria-current="true">`; it has no pending state to show anyway. Everything else in the UI-SPEC link contract holds as written (default scroll for name links, `scroll={false}` for tab/close/show-all/sort links).
- **PendingLink and prefetch off.** `PendingLink` spreads props onto `Link` after `prefetch={false}` (`PendingLink.tsx:27`), so a hash in `href` does not change prefetch behaviour; with prefetch disabled `useLinkStatus` shows the spinner for the whole server render. The hash is not sent to the server. No change to `PendingLink` is needed. [VERIFIED: component read; behaviour exercised in the scratch app]
- **`page.tsx` export allowlist.** The generated type check rejects any export not in `default`, `config`, `generateStaticParams`, `instant`, `prefetch`, `unstable_dynamicStaleTime`, `revalidate`, `dynamic`, `dynamicParams`, `fetchCache`, `preferredRegion`, `runtime`, `maxDuration`, `metadata`, `generateMetadata`, `viewport`, `generateViewport` ([VERIFIED: node_modules/next/dist/build/webpack/plugins/next-types-plugin/index.js:45-69]). `UnitTable` and `LastGameLines` are non-exported functions in `page.tsx` today, so they cannot be imported by a test or by a shared link component without moving them (Pitfall 2).
- **Dev server side effect:** `next dev` regenerates `AGENTS.md`/`CLAUDE.md` in its working directory (it did so in the scratch app). Run any dev server for Phase 2 checks in a scratch copy, as `webkit-strip-check.cjs` does, to avoid dirtying the repo.

## Common Pitfalls

### Pitfall 1: Using the OT-inclusive `playerSeconds` as the share denominator
**What goes wrong:** Shares in OT games are understated, and PP/SH denominators include OT penalty time while the numerators are regulation only.
**How to avoid:** Take the denominator from `pairs.self[situation]` only. Test: in a fixture with an OT shift, `share <= 1` and `self` excludes the OT seconds.
**Warning signs:** `self != playerSeconds` in a non-OT game (never happens; use as an assertion in a live smoke).

### Pitfall 2: Linking names from `UnitTable` while it is a private function in `page.tsx`
**What goes wrong:** A test cannot render it and a shared link component cannot be imported; exporting it from `page.tsx` fails the generated type check (Next.js Specifics).
**How to avoid:** Move `LastGameLines`/`UnitTable` to `components/` (server components) in the same plan that adds the links, and cover the unchanged Time and `%` cells with a markup test (criterion 5).

### Pitfall 3: `ResearchGame.pairs` as a required field breaks the type check of an existing test
**What goes wrong:** `tsconfig.json` includes `**/*.ts`, so `next build` and `tsc --noEmit` also type-check test files; `fixtureGame(...): ResearchGame` in `lib/research/toi-trends-view.test.ts:17` lacks the field.
**How to avoid:** Make the field required (so production code cannot forget it) and add `pairs: null` (or a real fixture) to that one `fixtureGame`; the spread-based builders in the same file (`stripGames`, `moverGames`, the `otNoChart` case) inherit it, and `toi-trends.test.ts` uses the structural `TrendGame` type, which does not include `pairs`. Gate: `node_modules/.bin/tsc --noEmit` (baseline clean, about 3 s).

### Pitfall 4: Tags look like a signal but fire on a third of rows
**What goes wrong:** UAT reads "everything is Rising or Fading".
**How to avoid:** Keep the thresholds as exported named constants so one edit retunes; show the legend line; if UAT objects, first try ±20.

### Pitfall 5: Recent-first ordering plus the cap hides Out and some Fading
**What goes wrong:** An injured regular linemate (recent time 0) sorts last and is capped away; 97 percent of Out tags are hidden at window 5 EV.
**How to avoid:** Decide Open Question 5; whichever way, the "Showing n of total" line and `?all=1` must work and be tested.

### Pitfall 6: Re-clicking the selected name appears dead
**What goes wrong:** A `PendingLink` to an identical URL does nothing visible (verified).
**How to avoid:** Native anchor for the selected name (Next.js Specifics).

### Pitfall 7: 38 percent of this season's games have no shift chart
**What goes wrong:** Heat strips full of amber dashed squares, tags unavailable, and UAT on a random team looks broken. Also every tab/sort click re-requests each empty-chart game uncached (`getShiftCharts` re-fetches an empty result with `cache: "no-store"`, `client.ts:149-152`), so a Last-20 window with several empty charts adds uncached requests per click (small, no 429s seen at this scale).
**How to avoid:** Pick UAT teams/windows with charts (check first); keep the amber footnote; make the "all games lack charts" empty state reachable in a test.

### Pitfall 8: Mixing "linemate absent" into the denominator
**What goes wrong:** A linemate out 2 of 5 games reads as 60 percent of what he is when healthy, and a returning player compares against an earlier share of 0.
**How to avoid:** Pool only over counted games (Pattern 3). This is the UI-SPEC state-table reading; D-09's text ("across the games the player played") is looser (Open Question 1).

### Pitfall 9: Popover dismiss class must win the CSS cascade
**What goes wrong:** `group-data-[dismissed]/cell:hidden` loses to `group-hover/cell:block` if the stylesheet order is the other way round.
**Verified (compiled with the repo's Tailwind 4.3.3):** generated order is `group-hover/cell:block` (inside `@media (hover: hover)`), then `group-focus-visible/cell:block`, then `group-data-[dismissed]/cell:hidden`, then `group-data-[open]/cell:block`, all at equal specificity. So dismissed beats hover and focus-visible, and a pinned popover (`data-open`) beats dismissed, which is why Escape must also unpin (`nextOpen` already returns `false` for `escape`, `ToiStripCell.tsx:9-11`). Pin it with a markup test on the class string, and re-verify in the WebKit check because the order is a property of this Tailwind version.

### Pitfall 10: Shade rendered on the popover's parent
**What goes wrong:** Opacity on the square fades the popover child.
**How to avoid:** Fill on an inner element with inline `opacity` (UI-SPEC:95), exactly as `ToiGameStrip.tsx` does today.

### Pitfall 11: New tests outside `lib/research/` are not run by `npm test`
**What goes wrong:** the script is `tsx --test lib/**/*.test.ts` (`package.json:10`); under `sh` without globstar, `**` matches one directory level, so only `lib/<dir>/*.test.ts` run.
**How to avoid:** Put every new test directly under `lib/research/`, including the component markup test (`toi-trends-view.test.ts` sets the precedent by importing components from there).

### Pitfall 12: Editing the auth-gate lines breaks the WebKit script
`webkit-strip-check.cjs` removes exactly three lines (`import { auth } from "@/auth";`, `const session = await auth();`, `if (!session?.user) redirect("/login");`) from a scratch copy of `page.tsx` and aborts with "auth gate changed" if any differ. Keep them byte-identical, or update the new script's `GATE_LINES`.

### Pitfall 13: A dressed player with no counted game
`buildTrendRows` includes players who dressed in games that lack charts; their strip is all `unknown`/`absent` and tags are unavailable. The empty-state precedence must be: all games lack charts, then no situation time, then below minimum (UI-SPEC States table).

## Code Examples

### Parsing the new params (modelled on `parseSort`)
```typescript
// toi-trends.ts (additions). Allowlist, not validation after the fact (T-01-06/T-01-07).
export function parsePlayer(value: unknown): number | null {
  return typeof value === "string" && /^\d{1,10}$/.test(value) ? Number(value) : null;
}
export function parseSit(value: unknown): Situation {
  return value === "pp" || value === "sh" ? value : "ev";
}
export function parseAll(value: unknown): boolean {
  return value === "1";
}
```

### Cell state, share, shade
```typescript
export function linemateOpacity(share: number): number {
  return 0.2 + 0.8 * Math.min(1, Math.max(0, share / LINEMATE_SHADE_SATURATION_SHARE));
}
```

### Tag rule (the whole decision, pure)
```typescript
function tagFor(recentPts: number, earlierPts: number): "New" | "Rising" | "Fading" | null {
  const delta = recentPts - earlierPts;
  const crossing = deltaCrossing(delta, LINEMATE_TAG_POINTS);
  if (crossing === 1) return earlierPts < LINEMATE_NEW_EARLIER_MAX_POINTS ? "New" : "Rising";
  return crossing === -1 ? "Fading" : null;
}
```

### Link to a player (hash only on name links)
```typescript
// Built only from validated values; the hash is a constant.
export const playerHref = (...args: Parameters<typeof researchHref>) => `${researchHref(...args)}#player-detail`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous `searchParams` | `Promise` prop, `await` | Next 15 (still a Promise in 16.3.4) | Already handled in `page.tsx` |
| Per-view derived-stat cache | None (7 ms/game, Data Cache holds the raw feeds) | ARCHITECTURE.md decision, re-measured this session | No `unstable_cache`, no Neon table |
| Whole-row click targets | Name-only link (D-02) | Phase 2 context | Avoids `<a>` around `<tr>`, no `after:` overlay trick |

**Deprecated/outdated in the project research:** ARCHITECTURE.md Pattern 5 says to use `scroll={false}` for the row links; CONTEXT D-03 reverses that (jump to the panel), which is why the `#player-detail` hash is needed. ARCHITECTURE's `timeline.ts` extraction is not needed for Phase 2; it may come with Phase 3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Window and recent/earlier shares are pooled (sum of together over sum of the player's seconds), not a mean of per-game shares | Pattern 3 | Slightly different numbers; consistent with Phase 1 PP share pooling but UI-SPEC does not say |
| A2 | `LINEMATE_NEW_EARLIER_MAX_POINTS = 10` | Pattern 3, Real-Data Validation | If the user wants stricter "New", lower it; tags Rising instead of New for more linemates |
| A3 | Window share excludes games where the linemate did not dress (UI-SPEC state table), not D-09's looser "across the games the player played" | Pitfall 8, Open Question 1 | Injured-linemate shares would differ; needs user confirmation |
| A4 | Out = linemate dressed in none of the recent-part team games; a linemate with no counted recent game but who did dress gets no tag | Pattern 3 | Edge-case tag differs from what the user imagines |
| A5 | When the player has no counted game in the earlier part, tags are unavailable with a third footnote reason | Pattern 3, Open Question 2 | UI-SPEC lists only two reasons; copy for the third is new |
| A6 | The validation sample (8 teams, 120 unique games, early 2026-27 plus late 2025-26 including playoffs) represents the live season; rates may drift mid-season | Real-Data Validation | Firing rates and cap hit rates are approximate |
| A7 | NHL boxscore groups skaters by listed position, so position-group changes inside a window stay near zero | Real-Data Validation | If wrong, D-21 matters more; `groups` is stored per game, so the code is already correct either way |
| A8 | The Tailwind rule order that makes `data-dismissed` win holds for 4.3.3 only | Pitfall 9 | A Tailwind upgrade could reorder; the markup test and the WebKit check catch it |
| A9 | The `package.json`/`package-lock.json` changes in `git status` come from the GSD installer, not from this research | Package Legitimacy Audit | If they are someone's real change, they were still not made here |

## Open Questions (RESOLVED)

1. **Window-share denominator when the linemate missed games.**
   - **RESOLVED: UI-SPEC reading — CONTEXT D-25 (user, 2026-10-12).**
   - What we know: UI-SPEC's `absent` state excludes those games "from shares and tags"; D-09 text says "across the games the player played".
   - What's unclear: whether a linemate out 2 of 5 games should read as his share when healthy (UI-SPEC) or diluted (D-09 literal).
   - Recommendation: UI-SPEC reading (Pattern 3). Confirm with the user in plan review; cheap to flip.
2. **Tags when the player has no counted earlier game** (e.g. he joined or returned inside the recent part).
   - **RESOLVED: no tags plus the footnote — confirmed by the user in plan review (2026-10-12).**
   - What we know: D-15 says "at least 2 games played", D-18 only covers missing recent games.
   - What's unclear: there is nothing to compare with.
   - Recommendation: tags unavailable, footnote `No tags: {name} has no earlier games in this window to compare with.` Add to the copy table.
3. **Does a returning-from-injury linemate count as New?** Under the rule earlier = 0 for a linemate with no counted earlier games, so yes if recent share >= 15 points. It cannot be told apart from a new acquisition using time-together alone, and it is a real change in who the player skates with. Recommendation: accept it and keep the UI-SPEC `title` copy.
   - **RESOLVED: a returning linemate with real recent time is New — confirmed by the user in plan review (2026-10-12).**
4. **±15 fires on about a third of rows.** D-16 locks 15. Recommendation: ship 15 as a single constant; if UAT finds it noisy, 20 drops it to about a quarter of rows.
   - **RESOLVED: keep ±15 — CONTEXT D-27 (user, 2026-10-12).**
5. **Cap versus change tags.** Option: exempt New/Rising/Fading rows from the cap (mean +1.1 rows, max 16). Default: UI-SPEC behaviour. The user decides in plan review.
   - **RESOLVED: tagged rows bypass the cap — CONTEXT D-26 (user, 2026-10-12).**
6. **Selected-name behaviour.** Recommendation: native anchor for the selected name (jumps every time, verified). Deviation from UI-SPEC's "PlayerLink everywhere" wording, same intent.
   - **RESOLVED: plain `#player-detail` anchor for the selected name — confirmed by the user in plan review (2026-10-12).**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, dev server | yes | v24.21.0 | — |
| tsx | `npm test` | yes | 4.23.13 | — |
| TypeScript (`tsc`) | type gate | yes | ^5 (clean baseline) | — |
| Playwright core + WebKit 2336 + Chromium 1234 | browser backstop checks | yes | npx cache `e41f203b7505f1fb`, `~/Library/Caches/ms-playwright` | skip the browser script and do manual UAT |
| Public NHL APIs (`api-web.nhle.com`, `api.nhle.com/stats`) | live smoke / browser check | yes (no 429 with 250 ms spacing) | — | recorded hand fixtures for unit tests |
| Database / Discord auth | the page's auth gate | not needed for tests; the browser script strips the gate in a scratch copy | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` via tsx 4.23.13; markup tests use `react-dom/server` `renderToStaticMarkup` in `.ts` files |
| Config file | none (script in `package.json:10`: `tsx --test lib/**/*.test.ts`) |
| Quick run command | `node_modules/.bin/tsx --test lib/research/pair-seconds.test.ts lib/research/linemates.test.ts lib/research/player-detail-view.test.ts` |
| Full suite command | `npm test` (188 tests, under 1 s today) then `node_modules/.bin/tsc --noEmit` (about 3 s) and `npm run lint` |
| Browser backstop | new `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`, patterned on `webkit-strip-check.cjs`, desktop context only (no touch, per the laptop-browser rule) |

### Phase Requirements to Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC5 / D-19 | `analyzeGameLines` outputs unchanged after extracting `bucketOnIce` | unit (existing) | `node_modules/.bin/tsx --test lib/research/lines.test.ts` | yes, must pass untouched |
| PLYR-02, PLYR-03 / D-19 | pair pass: symmetric, `together <= self`, regulation only (OT shift ignored, multi-OT ignored), EV/PP/SH split equals the existing fixture, duplicate rows once, goalie excluded, pulled-goalie second is EV, touching shifts do not overlap | unit | `... pair-seconds.test.ts` | no, Wave 0 |
| Oracle | `self == lines.playerSeconds` for a non-OT fixture; `self <= playerSeconds` with OT | unit | `... pair-seconds.test.ts` | no, Wave 0 |
| PLYR-02 / SC5 | cell states `together/apart/absent/unknown`; absent reasons; unknown never 0 and excluded from share | unit | `... linemates.test.ts` | no, Wave 0 |
| PLYR-03 | per-game share, pooled window share, `—` when no counted games, share <= 1 | unit | `... linemates.test.ts` | no, Wave 0 |
| PLYR-02 / D-11,12,13,21 | minimum filter, ordering (recent then total then id), caps per situation, `all` lifts cap not minimum, group split, group-played-most with tie to latest | unit | `... linemates.test.ts` | no, Wave 0 |
| PLYR-04 / SC4 | tag matrix: clean line change in the latest game at windows 2, 3, 5 gives New on the new linemates and Fading on the old; Rising/Fading boundary at exactly 14/15 rounded points; Out; returning linemate; trade (D-20); 1-game window; player played fewer than 2; missed all recent (D-18); no earlier games | unit | `... linemates.test.ts` | no, Wave 0 |
| PLYR-01 | `parsePlayer` / `parseSit` / `parseAll` (arrays, `__proto__`, 11 digits, empty, `007`); `researchHref` default output byte-identical; extras omit defaults; team links drop player and all, window links keep player and sit | unit | `node_modules/.bin/tsx --test lib/research/toi-trends.test.ts` | extend existing |
| PLYR-01 / D-02, D-06 | trends name cell is a link to `...&player=ID#player-detail`; selected row has `aria-current`, sr-only Selected, neutral bar; other cells unchanged; existing header and tint assertions still pass | markup | `... toi-trends-view.test.ts` | extend existing |
| UNIT-04 / D-22 | `UnitTable` names are links with the table's `sit`; separators stay ` – `; Time and `%` cell text identical to before | markup | `... player-detail-view.test.ts` | no, Wave 0 |
| PLYR-02 / D-07, D-10, D-13 | panel: tabs with `aria-current` on the active one; one `[data-state]` square per game per row; forwards block before defense; legend; show-all line; empty-state copy for each States row; no Tag column and no Δ stats at window 1 | markup | `... player-detail-view.test.ts` | no, Wave 0 |
| SC5 / D-24 | unknown square: `data-state="unknown"`, amber dashed classes, amber footnote lists dates, no `0:00` or `0%` anywhere in the strip | markup | `... player-detail-view.test.ts` | no, Wave 0 |
| WR-10 | `nextOpen` plus dismissed transitions; popover class string pinned (hover, focus-visible, `data-open`, `data-dismissed`); no `aria-expanded` | unit + markup | `... toi-trends-view.test.ts` | extend existing (`nextOpen` is already tested there) |
| Types | adding `pairs` and the widened state type compiles with all fixtures | typecheck | `node_modules/.bin/tsc --noEmit` | exists |
| SC1 / D-03, D-04 | click a far-down name: URL gets `?player=`, panel at the scroll-margin offset, Back restores, reload and shared URL show the same player; tab click keeps scrollY | browser | `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs` | no, Wave 0 (backstop, UI-SPEC row) |
| SC2 | squares are separate, at least 20x20 with at least 24 px pitch, popover opens on hover, focus and click, not clipped on the last forward and defense rows at Last 20 | browser | same script | no, Wave 0 (backstop) |
| WR-10 | Escape hides the popover and focus stays on the square; outside pointerdown unpins | browser | same script | no, Wave 0 |
| Dark mode | shades distinguishable, selected-row bar visible on green and red rows | manual (UAT) | `colorScheme: "dark"` screenshots | manual |
| Live oracle | the three invariants on one real game | one-off smoke | a throwaway `tsx` script run during verification, not in CI | no |

### Sampling Rate
- **Per task commit:** the quick run command (under 5 s) plus `node_modules/.bin/tsc --noEmit`.
- **Per wave merge:** `npm test`, `tsc --noEmit`, `npm run lint`.
- **Phase gate:** full suite green, the browser script green (or its failures triaged), then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `lib/research/pair-seconds.test.ts`: fixtures reuse the BUF/OPP layout from `lines.test.ts` (positions map, `shifts()` helper); add an OT shift and a 2OT shift.
- [ ] `lib/research/linemates.test.ts`: hand-built `ResearchGame`-shaped inputs (structural type, like `TrendGame`), no network.
- [ ] `lib/research/player-detail-view.test.ts`: renders `PlayerLinemates`, `PlayerLink`, `UnitTable`.
- [ ] Update `fixtureGame` in `toi-trends-view.test.ts` for the new required field.
- [ ] `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`: copy the harness (scratch copy, gate-line strip, port, check/out helpers) and replace the checks; pick the player from the page DOM, not a hard-coded id; drop the iPhone context.
- [ ] Framework install: none.

## Security Domain

`security_enforcement` is enabled (absent means enabled; `config.json` has `"security_enforcement": true`, `"security_asvs_level": 1`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | The page's existing `auth()` gate; do not touch (`page.tsx:26-27`) |
| V3 Session Management | no new surface | NextAuth, unchanged |
| V4 Access Control | no new surface | Same single-user, signed-in page; no per-record ownership |
| V5 Input Validation | yes | Allowlist parsers for `player` (digits only, at most 10), `sit` (3 values), `all` (`"1"`); `player` must also resolve to a loaded skater, and never reaches a fetch path; hrefs built only from validated values |
| V6 Cryptography | no | none |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Query-param tampering (`player=../`, array params, `__proto__`) | Tampering | Parsers return defaults for arrays and non-matching strings; no raw param is interpolated into an href or a fetch |
| Reflected content | Information disclosure / XSS | The raw `player` value is never rendered; names come from the NHL feed and are rendered as React text and attribute values (escaped); no `dangerouslySetInnerHTML` |
| Open redirect via href | Spoofing | Hrefs are same-origin relative paths built by `researchHref`; the hash is a constant |
| Resource exhaustion via `all=1` or large windows | Denial of service | `all` only lifts a cap bounded by roster size (about 25 skaters); window sizes stay on `GAME_COUNTS = [1, 3, 5, 10, 20]` (`page.tsx:12`) |
| Upstream feed shape drift (NHL API is undocumented) | Tampering / availability | `null` pairs for games without usable data; pure functions tolerate missing players (`?? 0` only where "no time" is the truth, never to hide unknown) |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `lib/research/{lines,team-games,toi-trends,game-strip,format}.ts`, `lib/research/{lines,toi-trends-view,toi-trends,game-strip}.test.ts`, `lib/nhl/client.ts`, `components/{ToiTrends,ToiGameStrip,ToiStripCell,PendingLink}.tsx`, `app/research/page.tsx`, `package.json`, `tsconfig.json`, `.planning/config.json`, phase and project planning documents listed in the task, `01-REVIEW-DISPOSITION.md`, `webkit-strip-check.cjs`.
- Next.js 16.3.4 source and docs: `node_modules/next/dist/client/components/segment-cache/navigation.js` (lines 367-475), `layout-router.js` (126-238), `build/webpack/plugins/next-types-plugin/index.js` (40-70), `docs/01-app/03-api-reference/02-components/link.md` (230-236, 687-702, 847-972), `.../03-file-conventions/page.md` (67-120).
- Executed this session: scratch prototype (`pairSeconds`, linemate view-model, tag rules) over 131 cached game loads; benchmark; Tailwind 4.3.3 `compile()` of the popover variants; scratch Next app driven by Playwright WebKit and Chromium; `npm test` (188 pass) and `tsc --noEmit` (clean).
- Live NHL API data, fetched 2026-10-12: `api-web.nhle.com/v1/club-schedule-season/{TEAM}/{season}`, `/gamecenter/{id}/boxscore`, `api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={id}` for TOR, MTL, EDM, BOS, COL, NYR, VGK, CHI, BUF.

### Secondary (MEDIUM confidence)
- `.planning/research/{ARCHITECTURE,PITFALLS,FEATURES}.md` (project research; the pair-time design and Pitfalls 18-19 were re-checked against the measurements above and hold).

### Tertiary (LOW confidence)
- None used. The `research-plan`/`research-store` seam and external search providers were not needed: no library was added and every claim is backed by code or an executed experiment in this repository's own stack.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new; versions read from disk.
- Architecture: HIGH, the seam was prototyped against real games and the invariants hold.
- Pitfalls: HIGH for the mechanical ones (type check, glob, page exports, scroll, CSS order); MEDIUM for the tuning observations (sample size, early season).

**Research date:** 2026-10-12
**Valid until:** 2026-11-12 (the constants should be re-checked mid-season; the Next.js and Tailwind behaviours hold until either is upgraded)
