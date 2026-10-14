---
phase: "1"
slug: "ice-time-trends-table"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-12"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `/research` server component | Signed-in user requests the page with `team`, `games`, `sort`, `dir` query params | Untrusted query strings (allowlisted before use) |
| Server → public NHL APIs | Boxscore, schedule and shift-chart fetches (unauthenticated) | Public game data; treated as untrusted upstream content |
| Server component → `ToiStripCell` client component | The only client boundary in the trends table | Aria-label string, a state literal, a static class string and server-rendered children |
| WebKit check scratch app (dev tooling) | Temp copy of the app with the auth gate removed, served for automated browser checks | Public NHL data only; no secrets, no DB |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Elevation of Privilege | `app/research/page.tsx` auth gate | medium | mitigate | `await auth()` + `redirect("/login")` at the top of the page (present) | closed |
| T-01-02 | Denial of Service | `lib/research/team-games.ts` loadGame | low | mitigate | OT and regulation TOI derive from already-fetched boxscore and shift chart; no new request per game | closed |
| T-01-03 | Information Disclosure | `components/ToiTrends.tsx` | low | mitigate | Server component (no `"use client"`); only rendered HTML reaches the browser | closed |
| T-01-04 | Tampering | `components/ToiGameStrip.tsx` popover and aria-label | medium | mitigate | API strings rendered only as React text and attributes; `dangerouslySetInnerHTML` count 0 across trends components and page | closed |
| T-01-05 | Denial of Service | buildTrendRows delta/mover computation | low | accept | Bounded arithmetic, no I/O; `games` allowlisted | closed |
| T-01-06 | Tampering | `sort` / `dir` params | medium | mitigate | `parseSort` allowlist (SORT_KEYS, exact "asc"), unit-tested; used by the page | closed |
| T-01-07 | Tampering | `researchHref` and header/nav links | medium | mitigate | hrefs built from validated values via URLSearchParams; no raw param interpolation (`String(sortParam)` count 0) | closed |
| T-01-08 | Denial of Service | sort navigation | low | accept | Same allowlisted games count; NHL data from the Data Cache; sorting adds no fetch | closed |
| T-01-09 | Tampering | `analyzeGameLines` upstream shift-feed integrity | medium | mitigate | `uniqueShifts` drops verbatim-repeated rows for both consumers; regression tests + live check on game 2026020075 | closed |
| T-01-10 | Denial of Service | `getShiftCharts` uncached refetch | low | accept | At most one uncached request per empty chart per page view (≤ 20); concurrency/429 handling is DATA-01 (Phase 3) | closed |
| T-01-11 | Information Disclosure | page error banner | low | mitigate | Fixed copy only; error details to server log; `.message` uses in page = 0 | closed |
| T-01-12 | Denial of Service | `loadTeamResearch` / `loadGame` | medium | mitigate | `Promise.allSettled` plus per-game shift-chart `.catch`; tested with stubbed fetch | closed |
| T-01-13 | Tampering | partial window shown as complete | low | mitigate | Dropped games listed via `unavailableDates` amber note; never rendered as DNP or 0 | closed |
| T-01-14 | Tampering | strip/table markup changes (01-07) | low | accept | Static classes and fixed copy only; T-01-04 unchanged | closed |
| T-01-15 | Information Disclosure | `components/ToiStripCell.tsx` client boundary | low | mitigate | Only strings, a state literal and server-rendered children cross; no `TrendRow`, game objects or Maps passed | closed |
| T-01-16 | Denial of Service | `ToiStripCell` document listener | low | mitigate | `pointerdown` listener added only while open and removed in effect cleanup (1 add / 1 remove) | closed |
| T-01-17 | Elevation of Privilege | `webkit-strip-check.cjs` scratch app (auth gate removed) | low | mitigate | Gate removed only in an OS temp copy; binds 127.0.0.1; `.env*` files filtered out of the copy; process group killed in `finally` | closed |
| T-01-18 | Tampering | strip/table markup and copy (01-09) | low | accept | Static classes and fixed copy only; T-01-04 unchanged; `ToiStripCell` untouched | closed |
| T-01-SC | Tampering | npm installs (all plans) | low | accept | No package-manager install in any plan; the WebKit check uses the cached `playwright-core` and exits instead of installing | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-05 | O(players × games) arithmetic per request, no I/O, user-controlled sizes allowlisted | Phase 1 plan threat model (01-03) | 2026-10-11 |
| AR-02 | T-01-08 | Sorting re-renders with cached NHL data and adds no fetch | Phase 1 plan threat model (01-04) | 2026-10-11 |
| AR-03 | T-01-10 | One extra uncached request per still-empty shift chart, bounded by the 20-game window; rate limiting deferred to DATA-01 (Phase 3) | Phase 1 plan threat model (01-05) | 2026-10-11 |
| AR-04 | T-01-14, T-01-18 | Class-string and fixed-copy changes only; escaping guarantees of T-01-04 unchanged | Phase 1 plan threat models (01-07, 01-09) | 2026-10-12 |
| AR-05 | T-01-SC | No packages installed by this phase | Phase 1 plan threat models | 2026-10-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-12 | 19 | 19 | 0 | /gsd-secure-phase (L1 grep verification; register authored at plan time, short-circuit, no auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-12
