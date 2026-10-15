# Phase 2: Player Linemate Detail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 2-player-linemate-detail
**Areas discussed:** Where detail opens, Heat strip readout, New/Rising/Fading rules, OT/trades/edge cases

---

## Where detail opens

| Question | Options | Selected |
|----------|---------|----------|
| Where the detail appears | Panel above table / Inline under the row / Side drawer / Replaces Last game section | Panel above table |
| Click target in a row | Player name link / Whole row | Player name link |
| After clicking a lower row | Jump to the panel / Stay where you are | Jump to the panel |
| Close or switch | Close button + click another / Click same name toggles | Close button + click another |
| Panel header | Name + his trend numbers / Name and position only | Name + his trend numbers |
| Mark selected row | Yes, subtle highlight / No marker | Yes, subtle highlight |

---

## Heat strip readout

| Question | Options | Selected |
|----------|---------|----------|
| Cell content | Shade only, numbers on click / Minutes in each cell / Share % in each cell | Shade only, numbers on click |
| Shade driver | Share of his TOI / Minutes together | Share of his TOI |
| Row summary | Window share + tag / Window minutes + share + tag / Tag only | Window share + tag |
| EV/PP/SH layout | Tabs, EV default / Stacked blocks / EV shown, PP/SH collapsed | Tabs, EV default |
| Who's listed | Meaningful time, capped / Everyone he shared ice with / Top N only | Meaningful time, capped |
| Order | Recent time first / Window total first | Recent time first |
| F / D split | One strip, two groups / Two separate strips | One strip, two groups |

---

## New/Rising/Fading rules

| Question | Options | Selected |
|----------|---------|----------|
| New | Real time recently, none before / First time ever in the window | Real time recently, none before |
| Rising/Fading | Share change, recent vs earlier / Slope across the window | Share change, recent vs earlier |
| Threshold | You decide, tuned on real data / ±25 share points / ±15 share points | ±15 share points |
| Absent linemate | No, mark him Out / Yes, Fading regardless | No, mark him Out |
| Selected player absent | Compare only games he played / Use team's last 2 regardless | Compare only games he played |
| Minimum games | Same as Phase 1 delta: 3 games / 2 games | 2 games |
| 2-game case (conflict with recent = last 2) | Recent = last game at 2 games / Recent = last game always / Keep last 2; tags start at 3 | Recent = last game at 2 games |

**Notes:** "Min 2 games" conflicted with "recent = team's last 2 games" (nothing earlier to compare). Resolved: at exactly 2 games, recent = latest game vs the one before; at 3+ games recent stays the last 2.

---

## OT, trades, edge cases

| Question | Options | Selected |
|----------|---------|----------|
| OT time in linemate time | No, regulation only / Yes, include OT | No, regulation only |
| Traded / called-up linemate | Blank "not with team" / Treat like a missed game | Blank "not with team" |
| Position-group change | Group by his main position / Group per game | Group by his main position |
| Unit-table click tab | That table's situation / Always EV | That table's situation |
| Goalies | No, skaters only / List goalie as context | No, skaters only |

---

## Claude's Discretion

- The minimum for "meaningful" time and the list caps per situation
- Panel, tab, divider and highlight visual design, within the Phase 1 visual language
- How the jump to the panel is done
- Tag glyphs and wording
- Where pair seconds are computed (extend `analyzeGameLines` or a new timeline helper)
- What happens to `?player` on a team or window change. This wasn't discussed; the suggested default is recorded in CONTEXT.md.

## Deferred Ideas

None.
