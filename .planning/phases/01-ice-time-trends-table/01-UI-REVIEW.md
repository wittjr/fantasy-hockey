# Phase 1 — UI Review (re-audit)

**Audited:** 2026-10-14
**Baseline:** 01-UI-SPEC.md (approved 2026-10-11), with later-phase changes recorded from 02-player-linemate-detail/02-UI-SPEC.md and 03-unit-event-stats/03-UI-SPEC.md
**Supersedes:** 01-UI-REVIEW.md of 2026-10-12 (24/24). That score was not supported: it predates the later edits and misses the contrast and copy drift below.
**Screenshots:** Attempted, not captured. A dev server answered on localhost:3000, but the Playwright desktop capture of `/research?team=MTL&games=10` failed. Code-only audit. Visual pillars are scored from class and markup analysis, so treat the Visuals and Spacing scores as provisional until a screenshot is taken.
**Interaction captures:** off (workflow.ui_interaction_capture is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Intro and legend match the contract, but the PP share header title, the amber no-PP/SH note and the page error banner text differ from the declared copy |
| 2. Visuals | 3/4 | Clear table hierarchy and quiet sort headers, but the nine-column table with 20 squares per row has no screenshot evidence of its density or focal point |
| 3. Color | 3/4 | Accent is limited to the Δ crossings and the mover tint, as D-18 requires; the muted dash `text-neutral-400` fails 4.5:1 on white |
| 4. Typography | 4/4 | Only 12, 14 and 16 px and weights 400 and 500 in the section; `font-semibold` and `text-2xl` appear only in the page header outside this section |
| 5. Spacing | 3/4 | Squares, gaps, popover clearance and `py-1 pr-3` follow the scale; the Pos cell adds `ml-1` on top of the literal space, so the GP count is spaced wider than the contract |
| 6. Experience Design | 3/4 | Sort, empty, error, window-1 and DNP states are handled; a window of 2 shows Δ columns that are all `—` with no contract rule for it |

**Overall: 19/24**

No pillar scores 1. No BLOCKER findings. All findings below are WARNING.

---

## Top 3 Priority Fixes

1. **Muted dashes fail contrast on white** — the `—` for missing Avg TOI, PP share, TOI Δ and PP share Δ uses `text-neutral-400` (about 2.5:1 on `#ffffff`), below the 4.5:1 AA threshold for 14 px text. The contract's own dash style is the source, so the contract needs the same fix. Fix: `text-neutral-600 dark:text-neutral-400` on the dash spans in `components/ToiTrends.tsx` (`muted` const and the `DeltaCell` dash), and update the UI-SPEC States and Color rows to match.
2. **Window of 2 renders empty Δ columns** — with two games, `showTrend` stays true, so TOI Δ, PP share Δ and TOI trend appear but every value is `—`. The contract only defines windows of 1 and 3+. Fix: either hide the Δ and trend columns when `research.games.length < MIN_GAMES_FOR_DELTA` (consistent with window 1), or add a contract row for window 2 and keep the columns. Pick one and record it in UI-SPEC.md.
3. **Copy drifts from the declared contract** — (a) the amber note reads "no shift chart is available for those games (not published yet, or it failed to load)" where the contract reads "the NHL hasn't published shift charts for those games yet"; (b) the PP share header title says "in the games he played" where the contract says "over the window"; (c) the page error banner reads "Try again in a minute." and omits `{error}` from the contract's "Couldn't load NHL data for {team}: {error}". Fix: align the strings in `components/ToiTrends.tsx` and `app/research/page.tsx`, or amend the contract if the wording change was intentional.

---

## Intentional Later Changes (not phase-1 drift)

These differ from 01-UI-SPEC.md on purpose. Each is traced to a later contract.

- **Player name is a link, selected-row bar, `pl-2` first column, `Selected` sr-only text** — 02-UI-SPEC.md, Component Contract row `ToiTrends`: "Name cell becomes `PlayerLink`; `pl-2`... selected-row bar".
- **Sort-header hrefs keep `player`, `sit`, `all`** — 02-UI-SPEC.md Interaction, "Sort header links keep player, sit and all".
- **Strip square is `role="button"`, not `role="img"`** — 02-UI-SPEC.md, `ToiStripCell` change: "Keep `role="button"`, `tabIndex={0}` and `aria-label`". Phase 1 specified `role="img"`; phase 2 replaced it.
- **Escape dismisses the popover (`data-dismissed`, `group-data-[dismissed]/cell:hidden`), `aria-expanded` absent** — 02-UI-SPEC.md, WR-10 behaviour.
- **Popover moved into `StripPopover` and shared with the linemate strip** — 02-UI-SPEC.md allows this; class string unchanged.
- **Popover shell class string** matches the phase-1 contract plus the phase-2 `group-data-[dismissed]/cell:hidden` addition.

Phase 3 does not alter the Ice-time trends table, the strip or the sparkline. Its unit tables sit in a different section.

---

## Pillar Detail

### Pillar 1: Copywriting (3/4)

Matches the contract:
- Heading `Ice-time trends`, intro paragraph, legend lines 1 and 2 (`ToiTrends.tsx`, footnotes block).
- Header labels `Player`, `Pos`, `Avg TOI`, `TOI Δ`, `PP share`, `PP share Δ`, `SH`, `Per game (click a square)`, `TOI trend`.
- `No skaters played in this window.` empty copy.
- Window-1 note `Deltas and trends need 2 or more games. Choose Last 3 or more.`
- DNP marker `DNP last 2`; OT and SO tags are rendered from `periodTag`.

Drift:
- PP share header `title` reads "in the games he played"; contract reads "over the window" (`ToiTrends.tsx`, SortHeader PP share).
- Amber note wording differs (see Top Fix 3).
- Page error banner (`app/research/page.tsx:95`) omits `{error}` and differs in the second sentence.
- Window-2 footnote ("Δ needs 3 or more games, and this window has only 2...") is not in the contract. It is reasonable, but it is undeclared copy.

### Pillar 2: Visuals (3/4)

- Focal point is the Avg TOI column and the strip. Sort headers are quiet (no icon on inactive headers), and the active header uses `↓`/`↑`, keeping `▲▼` for trend arrows, as the contract requires.
- Icon-only controls: none. The strip squares carry `aria-label`.
- The table has nine columns, and each row carries 20 squares at 24px pitch. That density is the thing the user complained about, and the code cannot show whether it reads cleanly. Score held at 3 until a screenshot exists.
- Sparkline is 80x20 and `aria-hidden`, which is fine because the delta columns carry the same signal.

### Pillar 3: Color (3/4)

Compliant:
- Accent green/red is used only on Δ values that cross 120 s or 15 points (`DeltaCell` tone) and on the row tint (`bg-green-100` / `bg-red-100` with dark pairs). Trend arrows are neutral (`text-neutral-600`). Sort indicators are neutral. This matches D-18 and D-09.
- Mixed-sign movers get no tint (`moverDirection` in `lib/research/toi-trends.ts`).
- OT uses shape and `sky-500`, with a hollow dot in the sparkline and a dashed cell outline. Color is not the only cue.

Findings:
- **WARNING:** Muted dash `text-neutral-400` (light) is about 2.5:1 on white, below AA for text. The dark pair `neutral-500` is about 4.2:1 on `#0a0a0a`, also below 4.5:1, so both themes need the fix.
- **WARNING:** Strip fill is `bg-neutral-800` at opacity 0.2 to 1.0. The minimum 0.2 fill is faint against the page. The contract exempts it from the 3:1 rule, so this is low-severity.

### Pillar 4: Typography (4/4)

- Section uses `text-sm` (body, 14 px), `text-xs` (labels, 12 px) and `font-medium` on the heading and active sort header. The `Per game` parenthetical is `font-normal`. No other sizes or weights.
- `text-2xl font-semibold` on the page `<h1>` and `font-semibold` on the team and window nav are outside the section and unchanged from the contract.
- Numeric columns use `tabular-nums` and right alignment.

### Pillar 5: Spacing (3/4)

Compliant:
- Cells `py-1 pr-3`; squares `h-5 w-5` with `gap-1` (24px pitch); popover `mt-1 p-2`; `pb-28 -mb-24` on the scroll wrapper; arrow slot `ml-1 w-4`.

Findings:
- **WARNING:** Pos cell renders `{position}{" "}<span className="ml-1 ...">`. The literal space plus `ml-1` gives a wider gap than the contract's single space. Fix: remove `ml-1` from that span.
- The contract's `pl-2` on the first column is the phase-2 selected-bar change, so it is not drift.

### Pillar 6: Experience Design (3/4)

Handled:
- Sort: `PendingLink` with `scroll={false}`, prefetch off, reserved spinner, `aria-sort` on the active header only, fallback to default on bad params.
- Empty (`No skaters played in this window.`), error banner, window-1 hiding of Δ, trend and sparkline, DNP last 2 marker with `—` deltas.
- Strip squares are focusable with full-detail `aria-label`. Click, Enter and Space pin the popover; blur, outside pointerdown and Escape close it. Tab stops (about 100+) are accepted by the contract.

Findings:
- **WARNING:** Window of 2 shows Δ columns that are all `—` (see Top Fix 2).
- **WARNING:** `formatSignedClock` and `formatSignedPoints` return unsigned `0:00` and `0` for a zero delta. The contract requires an explicit sign on every Δ, so a zero delta is unsigned. Low severity.

---

## Files Audited

- `.planning/phases/01-ice-time-trends-table/01-UI-SPEC.md`
- `.planning/phases/02-player-linemate-detail/02-UI-SPEC.md` (later-change check)
- `.planning/phases/03-unit-event-stats/03-UI-SPEC.md` (later-change check)
- `components/ToiTrends.tsx`
- `components/ToiGameStrip.tsx`
- `components/ToiStripCell.tsx`
- `components/StripPopover.tsx`
- `components/PendingLink.tsx`
- `app/research/page.tsx`
- `lib/research/game-strip.ts` (STRIP_SQUARE_CLASS, stripOpacity, detailText)
- `lib/research/toi-trends.ts` (thresholds, deltaCrossing, moverDirection)
- `lib/research/format.ts` (formatClock, formatSignedClock, formatSignedPoints)
- `.planning/ui-reviews/.gitignore` (capture gate; no PNG written)
