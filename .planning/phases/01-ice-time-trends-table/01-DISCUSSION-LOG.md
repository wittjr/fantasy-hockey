# Phase 1: Ice-Time Trends Table - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 01-ice-time-trends-table
**Areas discussed:** Row columns & density, 'Recent' & min-games, Per-game detail access, Sorting & highlighting

---

## Row columns & density

| Question | Options | Selected |
|----------|---------|----------|
| Main PP number | PP share % / PP TOI per game / Both | PP share % |
| How to present direction | Delta + arrow / Both numbers / Slope only | Delta + arrow |
| SH column | Own column / Small, after PP / Drop it | Small, after PP |
| Row density | Compact one line / Roomier / You decide | You decide |

---

## 'Recent' & min-games

| Question | Options | Selected |
|----------|---------|----------|
| What counts as recent | Last 2 games / Last game only / Scales with window | Last 2 games |
| Minimum games for a trend | 3 / 2 / 4+ | 2 |
| Window of 1 | Just values, no trend / Hide window of 1 | Just values, no trend |
| Slope vs delta conflict | Delta drives color / Show both uncolored / You decide | Delta drives color |
| Delta at exactly 2 games | Shrink recent to 1 / Slope only at 2 | Slope only at 2 |
| Player's vs team's last 2 | Player's last 2 played / Team's last 2 | Team's last 2 |
| Flag missing team's last 2 | Small 'out' marker / Just '—' delta | Small 'out' marker |

**Notes:** "Last 2" + "min 2 games" conflicted (no earlier games to compare); resolved as slope at ≥2 games, delta at ≥3.

---

## Per-game detail access

| Question | Options | Selected |
|----------|---------|----------|
| Reaching per-game values | Sparkline tooltip / Mini per-game strip / Expand row now | Mini per-game strip |
| OT flagging | Mark in detail / Also exclude from trend / Only in detail | Also exclude from trend |
| Games without shift data | Show TOI, PP/SH '—' / You decide | Show TOI, PP/SH '—' |
| Strip shading | TOI vs player's avg / TOI absolute / Toggle TOI/PP share | TOI vs player's avg |
| Strip vs sparkline | Strip replaces sparkline / Keep both | Keep both |
| OT exclusion method | Remove OT minutes only / Drop whole OT game | Remove OT minutes only |
| OT in Avg TOI | Avg too / Only slope/delta | Avg too |

---

## Sorting & highlighting

| Question | Options | Selected |
|----------|---------|----------|
| Default sort | Avg TOI within F/D / Biggest TOI delta | Avg TOI within F/D |
| Sort trigger | Clickable headers / Sort links above table | Clickable headers |
| Trend sorts | Both TOI Δ and PP Δ / TOI Δ only | Both |
| Mover highlight | Subtle row tint / Delta color only | Subtle row tint |
| Mover threshold | ±1:00 & ±10 pts / ±0:45 & ±7 pts / You decide | You decide |
| Tint trigger | Either delta / TOI only | Either |

---

## Claude's Discretion

- Row density and spacing
- Mover thresholds (tune against real team data)
- Sort direction toggling, header affordances, null-delta ordering
- OT detection method

## Deferred Ideas

None.
