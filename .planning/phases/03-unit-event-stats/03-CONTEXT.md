# Phase 3: Unit Event Stats - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add play-by-play to every game load, attribute each event to the skaters on ice, and show shots, goals and shot attempts for and against (SF/SA, GF/GA, CF/CA plus SF%, CF%, +/-) on every last-game unit table (EV, PP, SH; forwards and defense). Counts must reconcile with the official boxscore, and fixture tests gate the UI work. The loader must survive "Last 20" without NHL throttling failures (bounded concurrency, 429 retry, longer caching of finished games).

Not in this phase: event stats outside the last-game unit tables, event trends, per-60 or xG, league-wide views.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (already locked — do not re-ask)
- Attribution: an event at elapsed second T belongs to the skaters on ice with `start < t <= end` (REQUIREMENTS Conventions; research measured 100% on 2,644 events).
- Blocked shots count toward the shooting team's Corsi (`eventOwnerTeamId` is the shooter's team).
- Excluded from SF/GF/CF: empty-net events, shootout events (`periodType === "SO"`, never by period number), `teammate-blocked` attempts.
- One strength classifier (`situationFor` in `lib/research/lines.ts`) for both TOI and events; a 6v5 empty-net stretch is not a PP.
- Gate: event-attribution fixture tests (team SOG + every skater's plus-minus on real regulation, OT, shootout, empty-net, penalty-shot and missing-shift-chart games) pass before any plan adds event columns (ROADMAP gate).
- Unknown is never 0 (Phase 1 TRND-04, Phase 2 D-24): missing data shows "—".
- Laptop browsers only; no phone/touch UAT.

### Caching and throttling (DATA-01)
- **D-01:** Goal is **fewer NHL calls** using Next's existing fetch cache. No Neon persistence (stays out of scope per REQUIREMENTS).
- **D-02:** **Tiered TTL by game age** for finished-game data (boxscore, shift chart, play-by-play): games **under 48 hours old revalidate every 1 hour; older games every 30 days**. Named constants. The existing empty-shift-chart uncached re-request (`getShiftCharts`) stays.
- **D-03:** **No manual refresh / cache-bypass control** on the page.
- **D-04:** When requests still fail after bounded concurrency + 429 retry, the **page always renders**; games that failed are left out and named in the existing banner (Phase 1 01-06 pattern).
- **D-05:** **Play-by-play-only failure keeps the game.** If the boxscore and shift chart loaded but play-by-play failed or is unpublished, the game stays in TOI trends and the linemate strip; only its event columns show "—", and the page notes that play-by-play is missing for that date. Same spirit as a failed shift chart today.

### PP/SH stats
- **D-06:** **PP and SH tables show the same 9 columns as EV** (SF, SA, SF%, GF, GA, +/-, CF, CA, CF%). The legend explains that PP/SH percentages are lopsided by nature. This resolves the STATE.md Phase 3 concern.
- **D-07:** **+/- is GF − GA on every table**, PP/SH included. The legend notes it is not the official NHL plus-minus (which ignores PP goals for and SH goals against).

### Table layout
- **D-08:** **One table per row, full width**, stacked EV-F, EV-D, PP-F, PP-D, SH-F, SH-D. This replaces the `lg:grid-cols-2` grid in `components/LastGameLines.tsx`.
- **D-09:** Stat columns use **Frozen Pool order, grouped**: Goals (GF GA +/-), Shots (SF SA SF%), Corsi (CF CA CF%), with a group header row or light dividers between groups. Existing #, Time, % and line-name columns stay.
- **D-10:** **Neutral numbers, no colour coding** on %, +/- or counts. Green/red remains reserved for Phase 1 deployment movers.
- **D-11:** **Keep the current unit caps** (`UNIT_LIMITS`: EV F4/D3, PP F2/D2, SH F3/D3). Units below the cap roll into "Other".

### "Other" row, totals and exclusions (UNIT-03)
- **D-12:** Each table ends with an **"Other" row and a "Total" row**. "Other" = every event in that situation not on a listed unit (below-cap units, partial combos mid-change, 4v4/3v3 for EV). "Total" = the team's total for that situation, so listed + Other = Total. Total shows situation time as well.
- **D-13:** **4v4/3v3 events count as EV** and land in the EV table's "Other" row, consistent with `analyzeGameLines` counting those seconds as EV.
- **D-14:** A **one-line per-game exclusions note** under the tables, e.g. "Excluded: 1 empty-net goal, 2 shootout attempts, 3 teammate-blocked", so post-exclusion totals reconcile visibly with the official boxscore.
- **D-15:** A **legend** defines SF, GF, CF, SF%, CF%, +/- and the exclusions (UNIT-03), and states that SF%/CF% show "—" when for + against = 0 (UNIT-02).

### Unreliable or missing data (DATA-02)
- **D-16:** If a game's shift-derived on-ice skater counts disagree with play-by-play `situationCode` on too many events, **stats are still shown with an amber warning** (e.g. "Shift data disagrees with play-by-play on N% of events; counts may be off"), reusing Phase 2's amber footnote treatment.
- **D-17:** Threshold starts at **95% match**, one named constant; the fixture spike measures real games and may tune it. Penalty-shot events are expected mismatches and should not count against a game.
- **D-18:** If the **last game has no play-by-play** (just finished, unpublished or failed), unit tables still show the units with Time/% columns; **event columns show "—" with a note**. **No fallback** to an earlier game.

### Answers to research open questions (2026-10-13)
- **D-19:** A cold "Last 20" taking **about 10 s is acceptable**; ship the paced loader from research.
- **D-20:** **+/- shows `0`** when a unit had shot attempts but no goals; "—" only when the unit had no events at all (research A3).
- **D-21:** **Pulled-goalie (empty-net) stretches go to "Other", not to exclusions.** Every event while either team's goalie is out of the net (6v5 or 5v6, defending-goalie or shooting-team goalie digit `0` in `situationCode`) is counted in that situation's "Other" row and in Total, and is never attributed to a listed unit. This replaces research A4 and supersedes "empty-net" in the D-14 exclusions note and the D-15 legend: the legend says pulled-goalie events are in Other; exclusions remain shootout, penalty-shot and teammate-blocked attempts.
- **D-22:** **The unit Time column follows D-21.** Seconds while either goalie is out of the net are credited to the "Other" row (and Total), not to a listed unit, so a unit's Time and its event counts cover the same stretches. Pulled-goalie seconds come from the shift chart (no goalie shift covering that second). This changes the unit tables' Time and % values from Phases 1–2 for games with a pulled goalie; update the affected `lines` tests deliberately. Player TOI totals, the trends table and Phase 2 linemate time are unchanged.
- **D-23:** **Detect corrupted shift charts.** Game 2025020565 (BUF at NJD: every shift row tripled, 36 VGK/SJS players listed, 13/36 plus-minus wrong while 118/119 events still match `situationCode`) is committed as a negative regression fixture, not a plus-minus gate fixture. Add a shift-chart sanity check that flags a game when its chart contains players whose team is not one of the two teams in the game, or repeats identical shift rows beyond the normal duplicates seen in good games (threshold set from the fixtures). A flagged game gets the D-16 amber warning on its event stats. The fixture test must show 2025020565 is flagged and every gate fixture is not.

### Claude's Discretion
- Concurrency cap and retry/backoff details for DATA-01 (research suggests ~6 concurrent; verify 429 behaviour in dev before production).
- Penalty shots: research says exclude them from unit attribution but keep them in team-level reconciliation. Follow that, and decide whether they appear in the D-14 exclusions note.
- Whether OT events (not shootout) count on PP/SH/EV tables. Default: yes, consistent with whole-game `lines` including OT (Phase 1). Document the choice in the legend if it matters.
- Exact legend wording and placement, the group-header styling, and the "Other"/"Total" row styling within the existing neutral visual language (`tabular-nums`, neutral palette).
- How a game's age is determined for the D-02 TTL tier (schedule date or start time) and how the TTL is passed per request.
- If a play-by-play response is too large for Next's data cache (check the per-entry size limit in `node_modules/next/dist/docs/`), choose a workaround that still meets D-01 (e.g. caching a trimmed or derived per-game result). Do not add Neon persistence.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria, fixture-test gate, research flags
- `.planning/REQUIREMENTS.md` — DATA-01..03, UNIT-01..03, and the "Conventions (decided)" section (attribution rule, exclusions)
- `.planning/PROJECT.md` — Key Decisions table (event stats on all unit tables)
- `.planning/STATE.md` — Phase 3 blockers (PP/SH % concern now resolved by D-06; 429 cap verification)

### Domain research (event attribution pitfalls)
- `.planning/research/SUMMARY.md` — Phase 3 acceptance gate, T-1 bucketing, 429 at ~40 concurrent, ≥95% situationCode match
- `.planning/research/PITFALLS.md` — situationCode digit order, empty-net 6v5, shootout/penalty-shot leaks, period-boundary keys
- `.planning/research/FEATURES.md` — Frozen Pool column set, 4v4/3v3 units not summing to totals
- `.planning/research/ARCHITECTURE.md` — proposed timeline / event merge structure
- `.planning/research/STACK.md` — no new dependencies, concurrency limiter

### Prior phase decisions
- `.planning/phases/01-ice-time-trends-table/01-CONTEXT.md` — per-game failure isolation, banner, OT handling
- `.planning/phases/02-player-linemate-detail/02-CONTEXT.md` — D-19 regulation-only linemate time, D-22 unit-table links, D-24 unknown-not-0

### Framework
- `node_modules/next/dist/docs/` — fetch caching / revalidate behaviour in this Next.js 16 version (AGENTS.md: read before writing code)

### External reference
- https://frozenpool.dobbersports.com/frozenpool_last3gamelines.php?team=MTL — target table format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/research/lines.ts`: `situationFor`, `dedupeOnIce`, `bucketOnIce`, `uniqueShifts`, `analyzeGameLines` (units per situation/group). Event attribution should reuse the same on-ice timeline and strength rule.
- `lib/research/pair-seconds.ts`: an existing per-second on-ice walk that can serve as a pattern for an event join.
- `lib/nhl/client.ts`: `nhlGet`, `FINISHED_GAME_CACHE` (1h revalidate; becomes tiered per D-02), `getShiftCharts` uncached-empty refetch. Play-by-play client goes here.
- `components/LastGameLines.tsx`: `UnitTable`, `UNIT_LIMITS`, `PlayerLink` usage (UNIT-04 links must keep working).
- Phase 2's amber no-chart footnote in `components/PlayerLinemates.tsx`: pattern for the D-16/D-18 notes.

### Established Patterns
- Per-game failure isolation in `lib/research/team-games.ts` (`Promise.allSettled`, `unavailableDates`); currently loads all games at once, so the concurrency limit goes here.
- Nullable per-game data means unknown (`lines: GameLines | null`, `pairs: GamePairs | null`). Event data should follow suit (e.g. `events: ... | null`).
- Pure, tested analysis functions with `*.test.ts` beside the source; `tsx --test` runner.

### Integration Points
- `ResearchGame` in `lib/research/team-games.ts` gains per-game event data; `loadGame` adds the play-by-play fetch.
- `LastGameLines` renders the new columns, the Other/Total rows, the exclusions note, the warnings and the legend.

</code_context>

<specifics>
## Specific Ideas

- Target look: Frozen Pool "last 3 game lines". Stacked blocks, raw counts plus SF%/CF%/+/-, and a legend.
- Previewed and accepted row shape: `# | Time | % | Line | GF GA +/- | SF SA SF% | CF CA CF%`, then `Other` and `Total` rows.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope.

</deferred>

---

*Phase: 03-unit-event-stats*
*Context gathered: 2026-10-13*
