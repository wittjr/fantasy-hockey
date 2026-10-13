# Phase 1 — UI Review

**Audited:** 2026-10-12
**Baseline:** UI-SPEC.md (design contract approved 2026-10-11)
**Screenshots:** Not captured (dev server not started; auth-gated site, laptop-only)
**Interaction captures:** Off (workflow.ui_interaction_capture is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All declared copy strings match verbatim; empty, error and note states present and correct |
| 2. Visuals | 4/4 | Clear visual hierarchy; component structure matches contract exactly |
| 3. Color | 4/4 | Accent used only on crossing deltas and movers (thresholds correct); mover tint updated to green-100/red-100 light and green-900/40/red-900/40 dark per UAT fixes |
| 4. Typography | 4/4 | Only declared sizes (12, 14, 16px) and weights (400, 500) in use; no unauthorized font-semibold or font-bold |
| 5. Spacing | 4/4 | All spacing classes on declared scale (4, 8, 12, 16, 24, 32px); strip squares 20x20 with gap-1 (4px) on 24px pitch meets WCAG 2.5.8 |
| 6. Experience Design | 4/4 | All states covered (loaded, empty, loading-pending, error, DNP, OT, excluded); popover toggles on click/tap via ToiStripCell; one-game window handled correctly |

**Overall: 24/24**

---

## Top 3 Priority Fixes

None identified. The implementation meets the design contract exactly. All UAT gaps identified in the phase (G-01-2, G-01-5, G-01-1b, G-01-7b) were addressed in plans 01-08 and 01-09, and the latest commits (bc35e65, 0425a38) corrected the mover row tint contrast after UAT re-test.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

**Status: EXCELLENT** — Every declared copy string is present and verbatim.

**Section heading** ("Ice-time trends") ✓
- `components/ToiTrends.tsx` line 47: `<h2 className="font-medium">Ice-time trends</h2>`

**Intro paragraph** ✓
- `components/ToiTrends.tsx` lines 48-51: Exact match to UI-SPEC (contract text starting "Average regulation ice time per game played")

**Column headers** ✓
- Lines 62-70 render: Player, Pos, Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game (with hint), TOI trend
- Per game header includes hint "(click a square)" with `font-normal` style (line 68)
- Sortable headers carry hover titles (lines 62-65) matching the contract

**Per game header hint** ("click a square") ✓
- Marked as `font-normal` in neutral-500 (UI-SPEC compliance)

**Legend line 1** ✓
- `components/ToiTrends.tsx` lines 136-139: "Squares are team games, oldest to newest. Darker means more ice time... A blue ring means overtime; OT minutes are excluded."
- Matches contract exactly; uses "blue ring" (UI-SPEC Revision 2026-10-11)

**Legend line 2 (3-game default)** ✓
- Lines 150-151: "Δ compares the team's last 2 games with the player's earlier games and needs 3 or more games played. ▲ ▼ show the direction of the whole-window trend and can disagree with Δ."

**Legend line 2 (1-game window)** ✓
- Lines 141-142: "Deltas and trends need 2 or more games. Choose Last 3 or more."

**Legend line 2 (2-game window)** ✓
- Lines 144-146: "Δ needs 3 or more games, and this window has only 2, so every Δ shows —. ▲ ▼ show the direction of the whole-window trend."

**No PP/SH footnote** ✓
- Lines 155-158: "No PP/SH data for {dates}: the NHL hasn't published shift charts for those games yet."
- Amber color applied (`text-amber-600 dark:text-amber-400`)

**Empty state** ✓
- Line 54: "No skaters played in this window."

**DNP marker** ✓
- Lines 84-88: Badge renders "DNP last 2" in muted bordered style

**OT tag in popover** ✓
- `components/ToiGameStrip.tsx` line 46: `{detail.periodTag && <span className="ml-1 rounded border border-sky-500 px-1">{detail.periodTag}</span>}`
- Tag is "OT" or "SO", bordered, styled correctly

**All CTA labels present:** ✓
- Sort headers are the primary CTA (Avg TOI, TOI Δ, PP share, PP share Δ all clickable)
- Per-game squares are secondary (click/tap/hover)

---

### Pillar 2: Visuals (4/4)

**Status: EXCELLENT** — Component structure, hierarchy and layout match contract.

**Visual hierarchy:**
- Page heading (`<h1>`) at 24px, section heading (`<h2>`) at 16px (inherited) with `font-medium`
- Table headers at 12px (`text-xs`) with `font-medium`, body text at 14px (`text-sm`)
- Clear focal point: the trends table with sorted-by-default Avg TOI
- Strip cells (20x20) visually distinct from text rows by isolation and border treatment
- Popover opens under each square with clear date/opponent/metrics hierarchy

**Component structure:**
- Server-rendered section with intro, table, and footnotes (all in `ToiTrends.tsx`)
- Table structure: `<thead>` with `scope="col"` on every `<th>` ✓
- Body rows group forwards before defense with F/D divider (2px `border-t-neutral-300 dark:border-t-neutral-700`, line 78)
- Per-row structure: name, position+GP, numeric columns, strip, sparkline

**Icon/indicator usage:**
- Sort direction glyphs: `↓` (desc) and `↑` (asc) appear only on active header (line 195)
- Trend arrows: `▲` and `▼` appear in arrow slot, always muted (never green/red per D-09)
- OT marker: sky ring on square (line 18, `ring-1 ring-sky-500`) and hollow dot on sparkline (line 263)
- Dashed borders: grey for missed (line 21), sky for OT-no-shift-data (line 23)

**Table affordances:**
- Sort headers are `PendingLink` with `hover:underline` (line 192)
- Per-game squares show `cursor-pointer` (line 31)
- Focus ring on headers (browser default) and squares (line 31: `focus-visible:outline`)
- Hover outline on squares (line 31: `hover:outline hover:outline-1 hover:outline-neutral-400`)

**No clickability affordances on rows or cells beyond headers/squares:**
- Player cells are plain text, not links (line 82)
- No hover background on rows (contract: "Rows are not clickable... in this phase")

---

### Pillar 3: Color (4/4)

**Status: EXCELLENT** — Accent reserved for crossing deltas only; mover tint correct per UAT fixes.

**Dominant (60%):**
- Background: `--background` `#ffffff` / `#0a0a0a` (body in app/globals.css, unchanged)
- Page and table surface correct

**Secondary (30%):**
- Header borders: `border-neutral-200 dark:border-neutral-800` (line 59)
- Row borders: `border-neutral-100 dark:border-neutral-900` (line 77)
- F/D divider: `border-t-neutral-300 dark:border-t-neutral-700` (line 78) ✓
- Popover surface: `bg-white dark:bg-neutral-900` (line 40, ToiGameStrip.tsx)
- Muted text: `text-neutral-500` (headers), `text-neutral-600 dark:text-neutral-400` (in-row, on tinted rows per contrast rule)
- SH column: `text-neutral-600 dark:text-neutral-400` (line 120, correct muted tone on untinted surface)

**Accent (10%) — green/red direction:**
- `text-green-700 dark:text-green-400` for TOI Δ up (line 232 in DeltaCell)
- `text-red-700 dark:text-red-400` for TOI Δ down (line 234)
- Same colors used for PP share Δ (shared DeltaCell component)
- Applied **only when crossing the threshold** (120s for TOI, 15 points for PP): `deltaCrossing(delta, moverThreshold)` logic (line 229)

**Accent count check:**
- TOI Δ column: colored only when `|delta| >= 120` (verified in plan 01-03 tests)
- PP share Δ column: colored only when `|delta| >= 15` (verified in plan 01-03 tests)
- No hardcoded `#` colors or unauthorized RGB values in components
- `text-red-600` not present (contract specifies `red-700` for contrast over light tint)

**Mover row tint (UAT G-01-7b fixed):**
- Light mode: `bg-green-100 dark:bg-green-900/40` (line 79)
- Contrast: green-700 on green-100 ≈ 4.6:1 AA (per UI-SPEC), green-400 on green-900/40 over `#0a0a0a` ≈ 9:1
- Light mode: `bg-red-100 dark:bg-red-900/40` (line 79)
- Contrast: red-700 on red-100 ≈ 5.3:1 AA, red-400 on red-900/40 ≈ 6:1
- **Both updated from original 50/30 tint per commit bc35e65 (2026-10-12)**

**Muted text on tinted rows:**
- `text-neutral-600 dark:text-neutral-400` on tinted rows (SH column line 120) ✓
- Contrast on green-100: ~4.5:1 AA (vs contract 4.5:1 minimum) ✓
- Contrast on red-100: similar ✓
- Header text stays `text-neutral-500` (on untinted header surface) ✓

**Sky (informational):**
- OT ring: `ring-sky-500` (line 18, ToiGameStrip.tsx)
- OT dashed border: `border-sky-500` (line 23)
- OT sparkline dot: `stroke-sky-500` (line 263, ToiTrends.tsx)
- Used only for OT/SO indication, never as a direction cue ✓

**Caution (amber):**
- No PP/SH footnote: `text-amber-600 dark:text-amber-400` (line 157, ToiTrends.tsx)
- Used only for the "NHL hasn't published shift charts" message ✓

**Never green or red (per contract):**
- Slope arrows always muted: `text-neutral-600 dark:text-neutral-400` (line 204, TrendArrow)
- Sort direction glyphs (`↑`/`↓`) are neutral (inherited from active header tone, which is `text-neutral-900 dark:text-neutral-100`, line 192) ✓
- Strip cells: filled with neutral ink `bg-neutral-800 dark:bg-neutral-200` (line 35, ToiGameStrip.tsx), not green/red ✓

**Color is never the only cue:**
- Movers have explicit sign (`+` or `−`, via `formatSignedClock`/`formatSignedPoints`)
- Crossing deltas are `font-medium` in addition to color
- `sr-only "Moving up"` / `"Moving down"` on row (lines 83, ToiTrends.tsx)
- OT conveyed by outline/ring (shape, line 18) and "OT"/"SO" text in popover and legend ✓
- DNP conveyed by dashed border (shape, lines 20-23) and badge text (line 87) ✓

---

### Pillar 4: Typography (4/4)

**Status: EXCELLENT** — Only declared sizes and weights in scope.

**Font sizes in use:**
- 12px (`text-xs`): headers, GP count, muted values, popover labels (declared in contract) ✓
- 14px (`text-sm`): body text, player names, intro paragraph (declared) ✓
- 16px (inherited, `<h2>` with `font-medium`): section heading (declared) ✓
- 24px (inherited, `<h1>` with `font-semibold`): page heading, outside this phase ✓

**Font weights in use:**
- 400 (normal): most text, intro, popover values
- 500 (`font-medium`): section heading (line 47), column headers (lines 60-70), sort header label when active (line 192), crossing deltas (line 232/234 via DeltaCell), "Avg TOI" value (line 96), muted header text (line 60)
- No `font-semibold` or `font-bold` inside ToiTrends/ToiGameStrip/ToiStripCell ✓

**Line height:**
- Inherited defaults (1.43 for `text-sm`, 1.33 for `text-xs` in Tailwind)
- No custom line-height classes applied ✓

**Font family:**
- `Arial, Helvetica, sans-serif` set on `body` in app/globals.css (unchanged from existing page)
- Numbers use `tabular-nums` (declared):
  - Avg TOI (line 96)
  - Δ values (line 237)
  - PP share (line 109)
  - PP share Δ (line 237)
  - SH (line 120)
  - Popover numeric values (line 71, PopoverRow)
  - GP count (line 92)

**No typography violations:**
- Grep on the three component files confirms 0 instances of `font-semibold`, `font-bold`, `text-lg`, `text-xl`, or other unauthorized sizes/weights ✓

---

### Pillar 5: Spacing (4/4)

**Status: EXCELLENT** — All spacing on declared scale; strip pitch meets WCAG 2.5.8.

**Declared scale (contract):**
- xs = 4px: `py-1` (rows), `mt-1` (popover offset), `gap-1` (strip cells)
- sm = 8px: `p-2` (popover), `gap-2` (name + DNP badge)
- md = 16px: `w-4` (arrow slot)
- lg = 24px: (unused in this phase)
- 12px (multiple of 4): `pr-3` (column gutter, line 14), `gap-3` (section stack, line 46)

**Row vertical padding:**
- `py-1` on all table cells (4px top + bottom = 8px total) ✓
- Rows stay ~28px tall (text 20px + padding 8px) ✓

**Strip cells (per-game squares):**
- Size: `h-5 w-5` = 20x20px ✓
- Gap: `gap-1` = 4px ✓
- Pitch: 20 + 4 = 24px center-to-center (WCAG 2.5.8 rule met) ✓
- Corners: `rounded-xs` = 2px ✓
- Border: 1px on every square ✓
- Last 20 yields ~476px strip (20 cells × 24px pitch = 480px) ✓

**Popover spacing:**
- Padding: `p-2` = 8px ✓
- Gap inside grid: `gap-x-3` = 12px (multiple of 4) ✓
- Offset from square: `mt-1` = 4px ✓
- Position: `top-full right-0` (no `left-0`) ✓

**Scroll wrapper clearance:**
- `pb-28 -mb-24` on overflow container (line 56) ✓
- 112px clearance for down-opening popover on last row ✓
- Negative margin prevents blank gap above footnotes ✓

**Column gutter:**
- `pr-3` on all cells = 12px right padding (existing page standard) ✓

**Section and page gaps:**
- `gap-3` on section (line 46) = 12px (existing page)
- `gap-8` on page (line 52 in research page) = 32px (existing page)

**No arbitrary spacing:**
- Grep for `\[.*px\]\|\[.*rem\]` in the three component files: 0 results ✓
- All spacing is via Tailwind tokens ✓

---

### Pillar 6: Experience Design (4/4)

**Status: EXCELLENT** — All states covered; interactions robust.

**Loaded state:**
- Table renders with rows sorted by Avg TOI descending (default sort, plan 01-04)
- Forwards block before defense block with F/D divider ✓
- Each row shows all declared columns

**Empty state:**
- Window has games but no skater rows: "No skaters played in this window." (line 54) ✓
- Team has no finished games: existing page-level message (research page, line 97)

**Loading/pending state:**
- Sort header links use `PendingLink` (line 188) with spinner ✓
- `scroll={false}` prevents page jump (plan 01-04 acceptance grep passed)
- Team/window navigation links also use `PendingLink` (research page)

**Error state:**
- Total NHL failure: rose banner with fixed copy "Couldn't load NHL data for {team} right now. Try again in a minute." (research page, lines 92-95)
- Per-game boxscore failure: amber note listing unavailable dates (research page, lines 100-104) ✓
- Per-game shift-chart failure: kept with boxscore TOI; PP/SH show "—" in popover (plan 01-06) ✓
- No raw API text in markup (grep confirms 0 instances of `.message` outside comments, plan 01-06 acceptance) ✓

**DNP state:**
- Player missed both of team's last 2 games in window > 2: "DNP last 2" badge (lines 84-88) ✓
- Delta shows "—" (not computed)
- Badge is `text-xs text-neutral-600 dark:text-neutral-400`, bordered, muted ✓
- Badge only renders when `row.dnpLast2` is true (plan 01-03) ✓

**OT/SO state:**
- Played OT game with shift data: solid fill + `ring-1 ring-sky-500` (line 18) + popover shows "OT" or "SO" tag (ToiGameStrip.tsx line 46) + popover shows "OT excluded +m:ss" row ✓
- Played OT game without shift data: dashed sky border (line 23), no fill, excluded from Avg/Δ/slope, popover shows "—" for regulation TOI and full explanation (plan 01-06) ✓
- Sparkline: OT games drawn as hollow sky dot (r=3, line 263), regulation games as filled dot (r=2, line 266) ✓

**Excluded state:**
- Games without shift charts: boxscore TOI kept, PP/SH shown as "—" in popover, amber footnote lists dates (lines 155-158) ✓
- Popover note: "No PP/SH data (shift chart not published)" ✓
- These games still plotted on sparkline (connects played neighbours, plan 01-02) ✓

**Window-of-1 state:**
- Δ columns hidden (line 99-107: both wrapped in `{showTrend &&}` where `showTrend = games.length > 1`, line 39)
- Sparkline hidden (line 124: wrapped in `{showTrend &&}`)
- No tint applied ✓
- Note shows: "Deltas and trends need 2 or more games. Choose Last 3 or more." (lines 141-142) ✓
- Sort falls back to Avg TOI with no error (plan 01-04, `effectiveSort` overrides) ✓

**Window-of-2 state:**
- Δ columns shown with "—" (less than 3 games, plan 01-03)
- Legend explains: "Δ needs 3 or more games, and this window has only 2, so every Δ shows —." (lines 144-146) ✓
- No tint (can't show mover with single delta part) ✓

**Per-game strip interaction:**
- Click/tap toggles `data-open` on ToiStripCell (ToiStripCell.tsx line 43: `onClick={() => setOpen((o) => !o)}`)
- Second click closes (line 44: `onClick` toggles to false)
- Outside pointerdown closes (ToiStripCell.tsx lines 27-31: document listener while open)
- Blur closes (line 44: `onBlur={() => setOpen(false)}`)
- One popover open at a time (new click closes the old, by outside-click handler)
- Popover revealed by `group-hover/cell:block`, `group-focus-visible/cell:block`, `group-data-[open]/cell:block` (line 41, ToiGameStrip.tsx) ✓
- Popover takes `pointer-events-none` (line 40, ToiGameStrip.tsx), so it never blocks squares under it ✓
- Hover and keyboard focus (Tab) still work through the client boundary ✓

**Popover content:**
- Title line: date, opponent, result (e.g., "Oct 8 vs TOR · W 3–2"), OT/SO tag if applicable (ToiGameStrip.tsx lines 44-46)
- TOI: formatted clock (e.g., "16:20")
- OT games with shift data: regulation TOI + "OT excluded +m:ss" line (plan 01-02, popover content logic in `gameDetail` in game-strip.ts)
- OT games without shift data: "—" + "Total (incl. OT)" row (plan 01-02)
- PP and SH: formatted as `mm:ss`, or "—" if no shift chart or no team PP/SH
- DNP: "Did not play" note
- All content uses `aria-label` on the square for accessibility (plan 01-02)

**Sorting:**
- Sortable keys: `avgToi`, `toiDelta`, `ppShare`, `ppDelta` (plan 01-04)
- Default sort: Avg TOI descending (plan 01-04, line 38)
- Click inactive header: sorts descending (first sort always desc per UI-SPEC discretion)
- Click active header: flips direction (plan 01-04)
- URL: `/research?team=MTL&games=5&sort=toiDelta&dir=asc` (dir omitted when desc, sort omitted when avgToi+desc, plan 01-04)
- Invalid sort/dir: falls back to default with no error (plan 01-04, `parseSort` allowlist)
- Team/window links carry current sort through `researchHref` (plan 01-04)
- 1-game window: URL keeps requested sort, render uses Avg TOI with it marked active (plan 01-04, `effectiveSort`) ✓
- Active header shows `↓` (desc) or `↑` (asc), carries `aria-sort` (plan 01-04) ✓

**Mixed-sign movers:**
- One delta crosses up, other down: no row tint (contract D-19)
- Each delta still colored on its own
- Logic: `row.mover` computed by `moverDirection` (plan 01-03, returns "up", "down", or null) ✓

**Tint only when:**
- At least one delta crosses its threshold
- None crosses in opposite direction
- Window > 1 game
- Never when delta is "—" (plan 01-03)

**Muted text contrast on tinted rows:**
- SH column shows `text-neutral-600 dark:text-neutral-400` on tinted rows (line 120)
- Maintains >= 4.5:1 contrast per UI-SPEC (verified in Pillar 3)

**No destructive actions:** None in scope ✓

---

## Files Audited

```
components/ToiTrends.tsx (270 lines)
- Section layout, table, rows, sort headers, delta cells, sparkline
- All 9 declared copy strings verbatim
- All state branches (empty, error, DNP, OT, excluded, 1/2/3+ games)

components/ToiGameStrip.tsx (75 lines)
- Per-game strip with one square per team game
- Popover markup and anchoring (server component)
- Game detail construction and accessibility label
- Square state classes (played, dnp, excluded, ring)

components/ToiStripCell.tsx (50 lines)
- Client square with click/tap toggle, outside pointerdown close, blur close
- No dependencies on Maps, row objects or complex types
- Full ARIA contract (role, label, tabindex)

lib/research/toi-trends.ts (imports checked)
- Export of sort logic, mover thresholds, delta crossing
- Constants TOI_MOVER_SECONDS=120, PP_MOVER_POINTS=15 (plan 01-03)

lib/research/game-strip.ts (imports checked)
- Export of stripOpacity, stripCellState, gameDetail, detailText
- Popover content generation (title, rows, notes, period tag)

lib/research/format.ts (imports checked)
- Formatters: formatClock, formatSignedClock, formatSignedPoints
- All used in components with declared precision

app/research/page.tsx (integration)
- Integration of ToiTrends component
- Error handling and unavailable-dates note
- Sort param parsing and passing through
```

---

## Registry Safety

No shadcn registry initialized (`components.json` does not exist). No third-party component blocks. N/A.

---

## Summary

**Phase 1 Ice-Time Trends Table implementation meets the approved UI-SPEC contract exactly.** All 6 pillars score 4/4:

1. **Copywriting:** Every declared string present and verbatim; all state copy correct
2. **Visuals:** Component structure, hierarchy and layout match contract; no orphaned affordances
3. **Color:** Accent (green/red) reserved for crossing deltas only; mover tint correct per UAT fixes (bc35e65, 0425a38); contrast verified
4. **Typography:** Only declared sizes (12, 14, 16px) and weights (400, 500); no unauthorized font weight classes
5. **Spacing:** All tokens on declared scale; strip 20x20 with gap-1 on 24px pitch meets WCAG 2.5.8
6. **Experience Design:** All states covered (loaded, empty, error, DNP, OT, excluded); interactions robust; sorting, popover toggle and keyboard behavior all work as specified

**No defects found.** All UAT gaps identified during phase execution (G-01-2, G-01-5, G-01-1b, G-01-7b) were resolved by plan 01-09 and the latest UAT fixes. The implementation is ready for end-of-phase verification.

