---
phase: 02-player-linemate-detail
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - components/LastGameLines.tsx
  - components/PlayerLinemates.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/format.ts
  - lib/research/game-strip.test.ts
  - lib/research/game-strip.ts
  - lib/research/linemates.test.ts
  - lib/research/lines.ts
  - lib/research/player-detail-view.test.ts
  - lib/research/player-links-view.test.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 02: Code Review Report (re-review)

**Reviewed:** 2026-10-14
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Re-review of the phase-02 review-fix commits (44ae424, 5410486, 8b7ba09, f48d638, 3b33d35, 2574b76, 657e73f) and quick task 1a68924, reading each file as a whole. Phase-03 changes (unit event columns, `creditsUnit`/`unitKey`, overlay spinner) were treated as already reviewed in 03-REVIEW.md and not re-reported. I also ran `tsx --test lib/research/*.test.ts` (480 pass, 0 fail), `tsc --noEmit` and `eslint components lib/research`; all are clean.

The review fixes hold up. I traced each one:

- The window-share ordering test (3b33d35) has the right arithmetic: with `recentStart(5) = 3`, linemates 10 and 11 share 900/3000 = 30% and 12 and 13 share 600/3000 = 20%. The tags come out Fading and New, so the test does pin full ordering.
- The hover-only Escape handler (2574b76) is idempotent when the square is both focused and hovered. It cannot leave a stuck dismissed state, because `onPointerLeave` runs `send("leave")` and that clears `dismissed`.
- The `sort={requestedSort}` change in ToiTrends is covered by a test and matches the other name-link table.
- The `analyzeGameLines` doc comment now describes the whole function.
- `regulationSeconds` still sums overlapping non-identical rows. This is now documented and was accepted in the disposition ledger, so I did not re-raise it.

One real gap remains: the contrast fix in quick task 1a68924 was applied to only some of the dashes. The other findings are minor.

## Warnings

### WR-06: Quick task 1a68924 fixed the low-contrast "—" in ToiTrends but left the same dash in the player panel

**File:** `components/PlayerLinemates.tsx:308`, `components/PlayerLinemates.tsx:367` (same pattern also at `components/LastGameLines.tsx:104`, `components/LastGameLines.tsx:165`)
**Issue:** Commit 1a68924 changed the muted dash in `ToiTrends.tsx` from `text-neutral-400 dark:text-neutral-500` to `text-neutral-600 dark:text-neutral-400`. Its message says this meets AA "on white, tints and #0a0a0a". `neutral-400` on white is roughly 2.5:1, so that is the failure being fixed. The same unknown-value dash is still `text-neutral-400 dark:text-neutral-500` in two places in `PlayerLinemates`:

- the `HeaderStat` `<dd>` dash (line 308), which shows when Avg TOI, TOI Δ, PP share or PP share Δ is unknown;
- the Window share dash (line 367).

`LastGameLines` has the same pair: the `DASH` stat cells (line 104) and the "None" cell (line 165, `text-neutral-400` with no dark variant). The result is that the same "unknown" glyph passes contrast in the trends table and fails right above it in the detail panel. The panel's `TOI Δ` dash is the direct counterpart of the trends table's `TOI Δ` dash that was fixed. No test pins these dashes, so nothing guards the inconsistency.
**Fix:** Use the same classes as the fixed dashes, ideally from one shared constant so they cannot drift again.
```tsx
// components/PlayerLinemates.tsx:308 and :367
<span className="text-neutral-600 dark:text-neutral-400">—</span>

// components/LastGameLines.tsx:104
const tone = value === DASH ? "text-neutral-600 dark:text-neutral-400" : c.derived ? "text-neutral-500" : "";
// components/LastGameLines.tsx:165
<td colSpan={13} className="py-1 text-neutral-600 dark:text-neutral-400">
```
Add a markup test like the one added in `toi-trends-view.test.ts` ("Avg TOI and delta dashes are text-neutral-600 ...") for the `PlayerLinemates` header and Window share dashes.

## Info

### IN-10: `formatSignedPoints` is documented as the PP-share formatter but now formats goal +/-, and `formatPointsDelta` depends on its string output

**File:** `lib/research/format.ts:17-28` (consumer at `lib/research/unit-events-view.ts:60`)
**Issue:** `formatSignedPoints` is documented as "Signed whole percentage points for a PP share change". Since phase 03 it is also the formatter for the unit tables' goals +/- column (`formatSignedPoints(counts.gf - counts.ga)`), where the value is a goal differential and "points" is the wrong unit. The doc and name now mislead a reader of `unit-events-view.ts`. Separately, `formatPointsDelta` detects a zero by comparing the helper's output to the literal `"0"` (`text === "0"`). If `formatSignedPoints` ever changes its zero text, `formatPointsDelta` silently stops adding the `±`.
**Fix:** Rename the base helper to something neutral such as `formatSignedInt` and update its comment. Then either use a shared rounded-zero check in `formatPointsDelta` or have both helpers call a small `signed(value, zero)` function.
```ts
/** Signed whole number; a value that rounds to zero is `zero`. */
function signed(value: number, zero: string): string {
  const magnitude = Math.round(Math.abs(value));
  return magnitude === 0 ? zero : `${value > 0 ? "+" : MINUS}${magnitude}`;
}
export const formatSignedInt = (n: number) => signed(n, "0");
export const formatPointsDelta = (n: number) => signed(n, "±0");
```

### IN-11: The IN-02 hover-only Escape wiring has no regression test

**File:** `components/ToiStripCell.tsx:61-71`
**Issue:** The fix for IN-02 adds a `hovered` state and a document `keydown` listener that exist only in the client component. The existing tests cover the pure helpers `nextOpen` and `nextDismissed` and the static markup. Nothing exercises `onPointerEnter` setting `hovered`, or the listener removing itself when the pointer leaves. The behaviour could regress unnoticed, for example by dropping `onPointerEnter` or leaving `hovered` set after leave. No browser or component-level check mentions Escape; Escape appears only in planning documents.
**Fix:** Add a small jsdom or browser check that hovers a square, presses Escape, and asserts `data-dismissed` is set. It should then leave and assert the attribute is cleared. If that is not worth the setup cost, record the manual check in the phase validation file so the gap is explicit.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
