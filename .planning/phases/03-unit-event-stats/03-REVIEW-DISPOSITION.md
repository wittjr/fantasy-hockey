---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Malformed play-by-play JSON throws outside the D-05 catch and drops the whole game"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Attributed-nowhere events are silently dropped, but the legend says Total is the team's total"
  - id: IN-01
    severity: info
    disposition: open
    title: "`NhlPlay.details` declares fields nothing reads"
  - id: IN-02
    severity: info
    disposition: open
    title: "A play-by-play or shift chart that comes back empty makes a fourth request per game, beyond the rate budget the pacing was tuned for"
  - id: IN-03
    severity: info
    disposition: open
    title: "Redundant class and non-drained response on the non-OK path"
  - id: IN-04
    severity: info
    disposition: open
    title: "The unit-name separator now has no whitespace, so names copy as \"A–B–C\" and wrapping is left to atomic-inline rules"
---

# Phase 03 code review disposition

Every finding in 03-REVIEW.md starts `open`. Update `disposition` (fixed / skipped / deferred) as each is triaged.

WR-01 fixed in quick 261014-quc (84ec065): buildGameEvents returns null on malformed play-by-play. WR-02 fixed in quick 261014-quc (0768b00): an amber note above the unit tables counts shot attempts with no shift data. IN-01..IN-04 open (info).
