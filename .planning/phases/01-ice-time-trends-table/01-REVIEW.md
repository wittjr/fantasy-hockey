---
phase: 01-ice-time-trends-table
reviewed: 2026-10-12T00:00:00Z
depth: quick
files_reviewed: 2
files_reviewed_list:
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

**Reviewed:** 2026-10-12
**Depth:** quick (diff since 48ff767: commits bc35e65 and 0425a38, plus a contrast calculation)
**Files Reviewed:** 2
**Status:** issues_found

## Summary

The diff changes the mover row tint from `bg-green-50 dark:bg-green-950/30` and `bg-red-50 dark:bg-red-950/30` to `bg-green-100 dark:bg-green-900/40` and `bg-red-100 dark:bg-red-900/40`. In the view test, the class assertions were renamed from `-50` to `-100`. `npx tsx --test lib/research/toi-trends-view.test.ts` passes: 46 of 46.

**Test assertions are not vacuous.** `bg-green-100` and `bg-red-100` appear in exactly one place in non-test source, `ToiTrends.tsx:79`. The strip components and `globals.css` have no `bg-green-*` or `bg-red-*` classes. The positive test (line 242-244) asserts `bg-green-100` on the up row, `bg-red-100` on the down row, and neither on the flat row, all from one render. The negative checks on the mixed-sign, DNP and one-game rows therefore use the same substrings the positive check proves are emitted. The rename is complete, and no stale `-50` assertion remains. The remaining gaps are weaker (IN-09).

**Contrast.** The coloured delta text passes AA on the tint. The default foreground text passes by a wide margin. The Pos cell's `text-neutral-500` text falls below AA on the tinted rows, and the darker tint made that worse (WR-09).

Contrast ratios I computed (WCAG relative luminance; Tailwind 4 palette; light page background #ffffff, dark #0a0a0a, from `app/globals.css`):

| Text | Background | Ratio | AA (4.5:1) |
|---|---|---|---|
| green-700 (#15803d), delta cell | green-100 | 4.56 | pass, thin margin (IN-10) |
| red-700 (#b91c1c), delta cell | red-100 | 5.30 | pass |
| foreground #171717 | green-100 / red-100 | above 14 | pass |
| neutral-600 (#525252), GP count, SH, DNP badge | red-100 (the worst case) | 6.19 | pass |
| neutral-500 (#737373), Pos cell | green-100 | 4.32 | FAIL (was 4.56 on green-50) |
| neutral-500 (#737373), Pos cell | red-100 | 3.88 | FAIL (was 4.34 on red-50) |
| green-400 (#4ade80) on green-900/40 over #0a0a0a, dark | | about 9 | pass |
| red-400 (#f87171) on red-900/40 over #0a0a0a, dark | | about 6 | pass |
| neutral-500, Pos cell, dark (no `dark:` variant) | dark tint | about 3.4 (4.2 untinted) | FAIL |

## Warnings

### WR-08: The new interactive behavior has no test; the popover regex is fragile (still present, test file part)

**File:** `lib/research/toi-trends-view.test.ts:198-205`
**Issue:** Re-reported from the prior review. The test still uses `renderToStaticMarkup`, so the toggle, outside-click and blur behavior of `ToiStripCell` is never exercised. The popover regex `[\s\S]*?<\/span><\/span>` at line 200 is also still lazy and depends on markup nesting. This diff does not touch it.
**Fix:** Add a DOM-based behavioral test (jsdom or happy-dom with `react-dom/client`). Anchor the popover regex on the popover's own class and assert on the text content of its subtree.

### WR-09: Pos cell text (`text-neutral-500`) drops below WCAG AA on tinted rows

**File:** `components/ToiTrends.tsx:90` (tint at line 79)
**Issue:** The position letter (`C`, `L`, `D`) is 14px `text-neutral-500` (#737373) with no `dark:` variant. The darker `-100` tint puts it at 4.32:1 on green-100 and 3.88:1 on red-100, both below the 4.5:1 AA minimum for normal text. The previous `-50` tint already failed on red (4.34:1) and just passed on green (4.56:1), so this change moves green from pass to fail and makes red worse. In dark mode the same text sits at about 3.4:1 on the tint, against 4.2:1 untinted, which is also below AA. Mover rows are the ones the page exists to highlight, so this is the text a user reads most. The sibling GP span (`text-neutral-600 dark:text-neutral-400`) already uses the compliant pair.

Other muted text on the tinted rows also fails, but it fails on a plain white background too, so the tint did not cause it:
- The `—` placeholders use `text-neutral-400 dark:text-neutral-500`.
- The `muted` constant at line 40 is the same colour pair.

**Fix:** Use the same pair as the GP count on the Pos cell:
```tsx
<td className="py-1 pr-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
```
This gives 6.19:1 or better on red-100 and clears AA in dark mode. Optionally move `muted` to `text-neutral-500 dark:text-neutral-400`. That reaches 4.74:1 on white, but only 4.32:1 on green-100 and 3.88:1 on red-100, so the dashes would still fail on tinted rows unless they use neutral-600.

## Info

### IN-05: Popover headroom (`pb-28 -mb-24`) is a fixed magic number (still present)

**File:** `components/ToiTrends.tsx:56`
**Issue:** Re-reported unchanged. The worst-case popover (an OT square with no shift data, with its wrapped note) may exceed the 112px reserved under the last row. This has not been checked in a browser.
**Fix:** Raise the reserve, or open the popover upward for the lower rows.

### IN-06: Intro copy hard-codes the mover thresholds (still present)

**File:** `components/ToiTrends.tsx:48-51`
**Issue:** Re-reported unchanged. The text says "2:00 or more of TOI or 15 or more points" while the file imports `TOI_MOVER_SECONDS` and `PP_MOVER_POINTS` for the real logic. The test at line 363 pins the literal string, so drift would not be caught.
**Fix:** Interpolate `formatClock(TOI_MOVER_SECONDS)` and `PP_MOVER_POINTS` into the copy, and build the expected string in the test from the same constants.

### IN-09: The tint tests pin the exact light shade and never check the dark variant

**File:** `lib/research/toi-trends-view.test.ts:242-244,259,283,288`
**Issue:** This colour change forced edits to five assertions, because each pins the literal substring `bg-green-100` or `bg-red-100`. Two weaknesses follow:
- The next shade tweak must touch every assertion again. A missed negative assertion would pass vacuously, because it would check for a class that no longer exists.
- No assertion mentions `dark:bg-green-900/40` or `dark:bg-red-900/40`. Dropping or mistyping the dark variant would keep all 46 tests green. The dark variant was half of the point of this fix.

**Fix:** Add one helper and use it for all the tint checks:
```ts
const tint = (html: string) => /\bbg-(green|red)-\d+\b/.exec(html)?.[0] ?? null;
const darkTint = (html: string) => /\bdark:bg-(green|red)-\d+\/\d+\b/.exec(html)?.[0] ?? null;
// up-mover:   assert.match(tint(up) ?? "", /green/); assert.ok(darkTint(up));
// flat/mixed/DNP/one-game: assert.equal(tint(row), null);
```

### IN-10: Delta text on green-100 clears AA by 0.06

**File:** `components/ToiTrends.tsx:232` (with the tint at line 79)
**Issue:** `text-green-700` on `bg-green-100` is 4.56:1 against a 4.5:1 minimum, for 14px medium-weight text, which is not "large text". It passes today. It would fail on a one-step lighter text colour or a slightly darker tint, and the margin is small enough to deserve a note beside the tint classes.
**Fix:** No change needed. To gain headroom, use `text-green-800` (about 6.3:1). Otherwise leave a short comment tying the tint and the text shade together.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
