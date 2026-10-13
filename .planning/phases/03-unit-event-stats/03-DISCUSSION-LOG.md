# Phase 3: Unit Event Stats - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 03-unit-event-stats
**Areas discussed:** Caching of NHL API data (user-added), PP/SH percentages, Table layout & columns, 'Other' row & totals, Unreliable-game handling

---

## Caching of NHL API data

| Option | Description | Selected |
|--------|-------------|----------|
| Fewer NHL calls | Keep Next fetch cache, hold finished games longer | ✓ |
| Persist raw data in Neon | Store boxscore/shifts/PBP in Postgres | |
| Keep 1-hour cache as is | Only add concurrency limit + 429 retry | |

| Option | Description | Selected |
|--------|-------------|----------|
| 24 hours | One daily refresh | |
| 1 week or longer | Fewest calls, may miss late corrections | |
| Tiered by game age | Short TTL for recent games, long for older | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| <48h: 1h, older: 1 week | Recent games refresh hourly | ✓ (later changed to 30 days) |
| <24h: 1h, older: 1 day | More conservative | |
| You decide | | |

Manual refresh control: **No** (vs "Yes, a refresh link").

After retries fail: **Partial page + named games** (vs "Keep game, stats '—'").
Follow-up (PBP-only failure): **Only event columns go '—'; game stays in TOI/linemates** (vs "Drop the whole game").

**Notes:** User added this area themselves.

---

## PP/SH percentages

| Option | Description | Selected |
|--------|-------------|----------|
| Same as EV | All 9 columns everywhere; legend explains lopsidedness | ✓ |
| Raw counts only on PP/SH | Drop SF%/CF%/+/- | |
| PP 'for' only; SH 'against' only | Most compact | |

+/- on PP/SH: **GF − GA, same as EV** (vs "Omit +/- on PP/SH").

---

## Table layout & columns

| Option | Description | Selected |
|--------|-------------|----------|
| One per row, full width | Stacked six tables | ✓ (preview accepted) |
| Keep 2-up, F and D side by side | Denser, likely wraps | |
| Situation tabs | Adds URL state | |

Grouping: **Frozen Pool order, grouped (Goals, Shots, Corsi)** (vs Shots-first order, You decide).
Colour: **No, neutral numbers** (vs subtle tint).
Unit caps: **Keep current caps** (vs show every unit).

---

## 'Other' row & totals

| Option | Description | Selected |
|--------|-------------|----------|
| 'Other' + 'Total' rows | listed + other = total | ✓ (preview accepted) |
| 'Other' row only | | |

4v4/3v3 events: **EV table's 'Other' row** (vs excluded from unit tables).
Per-game exclusions note: **Yes, one line per game** (vs legend only).

---

## Unreliable-game handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show stats + warning | Amber note with mismatch % | ✓ |
| Hide stats ('—') | | |
| Show, no warning | | |

Threshold: **95% match, tune in research** (vs any mismatch).
Last game without PBP: **'—' with a note, no fallback** (vs fall back to previous game).

---

## Claude's Discretion

- Concurrency cap and retry/backoff
- Penalty-shot handling detail and whether it appears in the exclusions note
- OT (non-shootout) events on unit tables (default: included)
- Legend wording, group-header and Other/Total row styling
- How game age is determined for TTL tiers
- Workaround if play-by-play exceeds Next's data-cache entry size (no Neon)

## Deferred Ideas

None.

**Follow-up (2026-10-13):** User changed the older-game TTL from 1 week to 30 days.
