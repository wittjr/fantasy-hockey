# Phase 2: Player Linemate Detail - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a player detail panel to `/research`. Clicking a player's name in the trends table, or in a Last game unit table, selects him (`?player=<id>` in the URL). The panel shows who he has been on the ice with, game by game, per situation (EV / PP / SH), as a linemate heat strip with forwards and D partners grouped apart. It also shows each linemate's time together as a share of the player's own situation TOI, and New / Rising / Fading / Out tags based on time together only. Covers PLYR-01..04 and UNIT-04.

Not in this phase:
- Unit event stats (SF/SA, GF/GA, CF/CA) and play-by-play: Phase 3.
- Linemate quality scoring of any kind: out of scope for the project.
- League ownership on the research page: belongs in the league view.

The existing Last game unit tables must keep showing the same TOI and share values (roadmap success criterion 5).

</domain>

<decisions>
## Implementation Decisions

### Where the detail opens
- **D-01:** The detail is a **panel at the top of the page, above the trends table**. It is server-rendered from `?player=<id>`, and the trends table stays below it.
- **D-02:** In the trends table, **the player's name is the link** that opens the detail, not the whole row. This avoids clashing with the clickable per-game squares and the sort headers.
- **D-03:** After a click, the page **jumps to the panel**, even when the clicked row is far down the table.
- **D-04:** The panel has a **close (×) link that clears `?player`**. Clicking another name swaps the player, and browser back/forward works because the selection lives in the URL. Selecting a player keeps the existing `team` / `games` / `sort` / `dir` params.
- **D-05:** The panel header shows the **player's name, position, and his trends-row numbers** (Avg TOI, TOI Δ, PP share, PP share Δ), reusing the existing `TrendRow` values and formatting. The linemate change then sits next to his deployment change.
- **D-06:** The selected player's row in the trends table gets a **subtle neutral highlight** (an outline or neutral background) that does not clash with the green/red mover tint.

### Heat strip readout
- **D-07:** Each cell (one linemate × one game) is **shade only**. Minutes together and share appear in a popover on click, hover or keyboard focus, reusing the Phase 1 per-game strip pattern (`ToiStripCell` + popover).
- **D-08:** Cell shade is driven by **share of the player's own situation TOI that game**: time together ÷ the selected player's regulation seconds in that situation. A full-time linemate is dark whether the player had 12 or 20 minutes.
- **D-09:** Each linemate row ends with a summary: his **window share** (time together ÷ the player's situation seconds, across the games the player played) and his **tag**. Minutes appear only in the popover.
- **D-10:** EV / PP / SH are **tabs, EV by default**. The selected tab lives in the URL (e.g. `?sit=pp`, allowlisted like `sort`), so it survives reload and sharing.
- **D-11:** Only **linemates with meaningful time** are listed. Line-change noise below a minimum is hidden. The list is capped at roughly 6 forwards and 4 D at EV, with fewer for PP/SH, and has a "show all" link. The exact minimum and caps are Claude's discretion.
- **D-12:** Rows are ordered by **recent time first** (the recent games defined in D-15), then by window total. A line change pushes the new linemates to the top.
- **D-13:** **One strip with two groups.** The forwards block comes first, then a divider, then the D block, all sharing the same game columns. This matches the trends table's F-then-D layout.

### New / Rising / Fading / Out tags (time together only)
- **D-14:** **New:** meaningful time together in the recent games, and little or none in the earlier games of the window. Example: a forward moved to a new line in the latest game shows his new linemates as New.
- **D-15:** **Recent vs earlier.** With 3 or more games, "recent" is the team's last 2 games (Phase 1 D-05). With exactly 2 games, recent is the latest game and earlier is the game before it. Tags need at least 2 games in which the selected player played. In a 1-game window there are no tags.
- **D-16:** **Rising / Fading:** the linemate's share of the player's situation TOI in the recent games, compared with the earlier games. **Rising at +15 share points or more, Fading at −15 or less** (the same threshold as the Phase 1 PP-share movers). Smaller changes get no tag. Fading also covers a linemate who played but no longer shares ice with the player.
- **D-17:** **A linemate who missed the recent games** (scratched or injured) is tagged **Out**, never Fading, like Phase 1's "DNP last 2". His missed games are blank, never 0.
- **D-18:** **When the selected player missed games**, those columns are blank and excluded from both the recent and earlier parts. If he missed all of the recent games, no New / Rising / Fading tags are shown.

### OT, trades and edge cases
- **D-19:** **Linemate time is regulation only**, periods 1–3, in every situation. OT games stay in the strip, marked as in Phase 1, and their regulation seconds count. For consistency, the share denominator is also the player's regulation situation seconds. Note this differs from Phase 1's PP/SH, which use whole-game `lines` including OT.
- **D-20:** **A traded or called-up linemate** shows **blank "not with team"** for games when he wasn't on the team, never 0. Those games don't count toward his share or tags. A newly acquired player who gets real time shows as New.
- **D-21:** A player whose position group changed during the window is **listed once, under the group he played most** in the window.
- **D-22:** **Clicking a name in a Last game unit table (UNIT-04)** opens his detail **on that table's situation tab** (EV, PP or SH).
- **D-23:** **Skaters only.** Goalies can't be selected and aren't listed as linemates.
- **D-24:** **Missing shift charts** (unpublished, or a failed request) show as unknown/blank in the heat strip, never 0, and don't count toward shares or tags (roadmap criterion 5; DATA-02 spirit).

### Follow-up decisions (after phase research, 2026-10-12)
- **D-25:** **Window share counts only the games where both players dressed and a shift chart exists.** A linemate's missed games are blank and do not dilute his share (the UI-SPEC "absent" rule). This refines D-09's "across the games the player played".
- **D-26:** **Tagged linemates bypass the list cap.** Rows tagged New, Rising, Fading or Out are always listed, even past the ~6F/4D (EV) or 4F/3D (PP/SH) cap; on real data this adds about 1 row on average. The minimum-time filter still applies. "Show all" still lists everyone above the minimum.
- **D-27:** **Keep ±15 share points** for Rising/Fading (D-16 confirmed after research showed tags on about a third of EV rows). It is one named constant, to be raised to ±20 if UAT finds the tags noisy.

### Claude's Discretion
- The minimum time together that counts as "meaningful" for listing and for New, and the exact list caps per situation (D-11, D-14). Tune these on real team data.
- The visual design of the panel, tabs, divider, close link, row highlight and heat-strip colour, within the Phase 1 visual language (neutral palette, `tabular-nums`, squares and popovers like `ToiGameStrip`).
- What happens to `?player` when the team or window changes. Suggested: drop it when the player isn't on the new team's roster for the window, and keep it otherwise. This wasn't discussed.
- How the jump to the panel is done (a fragment anchor, `scroll` behaviour on links), provided it works with server rendering and the existing `PendingLink`.
- The tag glyphs and wording, as long as "New", "Rising", "Fading" and "Out" read clearly.
- Research recommendations adopted unless the plan finds a reason otherwise:
  - The "little or none earlier" bound for New is 10 share points (`LINEMATE_NEW_EARLIER_MAX_POINTS`).
  - When the player has no counted earlier game, no tags are shown and a footnote says why.
  - A linemate returning from injury who gets real recent time counts as New.
  - The already-selected name is a plain `#player-detail` anchor so re-clicking still jumps.
- Whether pair seconds come from extending `analyzeGameLines` or from a new timeline helper (research ARCHITECTURE suggests `timeline.ts` + `pairSeconds` + `lib/research/linemates.ts`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and requirements
- `.planning/PROJECT.md`: core value (spot role changes), constraints, Key Decisions (laptop-browser target; linemates by name, no quality score)
- `.planning/REQUIREMENTS.md`: PLYR-01..04, UNIT-04; DATA-02 (unknown, never 0) applies in spirit
- `.planning/ROADMAP.md` § Phase 2: goal and the 5 success criteria

### Research
- `.planning/research/FEATURES.md`: linemate heat strip, New/Rising/Fading tags, share of situation TOI, unit-row links; the anti-feature of quality scoring
- `.planning/research/ARCHITECTURE.md`: `?player=<id>` server-rendered pattern (Pattern 5), `lib/research/linemates.ts` view-model, share denominator, empty shift charts are normal
- `.planning/research/PITFALLS.md` § Pitfall 18 (linemate time conflated with availability, strength, line-change overlap) and § Pitfall 19 (traded, called-up, position-changed players)

### Phase 1 (decisions and patterns this phase builds on)
- `.planning/phases/01-ice-time-trends-table/01-CONTEXT.md`: D-05 recent window, D-06 minimum games, D-13 OT handling, D-17/D-18 sort keys and mover thresholds
- `.planning/phases/01-ice-time-trends-table/01-UI-SPEC.md`: visual language, the per-game strip and popover contract (as revised for G-01-2/G-01-5), mover tint colours
- `.planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md`: open review items on the strip component (WR-10: aria-expanded vs hover/focus; Escape blur) that a reused strip inherits

### Framework
- `node_modules/next/dist/docs/`: this Next.js 16 has breaking changes; read before writing code (AGENTS.md)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ToiStripCell.tsx` + `components/ToiGameStrip.tsx` + `lib/research/game-strip.ts`: the clickable square with popover (click/hover/focus, `data-open`, `nextOpen`). Reuse it for heat-strip cells.
- `lib/research/toi-trends.ts`: `buildTrendRows` / `TrendRow` (panel header numbers), `researchHref` + `parseSort` (URL param building and allowlisting; extend for `player` and `sit`), recent-vs-earlier delta logic and the `PP_MOVER_POINTS = 15` threshold pattern.
- `lib/research/lines.ts`: `analyzeGameLines` builds per-second on-ice sets per team (`uniqueShifts`, `REGULATION_PERIODS`, situation classification). Pair (linemate) seconds are a second pass over the same on-ice seconds.
- `lib/research/team-games.ts`: `ResearchGame` (`lines`, `regulationToi`, `overtime`, `toi` = who dressed), `TeamResearch.players` (`ResearchPlayer.group`), `situationSeconds`.
- `lib/research/format.ts`: `formatClock` and the date/opponent labels for the popover and column headers.
- `components/PendingLink.tsx`: links with pending spinner and prefetch off.

### Established Patterns
- The page is an async server component and all state is in search params (`team`, `games`, `sort`, `dir`). Add `player` and `sit` the same way, with allowlist validation and hrefs built only from validated values (threat-model T-01-06/T-01-07).
- Pure logic lives in `lib/research/*.ts` with co-located `node:test` tests. Markup tests use `renderToStaticMarkup` in `.ts` files.
- Missed or unknown games are `null`, never 0. They are excluded from averages, deltas and tags.
- F before D grouping. Neutral Tailwind palette with dark variants. `tabular-nums` for numbers.

### Integration Points
- `app/research/page.tsx`: render the panel above `ToiTrends` when `?player` is valid; the trends-table name cell becomes a link; the `LastGameLines` / `UnitTable` names become links carrying `sit`.
- `components/ToiTrends.tsx`: name cell link and selected-row highlight.
- `GameLines` currently exposes units and per-player seconds, but not pair seconds. Phase 2 needs per-game, per-situation, regulation-only pair seconds.

</code_context>

<specifics>
## Specific Ideas

- This phase answers the user's original ask: "toggle players to see the details for the player including line mate time trends, this will allow me to see who is starting to get access to better players". Show names only; the user judges linemate quality.
- The panel should make a line change obvious at a glance. New linemates rise to the top (recent-first ordering) and carry a New tag, and old ones fade.
- Keep the Phase 1 lesson: small, shade-only cells must still read as separate, clickable squares (20×20, gaps, borders, "click a square" hint). Hover-only discovery failed in UAT.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope.

</deferred>

---

*Phase: 02-player-linemate-detail*
*Context gathered: 2026-10-12*
