---
phase: "2"
slug: "player-linemate-detail"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner via tsx 4.23.13 (`node:test`, `node:assert/strict`). Markup tests use `renderToStaticMarkup(createElement(...))` in `.ts` files |
| **Config file** | none. The `npm test` script is `tsx --test lib/**/*.test.ts`, which only reaches one directory level, so new tests must sit directly in `lib/research/` |
| **Quick run command** | `npx tsx --test lib/research/pair-seconds.test.ts lib/research/linemates.test.ts lib/research/player-detail-view.test.ts` (list only the files that exist at that point) |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run build && npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx components/ToiStripCell.tsx` plus any new component files |
| **Browser backstop** | `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs` (new). It is patterned on the Phase 1 `webkit-strip-check.cjs`, runs desktop only, uses a scratch copy outside the repo on 127.0.0.1, needs live NHL data, and takes a few minutes |
| **Estimated runtime** | ~20 seconds for the full suite (build ~8 s), plus a few minutes for the browser backstop |

Note: `npm run lint` is not used. It lints the whole repo and fails at baseline on the untracked `.claude/` GSD files, so the scoped `npx eslint ...` above is used instead.

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` commands (the quick run for the test files it touches) plus `npx tsc --noEmit`
- **After every plan wave:** the full suite command above
- **Before `/gsd-verify-work`:** the full suite green and the browser backstop green (or its failures triaged), then the manual checks below
- **Max feedback latency:** 15 seconds, excluding the browser backstop

---

## Per-Task Verification Map

Filled in by the planner per task. Requirement coverage target, from research:

| Requirement / SC | Behavior | Test Type | Automated Command | File Exists | Status |
|------------------|----------|-----------|-------------------|-------------|--------|
| SC5 / D-19 | `analyzeGameLines` outputs unchanged after any extraction | unit (existing) | `npx tsx --test lib/research/lines.test.ts` | ✅ must pass untouched | ⬜ pending |
| PLYR-02, PLYR-03 / D-19 | Pair seconds are symmetric, together <= self, regulation only, EV/PP/SH split, duplicates counted once, goalie excluded | unit | `npx tsx --test lib/research/pair-seconds.test.ts` | ❌ W0 | ⬜ pending |
| Oracle | self == `lines.playerSeconds` for a non-OT fixture; self <= it with OT | unit | same | ❌ W0 | ⬜ pending |
| PLYR-02 / SC5 / D-24 | Cell states together/apart/absent/unknown; unknown is never 0 and is excluded from share and tags | unit | `npx tsx --test lib/research/linemates.test.ts` | ❌ W0 | ⬜ pending |
| PLYR-03 | Per-game share, window share, `—` when no counted games, share <= 1 | unit | same | ❌ W0 | ⬜ pending |
| PLYR-02 / D-11, D-12, D-13, D-21 | Minimum filter, recent-first ordering, caps, `all` lifts the cap but not the minimum, F/D split, group-played-most | unit | same | ❌ W0 | ⬜ pending |
| PLYR-04 / SC4 / D-14..D-18, D-20 | Tag matrix: clean line change at windows 2/3/5 gives New and Fading; ±15 boundary; Out; trade; 1-game window; fewer than 2 played; missed all recent | unit | same | ❌ W0 | ⬜ pending |
| PLYR-01 | `player` / `sit` / `all` parsing and allowlisting; `researchHref` default output byte-identical; team links drop player | unit | `npx tsx --test lib/research/toi-trends.test.ts` | ✅ extend | ⬜ pending |
| PLYR-01 / D-02, D-06 | Trends name cell links to `?player=ID#player-detail`; selected row marked; existing assertions still pass | markup | `npx tsx --test lib/research/toi-trends-view.test.ts` | ✅ extend | ⬜ pending |
| UNIT-04 / D-22 | Unit-table names are links carrying the table's `sit`; Time and `%` cells unchanged | markup | `npx tsx --test lib/research/player-detail-view.test.ts` | ❌ W0 | ⬜ pending |
| PLYR-02 / D-07, D-10, D-13 | Panel tabs, one square per game per row, forwards before defense, legend, show-all, empty states, window-of-1 shape | markup | same | ❌ W0 | ⬜ pending |
| SC5 / D-24 | Unknown square markup, amber footnote, no `0:00` or `0%` in the strip | markup | same | ❌ W0 | ⬜ pending |
| WR-10 | Dismiss transitions; popover class string pinned; no `aria-expanded` | unit + markup | `npx tsx --test lib/research/toi-trends-view.test.ts` | ✅ extend | ⬜ pending |
| Types | New required field and widened state type compile with all fixtures | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| SC1 / SC2 / WR-10 | Jump to panel, Back, reload, tab keeps scroll; squares separate; popover on hover/focus/click, not clipped; Escape keeps focus | browser | `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/research/pair-seconds.test.ts`: fixtures reuse the layout from `lines.test.ts`, plus an OT shift and a 2OT shift
- [ ] `lib/research/linemates.test.ts`: hand-built `ResearchGame`-shaped inputs, no network
- [ ] `lib/research/player-detail-view.test.ts`: renders the panel, the player link and `UnitTable`
- [ ] Update `fixtureGame` in `lib/research/toi-trends-view.test.ts` for the new required `ResearchGame` field
- [ ] `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`: copy the Phase 1 harness, desktop context only, pick the player from the page DOM
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clicking a name jumps to the panel; Back and reload keep the player; the tab is right after clicking a unit-table name | PLYR-01, UNIT-04 | Auth-gated page, real browser navigation | Signed in, `/research?team=MTL&games=5`: click a lower-row name, then a PP unit-table name, then Back, then reload |
| A line change reads at a glance: new linemates on top with New, old ones Fading or Out | PLYR-04 / SC4 | Judgment on real data | Pick a forward whose line changed in the latest game |
| Heat-strip squares read as separate and clickable; shades distinguishable in light and dark mode; selected-row bar visible on tinted rows | PLYR-02, D-06 | Visual | Check both color schemes |
| Missing-shift-chart games show blank or amber, never 0, and the existing Last game tables show the same values as before | SC5 | Cross-check | Compare a team with a no-chart game; compare a unit table against the pre-phase build |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
