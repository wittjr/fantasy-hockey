---
phase: 01-ice-time-trends-table
reviewed: 2026-10-11T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/toi-trends-view.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-11
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Incremental re-review after gap plans 01-08 (click/tap popover via the new `ToiStripCell` client component) and 01-09 (bordered 20x20 squares, header hint, "C 5/5 GP" Pos cell). I also read `lib/research/game-strip.ts` and `lib/research/toi-trends.ts` to confirm the data the components consume.

What checks out:
- **Server/client boundary is sound.** `ToiStripCell` receives only `label` (string), `state` (string-literal union), `className` (string) and `children` (server-rendered elements). All are serializable. `ToiGameStrip` and `ToiTrends` have no hooks or handlers and stay server components. `import type` is used for the lib types, so no server-only code is pulled into the client bundle.
- **Listener lifecycle is correct.** The `pointerdown` listener is added only while `open` is true. The effect cleanup removes it on close and on unmount. There is no leak and no stale closure (the handler reads only `ref` and the stable setter).
- **Toggle sequencing works.** A pointerdown inside the square is ignored, so the `click` toggles it closed. A pointerdown on another square closes this one first. The `blur` handler covers focus loss.
- **Tailwind 4 syntax is valid.** `group-data-[open]/cell:block` matches the `data-open=""` attribute, and `group-focus-visible/cell:block` is valid. In Tailwind 4, `hover:` and `group-hover:` are wrapped in `@media (hover: hover)`, so touch devices do not get a sticky hover popover competing with the tap-to-open state.

Remaining concerns are accessibility semantics of the clickable squares and the gap in test coverage for the new interactive behavior.

## Warnings

### WR-07: Clickable squares use `role="img"` with no keyboard toggle, no `aria-expanded` and no Escape dismissal

**File:** `components/ToiStripCell.tsx:35-45`
**Issue:** The square is a focusable (`tabIndex={0}`), clickable control, but it is exposed as `role="img"`. That is a non-interactive role, so assistive tech does not announce it as actionable. Concretely:
- Enter and Space do nothing, because only `onClick` is wired and a `span` gets no synthesized click from the keyboard. Keyboard users only get the popover through the `focus-visible` CSS, never the same open state as mouse and touch users.
- There is no `aria-expanded` state. The popover is `aria-hidden`, so the `aria-label` carries the content. That part is fine, but the control's open or closed state is not conveyed.
- Escape does not dismiss the open popover. WCAG 1.4.13 (content on hover or focus) requires it to be dismissible without moving the pointer or focus.
- The project's lint config (`eslint-config-next`) enables only a small subset of `jsx-a11y`, so none of this is flagged.

The test suite (`toi-trends-view.test.ts:191-192,430`) pins `role="img"` and `tabindex="0"`, so changing it also means updating those assertions.

**Fix:** Either keep `role="img"` for pure hover and focus use and drop the click handler's claim to be interactive, or make it a real control. The minimal change is to add Escape handling and keyboard activation. The `useEffect` can also listen for `keydown` while open:
```tsx
// in the effect, while open
const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
document.addEventListener("keydown", onKey);
// ...and remove it in cleanup

// on the span
onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
```
The cleaner option is `<button type="button" aria-expanded={open} aria-label={label}>`, with the `[role=img]` test assertions updated to match.

### WR-08: The new interactive behavior (toggle, outside-click, blur, cleanup) has no test

**File:** `lib/research/toi-trends-view.test.ts:423-445` (and `components/ToiStripCell.tsx:22-47`)
**Issue:** Plan 01-08's entire purpose is that a click or tap opens the popover, a second click, an outside `pointerdown` or a blur closes it, and the popover never blocks the squares under it. The tests use `renderToStaticMarkup`, so they can only assert class tokens and the initial `data-open` absence ("starts closed"). The state machine is never exercised. A regression that breaks the toggle, drops the `blur` close, or leaks the document listener would pass the whole suite. One adjacent assertion is also fragile. The test at lines 198-205 matches popovers with a lazy `[\s\S]*?<\/span><\/span>`, which stops at the first nested `</span></span>`, so `popovers[0].includes("1:00")` can pass or fail depending on markup nesting rather than on content.

**Fix:** Add a small behavioral test with a DOM (for example `@testing-library/react` with jsdom or happy-dom, or a hand-driven `react-dom/client` render) covering:
```ts
// click toggles data-open on, second click off
// pointerdown on document.body closes an open cell
// pointerdown on another cell closes the first
// blur closes
// after close and after unmount, document has no pointerdown listener
```
If a DOM test dependency is too heavy for this project, at least tighten the line-200 regex to anchor on the popover's own class and assert on the extracted text of its subtree.

## Info

### IN-05: Popover headroom (`pb-28 -mb-24`) is a fixed magic number; worst case still overflows (still present)

**File:** `components/ToiTrends.tsx:56`
**Issue:** Re-reported. The popover opens downward inside an `overflow-x-auto` wrapper, which forces `overflow-y` to `auto`. The `pb-28 -mb-24` hack reserves 112px under the table. The tallest popover is a no-shift-data OT square: a title line, four rows (TOI, Total, PP, SH) and two notes, one of which wraps at `max-w-xs`. That is about 8 lines at 16px plus padding, border and `mt-1`, roughly 150px. The last row has only about 116px below its square, so the final line can be clipped or can create a vertical scrollbar in the wrapper. This is an estimate and has not been checked in a browser.
**Fix:** Either raise the reserve (for example `pb-40 -mb-36`), or open the popover upward (`bottom-full mb-1`) for rows in the lower half, or move the popover out of the scroll container.

### IN-06: Intro copy hard-codes the mover thresholds (still present)

**File:** `components/ToiTrends.tsx:48-51`
**Issue:** Re-reported. The intro text literally says "2:00 or more of TOI or 15 or more points", while the same file imports `TOI_MOVER_SECONDS` and `PP_MOVER_POINTS` for the actual logic. Changing a constant silently makes the copy wrong. The test at line 363 also pins the literal copy, so the drift would not be caught. The "regular-season" wording part of the original finding is not in this file's current text.
**Fix:** Interpolate `formatClock(TOI_MOVER_SECONDS)` and `PP_MOVER_POINTS` into the sentence, and update the test to build its expected string from the same constants.

### IN-07: A second click on a hovered square appears to do nothing on desktop

**File:** `components/ToiStripCell.tsx:43`
**Issue:** `onClick` toggles `open`, but the popover is also shown by `group-hover`. On a pointer device, the first click sets `data-open` (the popover was already visible from hover), and the second click clears it, yet the popover stays visible because the pointer is still over the square. The toggle-off is invisible there. It only matters on touch and for keyboard focus. The click-to-open affordance advertised in the header ("click a square") therefore has no visible effect on desktop.
**Fix:** Accept this and drop the "click" wording for non-touch users, or make the hint and behavior match. For example, say "(click or tap a square)", or leave it as is and document that click is a touch affordance.

### IN-08: One tab stop per square makes the table slow to traverse by keyboard

**File:** `components/ToiStripCell.tsx:39`
**Issue:** Every square has `tabIndex={0}`. A 20-skater table with a 10-game window yields about 200 tab stops, so reaching the next page control or footer requires many Tab presses. Each stop also reads the full aria-label.
**Fix:** Use a roving tabindex (one tab stop per row, with arrow keys moving between squares), or make only the first square in each row tabbable. This pairs naturally with the WR-07 keyboard work.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
