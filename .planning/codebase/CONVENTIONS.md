---
last_mapped_commit: 71dcf6bf8b83733ab5a0ba6dd1f08cc26a801652
last_mapped_at: 2026-10-11
---
# Coding Conventions

**Analysis Date:** 2026-10-11

## Naming Patterns

**Files:**
- Library/utility files: `kebab-case.ts` (e.g., `gap-analysis.ts`, `draft-targets.ts`, `run-analysis.ts`)
- React components: `PascalCase.tsx` (e.g., `PendingSubmitButton.tsx`, `PlayerStatsTable.tsx`)
- Database migrations: files in `drizzle/` directory
- Test files: `*.test.ts` co-located with source

**Functions:**
- camelCase with verb-first naming: `getPeriodProjections()`, `computeRosterGaps()`, `fetchTeamRoster()`, `analyzeGameLines()`
- Common prefixes: `get*` (data retrieval), `compute*` (calculations), `fetch*` (async data), `run*` (main execution flow), `match*` (matching logic), `analyze*` (analysis operations)

**Variables:**
- camelCase: `playerSeconds`, `situationSeconds`, `rosterInfo`, `yahooLeagues`
- Boolean flags typically prefixed with `is*`, `has*`, or `should*`: `isPerGame`, `hasPendingDraft`
- Constants in UPPER_CASE: `PERIOD_SECONDS`, `MIN_UNIT_SECONDS`, `EV_UNIT_SIZE`, `BY_PERIOD`, `PER_GAME`

**Types:**
- PascalCase for interfaces and types: `ConsideredPlayer`, `GameLines`, `GapAnalysisResult`, `FantraxRosterInfo`, `DisplayPlayer`
- Exported type aliases: `type Situation = "ev" | "pp" | "sh"`, `type PositionGroup = "F" | "D" | "G"`

**Database columns:**
- snake_case: `fantrax_league_id`, `last_synced_at`, `season_year` (defined in `lib/db/schema.ts` with Drizzle)

## Code Style

**Formatting:**
- Uses eslint-config-next defaults (no explicit Prettier config)
- Line length: reasonable within standard editor widths
- Semicolons are used throughout
- Spacing around operators and after commas

**Linting:**
- Tool: ESLint v9 with Next.js config (`eslint-config-next`)
- Config file: `eslint.config.mjs`
- Rules: Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

## Import Organization

**Order:**
1. Node.js built-ins (`import { test } from "node:test"`)
2. Third-party packages (`import { signOut } from "@/auth"`)
3. Internal imports using @ alias (`import { gap analysis } from "@/lib/analysis/gap-analysis"`)
4. Type imports: `import type { ConsideredPlayer }` (same sections but type keyword)

**Path Aliases:**
- `@/*` maps to project root (configured in `tsconfig.json`)
- Used throughout for cleaner relative imports: `@/lib`, `@/components`, `@/auth`, `@/lib/db`

## Error Handling

**Patterns:**
- Throw descriptive errors for validation failures: `throw new Error("user_league ${userLeagueId} not found")`
- Errors include context about what failed and why (e.g., "Fantrax no longer offers a per-game projection view")
- Try-catch in data fetching (e.g., `lib/fantrax/draft-sync.ts` catches errors and logs them)
- Console.error for logging caught exceptions: `console.error("Listing Yahoo leagues failed", err)`
- Error instanceof checks: `err instanceof Error ? err.message : String(err)` in UI code

**When to throw vs. catch:**
- Throw on critical failures that prevent further execution
- Catch and log on integrations (Yahoo/Fantrax APIs) to gracefully degrade
- Client-side error handling in Server Components displays fallback UI

## Logging

**Framework:** Built-in `console.error()` and `console.log()`

**Patterns:**
- Error logging with context: `console.error("Action description", errorObject)`
- No debug logging visible in production code
- Server Components can log freely; Client Components limited by runtime

## Comments

**When to Comment:**
- Public function behavior: JSDoc comments describe what the function does, parameters, and return value
- Complex logic: Inline comments explain non-obvious decisions (e.g., "Ignore combos that only exist for a moment during line changes")
- Data structure decisions: Comments on types explain field purposes (see `lib/analysis/types.ts`)

**JSDoc/TSDoc:**

```typescript
/** Parses "MM:SS" into seconds, or null if malformed. */
export function parseClock(value: string | null | undefined): number | null { ... }

/**
 * Least-squares slope of y over x, or null with fewer than two points.
 * Optional weights let unreliable points (e.g. games with little PP time) count less.
 */
export function trendSlope(points: TrendPoint[]): number | null { ... }

/** Submit button that disables itself and shows a spinner while its form's action runs. */
export function PendingSubmitButton({ children, className }: Props) { ... }
```

- Single-line JSDoc for simple functions
- Multi-line JSDoc for complex parameters or return types
- Brief descriptions of what the function does, not how

## Function Design

**Size:** Functions keep single responsibilities. Library functions typically 20-50 lines; complex analysis functions up to 100 lines.

**Parameters:**
- Functions accept structured data (interfaces) rather than many positional args
- Example: `analyzeGameLines(team: string, shifts: ShiftInput[], positions: Map<number, PositionGroup>)`
- Map and array parameters used for efficient lookups

**Return Values:**
- Functions return plain objects/maps for JSON serializability in Next.js data caching
- Null returns for "not found" or "no data": `parseC lock() -> number | null`, `matchSpreadsheetRow() -> MatchResult | null`
- Record/Map for collections: `columnByPlayer() -> Map<string, number>`, `playerSeconds: Map<number, Record<Situation, number>>`

## Module Design

**Exports:**
- Each file exports public functions/types at the top level
- No barrel files (index.ts) with re-exports; direct imports encouraged
- Example imports: `import { analyzeGameLines } from "@/lib/research/lines"`

**Barrel Files:** Not used; direct imports to modules preferred for clarity.

## TypeScript-Specific

**Strict Mode:** Enabled in `tsconfig.json` with `"strict": true`

**Type Patterns:**
- Discriminated unions for different result shapes: `type Situation = "ev" | "pp" | "sh"`
- Readonly collections: `readonly` used in const declarations for immutability
- Generic types for reusable patterns: `columnByPlayer<T>` pattern used
- Type narrowing with instanceof checks and conditional logic

---

*Convention analysis: 2026-10-11*
