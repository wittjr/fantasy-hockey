---
phase: quick-261012-tph
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/research/lines.ts
  - lib/research/lines.test.ts
  - lib/research/pair-seconds.ts
  - lib/research/pair-seconds.test.ts
autonomous: true
requirements: [WR-01]

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "If one skater has two overlapping rows that are not identical, analyzeGameLines classifies a 5v5 second as even strength and gives him one second, not two"
    - "If an opponent has overlapping rows, the team's EV/PP/SH classification in analyzeGameLines does not change"
    - "No unit in analyzeGameLines (EV/PP/SH, F or D) lists the same player id twice"
    - "On a regulation chart with overlapping rows, pairSeconds' own seconds equal analyzeGameLines' playerSeconds for every skater (the oracle test now covers more than clean charts)"
    - "pairSeconds and analyzeGameLines share one dedupe helper, and the pair-seconds.ts header no longer says the two passes differ"
  artifacts:
    - path: "lib/research/lines.ts"
      provides: "Exported dedupeOnIce helper; analyzeGameLines dedupes own and opponent on-ice skaters before situationFor"
      contains: "export function dedupeOnIce"
    - path: "lib/research/pair-seconds.ts"
      provides: "pairSeconds uses the shared dedupeOnIce from ./lines; header says both passes dedupe"
      contains: "dedupeOnIce"
    - path: "lib/research/lines.test.ts"
      provides: "Overlapping-row fixture tests for analyzeGameLines (own skater, opponent, PP unit)"
      contains: "overlapping"
    - path: "lib/research/pair-seconds.test.ts"
      provides: "Oracle test on a chart with overlapping rows"
      contains: "overlapping"
  key_links:
    - from: "lib/research/lines.ts analyzeGameLines"
      to: "dedupeOnIce"
      via: "called on own and opponent OnIce before situationFor; deduped skaters also feed playerSeconds and unit grouping"
      pattern: "dedupeOnIce\\("
    - from: "lib/research/pair-seconds.ts"
      to: "lib/research/lines.ts"
      via: "named import of dedupeOnIce, replacing the file's own copy"
      pattern: "dedupeOnIce"
---

<objective>
Finish WR-01 (02-REVIEW.md). Commit d935cc1 made pairSeconds dedupe on-ice skaters, own team and opponent, before calling situationFor. analyzeGameLines in lib/research/lines.ts still counts the raw skater list from bucketOnIce. bucketOnIce pushes a player's id once per row, so a player with two overlapping rows that are not identical counts twice. This task applies the same dedupe to analyzeGameLines, so the two passes classify strength the same way.

Audit of the inflated count in analyzeGameLines. All three uses read the same `mine.skaters`, so one dedupe at the top of the per-second loop fixes all three:
1. Strength. situationFor reads skater counts on both teams, so a 5v5 second can read as PP, or an opponent's overlap can read as SH.
2. playerSeconds. The loop over `mine.skaters` gives the player two seconds for each second he is on ice.
3. Units. The F/D id list keeps the repeated id. An EV forward line then has 4 ids and fails the EV_UNIT_SIZE check, so it is dropped. A PP unit gets a key like "1,4,4,5,6".

This was confirmed on a scratch copy at planning time. Every fixture below fails against the current lines.ts and passes once the dedupe is added.

Purpose: playerSeconds and units from analyzeGameLines feed the TOI trends (PP share), the last-game unit tables and the oracle test. On charts with overlapping rows they are wrong today and disagree with pairSeconds.
Output: dedupeOnIce exported from lines.ts and used by both passes. New fixture tests in lines.test.ts. An oracle test on overlapping rows in pair-seconds.test.ts. Updated header and JSDoc comments.

Out of scope: bucketOnIce keeps returning one id per row, so its output is unchanged. Only the JSDoc gets a note. Deduping inside bucketOnIce is the alternative, but it would undo the mechanism d935cc1 just added. uniqueShifts, regulationSeconds, trendSlope and situationFor are unchanged.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/02-player-linemate-detail/02-REVIEW.md
@.planning/phases/02-player-linemate-detail/02-REVIEW-FIX.md
@lib/research/lines.ts
@lib/research/lines.test.ts
@lib/research/pair-seconds.ts
@lib/research/pair-seconds.test.ts

Reference: `git show d935cc1` is the pairSeconds change to mirror.

<interfaces>
From lib/research/lines.ts (current):
- `export interface OnIce { skaters: number[]; goalie: boolean }` (around line 76)
- `export function situationFor(team: OnIce, opp: OnIce): Situation`. Strength is the skater count, minus one when the goalie is pulled.
- `export function bucketOnIce(shifts, positions): Map<number, Map<string, OnIce>>`. Runs uniqueShifts first. After that it pushes `shift.playerId` once per row, so overlapping rows for one player that are not identical repeat the id.
- `export function analyzeGameLines(team, shifts, positions): GameLines`. The per-second loop (around lines 123-144) reads `mine = byTeam.get(team)`, and `opp` is the first other team or an empty OnIce. It calls `situationFor(mine, opp)`, credits each id in `mine.skaters`, and builds F/D unit keys from `mine.skaters`.

From lib/research/pair-seconds.ts (after d935cc1):
- A local helper (lines 26-27) builds a new OnIce from `[...new Set(onIce.skaters)]` with the goalie unchanged. Its JSDoc reads "One entry per player, so overlapping rows for the same player cannot inflate the skater count that decides strength."
- The loop applies it to `rawMine` and to the opponent before situationFor.

Test helpers already in both test files: a `positions` map (BUF F 1-6, D 11-14, G 20; OPP F 101-105, G 120) and `shifts(team, ids, startSec, endSec, period = 1)`. pair-seconds.test.ts also has the `evPpSh` fixture (0-60 5v5, 60-90 BUF PP, 90-120 BUF SH).
</interfaces>
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Dedupe on-ice skaters in analyzeGameLines before strength, seconds and units (tracer)</name>
  <files>lib/research/lines.ts, lib/research/lines.test.ts</files>
  <behavior>
    - Test A, own skater with overlapping rows: rows BUF [1] 0-60, BUF [1] 30-60, BUF [2,3,11,12,20] 0-60 and OPP [101,102,103,104,105,120] 0-60.
      - situationSeconds is {ev:60, pp:0, sh:0}.
      - playerSeconds.get(1) is {ev:60, pp:0, sh:0}.
      - units.ev.F is [{playerIds:[1,2,3], seconds:60, pct:100}].
      - units.pp.F is [].
      - Current code gives {ev:30, pp:30} and skater 1 {ev:30, pp:60}.
    - Test B, opponent with overlapping rows: rows BUF [1,2,3,11,12,20] 0-60, OPP [101,102,103,104,105,120] 0-60 and OPP [101] 30-60.
      - situationSeconds is {ev:60, pp:0, sh:0}.
      - playerSeconds.get(1) is {ev:60, pp:0, sh:0}.
      - Current code gives {ev:30, sh:30}.
    - Test C, overlapping rows on the power play: rows BUF [4,5,6,1,13,20] 0-30, BUF [4] 10-30 and OPP [101,102,103,104,120] 0-30.
      - units.pp.F is [{playerIds:[1,4,5,6], seconds:30, pct:100}].
      - playerSeconds.get(4) is {ev:0, pp:30, sh:0}.
      - Current code splits the unit into [1,4,4,5,6] 20s and [1,4,5,6] 10s, and gives skater 4 pp:50.
  </behavior>
  <action>
RED: append Tests A, B and C from the behavior block to the end of lib/research/lines.test.ts, after the test that checks no player's PP or SH seconds exceed the team's.
- Reuse the file's `positions` and `shifts` helpers.
- Use plain-language names in the file's style:
  - "a player's overlapping differing rows do not inflate the skater count, so 5v5 stays even strength"
  - "an opponent's overlapping differing rows do not turn even strength into a short-handed second"
  - "a player's overlapping differing rows on the power play count once in his seconds and in the unit"
- Add a one-line comment on Test A explaining that, counted raw, skater 1's rows make 6 skaters plus a goalie, which reads as a power play.
- Run the test file and confirm all three fail on the current code.

GREEN in lib/research/lines.ts (per WR-01, mirroring d935cc1):
1. Add the helper `export function dedupeOnIce(onIce: OnIce): OnIce` just below the `OnIce` interface.
   - It returns a new OnIce: skaters is the Set-deduped list in first-seen order, and goalie is copied over.
   - Give it pair-seconds.ts's JSDoc wording: one entry per player, so overlapping rows for one player cannot inflate the skater count that decides strength.
   - Use a function declaration, matching the other exports in lines.ts.
2. In analyzeGameLines' per-second loop, rename the `byTeam.get(team)` result to `rawMine` and keep the empty/missing guard on it. Then set `mine` to `dedupeOnIce(rawMine)`. Wrap the opponent expression (the other team or the empty OnIce) in `dedupeOnIce` too.
3. Leave everything after that unchanged: the situationFor call, the playerSeconds loop and the F/D unit grouping keep reading `mine.skaters`, which now has no repeats. This one change fixes all three uses listed in the objective.
4. Update the analyzeGameLines JSDoc:
   - Repeated rows are still dropped by uniqueShifts.
   - Overlapping rows for one player now count once per second via dedupeOnIce.
   - So neither can inflate the skater count that decides EV/PP/SH, double a player's seconds, or put an id in a unit twice.
5. Add one sentence to the bucketOnIce JSDoc: a player with overlapping rows that are not identical is listed once per row, so callers that count skaters should pass each OnIce through dedupeOnIce.

Do not change bucketOnIce's code, uniqueShifts, situationFor or the GameLines shape. Keep semicolons and the existing style (AGENTS.md: minimum code, touch only what you must).
  </action>
  <verify>
    <automated>npx tsx --test lib/research/lines.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Before the lines.ts edit, the three new tests failed. After it, `npx tsx --test lib/research/lines.test.ts` passes every test, old and new.
    - `grep -c "export function dedupeOnIce" lib/research/lines.ts` prints 1.
    - `grep -c "dedupeOnIce(" lib/research/lines.ts` prints at least 2 (own and opponent calls in analyzeGameLines).
  </acceptance_criteria>
  <done>analyzeGameLines dedupes own and opponent skaters before situationFor. Overlapping rows no longer flip strength, double a player's seconds or repeat an id in a unit key. Tests A-C pass, and every existing lines test still passes.</done>
</task>

<task type="auto">
  <name>Task 2: Share dedupeOnIce with pairSeconds, fix the header, and extend the oracle test to overlapping rows</name>
  <files>lib/research/pair-seconds.ts, lib/research/pair-seconds.test.ts</files>
  <action>
In lib/research/pair-seconds.ts:
1. Add `dedupeOnIce` to the existing named import from "./lines", keeping the list alphabetical as it is now.
2. Delete the module's own dedupe helper and its JSDoc (lines 26-27). Replace its two call sites (own team and opponent) with `dedupeOnIce`.
3. Leave NO_ONE, emptyRecord and the loop logic unchanged.
4. Rewrite header line 3, the sentence saying this pass treats overlapping rows differently from analyzeGameLines. It should now say that both passes count a player with two overlapping rows that are not identical once (dedupeOnIce) before classifying strength. Lines 1-2 stay as they are.

In lib/research/pair-seconds.test.ts, add a new test directly after the existing "(oracle)" test. Name it "own seconds equal analyzeGameLines' per-skater seconds on a chart with overlapping differing rows (oracle)".
- Fixture: the `evPpSh` rows plus BUF [1] 30-60 (own overlap at even strength), OPP [101] 70-90 (opponent overlap during the BUF power play) and BUF [13] 100-120 (own overlap while short-handed).
- Assert that analyzeGameLines' situationSeconds is {ev:60, pp:30, sh:30}, so the overlaps did not change strength.
- Then use the same assertions as the existing oracle test: `self.size` equals `lines.playerSeconds.size`, and every playerSeconds record deep-equals `self.get(id)`, with the skater id in the message.
- At planning time this fixture failed against the old analyzeGameLines and passed with Task 1's change. It now guards against the two passes drifting apart again, so no RED step is needed here.

Leave the existing oracle and overlapping-row tests unchanged.
  </action>
  <verify>
    <automated>npx tsx --test lib/research/*.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsx --test lib/research/*.test.ts` passes every test, with 0 failures.
    - `npx tsc --noEmit` exits 0. One exception: in a fresh git worktree, an error only about the generated `LayoutProps` type in app/layout.tsx is the known missing-type issue recorded in 02-REVIEW-FIX.md, not this change. Re-run tsc in the main checkout to confirm.
    - `grep -c "dedupeOnIce" lib/research/pair-seconds.ts` prints at least 3 (the import plus two calls).
    - `grep -c "Unlike analyzeGameLines" lib/research/pair-seconds.ts` prints 0.
    - `grep -cE "^const dedupe\b" lib/research/pair-seconds.ts` prints 0.
  </acceptance_criteria>
  <done>pairSeconds and analyzeGameLines use one dedupeOnIce from lines.ts. The pair-seconds.ts header says both passes dedupe. The oracle test passes on a chart with overlapping rows at EV, PP and SH. The whole research test suite passes, and tsc is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| NHL shift-chart API to research analysis | Public, unauthenticated shift rows come in as ShiftInput[]. The feed is known to contain repeated rows and overlapping rows. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-tph-01 | Tampering | analyzeGameLines strength classification (lib/research/lines.ts) | low | mitigate | Overlapping rows in the feed corrupt the EV/PP/SH totals and unit tables shown to the user. dedupeOnIce runs on both teams before situationFor, and Tests A-C plus the overlapping-row oracle test pin the result. |
| T-tph-02 | Denial of Service | dedupeOnIce per-second Set allocation | low | accept | It builds one Set of at most about 6 ids per team per on-ice second, about 4,000 seconds per game. pairSeconds already pays this cost, so it adds no new risk. |
| T-tph-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages, so the package-legitimacy gate does not apply. |
</threat_model>

<verification>
- `npx tsx --test lib/research/*.test.ts` passes, including the 3 new lines tests and the new overlapping-row oracle test.
- `npx tsc --noEmit` exits 0.
- `git diff --stat` shows changes only to lib/research/lines.ts, lib/research/lines.test.ts, lib/research/pair-seconds.ts and lib/research/pair-seconds.test.ts.
</verification>

<success_criteria>
- analyzeGameLines and pairSeconds classify strength from deduped on-ice skaters for both teams, using one shared helper.
- playerSeconds and unit keys from analyzeGameLines never count one player twice in a second.
- The oracle test (pairs.self equals lines.playerSeconds) holds on a chart with overlapping rows, not only on clean charts.
- The pair-seconds.ts header no longer says it differs from analyzeGameLines.
</success_criteria>

<output>
Create `.planning/quick/261012-tph-wr-01-follow-up-dedupe-skaters-before-st/261012-tph-SUMMARY.md` when done.
</output>
