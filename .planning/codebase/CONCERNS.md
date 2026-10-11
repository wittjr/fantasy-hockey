---
last_mapped_commit: 71dcf6bf8b83733ab5a0ba6dd1f08cc26a801652
last_mapped_at: 2026-10-11
---
# Codebase Concerns

**Analysis Date:** 2026-10-11

## Tech Debt

**Outdated Dependencies:**
- Issue: Multiple dependencies have available updates including minor and patch versions
- Files: `package.json`
- Current versions vs. available:
  - `@neondatabase/serverless`: 1.1.0 → 1.2.0
  - `@types/node`: 20.19.43 → 26.6.5
  - `@types/react`: 19.2.18 → 19.3.0
  - `@types/react-dom`: 19.2.7 → 19.3.0
  - `drizzle-kit`: 0.31.10 → 0.31.11
  - `drizzle-orm`: 0.45.2 → 0.45.4
  - `eslint`: 9.39.5 → 10.12.0
  - `next`: 16.3.4 → 16.4.0
  - `zod`: 4.5.4 → 4.6.5
  - `tsx`: 4.23.13 → 4.23.15
  - `typescript`: 5.9.3 → 7.0.2
- Impact: Potential security patches missed, incompatibilities not addressed, new features not available
- Fix approach: Run `npm install` and test thoroughly; update in increments, testing after each major version bump

**Large Page Components:**
- Issue: Page components are monolithic and complex, making them hard to test and maintain
- Files: 
  - `app/leagues/[userLeagueId]/analysis/page.tsx` (727 lines)
  - `app/leagues/[userLeagueId]/planner/page.tsx` (516 lines)
  - `app/research/page.tsx` (374 lines)
- Impact: Difficult to unit test, high cognitive load, risky to modify, harder to debug when issues appear
- Fix approach: Extract data loading into separate hook/function, split rendering into smaller sub-components, consider moving complex logic to lib functions with tests

**Large Component Library:**
- Issue: Complex client components lack proper separation of concerns and are difficult to test
- Files:
  - `components/ProjectionsTable.tsx` (423 lines)
  - `components/PlayerStatsTable.tsx` (280 lines)
  - `components/DraftPickSync.tsx` (161 lines)
- Impact: Hard to debug issues, high risk of regressions, no test coverage means manual testing required
- Fix approach: Break into smaller composable components, add unit tests for sort/filter logic

**Experimental Next.js API:**
- Issue: Using `unstable_cache` from Next.js which is marked as unstable
- Files: `lib/fantrax/cached-projections.ts`
- Impact: API could change, behavior not guaranteed across Next.js versions, cache invalidation might not work as expected
- Fix approach: Monitor Next.js documentation for cache component stabilization; plan migration to stable API once available

## Known Bugs

**Yahoo Token Refresh Edge Case:**
- Symptoms: Yahoo OAuth refresh could fail silently if expiresAt check is off by milliseconds
- Files: `lib/yahoo/oauth.ts` (line 124)
- Trigger: Token expiry time reaches expiresAt between check and API call; EXPIRY_SKEW_MS helps but edge case still exists
- Current handling: `getYahooAccessToken` checks expiry with 60-second skew before returning token
- Mitigation: Try-catch in callers not implemented

**Fantrax API Projection Column Parsing:**
- Symptoms: If Fantrax changes column headers, `columnByPlayer` silently returns empty maps instead of erroring
- Files: `lib/fantrax/projections.ts` (lines 6-14)
- Trigger: Fantrax updates their column names (e.g., "FPts" → "FFantasyPts")
- Workaround: Error is thrown at higher level if no players have projections, but could be opaque

**Stale Roster Period Handling:**
- Symptoms: When future roster periods haven't started, they keep stale roster copies from Fantrax
- Files: `lib/planner/sources/fantrax.ts` (lines 68-72)
- Trigger: Roster changes before future period starts; old period still shows old roster
- Mitigation: Code detects mismatch and uses current roster instead, but only if period > current

## Security Considerations

**Database Query Validation:**
- Risk: User-supplied league IDs, team IDs, and player IDs are used in queries after validation but no explicit input sanitization before Drizzle
- Files: `lib/actions/league-actions.ts`, all import-* files
- Current mitigation: Drizzle ORM parameterizes all queries, preventing SQL injection; authorization checks verify user owns resource
- Recommendations: 
  - Add explicit validation with Zod for all user inputs (leagueId, teamId, etc.) before use
  - Consider centralizing input validation as middleware

**OAuth Token Storage:**
- Risk: Yahoo OAuth tokens stored in plaintext in database; no encryption at rest
- Files: `lib/db/schema.ts` (yahooConnections table), `lib/yahoo/oauth.ts`
- Current mitigation: Tokens only valid until `expiresAt`; breach would require stealing access_token and refresh_token together
- Recommendations:
  - Consider encrypting refresh_token in database; access_token can stay plaintext since it's short-lived
  - Add database-level encryption for sensitive columns
  - Ensure database backups are encrypted

**Discord OAuth Session:**
- Risk: Session tokens stored in database; session strategy is "database"
- Files: `auth.ts`, `lib/db/schema.ts`
- Current mitigation: NextAuth.js handles token generation and validation; sessions table has expiry
- Recommendations: Regularly audit session cleanup; ensure old sessions are deleted after expiry

**User Resource Access:**
- Risk: Most server actions check `userId` against resource but some might not
- Files: All `lib/actions/league-actions.ts`
- Current mitigation: Most functions call `requireUserId()` and verify ownership with `user_league.userId` checks
- Recommendations:
  - Audit every action to ensure ownership check happens
  - Consider middleware wrapper that auto-checks resource ownership by userLeagueId

## Performance Bottlenecks

**Fantrax API Projections Fetch:**
- Problem: Fetching per-game projections requires 2-3 large requests (~1MB each) that must complete in sequence
- Files: `lib/fantrax/cached-projections.ts`, `lib/fantrax/projections.ts` (getPeriodProjections, getRosterDayProjections, getSeasonProjections)
- Cause: Fantrax's fxpa API returns huge tables; no pagination or filtering available at source
- Current mitigation: 24-hour cache with `unstable_cache`; Promise.all for parallel fetches where possible
- Improvement path:
  - Measure actual response times; consider if 24hr cache is too long
  - Cache granularly: season vs period vs roster-day separately
  - Consider background refresh before cache expires to avoid user-facing delay
  - Add timeout handling so projections-required features don't hang

**Page Load Time:**
- Problem: Analysis page loads league data, projections, opponent rosters, schedule, and analysis sequentially
- Files: `app/leagues/[userLeagueId]/analysis/page.tsx` (lines 73-78)
- Cause: Some data depends on others; no incremental rendering
- Improvement path:
  - Use Suspense boundaries to show partial data sooner
  - Load non-critical data (opponent rosters) in background after render
  - Consider streaming/progressive enhancement

**Analysis Computation:**
- Problem: Gap analysis, team fit scoring, and player ranking run synchronously on page load
- Files: `lib/planner/lineup.ts` (336 lines of complex scoring logic)
- Cause: Complex algorithm that can't be easily parallelized
- Improvement path:
  - Profile the actual runtime; may be acceptable but untested
  - Consider memoizing intermediate results if analysis needs to run multiple times

## Fragile Areas

**Fantrax Undocumented API Dependency:**
- Files: `lib/fantrax/client.ts`, `lib/fantrax/projections.ts`, `lib/fantrax/cached-projections.ts`
- Why fragile: Fantrax fxea/fxpa endpoints are undocumented and unauthenticated — endpoints could change at any time
- Observation: Comment notes "If Fantrax ever locks these down, swap the fetch base for a cookie-authenticated fxpa/req call instead"
- Risk: Any Fantrax API response format change breaks projections, draft prep, planner
- Safe modification:
  - Keep fallback cookie-auth approach documented and testable
  - Add response validation (Zod schema) to catch format changes early
  - Add comprehensive logging of API responses for debugging
  - Test against real Fantrax API regularly
- Test coverage: Projections tested but client integration not tested

**Player Matching (Name + Team to Fantrax ID):**
- Files: `lib/import/match-players.ts`, `lib/analysis/match-projections.ts`
- Why fragile: Matches player names from spreadsheets/Yahoo to Fantrax by fuzzy name/position/team matching
- Risk: Wrong matches could lead to wrong projections assigned, wrong lineup recommendations
- Safe modification:
  - Add match confidence scores visible to user
  - Allow user to override bad matches
  - Test with real spreadsheets before deployment
- Test coverage: `match-players.test.ts` exists but only 93 lines

**Yahoo League Import:**
- Files: `lib/yahoo/import-league.ts`, `lib/yahoo/client.ts`
- Why fragile: Yahoo API responses have complex nested structures; changes to API response shape would break parsing
- Risk: Yahoo API change, network error mid-request could leave inconsistent data
- Safe modification:
  - Add Zod schemas for Yahoo API responses
  - Wrap Yahoo client calls with retry logic and error logging
  - Validate response structure before using
- Test coverage: `normalize.test.ts` exists but no integration tests

**Keeper Override Logic:**
- Files: `lib/fantrax/keeper-overrides.ts`
- Why fragile: Keeper selection uses heuristics (top 6 by ADP) that might not match actual keeper selections
- Risk: Incorrect keeper assumptions lead to wrong gap analysis, wrong draft recommendations
- Safe modification:
  - Add option for manual keeper selection override
  - Show confidence in keeper predictions
  - Let user mark which teams' keepers they know
- Test coverage: No tests

## Scaling Limits

**Fantrax Player Pool Size:**
- Current capacity: ~8,700 NHL players cached per Fantrax API
- Limit: If player pool grows significantly, memory usage and cache size will increase
- Scaling path: Monitor cache size; consider storing only active/relevant players if pool exceeds 10k

**Scoring Periods in Planner:**
- Current capacity: System assumes < 50 scoring periods per season (typical for weekly leagues)
- Limit: Daily-lineup leagues with 200+ periods could have performance issues
- Scaling path: Implement pagination for periods if supporting daily leagues becomes primary

**Number of Leagues per User:**
- Current capacity: Untested; UI assumes 1-3 leagues per user
- Limit: 10+ leagues would make home page listing slow
- Scaling path: Add league search/filter if supporting power users with many leagues

## Dependencies at Risk

**next-auth Beta Version:**
- Risk: Using `next-auth@5.0.0-beta.32` — a beta release
- Impact: Breaking changes possible in RC or stable release; security updates might lag
- Migration plan: 
  - Monitor next-auth releases for stable v5
  - Have test coverage for auth flows so upgrade is low-risk
  - Check migration guide when stable v5 is released

**exceljs for Spreadsheet Parsing:**
- Risk: Only dependency for parsing Excel files; no alternative easy to swap
- Impact: If exceljs has bugs with specific file formats, no fallback
- Current usage: Parsing "The List" projections spreadsheet
- Migration plan: Keep test files with various Excel formats; consider xlsx as alternative if needed

## Missing Critical Features

**No Email Notifications:**
- Problem: Roster changes, draft date reminders, league updates have no notification system
- Blocks: Users can't be proactively informed of important events
- Workaround: Users must visit website manually to check for updates

**No Offline Mode:**
- Problem: No cached projections/rosters available if API is down or user loses network
- Blocks: Can't use app during Fantrax outages or offline
- Workaround: Historical data in browser local storage not implemented

**No Undo/History:**
- Problem: Keeper overrides, draft targets, watched players, removed players have no undo
- Blocks: User mistakes can't be easily recovered without manually fixing each change
- Improvement: Add soft-delete with timestamp, show recent changes

**No Multi-League Draft Consolidation:**
- Problem: Draft Day Helper works on one league at a time; no way to see draft board across leagues
- Blocks: Users in multiple leagues can't use this for managing across their portfolio
- Improvement: Add league selector, consolidate player status across leagues

**No Real-Time Collaboration:**
- Problem: League managers can't see each other's draft recommendations or keeper selections
- Blocks: Non-real-time leagues lose collaborative analysis
- Improvement: Add optional shared board mode for friendly leagues

## Test Coverage Gaps

**Server Actions (None):**
- What's not tested: All `lib/actions/league-actions.ts` functions
- Files: `lib/actions/league-actions.ts` (305 lines)
- Risk: Deployment could break critical workflows (import league, sync roster, add draft targets) without catching it
- Priority: High — these directly modify user data

**Fantrax API Integration (Minimal):**
- What's not tested: `lib/fantrax/client.ts` network calls, error handling, response parsing
- Files: `lib/fantrax/client.ts` (206 lines), `lib/fantrax/import-league.ts` (238 lines), `lib/fantrax/draft-sync.ts`
- Risk: API changes or malformed responses caught only in production
- Priority: High — breaks user experience when Fantrax changes

**League Import Logic (None):**
- What's not tested: `importFantraxLeague`, `importYahooLeague`, team/roster syncing
- Files: `lib/fantrax/import-league.ts`, `lib/yahoo/import-league.ts`
- Risk: Broken imports leave database in inconsistent state
- Priority: High — foundational feature

**Draft Synchronization (None):**
- What's not tested: `lib/fantrax/draft-sync.ts` pick merging, duplicate handling
- Risk: Missed picks or duplicate picks go undetected until user notices
- Priority: High — core feature during draft season

**Analysis Engine (Limited):**
- What's not tested: `lib/analysis/run-analysis.ts` gap calculation, `lib/analysis/opponent-rosters.ts` opponent inference, `lib/analysis/match-projections.ts` matching logic
- Files: `lib/analysis/run-analysis.ts` (151 lines), plus supporting files
- Risk: Incorrect gap analysis leads to wrong draft recommendations
- Priority: High — impacts draft strategy accuracy

**Player Match Logic (Partial):**
- What's not tested: `lib/import/spreadsheet.ts` Excel parsing, edge cases in name matching
- Files: `lib/import/spreadsheet.ts` (145 lines), `lib/import/match-players.ts` (detailed testing exists but incomplete)
- Risk: Bad matches go undetected, users get wrong projections assigned
- Priority: Medium — user could manually override, but error-prone

**All UI Components (None):**
- What's not tested: None of the 8 UI components have tests
- Files: All `components/*.tsx`
- Risk: UI bugs go to production (broken sorting, wrong conditional rendering, state management errors)
- Priority: Medium — less critical than data logic, but affects user experience

**Yahoo Integration (Minimal):**
- What's not tested: OAuth flow, token refresh, league import from Yahoo
- Files: `lib/yahoo/oauth.ts`, `lib/yahoo/client.ts`, `lib/yahoo/import-league.ts`
- Risk: Yahoo users hit unexpected errors; limited ability to debug
- Priority: Medium — Yahoo support is secondary to Fantrax

**Planner Data Loading (Partial):**
- What's not tested: `lib/planner/load-planner.ts`, complex logic in `lib/planner/sources/fantrax.ts`
- Files: `lib/planner/load-planner.ts`, `lib/planner/sources/fantrax.ts` (192 lines)
- Risk: Edge cases in schedule loading, roster period mapping missed
- Priority: Medium

**NHL Schedule Import (None):**
- What's not tested: `lib/nhl/import-schedule.ts`, API integration with NHL
- Risk: Bad data or API changes undetected; schedule gaps missed
- Priority: Low — less frequently used than other features

---

*Concerns audit: 2026-10-11*
