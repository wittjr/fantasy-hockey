<!-- GSD:project-start source:PROJECT.md -->

## Project

**Fantasy Hockey Draft Prep**

A personal fantasy hockey web app (Next.js on Vercel, Neon Postgres, Discord sign-in) that imports Fantrax and Yahoo leagues and helps with draft prep, weekly lineup planning, and player research. The current milestone focuses on the **Line research** page (`/research`): a per-team view of NHL line combinations and ice-time trends, modelled on Dobber Frozen Pool's "last 3 game lines" page, being refined into a tool for spotting players whose role is changing.

**Core Value:** At a glance, show which players on a team are moving up or down in deployment — so pickup/drop decisions can be made before the rest of the league notices.

### Constraints

- **Tech stack**: Next.js 16 App Router, Tailwind 4, Drizzle/Neon, deployed on Vercel — existing app, keep consistent
- **Data sources**: Public, unauthenticated NHL APIs only — no paid data feeds
- **Code style**: Minimum code that solves the problem; touch only what's needed (AGENTS.md principles)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x - All source code in `app/`, `lib/`, and `auth.ts`
- JavaScript - Build and config files (`next.config.ts`, `drizzle.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

- Node.js (via Next.js; version specified in `.nvmrc` or inferred from deployment target)
- npm
- Lockfile: `package-lock.json` (present, committed)

## Frameworks

- Next.js 16.3.4 - Full-stack React framework with server actions, API routes, and built-in build pipeline
- React 19.2.8 - UI component library
- Tailwind CSS 4.x - Utility-first CSS via `@tailwindcss/postcss`
- PostCSS 4.x - CSS processing (configured in `postcss.config.mjs`)
- Drizzle ORM 0.45.2 - Type-safe SQL query builder and schema management in `lib/db/schema.ts`
- Drizzle Kit 0.31.10 - Migration generation and management
- next-auth 5.0.0-beta.32 - Session management with Discord OAuth provider (configured in `auth.ts`)
- @auth/drizzle-adapter 1.11.3 - Drizzle ORM adapter for next-auth session/account/user storage
- Zod 4.5.4 - Runtime schema validation for API payloads
- exceljs 4.4.0 - Excel file parsing for projection imports
- fuzzysort 4.0.2 - Fuzzy string matching for player name resolution
- tsx 4.23.13 - TypeScript execution with built-in test runner (Node.js native `--test` flag)

## Key Dependencies

- @neondatabase/serverless 1.1.0 - Serverless PostgreSQL client for Neon database connections
- eslint 9.x - Code linting (config: `eslint.config.mjs`)
- eslint-config-next 16.3.4 - Next.js-specific ESLint rules and presets

## Configuration

- `.env.local` - Local development secrets (DATABASE_URL, AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, AUTH_SECRET, YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REDIRECT_URI)
- `.env.example` - Template showing all required environment variables
- TypeScript path aliases: `@/*` maps to project root (configured in `tsconfig.json`)
- `tsconfig.json` - TypeScript compiler configuration (target: ES2017, module: esnext)
- `next.config.ts` - Next.js configuration with 10MB server action body size limit (for projection file uploads)
- `drizzle.config.ts` - Drizzle ORM configuration (schema: `lib/db/schema.ts`, out: `drizzle/`)

## Platform Requirements

- Node.js (LTS recommended)
- npm or equivalent
- Postgres-compatible database for local testing (Neon for dev; see DATABASE_URL setup)
- Vercel (primary deployment target per AGENTS.md)
- Neon PostgreSQL database
- Discord app credentials (OAuth)
- Yahoo Fantasy app credentials (optional, for league import feature)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Library/utility files: `kebab-case.ts` (e.g., `gap-analysis.ts`, `draft-targets.ts`, `run-analysis.ts`)
- React components: `PascalCase.tsx` (e.g., `PendingSubmitButton.tsx`, `PlayerStatsTable.tsx`)
- Database migrations: files in `drizzle/` directory
- Test files: `*.test.ts` co-located with source
- camelCase with verb-first naming: `getPeriodProjections()`, `computeRosterGaps()`, `fetchTeamRoster()`, `analyzeGameLines()`
- Common prefixes: `get*` (data retrieval), `compute*` (calculations), `fetch*` (async data), `run*` (main execution flow), `match*` (matching logic), `analyze*` (analysis operations)
- camelCase: `playerSeconds`, `situationSeconds`, `rosterInfo`, `yahooLeagues`
- Boolean flags typically prefixed with `is*`, `has*`, or `should*`: `isPerGame`, `hasPendingDraft`
- Constants in UPPER_CASE: `PERIOD_SECONDS`, `MIN_UNIT_SECONDS`, `EV_UNIT_SIZE`, `BY_PERIOD`, `PER_GAME`
- PascalCase for interfaces and types: `ConsideredPlayer`, `GameLines`, `GapAnalysisResult`, `FantraxRosterInfo`, `DisplayPlayer`
- Exported type aliases: `type Situation = "ev" | "pp" | "sh"`, `type PositionGroup = "F" | "D" | "G"`
- snake_case: `fantrax_league_id`, `last_synced_at`, `season_year` (defined in `lib/db/schema.ts` with Drizzle)

## Code Style

- Uses eslint-config-next defaults (no explicit Prettier config)
- Line length: reasonable within standard editor widths
- Semicolons are used throughout
- Spacing around operators and after commas
- Tool: ESLint v9 with Next.js config (`eslint-config-next`)
- Config file: `eslint.config.mjs`
- Rules: Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

## Import Organization

- `@/*` maps to project root (configured in `tsconfig.json`)
- Used throughout for cleaner relative imports: `@/lib`, `@/components`, `@/auth`, `@/lib/db`

## Error Handling

- Throw descriptive errors for validation failures: `throw new Error("user_league ${userLeagueId} not found")`
- Errors include context about what failed and why (e.g., "Fantrax no longer offers a per-game projection view")
- Try-catch in data fetching (e.g., `lib/fantrax/draft-sync.ts` catches errors and logs them)
- Console.error for logging caught exceptions: `console.error("Listing Yahoo leagues failed", err)`
- Error instanceof checks: `err instanceof Error ? err.message : String(err)` in UI code
- Throw on critical failures that prevent further execution
- Catch and log on integrations (Yahoo/Fantrax APIs) to gracefully degrade
- Client-side error handling in Server Components displays fallback UI

## Logging

- Error logging with context: `console.error("Action description", errorObject)`
- No debug logging visible in production code
- Server Components can log freely; Client Components limited by runtime

## Comments

- Public function behavior: JSDoc comments describe what the function does, parameters, and return value
- Complex logic: Inline comments explain non-obvious decisions (e.g., "Ignore combos that only exist for a moment during line changes")
- Data structure decisions: Comments on types explain field purposes (see `lib/analysis/types.ts`)
- Single-line JSDoc for simple functions
- Multi-line JSDoc for complex parameters or return types
- Brief descriptions of what the function does, not how

## Function Design

- Functions accept structured data (interfaces) rather than many positional args
- Example: `analyzeGameLines(team: string, shifts: ShiftInput[], positions: Map<number, PositionGroup>)`
- Map and array parameters used for efficient lookups
- Functions return plain objects/maps for JSON serializability in Next.js data caching
- Null returns for "not found" or "no data": `parseC lock() -> number | null`, `matchSpreadsheetRow() -> MatchResult | null`
- Record/Map for collections: `columnByPlayer() -> Map<string, number>`, `playerSeconds: Map<number, Record<Situation, number>>`

## Module Design

- Each file exports public functions/types at the top level
- No barrel files (index.ts) with re-exports; direct imports encouraged
- Example imports: `import { analyzeGameLines } from "@/lib/research/lines"`

## TypeScript-Specific

- Discriminated unions for different result shapes: `type Situation = "ev" | "pp" | "sh"`
- Readonly collections: `readonly` used in const declarations for immutability
- Generic types for reusable patterns: `columnByPlayer<T>` pattern used
- Type narrowing with instanceof checks and conditional logic

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Auth Boundary** | Discord OAuth session management | `auth.ts`, `app/api/auth/[...nextauth]/route.ts` |
| **Dashboard** | Display user's leagues, import controls, Yahoo connection | `app/page.tsx` |
| **League Setup** | Select team in imported league, display league info | `app/leagues/[userLeagueId]/page.tsx` |
| **Analysis** | Gap analysis, schedule fit scoring, keeper recommendations | `lib/analysis/gap-analysis.ts`, `lib/analysis/rank-players-by-fit.ts` |
| **Planner** | Weekly lineup recommendations, pickup suggestions | `lib/planner/load-planner.ts`, `lib/planner/lineup.ts` |
| **Fantrax Sync** | Import leagues, fetch rosters, sync draft picks | `lib/fantrax/import-league.ts`, `lib/fantrax/draft-sync.ts` |
| **Yahoo Sync** | OAuth connect/disconnect, import leagues | `lib/yahoo/oauth.ts`, `lib/yahoo/import-league.ts` |
| **Spreadsheet Import** | Parse "The List" projections spreadsheet | `lib/import/spreadsheet.ts` |
| **Research** | Per-game line changes and role trends | `lib/research/lines.ts` |
| **Database** | Schema definition, Neon connection | `lib/db/schema.ts`, `lib/db/index.ts` |

## Pattern Overview

- **Server-driven pages**: Pages run as async server components, load data, dispatch server actions
- **Platform adapters**: Fantrax and Yahoo both expose different APIs; normalized via `PlannerData` type
- **Stateless clients**: External API clients (Fantrax, Yahoo, NHL) are pure, no session/cookie required
- **Cached vs. fresh**: Some data cached in DB (league settings, rosters); some fetched fresh each request (projections, live scores)

## Layers

- Purpose: Server components that handle auth, load data, render UI
- Location: `app/`
- Contains: `.tsx` pages with async components, `layout.tsx` root
- Depends on: `auth.ts`, server actions, DB queries
- Used by: Browser navigation
- Purpose: Form submission handlers that mutate state
- Location: `lib/actions/league-actions.ts`
- Contains: Exported `"use server"` async functions, revalidation calls
- Depends on: Domain logic (import-league.ts, draft-sync.ts, etc.)
- Used by: Page components, form submissions
- Purpose: Platform-specific import, analysis, planning logic
- Location: `lib/fantrax/`, `lib/yahoo/`, `lib/analysis/`, `lib/planner/`, `lib/research/`, `lib/nhl/`, `lib/import/`
- Contains: League sync, roster matching, analytics functions, player matching
- Depends on: External clients, DB queries
- Used by: Server actions, page components
- Purpose: Database queries and external API calls
- Location: `lib/db/`, `lib/fantrax/client.ts`, `lib/yahoo/client.ts`, `lib/nhl/client.ts`
- Contains: Drizzle ORM schema, API client functions, query builders
- Depends on: `@neondatabase/serverless`, external HTTP endpoints
- Used by: Domain layer
- Purpose: Shared React components (forms, tables, buttons)
- Location: `components/`
- Contains: Interactive UI components (PlayerFlagToggle, ProjectionsTable, etc.)
- Depends on: Server actions
- Used by: Pages

## Data Flow

### Primary Request Path: View League Roster & Analysis

### Weekly Planner Request Path

### Draft Sync Request Path

### Yahoo Connection Request Path

- **Session state**: Stored in `sessions` table (NextAuth required)
- **User preferences**: Stored in DB (`user_leagues.myFantraxTeamId`, keeper overrides, removed players, watched players)
- **Cached league data**: `fantrax_leagues`, `fantrax_teams`, `team_rosters`, `fantrax_players` - fetched from APIs, stored for offline reference
- **Fresh data**: Rosters, projections, schedule - fetched fresh from APIs on each request (except projected points which come from cached `spreadsheet_projections`)
- **In-memory state**: Draft picks during active sync (not persisted until `markDraftSynced()`)

## Key Abstractions

- Purpose: Shields page from platform differences (Fantrax vs. Yahoo)
- Examples: `lib/planner/types.ts`, `lib/planner/sources/fantrax.ts`, `lib/planner/sources/yahoo.ts`
- Pattern: Each platform has an adapter that returns the same shape
- Purpose: A player on a roster with their position and team, used for schedule analysis
- Examples: `lib/analysis/types.ts`, `lib/analysis/gap-analysis.ts`
- Pattern: Created from `team_rosters` rows, enriched with NHL team data
- Purpose: How many "gap days" (days with no covered roster slots) a player's team plays on
- Examples: `lib/analysis/rank-players-by-fit.ts`
- Pattern: Higher score = better fit for draft targets
- Purpose: Parsed Fantrax league metadata from fxea endpoints
- Examples: `lib/fantrax/client.ts`
- Pattern: Typed response from Fantrax API, stored in `fantrax_leagues.settingsJson`
- Purpose: Optimal starting lineup for a given date
- Examples: `lib/planner/lineup.ts`
- Pattern: Computed from roster availability, position eligibility, and projected points

## Entry Points

- Location: `app/layout.tsx` (root layout)
- Triggers: Browser navigation to `/`
- Responsibilities: Load Tailwind globals, wrap children with layout
- Location: `app/api/auth/[...nextauth]/route.ts`
- Triggers: Signin form, Discord callback
- Responsibilities: Validate session, handle token refresh, redirect on auth failure
- Location: `app/page.tsx`
- Triggers: Authenticated user navigates to `/`
- Responsibilities: Load leagues, display import forms, Yahoo status
- Location: `lib/actions/league-actions.ts` (importLeagueAction, importYahooLeagueAction)
- Triggers: Form submission with league URL / Yahoo league selection
- Responsibilities: Validate input, call import logic, redirect to league page
- Location: `app/api/yahoo/connect/route.ts`, `app/api/yahoo/callback/route.ts`
- Triggers: User OAuth flow with Yahoo
- Responsibilities: OAuth state management, token exchange

## Architectural Constraints

- **Threading:** Single-threaded event loop (Node.js). No worker threads. Analytics/gap-solving happen synchronously on request.
- **Global state:** `db` singleton in `lib/db/index.ts` (Drizzle ORM instance). NextAuth handler exported from `auth.ts`.
- **Circular imports:** None known. Data flows unidirectionally: Pages → Actions → Domain → Clients → DB.
- **Session cookies:** httpOnly, Secure (HTTPS only in prod), SameSite=Lax. Managed by NextAuth.
- **API authentication:** Fantrax/NHL APIs don't require auth (public endpoints). Yahoo requires OAuth tokens stored in DB.
- **Database transactions:** Drizzle doesn't auto-wrap in transactions. Multi-table updates (import-league) are sequential, not atomic.

## Anti-Patterns

### Scattered State Management

- Store all draft picks in a dedicated `draft_picks` table with completed flag
- Use a status enum (`syncing`, `synced`) instead of a date column
- See `lib/fantrax/draft-sync.ts` for current implementation—consider refactoring to use a picks table instead of relying on the sync status marker.

### Platform-Specific Logic in Page Components

- Create a `getLeaguePageData()` function in domain logic that normalizes league UI metadata
- Return `{ layout: "yahoo" | "fantrax", slots: Record<string, number>, ... }`
- Let the page consume the shape, not the provider string
- Keeps pages focused on rendering, not branching on data types

### Manual Player Name Matching

- Store matched `fantraxPlayerId` in `spreadsheet_projections.fantrax_player_id` after first match (already done)
- For new spreadsheets, use cached matches when possible before fuzzy-matching
- Consider asking user to select from top fuzzy matches if confidence is low

## Error Handling

- Pages wrap data-loading in try-catch, catch shows error message in JSX
- Server actions throw on validation failure; caught by Next.js boundary
- External API errors (Fantrax, Yahoo) logged but swallowed if non-critical (e.g., listing Yahoo leagues fails but app continues)
- Database constraint errors bubble up (e.g., duplicate league import)

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
