---
phase: 01-ice-time-trends-table
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/team-games.ts
  - lib/research/toi-trends.ts
  - lib/research/toi-trends-view.test.ts
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Re-verification of the still-open ledger findings against current source. All of WR-05, WR-06, WR-07, WR-08 and IN-01, IN-02, IN-05, IN-06, IN-07, IN-09, IN-10 are still present and are re-reported under their existing IDs. No new findings (no CR-02 / WR-10 / IN-11) after re-reading the seven files; `toi-trends.ts` is clean (sort/href/delta/mover logic traced, including the Avg-TOI-ascending href round trip).

Not re-reported because they are fixed or accepted: CR-01, WR-01..WR-04, WR-09, IN-08.

Out of file scope, so not re-reported but still present on a read-through (fix only if scope is widened): IN-03 (`lib/research/game-strip.ts:35`, `+${formatClock(cell.totalToi - cell.toi)}`; `formatClock` takes `Math.abs`, so a negative difference prints as a positive "OT excluded") and IN-04 (`lib/nhl/client.ts:146`, `data.data.filter` assumes the response envelope; the call is wrapped by the `.catch` in `loadGame`, so the effect is a degraded game, not a crash).

## Warnings

### WR-05: A failed shift-chart request is reported as "not published"; for an OT/SO game every skater silently drops out of that game's averages

**File:** `lib/research/team-games.ts:74-80,96,104-106` (copy at `app/research/page.tsx:126`, `components/ToiTrends.tsx:157`)
**Issue:** `getShiftCharts(...).catch(() => [])` makes a failed request indistinguishable from an unpublished chart. For a regulation game that only loses PP/SH, but the UI then claims "the NHL hasn't published shift charts". For an OT/SO game `regulationToi` is `null` when `shiftInputs` is empty (line 106), so every skater's cell becomes `excluded` and the game vanishes from Avg TOI, slopes and Δ with no warning at all; `unavailableDates` is not populated because `loadGame` still resolves.
**Fix:** Have the catch return `null`, and fail the whole game when its regulation TOI depends on the chart:
```ts
getShiftCharts(gameId).catch((err: unknown) => {
  console.error(`Loading shift chart for game ${gameId} (${team}) failed`, err);
  return null;
}),
// ...after `overtime` is computed (move that block above shiftInputs):
if (overtime && shifts === null) throw new Error(`Shift chart for OT/SO game ${gameId} failed to load`);
const shiftInputs = (shifts ?? []).flatMap(/* unchanged */);
```
The thrown error lands the game in `unavailableDates`, which the page already reports. Also soften the two user-facing strings so a failed fetch on a regulation game is not misreported, e.g. `ToiTrends.tsx:157`: "...: no shift chart is available for those games (not published yet, or it failed to load)." and the same wording at `page.tsx:126`. The existing test (`toi-trends-view.test.ts:82,84`) asserts only the "No PP/SH data for Oct 8" prefix, so it keeps passing.

### WR-06: When the newest game(s) fail to load, "Last game" and the last-2-games Δ silently re-anchor to older games

**File:** `app/research/page.tsx:100-104,116` (cause: `lib/research/team-games.ts:138-146`)
**Issue:** Failed games are dropped from `games`, so `LastGameLines` shows `games[games.length - 1]` under a heading that reads "Last game: <older date>", and `recentDelta` treats the newest two *loaded* games as "recent". The warning paragraph names the missing dates but never says that the "Last game" section and the Δ columns now describe older games, so a user can read a stale role change as current.
**Fix:** Make the warning say so when a failed game is newer than the newest loaded one (ISO dates compare lexically). In `page.tsx`, inside the final `<>` branch:
```tsx
const newestLoaded = research.games[research.games.length - 1].date;
const newestMissing = research.unavailableDates.some((d) => d > newestLoaded);
// ...
Couldn&apos;t load NHL data for {dates}, so those games are left out of this window
{newestMissing && "; Last game and the last-2-games comparison use the newest games that did load"}. Reload to try again.
```
(Declare the two consts before the `return`, guarded by `research && research.games.length > 0`, or compute them in a small helper.)

### WR-07: Strip square is focusable and clickable but exposed as `role="img"`: no Enter/Space toggle, no `aria-expanded`, no Escape dismiss

**File:** `components/ToiStripCell.tsx:35-45`
**Issue:** The span has `tabIndex=0` and an `onClick` toggle, so it is an interactive control, but it is announced as a static image and has no keyboard activation (Enter/Space do nothing), no expanded state, and no Escape handling. Keyboard users get the popover only via `:focus-visible` CSS, and cannot dismiss it without moving focus (WCAG 1.4.13 dismissable).
**Fix:** Make it a real button role with expanded state and keys:
```tsx
role="button"
aria-expanded={open}
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    setOpen((o) => !o);
  } else if (e.key === "Escape") {
    e.currentTarget.blur(); // onBlur closes data-open and ends :focus-visible
  }
}}
```
Tradeoff: Escape drops focus to the body; hover-shown popovers still end only when the pointer leaves. Update the tests that assert `role="img"` (`toi-trends-view.test.ts:192` and `:430`) to `role="button"` and add `aria-expanded="false"` to the closed-state assertion at `:431`. Update the stale `role` wording nowhere else (the `ToiGameStrip` doc comment does not mention it).

### WR-08: `ToiStripCell` click / outside-click / blur behaviour has no behavioural test; popover regexes in the view test are fragile

**File:** `lib/research/toi-trends-view.test.ts:198-205,377-385,435-445`; `components/ToiStripCell.tsx:25-48`
**Issue:** Every strip test is a static-markup string match. The only logic in the client component (toggle, outside `pointerdown` close, blur close) is never exercised, and the markup tests are brittle: `:200` ends a popover at the first `</span></span>`, which is the end of the title span for any OT game (the `periodTag` span is the last child of the title), and `:379`/`:437` require `aria-hidden="true"` to be the first attribute and `class` the second, so any attribute reordering fails them for the wrong reason.
**Feasibility:** A true behavioural test (dispatching click/pointerdown/blur and reading `data-open`) needs a DOM and a React renderer with effects; `renderToStaticMarkup` only renders initial state, and neither jsdom/happy-dom nor `@testing-library` is installed. That is **not feasible under `tsx --test lib/**/*.test.ts` without a new package**, so the wiring (`ref.contains`, listener add/remove) stays untested. Do not add a dependency.
**Fix (what is feasible, no new packages):**
1. Extract the state transitions into a pure function and test it under the existing runner (also covers the WR-07 keys):
```ts
// components/ToiStripCell.tsx
export type CellEvent = "click" | "blur" | "enter" | "space" | "escape" | "outside";
export function nextOpen(open: boolean, event: CellEvent): boolean {
  return event === "click" || event === "enter" || event === "space" ? !open : false;
}
```
Use it as `setOpen((o) => nextOpen(o, "click"))` etc., and add a `test()` table in the view test (or `lib/research/` colocated test) asserting closed->click->open->click->closed, and blur/escape/outside always close.
2. Replace the position-sensitive regexes with one helper defined before first use, near the top of the test file:
```ts
const popoverTags = (html: string) =>
  [...html.matchAll(/<span\b[^>]*>/g)].map((m) => m[0]).filter((t) => t.includes('aria-hidden="true"') && classTokens(t).includes("group-hover/cell:block"));
```
and, for `:198-205`, split the row on `aria-hidden="true"` and assert on the chunk that follows (`.filter((c) => c.includes("Oct"))`) instead of the lazy `</span></span>` match. Move `classTokens` (currently `:369`) above its first use.
Keep this finding open until a DOM-capable test exists; the above only narrows it.

## Info

### IN-01: `if (secs)` conflates a 0:00 clock with a malformed one

**File:** `lib/research/team-games.ts:92-93`
**Issue:** `parseClock` returns `0` for `"00:00"` and `null` for garbage; `if (secs)` drops both, so a skater who dressed with 0:00 is treated as a scratch (DNP), contradicting the `toi` field comment ("every skater who dressed").
**Fix:** Make the intent explicit and behaviour-preserving, or include the zero:
```ts
if (secs !== null && secs > 0) toi.set(p.playerId, secs); // 0:00 means he did not take a shift: treated as not played
```

### IN-02: Non-null assertion inside a closure

**File:** `app/research/page.tsx:134`
**Issue:** `game.lines!` is needed only because TypeScript does not keep property narrowing from the `!game.lines` check inside the `flatMap`/`map` callbacks.
**Fix:** Narrow a const and drop the `!`:
```tsx
const lines = game.lines;
// ...
{!lines ? (...) : ( ... units={lines.units[situation][group].slice(0, UNIT_LIMITS[situation][group])} ...
```

### IN-05: Popover headroom (`pb-28 -mb-24`) is a fixed magic number; a worst-case last-row popover can exceed it

**File:** `components/ToiTrends.tsx:56`
**Issue:** The wrapper reserves 112 px under the table (plus 4 px row padding). A worst-case popover (an excluded OT game: title, TOI, Total, PP, SH rows plus two note lines, `p-2`, border, `mt-1`) is roughly 130-135 px tall, so on the last row it can run past the padding. Because `overflow-x-auto` forces `overflow-y` to `auto`, that shows as a vertical scrollbar or clipped popover. Not browser-checked.
**Fix:** Increase the reserve and say why it is that size:
```tsx
{/* Headroom for the tallest popover (about 135px) under the last row; the negative margin gives the space back. */}
<div className="overflow-x-auto pb-40 -mb-36">
```

### IN-06: Intro copy hard-codes 2:00 / 15 instead of the mover constants; empty state says "regular-season" though playoff games are included

**File:** `components/ToiTrends.tsx:50`; `app/research/page.tsx:97`
**Issue:** Changing `TOI_MOVER_SECONDS` / `PP_MOVER_POINTS` (already imported at `ToiTrends.tsx:11,18`) would leave the visible explanation wrong. `RESEARCH_GAME_TYPES` includes playoffs (`team-games.ts:18`), so "regular-season" is inaccurate.
**Fix:** Build the sentence from the constants (output is unchanged, so the approved-copy test at `toi-trends-view.test.ts:359-366` still passes; use a template string so no text-node splitting is involved):
```tsx
{`Rows tinted green or red moved by ${formatClock(TOI_MOVER_SECONDS)} or more of TOI or ${PP_MOVER_POINTS} or more points of power-play share.`}
```
and change `page.tsx:97` to "...hasn't finished a game yet this season."

### IN-07: On desktop a second click on a hovered square has no visible effect, so the "click a square" hint can mislead

**File:** `components/ToiTrends.tsx:51,68`; `components/ToiGameStrip.tsx:41`
**Issue:** On a laptop the pointer is already hovering the square when it is clicked, so the popover is already visible and the click changes nothing visible; the click only pins it open after the pointer leaves, which is not explained. The header hint and intro both say to click.
**Fix:** Say what works on the target device: change the header hint to "(hover or click a square)" at `ToiTrends.tsx:68` and update the matching assertions at `toi-trends-view.test.ts:50` and `:483`. Leave the intro sentence as is (it already says "click, tap or hover").

### IN-09: Tests pin the literal light tint shade in many places; no test covers the `dark:bg-*-900/40` classes

**File:** `lib/research/toi-trends-view.test.ts:242-244,259,283,288`
**Issue:** `bg-green-100` / `bg-red-100` are repeated as raw strings, and the dark-mode tint (`ToiTrends.tsx:79`) is untested, so removing or mistyping it passes the suite.
**Fix:** Define `const TINT = { up: "bg-green-100", down: "bg-red-100" }` once and reuse it, and add to the up/down test:
```ts
assert.ok(up.includes("dark:bg-green-900/40") && down.includes("dark:bg-red-900/40"));
```

### IN-10: `text-green-700` on green-100 is 4.56:1, only just above AA

**File:** `components/ToiTrends.tsx:232` (pinned by `toi-trends-view.test.ts:245,260,273`)
**Issue:** The up-mover delta text is barely above the 4.5:1 AA threshold on the tinted row; any rendering/colour-profile variance puts it under.
**Fix:** Use `text-green-800` (`"font-medium text-green-800 dark:text-green-400"`) and update the three test assertions from `text-green-700` to `text-green-800`.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
