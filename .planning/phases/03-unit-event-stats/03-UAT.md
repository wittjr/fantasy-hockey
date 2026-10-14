---
status: diagnosed
phase: 03-unit-event-stats
source: [03-VERIFICATION.md]
started: 2026-10-14T14:34:47Z
updated: 2026-10-14T15:42:28.212Z
---

## Current Test

[testing complete]

## Tests

### 1. Boxscore cross-check
expected: Sum of SF over the EV, PP and SH forwards Total rows equals NHL.com boxscore SOG for MTL, minus any penalty shot listed in the exclusions note
result: issue
reported: "format looks fine, but can you investigate the CF/CA numbers? I see other sites calculated some different values. For the first line \"N. Suzuki – C. Caufield – J. Slafkovský\" I see CF = 11, where our code has CF = 10.  And for line 3 \"C. Kreider  – J. Anderson – A. Newhook\", I see CA =6 other places and CA=5 here."
severity: major
note: "SF check itself confirmed by user: forwards EV+PP+SH Total SF = 38 = boxscore SOG. Issue is CF/CA only (G-03-1)."

### 2. Legend and exclusions wording
expected: SF, GF, CF, SF%, CF%, +/-, Other, and the placement of pulled-goalie / 4-on-4 / 3-on-3 time and events in Other read clearly
result: pass

### 3. Screenshot review (light and dark, 1024 px)
expected: In the session scratchpad's units-check-light.png and units-check-dark.png (or the live page), columns align, the Goals/Shots/Corsi dividers run down each table, and the Total row stands out
result: issue
reported: "the numbers in the Goals +/- and Shots SF% columns need some space between them and the vertical divider line. The divider line at the start of each stat section has a little too much space"
severity: cosmetic

### 4. No-data game
expected: A window game with no shift chart or no play-by-play shows a dash with the amber note in its cells, never 0
result: pass

### 5. Post-deploy Vercel Last 20
expected: After deploying, open Last 20 for two or three teams within a minute; no "Couldn't load NHL data" banner
result: pass

### 6. Plus-minus exception decision
expected: Accept or reject SC1 with the one pinned, cause-checked exception (2025020500, A. Panarin: official 0, reproduced -1); see the suggested override in 03-VERIFICATION.md
result: pass
note: "User accepted the override: if the shift chart lists the player on ice at the goal second it should count; the official 0 may be a manual league adjustment."

### 7. Line name separator spacing
expected: In unit rows, the dash between player names is centered between the names with modest, even spacing (e.g. "W. Carrier – S. Aho – A. Svechnikov")
result: issue
reported: "I noticed that on shift lines the the - separating the players is directly in front of the name of the players, after the first.  I think a little less space is needed and the \"-\" should be centered between the names"
severity: cosmetic
note: "Raised by user during test 4 (which passed); screenshot showed a wide gap before each dash and almost none after it."

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0
blocked: 0

## Deferred Follow-Ups

- test: 2
  idea: "I want to add a target for later to be able to see the details in \"Other\""
  deferred_at: 2026-10-14

## Gaps

- gap_id: G-03-1
  truth: "Unit CF/CA match the public convention used by other line-stat sites (e.g. MTL 2026020092: L1 Suzuki-Caufield-Slafkovsky EV CF 11, L3 Kreider-Anderson-Newhook EV CA 6)"
  status: failed
  reason: "User reported: L1 CF shows 10 (others 11); L3 CA shows 5 (others 6) for the Oct 13 MTL vs BUF game"
  severity: major
  test: 1
  root_cause: "Locked decision (03-CONTEXT.md line 21 / D-14) excludes blocked-shot plays with reason 'teammate-blocked' from every count; other sites count them as shot attempts for the shooting team. In 2026020092, L1 was on ice (5v5) for MTL's teammate-blocked attempt at P1 03:06 and L3 for BUF's at P2 19:34 - exactly the +1 CF and +1 CA. Verified in scratch: blocked-shot eventOwnerTeamId equals the shooter's team for all 25 blocks; shift-boundary convention is not the cause."
  artifacts:
    - path: "lib/research/play-events.ts"
      issue: "teammate-blocked mapped to an Exclusion, so it never reaches CF/CA"
    - path: "lib/research/unit-events-view.ts"
      issue: "legend and exclusions note describe teammate-blocked as excluded"
  decision: "User (2026-10-14): count teammate-blocked attempts in CF/CA. Supersedes the teammate-blocked part of 03-CONTEXT.md D-14/D-21 exclusions."
  missing:
    - "Map teammate-blocked blocked-shots as counted events (CF for shooter's team, CA for opponent; never SF/GF)"
    - "Remove teammate-blocked from the exclusions note, excluded counts and legend text; update tests/fixtures"
  debug_session: ""

- gap_id: G-03-3
  truth: "Units table stat groups (Goals, Shots, Corsi) have balanced spacing: the last number in a group is not flush against the next divider, and the gap after each divider is not oversized"
  status: failed
  reason: "User reported: the numbers in the Goals +/- and Shots SF% columns need some space between them and the vertical divider line. The divider line at the start of each stat section has a little too much space"
  severity: cosmetic
  test: 3
  root_cause: "components/LastGameLines.tsx gives every stat td/th only left padding (pl-3) and right-aligns the numbers, so the last column of a group (+/-, SF%) has no right padding and touches the next group's border-l, while the group-start column gets pl-3 on top of right-aligned slack in its fixed width."
  artifacts:
    - path: "components/LastGameLines.tsx"
      issue: "cell padding at lines 106 and 156 is pl-3 only; group header th at line 145 also pl-3"
  missing:
    - "Add right padding to the last column of each group (the cell before a divider)"
    - "Reduce left padding on group-start (c.start) cells and the colgroup header so the divider gap matches"
  debug_session: ""

- gap_id: G-03-7
  truth: "The en dash between player names in a unit row is visually centered with modest, equal spacing on both sides"
  status: failed
  reason: "User reported: the - separating the players is directly in front of the name of the players, after the first. A little less space is needed and the - should be centered between the names"
  severity: cosmetic
  test: 7
  root_cause: "components/LastGameLines.tsx:178 renders the separator as a text span ' – ' between PlayerLink anchors; the rendered gap is uneven (wide before the dash, almost none after). Exact cause of the asymmetry not yet confirmed in the browser."
  artifacts:
    - path: "components/LastGameLines.tsx"
      issue: "separator <span aria-hidden> – </span> relies on literal spaces for spacing"
  missing:
    - "Render the separator with explicit, symmetric horizontal margin (e.g. mx-1 on the span, no literal spaces) and confirm in light/dark at 1024 px"
  debug_session: ""
