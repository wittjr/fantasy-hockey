---
phase: "1"
slug: "ice-time-trends-table"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-11"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner via tsx 4.23.13 (`node:test`, `node:assert/strict`) |
| **Config file** | none — `npm test` script in package.json (`tsx --test lib/**/*.test.ts`) |
| **Quick run command** | `npx tsx --test lib/research/toi-trends.test.ts lib/research/lines.test.ts` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test lib/research/toi-trends.test.ts lib/research/lines.test.ts`
- **After every plan wave:** Run `npm test && npx tsc --noEmit && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green, then manual UAT below
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner/executor) | | | TRND-01..05, D-16 | — | `?sort` validated against allowlist | unit | `npx tsx --test lib/research/toi-trends.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/research/toi-trends.test.ts` — covers TRND-01, 03, 04, 05 and D-16 with hand-built `ResearchGame`-shaped fixtures
- [ ] `regulationSeconds` case in `lib/research/lines.test.ts` — TRND-04 (OT minutes removed)
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No per-game numeric grid; D-01 column order; F block then D block | TRND-01 | Auth-gated page, visual | `/research?team=<T>&games=10` |
| Strip popover on hover and keyboard focus; OT game shows "OT" + regulation TOI; DNP cell empty | TRND-02 | Visual/interaction | Hover and Tab through strip cells |
| Below 3 games: no delta, GP visible; below 2: no arrow; Last game: values only | TRND-03/04 | Visual | Check a recently called-up player and `games=1` |
| Sort headers toggle, survive reload and team/window changes, F always first, "—" rows last | TRND-05 | Auth-gated navigation | Click each header, reload, switch team |
| Popover not clipped at last F/D rows and at Last 20; tap works on touch | TRND-02 | Layout/touch | Check on desktop and phone |
| Tint frequency sane (a handful of rows per roster) | D-16 | Judgment on real data | Scan several teams |
| OT game regulation TOI + OT excluded = NHL.com boxscore TOI | D-13 | Cross-source check | Compare one forward in one OT game |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
