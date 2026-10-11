---
last_mapped_commit: 71dcf6bf8b83733ab5a0ba6dd1f08cc26a801652
last_mapped_at: 2026-10-11
---
<!-- refreshed: 2026-10-11 -->

# Architecture

**Analysis Date:** 2026-10-11

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Pages (UI Layer)                       │
│  app/page.tsx │ app/login/ │ app/leagues/[userLeagueId]/ │        │
│  app/research/ │ app/api/auth/ │ app/api/yahoo/                  │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Server Actions & Request Handlers                    │
│  lib/actions/league-actions.ts │ app/api/auth/[...nextauth]/ │   │
│  app/api/yahoo/connect │ app/api/yahoo/callback                 │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Business Logic Domains                          │
│  lib/fantrax/ │ lib/yahoo/ │ lib/analysis/ │ lib/planner/ │      │
│  lib/research/ │ lib/nhl/ │ lib/import/                          │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│           External API Clients & Data Access                      │
│  lib/fantrax/client.ts │ lib/yahoo/client.ts │ lib/nhl/client.ts │
│  lib/db/index.ts (Drizzle ORM)                                   │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ├─────────────┬───────────────┬──────────────┐
           ▼             ▼               ▼              ▼
      Neon DB      Fantrax API      Yahoo API      NHL API
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

**Overall:** Full-stack Next.js application with server components, server actions, and client components combined for reactive UI. Server-side business logic with external API integration. Database-backed state for user preferences and cached league data.

**Key Characteristics:**
- **Server-driven pages**: Pages run as async server components, load data, dispatch server actions
- **Platform adapters**: Fantrax and Yahoo both expose different APIs; normalized via `PlannerData` type
- **Stateless clients**: External API clients (Fantrax, Yahoo, NHL) are pure, no session/cookie required
- **Cached vs. fresh**: Some data cached in DB (league settings, rosters); some fetched fresh each request (projections, live scores)

## Layers

**Page Layer (Next.js App Router):**
- Purpose: Server components that handle auth, load data, render UI
- Location: `app/`
- Contains: `.tsx` pages with async components, `layout.tsx` root
- Depends on: `auth.ts`, server actions, DB queries
- Used by: Browser navigation

**Server Action Layer:**
- Purpose: Form submission handlers that mutate state
- Location: `lib/actions/league-actions.ts`
- Contains: Exported `"use server"` async functions, revalidation calls
- Depends on: Domain logic (import-league.ts, draft-sync.ts, etc.)
- Used by: Page components, form submissions

**Domain Layer:**
- Purpose: Platform-specific import, analysis, planning logic
- Location: `lib/fantrax/`, `lib/yahoo/`, `lib/analysis/`, `lib/planner/`, `lib/research/`, `lib/nhl/`, `lib/import/`
- Contains: League sync, roster matching, analytics functions, player matching
- Depends on: External clients, DB queries
- Used by: Server actions, page components

**Data Access Layer:**
- Purpose: Database queries and external API calls
- Location: `lib/db/`, `lib/fantrax/client.ts`, `lib/yahoo/client.ts`, `lib/nhl/client.ts`
- Contains: Drizzle ORM schema, API client functions, query builders
- Depends on: `@neondatabase/serverless`, external HTTP endpoints
- Used by: Domain layer

**Component Layer:**
- Purpose: Shared React components (forms, tables, buttons)
- Location: `components/`
- Contains: Interactive UI components (PlayerFlagToggle, ProjectionsTable, etc.)
- Depends on: Server actions
- Used by: Pages

## Data Flow

### Primary Request Path: View League Roster & Analysis

1. **Auth check** (`app/page.tsx`) - `auth()` returns session or redirects to `/login`
2. **Load leagues** (`lib/fantrax/import-league.ts`) - Query `user_leagues JOIN fantrax_leagues JOIN fantrax_teams` from DB
3. **Navigate to league** (`app/leagues/[userLeagueId]/page.tsx`)
4. **User selects team** (`setMyTeamAction`) - Updates `user_leagues.myFantraxTeamId`, calls `syncTeamRoster()`
5. **Sync roster** (`lib/fantrax/import-league.ts:syncTeamRoster`) - Fetch from Fantrax API, insert `team_rosters` rows
6. **View analysis** (`app/leagues/[userLeagueId]/analysis/page.tsx`) - Load roster, fetch schedule, run `gapAnalysis()` / `rankPlayersByFit()`
7. **Render** - Display gaps, surpluses, and recommended pickups by team fit

### Weekly Planner Request Path

1. **Planner page** (`app/leagues/[userLeagueId]/planner/page.tsx`) - Auth check, parse `?week=` query param
2. **Load planner data** (`lib/planner/load-planner.ts`) - Route to platform adapter (`loadFantraxPlanner` or `loadYahooPlanner`)
3. **Fantrax adapter** (`lib/planner/sources/fantrax.ts`) - Fetch rosters + projections from Fantrax API
4. **Normalize to PlannerData** - Roster, available, weeks, lineup slots
5. **Apply spreadsheet projections** (if platform has none) - Match uploaded "The List" by player name/team
6. **Solve lineups** (`lib/planner/lineup.ts`) - For each day, find best starters given schedule
7. **Recommend pickups** (`recommendPlayers()`) - Score available players, rank by game count and fit
8. **Render** - Daily lineups, pickup suggestions with projected points

### Draft Sync Request Path

1. **Draft helper visible** - `app/leagues/[userLeagueId]/page.tsx` shows sync button
2. **User clicks sync** - `syncDraftAction()` → `syncDraftPicks(userLeagueId)`
3. **Fetch draft** (`lib/fantrax/draft-sync.ts`) - Get current draft from Fantrax API
4. **Insert picks** - Store in application state (in-memory), compare to `draftSyncedFor` in DB
5. **Mark synced** (`markDraftSynced()`) - Update `user_leagues.draftSyncedFor` to skip re-sync on reload
6. **Revalidate path** - Trigger page re-render with updated picks

### Yahoo Connection Request Path

1. **User clicks "Connect Yahoo"** - Navigate to `/api/yahoo/connect`
2. **Initiate OAuth** (`app/api/yahoo/connect/route.ts`) - Generate PKCE pair, store in httpOnly cookies, redirect to Yahoo
3. **User authorizes** - Yahoo redirects to `/api/yahoo/callback?code=...&state=...`
4. **Exchange code** (`app/api/yahoo/callback/route.ts`) - Verify state, trade code for tokens
5. **Store tokens** (`lib/yahoo/oauth.ts`) - Insert into `yahoo_connections` table
6. **Redirect to dashboard** - Show "Yahoo connected" success message
7. **List leagues** (`lib/yahoo/client.ts:listMyNhlLeagues`) - Fetch user's NHL leagues from Yahoo API

**State Management:**
- **Session state**: Stored in `sessions` table (NextAuth required)
- **User preferences**: Stored in DB (`user_leagues.myFantraxTeamId`, keeper overrides, removed players, watched players)
- **Cached league data**: `fantrax_leagues`, `fantrax_teams`, `team_rosters`, `fantrax_players` - fetched from APIs, stored for offline reference
- **Fresh data**: Rosters, projections, schedule - fetched fresh from APIs on each request (except projected points which come from cached `spreadsheet_projections`)
- **In-memory state**: Draft picks during active sync (not persisted until `markDraftSynced()`)

## Key Abstractions

**PlannerData (Platform-Agnostic Planner):**
- Purpose: Shields page from platform differences (Fantrax vs. Yahoo)
- Examples: `lib/planner/types.ts`, `lib/planner/sources/fantrax.ts`, `lib/planner/sources/yahoo.ts`
- Pattern: Each platform has an adapter that returns the same shape

**ConsideredPlayer (Roster Member with Context):**
- Purpose: A player on a roster with their position and team, used for schedule analysis
- Examples: `lib/analysis/types.ts`, `lib/analysis/gap-analysis.ts`
- Pattern: Created from `team_rosters` rows, enriched with NHL team data

**TeamFitScore (Schedule Fit Metric):**
- Purpose: How many "gap days" (days with no covered roster slots) a player's team plays on
- Examples: `lib/analysis/rank-players-by-fit.ts`
- Pattern: Higher score = better fit for draft targets

**FantraxLeagueInfo (API Response):**
- Purpose: Parsed Fantrax league metadata from fxea endpoints
- Examples: `lib/fantrax/client.ts`
- Pattern: Typed response from Fantrax API, stored in `fantrax_leagues.settingsJson`

**DailyLineup (Solved Daily Roster):**
- Purpose: Optimal starting lineup for a given date
- Examples: `lib/planner/lineup.ts`
- Pattern: Computed from roster availability, position eligibility, and projected points

## Entry Points

**Web Entry Point:**
- Location: `app/layout.tsx` (root layout)
- Triggers: Browser navigation to `/`
- Responsibilities: Load Tailwind globals, wrap children with layout

**Auth Entry Point:**
- Location: `app/api/auth/[...nextauth]/route.ts`
- Triggers: Signin form, Discord callback
- Responsibilities: Validate session, handle token refresh, redirect on auth failure

**Dashboard Entry Point:**
- Location: `app/page.tsx`
- Triggers: Authenticated user navigates to `/`
- Responsibilities: Load leagues, display import forms, Yahoo status

**Import Entry Points:**
- Location: `lib/actions/league-actions.ts` (importLeagueAction, importYahooLeagueAction)
- Triggers: Form submission with league URL / Yahoo league selection
- Responsibilities: Validate input, call import logic, redirect to league page

**API Entry Points:**
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

**What happens:** League metadata, roster positions, and draft syncs stored in multiple places (DB table columns, settingsJson JSONB, in-memory variables).

**Why it's wrong:** Unclear which source is authoritative. Draft picks synced but only marked complete after a separate `markDraftSynced()` call—partial sync visible if request fails between insert and mark.

**Do this instead:** 
- Store all draft picks in a dedicated `draft_picks` table with completed flag
- Use a status enum (`syncing`, `synced`) instead of a date column
- See `lib/fantrax/draft-sync.ts` for current implementation—consider refactoring to use a picks table instead of relying on the sync status marker.

### Platform-Specific Logic in Page Components

**What happens:** `app/leagues/[userLeagueId]/page.tsx` branches on `league.provider === "yahoo"` to decide layout and settings display.

**Why it's wrong:** Page components should be data-agnostic. UI differences belong in components, not in data-loading pages.

**Do this instead:**
- Create a `getLeaguePageData()` function in domain logic that normalizes league UI metadata
- Return `{ layout: "yahoo" | "fantrax", slots: Record<string, number>, ... }`
- Let the page consume the shape, not the provider string
- Keeps pages focused on rendering, not branching on data types

### Manual Player Name Matching

**What happens:** `lib/import/match-players.ts` normalizes names by removing punctuation and converting to lowercase, then fuzzy-matches against Fantrax player IDs.

**Why it's wrong:** Fragile. A player with a special character or nickname won't match. Requires re-running on every spreadsheet import.

**Do this instead:**
- Store matched `fantraxPlayerId` in `spreadsheet_projections.fantrax_player_id` after first match (already done)
- For new spreadsheets, use cached matches when possible before fuzzy-matching
- Consider asking user to select from top fuzzy matches if confidence is low

## Error Handling

**Strategy:** Try-catch at page level with error boundaries. API errors logged to console, shown to user as toast or error message block.

**Patterns:**
- Pages wrap data-loading in try-catch, catch shows error message in JSX
- Server actions throw on validation failure; caught by Next.js boundary
- External API errors (Fantrax, Yahoo) logged but swallowed if non-critical (e.g., listing Yahoo leagues fails but app continues)
- Database constraint errors bubble up (e.g., duplicate league import)

See `app/page.tsx` (Yahoo error handling) and `lib/actions/league-actions.ts` (try-catch around imports).

## Cross-Cutting Concerns

**Logging:** `console.error()` and `console.log()` to stderr/stdout. No log aggregation service.

**Validation:** Input validation via Zod (`package.json` includes `zod`). Form inputs parsed in server actions before passing to domain logic. No runtime validation in pages.

**Authentication:** Discord OAuth via NextAuth. Session token stored in `sessions` table. Protected pages check `await auth()`, redirect to `/login` if null. API routes check session before proceeding.

---

*Architecture analysis: 2026-10-11*
