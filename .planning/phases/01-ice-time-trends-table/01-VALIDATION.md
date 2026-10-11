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
| **Quick run command** | `npx tsx --test lib/research/toi-trends.test.ts lib/research/lines.test.ts lib/research/game-strip.test.ts lib/research/toi-trends-view.test.ts` (list only the files that exist at that point) |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run build && npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx` |
| **Estimated runtime** | ~20 seconds (build ~8 s) |

Note (planner, 2026-10-11): `npm run lint` is not used — it lints the whole repo and fails at baseline (1512 problems) on untracked `.claude/` GSD files. The scoped `npx eslint ...` above is clean at baseline. `npm run build` runs locally in ~8 s and catches server/client component boundary errors that `tsc` does not.

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` commands (quick run command above for the test files it touches)
- **After every plan wave:** Run the full suite command above
- **Before `/gsd-verify-work`:** Full suite must be green, then manual UAT below
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 (tracer) | 01 | 1 | TRND-01, TRND-04 | T-01-01, T-01-02 | Auth gate kept; no new NHL request | live smoke + build | `npx tsx -e '…'` smoke in 01-01-PLAN Task 1, then `npx tsc --noEmit && npm run build` | n/a (live smoke, existing suite) | ⬜ pending |
| 01-01-T2 | 01 | 1 | TRND-04 | — | Missed / unknown games never 0 | unit | `npx tsx --test lib/research/toi-trends.test.ts lib/research/lines.test.ts` | ❌ created in this task | ⬜ pending |
| 01-01-T3 | 01 | 1 | TRND-01 | T-01-03 | Trends section is a server component | markup | `npx tsx --test lib/research/toi-trends-view.test.ts` | ❌ created in this task | ⬜ pending |
| 01-02-T1 | 02 | 2 | TRND-02, TRND-04 | — | — | unit + markup | `npx tsx --test lib/research/game-strip.test.ts lib/research/toi-trends-view.test.ts` | ❌ game-strip.test.ts created in this task | ⬜ pending |
| 01-02-T2 | 02 | 2 | TRND-02 | T-01-04 | API strings rendered escaped only | unit + markup | `npx tsx --test lib/research/game-strip.test.ts lib/research/toi-trends-view.test.ts` | ✅ after 01-02-T1 | ⬜ pending |
| 01-03-T1 | 03 | 3 | TRND-03, TRND-04 | — | — | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ⬜ pending |
| 01-03-T2 | 03 | 3 | TRND-03, D-16/D-18/D-19 | T-01-05 | — | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ⬜ pending |
| 01-04-T1 | 04 | 4 | TRND-05 | T-01-06, T-01-07 | `?sort`/`dir` allowlisted; hrefs built from validated values | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ⬜ pending |
| 01-04-T2 | 04 | 4 | TRND-05 | — | — | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/research/toi-trends.test.ts` — covers TRND-01, 03, 04, 05 and D-16 with hand-built `ResearchGame`-shaped fixtures (created in 01-01 Task 2, extended by plans 03-04)
- [ ] `regulationSeconds` case in `lib/research/lines.test.ts` — TRND-04 (OT minutes removed) (01-01 Task 2)
- [ ] `lib/research/toi-trends-view.test.ts` — rendered markup of `components/ToiTrends.tsx` via `renderToStaticMarkup(createElement(...))`, fixture data, no network (created in 01-01 Task 3, extended by plans 02-04). Kept `.ts` with no JSX so the existing `lib/**/*.test.ts` glob runs it with no package.json change.
- [ ] `lib/research/game-strip.test.ts` — strip shading, cell states, per-game detail text for TRND-02 (01-02)
- The tracer (01-01 Task 1) has no new test file; its automated proof is a live smoke over MTL's real OT and SO games plus the existing suite.
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
