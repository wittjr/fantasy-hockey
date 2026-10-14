# Phase 2 — UI Review

**Audited:** 2026-10-14
**Baseline:** 02-UI-SPEC.md (Phase 2 design contract, extends 01-UI-SPEC.md)
**Screenshots:** not captured (code-only audit). `/research` is auth-gated behind Discord sign-in; no sign-in attempted.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Panel copy matches the contract, but the show-all line and close aria-label drift from the spec text. |
| 2. Visuals | 3/4 | Clear focal point (name + Avg TOI, then strip). Window-share header explains itself only through a hover `title`. |
| 3. Color | 3/4 | Accent discipline holds (green/red only on Δ crossings; tags neutral). Two text-contrast failures: `—` placeholders and amber footnote text. |
| 4. Typography | 3/4 | Panel uses only 12/14/16 px and 400/500. Page chrome outside the panel uses `text-2xl` and `font-semibold`, outside the stated scale. |
| 5. Spacing | 3/4 | Panel follows the spacing scale and the 112 px popover clearance. Not verified visually, so the clearance is unconfirmed. |
| 6. Experience Design | 3/4 | State coverage is thorough (no-chart, no-situation-time, below-minimum, not-in-window, window of 1). WR-10 pin/dismiss behavior is implemented. Keyboard tab-stop load is accepted by contract but unverified in a browser. |

**Overall: 18/24**

No pillar scored 1, so there are no BLOCKER findings. Every pillar is at 2 or above and has at least one WARNING.

---

## Top 3 Priority Fixes

1. **Placeholder dashes fail text contrast.** `—` is rendered `text-neutral-400` (about 2.5:1 on white) in the panel's header stats (`HeaderStat`, `PlayerLinemates.tsx`) and in the Window share column. Users can miss "no data" against the page. Fix: use `text-neutral-600 dark:text-neutral-400` to match `ToiTrends.tsx`, and update the spec's Color section, which currently mandates neutral-400.
2. **Amber footnote text is below AA.** The missing-chart note uses `text-amber-600` at 12 px on white (about 3.2:1), below 4.5:1 for small text. It appears in `PlayerLinemates.tsx` and `ToiTrends.tsx`. Fix: use `text-amber-700 dark:text-amber-400` for text. Keep `amber-600` for the dashed cell border, which only needs 3:1 non-text contrast.
3. **Spec and code disagree on copy and page chrome.** (a) The show-all line in code reads "highest share of time together first", but the spec says "most recent time together first" (the spec predates D-28). (b) The close aria-label is `Close player detail: {name}` in code and `Close {name} detail` in the spec. (c) The page-level h1 and team/window nav use `text-2xl` and `font-semibold`, which the spec does not list. Fix: update the spec to match the shipped (D-28) wording, align the aria-label, and either change the chrome to `font-medium` or record it as an inherited Phase 1 exception.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- Panel copy matches the contract: "That player didn't play for {TEAM} in this window.", "{Name} had no {EV} time in this window.", "No linemates with 2:00 or more together in this window.", the no-chart message, and the tag titles (`PlayerLinemates.tsx`, `LinemateRowView`). Tag tooltips match the spec table.
- Drift: show-all line (`PlayerLinemates.tsx`, `Showing {n} of {total} linemates, highest share of time together first.`). The spec says "most recent time together first". The code follows D-28 (window share order), so the spec is stale.
- Drift: close link `aria-label` is `Close player detail: ${name}` versus the spec's `Close {name} detail`. Screen reader output differs from the contract but is not wrong.
- Generic labels: none found in the new components. The only "None" is the spec-mandated empty group row.

### Pillar 2: Visuals (3/4)

- Focal point is correct: `h2` name with `font-medium` and the Avg TOI header stat, then the strip. Hierarchy is clear.
- The Window share column header uses only a `title` attribute for its definition (`PlayerLinemates.tsx`, `<th title=...>`). Hover-only definitions are not available to keyboard or touch users. The page is laptop-only, so this is a low-severity WARNING.
- Icon-only elements: the close link keeps visible text beside `aria-hidden` "×", so it is fine. Tag glyphs `▲ ▼` are `aria-hidden` with the word in the chip, which is correct.

### Pillar 3: Color (3/4)

- Accent discipline holds. Green/red appear only on crossing Δ values in `HeaderStat` and `DeltaCell` (`deltaCrossing`). Tag chips in `TAG_CHIP` are neutral (black/white/grey). Confirmed by UAT test 5.
- Cell shading uses `bg-neutral-800`/`neutral-200` with opacity from `linemateOpacity` (0.2 floor, 0.75 saturation). Cell borders match the four-state table.
- WARNING: `text-neutral-400` placeholder dashes, as described in Top Fix 1. Approximately 2.5:1.
- WARNING: `text-amber-600` footnote text, as described in Top Fix 2.
- INFO: the page-level error notice (`app/research/page.tsx`, `rose-*` classes) introduces a rose hue outside the spec's palette. It is probably inherited from Phase 1 and is not a Phase 2 addition. Record it as an inherited exception or switch it to the red token.

### Pillar 4: Typography (3/4)

- Panel sizes are `text-xs`, `text-sm`, and `text-base` via the heading default. Weights are 400 and 500 only, as the contract requires.
- WARNING: `app/research/page.tsx` uses `text-2xl font-semibold` for the h1, `font-semibold` for the active team and window links. The spec states "No `font-semibold` or `font-bold` in this section" and lists sizes 12/14/16 only. These classes are page chrome, so they may be inherited from Phase 1, but they break the stated scale on the page this phase ships into.
- The Δ values and popover numbers use `tabular-nums` consistently.

### Pillar 5: Spacing (3/4)

- Uses the spec scale throughout: `gap-4` panel children, `p-4` panel padding, `gap-x-6` header stats, `px-3` tab gutters, `py-1` rows, `gap-1` squares, and `w-5 h-5` strip squares.
- The popover clearance `pb-28 -mb-24` matches the contract's 112 px value.
- Not verified visually. The Phase 2 UAT (02-UAT.md, test 3) records the popover is not clipped on the last rows at Last 20, which supports the value, but no render was checked in this audit. Score held at 3 for that reason.

### Pillar 6: Experience Design (3/4)

- Coverage is strong. States implemented in `PlayerLinemates.tsx`: not-in-window notice with Close, no-chart note, no-situation-time message, below-minimum message, empty forward/defense groups as `None`, window of 1 without Δ or tags, tags unavailable with a reason note, show-all toggle, and the amber footnote for missing charts.
- WR-10 is implemented in `ToiStripCell.tsx`: hover and focus show the popover, click/Enter/Space pin it, Escape sets `data-dismissed` without moving focus, `aria-expanded` is removed, and `nextOpen`/`nextDismissed` are pure and testable.
- Accepted by contract: up to 200 extra `tabIndex={0}` squares in a capped panel. Recorded as a known trade-off, not a defect.
- Loading: `PendingLink` provides the pending spinner on every panel link. Load failure: `page.tsx` shows fixed copy, and the server log keeps the detail.
- Not verified in a browser: the Escape/Tab continuity and the pinned-popover behavior on touch are not relevant (laptop target). Hover-state popover timing is code-derived only.

---

## Files Audited

- `components/PlayerLinemates.tsx`
- `components/PlayerLink.tsx`
- `components/StripPopover.tsx`
- `components/ToiStripCell.tsx`
- `components/ToiTrends.tsx`
- `components/LastGameLines.tsx` (PlayerLink wiring only)
- `app/research/page.tsx`
- `lib/research/game-strip.ts` (`STRIP_SQUARE_CLASS`)
- `lib/research/linemates.ts` (constants and `linemateOpacity`)
- `.planning/phases/02-player-linemate-detail/02-UI-SPEC.md`
- `.planning/phases/02-player-linemate-detail/02-UAT.md`
