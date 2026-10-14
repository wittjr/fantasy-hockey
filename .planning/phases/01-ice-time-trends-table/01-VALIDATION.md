---
phase: "1"
slug: "ice-time-trends-table"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-11"
validated: "2026-10-14"
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
| 01-01-T1 (tracer) | 01 | 1 | TRND-01, TRND-04 | T-01-01, T-01-02 | Auth gate kept; no new NHL request | live smoke + build | `npx tsx -e '…'` smoke in 01-01-PLAN Task 1, then `npx tsc --noEmit && npm run build` | n/a (live smoke, existing suite) | ✅ rules pinned by 01-01-T2/T3 tests (live smoke was one-time) |
| 01-01-T2 | 01 | 1 | TRND-04 | — | Missed / unknown games never 0 | unit | `npx tsx --test lib/research/toi-trends.test.ts lib/research/lines.test.ts` | ✅ | ✅ green |
| 01-01-T3 | 01 | 1 | TRND-01 | T-01-03 | Trends section is a server component | markup | `npx tsx --test lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-02-T1 | 02 | 2 | TRND-02, TRND-04 | — | — | unit + markup | `npx tsx --test lib/research/game-strip.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-02-T2 | 02 | 2 | TRND-02 | T-01-04 | API strings rendered escaped only | unit + markup | `npx tsx --test lib/research/game-strip.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-03-T1 | 03 | 3 | TRND-03, TRND-04 | — | — | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-03-T2 | 03 | 3 | TRND-03, D-16/D-18/D-19 | T-01-05 | — | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-04-T1 | 04 | 4 | TRND-05 | T-01-06, T-01-07 | `?sort`/`dir` allowlisted; hrefs built from validated values | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-04-T2 | 04 | 4 | TRND-05 | — | — | unit + markup | `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-05-T1 (tracer) | 05 | 5 | TRND-01, TRND-03, TRND-04 | (plan) T-01-09, T-01-10 | — | unit (+ one-time live smoke) | `npx tsx --test lib/research/lines.test.ts` | ✅ | ✅ green |
| 01-05-T2 | 05 | 5 | TRND-04 | (plan) T-01-09, T-01-10 | — | unit | `npx tsx --test lib/nhl/client.test.ts` | ✅ | ✅ green |
| 01-06-T1 (tracer) | 06 | 6 | TRND-01, TRND-04 | (plan) T-01-01, T-01-11..13 | — | unit + markup | `npx tsx --test lib/research/team-games.test.ts lib/research/toi-trends-view.test.ts` | ✅ | ✅ green |
| 01-06-T2 | 06 | 6 | TRND-04 | (plan) T-01-01, T-01-11..13 | Fixed error banner; no API path or status in markup | unit | `npx tsx --test lib/research/team-games.test.ts` | ✅ | ✅ green |
| 01-07-T1 (tracer) | 07 | 7 | TRND-02 | (plan) T-01-04, T-01-14 | — | markup | `npx tsx --test lib/research/toi-trends-view.test.ts lib/research/game-strip.test.ts` | ✅ | ✅ green |
| 01-07-T2 | 07 | 7 | TRND-03, TRND-05 | (plan) T-01-04, T-01-14 | — | unit + markup | `npx tsx --test lib/research/toi-trends-view.test.ts lib/research/toi-trends.test.ts` | ✅ | ✅ green |
| 01-08-T1 (tracer) | 08 | 8 | TRND-02 | (plan) T-01-04, T-01-15..17 | — | unit + markup + build CSS check | `npx tsx --test lib/research/toi-trends-view.test.ts lib/research/game-strip.test.ts` | ✅ | ✅ green |
| 01-08-T2 | 08 | 8 | TRND-02 | (plan) T-01-04, T-01-15..17 | — | browser e2e (WebKit) | `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` | ✅ | ⚠️ could not run 2026-10-14 (see audit) |
| 01-09-T1 | 09 | 9 | TRND-02, TRND-04 | (plan) T-01-04, T-01-17, T-01-18 | — | markup (+ browser e2e) | `npx tsx --test lib/research/toi-trends-view.test.ts lib/research/game-strip.test.ts` | ✅ | ✅ green |
| 01-09-T2 | 09 | 9 | TRND-02 | (plan) T-01-04, T-01-17, T-01-18 | — | doc check | grep checks in 01-09-PLAN Task 2 | ✅ | ✅ one-time doc check |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky or could not run*

---

## Wave 0 Requirements

- [x] `lib/research/toi-trends.test.ts` — covers TRND-01, 03, 04, 05 and D-16 with hand-built `ResearchGame`-shaped fixtures (created in 01-01 Task 2, extended by plans 03-04)
- [x] `regulationSeconds` case in `lib/research/lines.test.ts` — TRND-04 (OT minutes removed) (01-01 Task 2)
- [x] `lib/research/toi-trends-view.test.ts` — rendered markup of `components/ToiTrends.tsx` via `renderToStaticMarkup(createElement(...))`, fixture data, no network (created in 01-01 Task 3, extended by plans 02-04). Kept `.ts` with no JSX so the existing `lib/**/*.test.ts` glob runs it with no package.json change.
- [x] `lib/research/game-strip.test.ts` — strip shading, cell states, per-game detail text for TRND-02 (01-02)
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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-14 (validate-phase audit during the phase 01 re-verification)

Audit notes (2026-10-14): the six phase-01 test files (`toi-trends`, `lines`, `toi-trends-view`, `game-strip`, `team-games`, `lib/nhl/client`) ran 176/176 green. `webkit-strip-check.cjs` could not run: its readiness probe aborts each request after 3 s, but `/research?team=MTL&games=5` now takes about 5 s to render (the page fetches more since phase 03), and with a longer probe the npx cache's `playwright-core` 1.64.1 needs WebKit build 2370, while only 2336 is installed. The popover's click, hover and keyboard behaviour therefore stays under Manual-Only above until `npx playwright install webkit` is run and the probe timeout is raised.

## Validation Audit 2026-10-14

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
