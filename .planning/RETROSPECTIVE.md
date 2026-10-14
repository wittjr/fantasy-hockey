# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Line Research

**Shipped:** 2026-10-14
**Phases:** 3 | **Plans:** 29 (16 initial, 13 gap/fix plans) | **Quick tasks:** 6 | **Commits:** 322 over 4 days

### What Was Built
- Ice-time trends table on `/research`: regulation-only Avg TOI, PP share, SH, recent-vs-window Δ with mover tints, URL sorting, clickable per-game strip
- Player detail panel: per-game linemate heat strip by situation, window share, New/Rising/Fading/Out tags
- Play-by-play attribution to on-ice units, reconciled to the official boxscore, driving GF/GA, SF/SA, CF/CA on every last-game unit table
- Paced, cached loading so "Last 20" survives NHL throttling

### What Worked
- Gating the risky Phase 3 attribution on committed real-game fixtures that must reproduce boxscore SOG and every skater's plus-minus before any UI work. It caught real rule errors and made later changes (teammate-blocked Corsi) safe.
- Pure, fixture-tested view-models with thin server components: 557 tests run in seconds with no browser.
- The re-runnable WebKit harness on live data caught a real defect (scroll anchoring on panel close) that unit tests could not.
- Verification passed 9/9, 5/5 and 5/5 must-haves; UAT found 5 issues across 22 tests, all fixed or explicitly deferred.

### What Was Inefficient
- Phase 1 needed 5 gap plans (01-05..01-09) after review and UAT, more than its 4 initial plans; the per-game strip went through hover-only, click, then separate bordered squares.
- A first UI audit scored 24/24 and was later found unsupported; contrast and copy drift surfaced only on re-audit. Small-text contrast (`neutral-400` dashes, `amber-600` notes) was fixed piecemeal across three quick tasks.
- UI-SPECs drifted from shipped copy and had to be amended after the fact several times.
- Review ledgers: the hand-curated Phase 1 disposition file cannot be parsed by the GSD review step, so it needs manual reconciliation.

### Patterns Established
- Unknown is never zero: missing shift charts or play-by-play render "—" and are excluded from shares, tags and totals; a note says why.
- Per-game failure isolation: one bad boxscore, shift chart or play-by-play costs only that game's affected data.
- Small text must hold WCAG AA in both themes: `neutral-600 / dark:neutral-400` for muted text, `amber-700 / dark:amber-400` for notes; disabled controls may stay lighter.
- URL is the state for team, window, sort, player, situation and show-all.

### Key Lessons
1. Run the contrast check while building, not at audit time: every muted or caution text class should be checked at its actual size on both themes.
2. Update the UI-SPEC in the same commit as a copy or style change, so audits compare like with like.
3. For data derived from a third-party feed, a reconciliation gate against an official total is worth its cost; build it before the UI.
4. Make every mapping of external JSON total (or contained) from the start; review found an unguarded path that could drop a whole game.

### Cost Observations
- Model mix, session count and token cost were not tracked this milestone.
- Notable: gap plans and quick tasks (19 of 35 units of work) outnumbered initial plans; tighter UI acceptance up front would cut most of them.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | not tracked | 3 | Fixture reconciliation gate before UI; WebKit harness on live data |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 557 | not measured | 0 new runtime dependencies |

### Top Lessons (Verified Across Milestones)

1. (Needs a second milestone to verify.)
