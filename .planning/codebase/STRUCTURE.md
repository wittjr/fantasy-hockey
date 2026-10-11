---
last_mapped_commit: 71dcf6bf8b83733ab5a0ba6dd1f08cc26a801652
last_mapped_at: 2026-10-11
---
# Codebase Structure

**Analysis Date:** 2026-10-11

## Directory Layout

```
/Users/jwitt/Development/fantasy-hockey/
├── app/                           # Next.js app router pages and API routes
│   ├── layout.tsx                 # Root layout (Tailwind, fonts)
│   ├── page.tsx                   # Dashboard: user's leagues and import forms
│   ├── login/
│   │   └── page.tsx               # Discord sign-in page
│   ├── research/
│   │   └── page.tsx               # Per-game line changes and role trends
│   ├── leagues/
│   │   └── [userLeagueId]/
│   │       ├── page.tsx           # League overview, roster, team selection
│   │       ├── analysis/
│   │       │   └── page.tsx       # Gap analysis, schedule-fit recommendations
│   │       └── planner/
│   │           ├── page.tsx       # Weekly lineup planner
│   │           └── loading.tsx    # Planner loading state
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts       # NextAuth handler (Discord OAuth)
│   │   └── yahoo/
│   │       ├── connect/
│   │       │   └── route.ts       # Initiate Yahoo OAuth (PKCE flow)
│   │       └── callback/
│   │           └── route.ts       # Receive Yahoo OAuth callback
│   └── globals.css                # Tailwind directives
├── lib/                           # Business logic, data access, utilities
│   ├── actions/
│   │   └── league-actions.ts      # Server actions: imports, syncs, flag toggles
│   ├── fantrax/                   # Fantrax-specific import, sync, projections
│   │   ├── client.ts              # Fantrax fxea API client
│   │   ├── import-league.ts       # League/roster import, team sync
│   │   ├── draft-sync.ts          # Draft pick syncing
│   │   ├── draft-plan.ts          # Draft order predictions (for analysis)
│   │   ├── draft-targets.ts       # Manage draft target "what-if" additions
│   │   ├── projections.ts         # Cached per-game projections from Fantrax
│   │   ├── keeper-overrides.ts    # Mark opponent keepers
│   │   ├── removed-players.ts     # Players removed from draft board
│   │   ├── watched-players.ts     # Starred players to track
│   │   ├── position-mapping.ts    # Map granular positions to roster buckets
│   │   ├── periods.ts             # Parse Fantrax scoring/roster periods
│   │   └── cached-projections.ts  # Revalidation tags for projection caching
│   ├── yahoo/                     # Yahoo Fantasy-specific integration
│   │   ├── client.ts              # Yahoo Fantasy API client
│   │   ├── oauth.ts               # OAuth flow, token storage/refresh
│   │   ├── import-league.ts       # Import Yahoo league
│   │   └── normalize.ts           # Normalize Yahoo rosters to app types
│   ├── analysis/                  # Draft preparation analytics
│   │   ├── types.ts               # ConsideredPlayer, DateBucketGap, TeamFitScore
│   │   ├── gap-analysis.ts        # Identify days with roster coverage gaps
│   │   ├── team-fit.ts            # Score teams by how many gap-days they play
│   │   ├── rank-players-by-fit.ts # Rank draft targets by fit, with ADP
│   │   ├── likely-keepers.ts      # Predict opponent keeper picks (top 6 by ADP)
│   │   ├── opponent-rosters.ts    # Build opponent rosters with keeper overrides
│   │   ├── match-projections.ts   # Match spreadsheet players to Fantrax IDs
│   │   ├── off-nights.ts          # Find nights with no games for all players
│   │   ├── playoff-games.ts       # Count playoff games remaining per team
│   │   └── run-analysis.ts        # Orchestrate all analysis functions
│   ├── planner/                   # Weekly lineup optimization
│   │   ├── types.ts               # PlannerData, PlanningWeek, DailyLineup
│   │   ├── load-planner.ts        # Load planner data, route to platform adapter
│   │   ├── lineup.ts              # Solve daily lineups, recommend pickups
│   │   ├── schedule.ts            # Parse schedule games, build GamesByTeam map
│   │   ├── weeks.ts               # Parse scoring periods into weeks
│   │   └── sources/
│   │       ├── fantrax.ts         # Load Fantrax rosters and projections
│   │       └── yahoo.ts           # Load Yahoo rosters and projections
│   ├── research/                  # Per-game line research
│   │   ├── lines.ts               # Parse lines (EVG, EVA, PPG, etc.), compute trends
│   │   └── team-games.ts          # Load recent games, player stats per game
│   ├── nhl/                       # NHL reference data
│   │   ├── client.ts              # NHL API client (schedule, team abbrevs)
│   │   ├── team-abbrev.ts         # Team abbreviation constants
│   │   └── import-schedule.ts     # Fetch and store NHL schedule
│   ├── import/                    # Spreadsheet import and player matching
│   │   ├── spreadsheet.ts         # Parse "The List" Excel file
│   │   ├── projections.ts         # Store parsed projections in DB
│   │   └── match-players.ts       # Fuzzy-match spreadsheet names to Fantrax IDs
│   ├── db/
│   │   ├── index.ts               # Drizzle ORM instance (Neon connection)
│   │   └── schema.ts              # Database schema definition (all tables)
│   └── yahoo/
│       └── oauth.ts               # [duplicate, should be in lib/yahoo/]
├── components/                    # Shared React components
│   ├── DraftPickSync.tsx           # Draft sync status, start/stop button
│   ├── PendingLink.tsx             # Link with pending state during navigation
│   ├── PendingSubmitButton.tsx     # Button with pending state during form submission
│   ├── PickupsTable.tsx            # Suggested pickups (sortable, paginated)
│   ├── PlayerFlagToggle.tsx        # Toggle player flags (keeper, considered, etc.)
│   ├── PlayerStatsTable.tsx        # Stats display for research page
│   ├── ProjectionsTable.tsx        # Projections spreadsheet display
│   └── RenamePlayerForm.tsx        # Inline player name editor
├── types/
│   └── next-auth.d.ts             # NextAuth session type augmentation
├── public/                        # Static assets (empty)
├── scripts/
│   └── apply-migrations.mjs       # Apply Drizzle migrations
├── drizzle/                       # Drizzle migrations
│   └── meta/                      # Migration metadata
├── auth.ts                        # NextAuth configuration (Discord provider)
├── drizzle.config.ts              # Drizzle kit config (Neon connection)
├── tsconfig.json                  # TypeScript config (path alias: @/*)
├── next.config.ts                 # Next.js config
├── package.json                   # Dependencies
├── package-lock.json              # Lock file
├── .env.example                   # Template for environment variables
├── .env.local                     # Runtime env (not committed, secrets)
├── .gitignore                     # Ignored files
├── .eslintrc                      # ESLint config
├── postcss.config.mjs             # PostCSS config (Tailwind)
├── README.md                      # Project overview
├── CLAUDE.md                      # Project instructions (agent context)
├── AGENTS.md                      # Agent-specific notes (Next.js 16 breaking changes)
└── .claude/                       # Claude Code configuration
    ├── skills/                    # (if project-specific skills exist)
    └── gsd-core/                  # GSD orchestrator core files
```

## Directory Purposes

**app/**
- Purpose: Next.js app router pages and API routes
- Contains: Server components, API handlers, layouts
- Key files: `page.tsx` (each route), `layout.tsx` (root), `[...nextauth]` and `yahoo/` API routes

**lib/**
- Purpose: Shared business logic, utilities, data access
- Contains: Domain-specific modules, database schema, external API clients, server actions
- Structure: Organized by domain (fantrax, yahoo, analysis, planner, nhl, import) plus data layer (db)

**lib/fantrax/**
- Purpose: Fantrax-specific league import, roster sync, projection fetching, draft management
- Key exports: `importFantraxLeague()`, `syncTeamRoster()`, `syncDraftPicks()`, `getCachedProjections()`

**lib/yahoo/**
- Purpose: Yahoo Fantasy integration—OAuth token management, league import, roster normalization
- Key exports: `getYahooConnection()`, `disconnectYahoo()`, `importYahooLeague()`, `listMyNhlLeagues()`

**lib/analysis/**
- Purpose: Draft preparation analytics—gap identification, schedule-fit scoring, keeper prediction
- Key exports: `gapAnalysis()`, `scoreTeamFits()`, `rankPlayersByFit()`, `selectLikelyKeepers()`

**lib/planner/**
- Purpose: Weekly lineup optimization—load platform data, solve lineups, recommend pickups
- Key exports: `loadPlanner()`, `buildDailyLineups()`, `recommendPlayers()`, `lineupChange()`
- Pattern: `sources/` subdirectory has platform-specific adapters (Fantrax, Yahoo)

**lib/research/**
- Purpose: Per-game line research—parse stats, compute role trends
- Key exports: `loadTeamResearch()`, `trendSlope()`

**lib/nhl/**
- Purpose: NHL reference data—team abbreviations, schedule, player IDs
- Key exports: `getSchedule()`, `importNhlSeasonSchedule()`, NHL team constants

**lib/import/**
- Purpose: Spreadsheet import—parse Excel files, match players to Fantrax IDs
- Key exports: `parseProjectionsSpreadsheet()`, `matchProjectionsToFantraxIds()`

**lib/db/**
- Purpose: Database schema and connection
- Key files: `schema.ts` (all tables), `index.ts` (Drizzle instance)
- Tables: `users`, `sessions`, `accounts` (NextAuth); `fantrax_leagues`, `fantrax_teams`, `fantrax_players`, `user_leagues`, `team_rosters` (leagues); `nhl_games`, `nhl_teams` (reference); `spreadsheet_projections`, `draft_targets`, `keeper_overrides`, `removed_players`, `watched_players` (user data); `yahoo_connections` (Yahoo OAuth)

**components/**
- Purpose: Shared interactive React components
- Pattern: Client components, use server actions for mutations
- Examples: `PlayerFlagToggle` (checkbox with action), `PickupsTable` (sortable, filterable)

**drizzle/**
- Purpose: Database migrations
- Pattern: Auto-generated by `drizzle-kit generate`, applied via `npm run db:apply`

**scripts/**
- Purpose: Setup and utilities
- Key file: `apply-migrations.mjs` (connects to DB and runs pending migrations)

**types/**
- Purpose: Shared type definitions
- Key file: `next-auth.d.ts` (augments NextAuth Session type with user ID)

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout (fonts, Tailwind globals)
- `app/page.tsx` - Dashboard/home page (league list, import forms)
- `app/api/auth/[...nextauth]/route.ts` - NextAuth handler
- `auth.ts` - NextAuth configuration

**Configuration:**
- `tsconfig.json` - TypeScript (path alias `@/` → root)
- `next.config.ts` - Next.js build config
- `drizzle.config.ts` - Drizzle migrations config
- `.env.local` - Runtime secrets (not committed)
- `.env.example` - Template for required env vars

**Core Logic:**
- `lib/fantrax/import-league.ts` - Import Fantrax leagues, sync rosters
- `lib/analysis/gap-analysis.ts` - Identify coverage gaps
- `lib/planner/load-planner.ts` - Load weekly planner data
- `lib/planner/lineup.ts` - Solve lineups, recommend pickups
- `lib/actions/league-actions.ts` - All server actions (imports, syncs, flags)

**Database:**
- `lib/db/schema.ts` - All table definitions
- `lib/db/index.ts` - Drizzle ORM instance

**Testing:**
- Tests are co-located: `*.test.ts` files next to implementation
- Run with: `npm test` (uses `tsx --test`)
- Examples: `lib/analysis/gap-analysis.test.ts`, `lib/fantrax/draft-plan.test.ts`

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Tests: `*.test.ts` (tsx --test runner)
- Components: PascalCase with `.tsx` extension (e.g., `PlayerFlagToggle.tsx`)
- Utilities/functions: camelCase with `.ts` extension (e.g., `gap-analysis.ts`)

**Directories:**
- App routes: `[param]` for dynamic segments, `[...catch]` for catch-all
- Feature domains: kebab-case (e.g., `lib/fantrax/`, `lib/yahoo/`)
- Subdirectories in lib: One per domain, flat (no nesting beyond domain)

**Functions:**
- Async actions: `*Action` suffix (e.g., `importLeagueAction`, `syncDraftAction`)
- Queries: `get*` or `load*` prefix (e.g., `getTeamRosterRows`, `loadPlanner`)
- Mutations: `*` or `set*` prefix (e.g., `syncTeamRoster`, `setMyTeam`)
- Predicates: `is*` or `can*` prefix (e.g., `canFillSlot`, `isKeeper`)
- Computations: Descriptive name (e.g., `gapAnalysis`, `scoreTeamFits`, `rankPlayersByFit`)

**Types:**
- Interfaces: PascalCase, no `I` prefix (e.g., `PlannerData`, `ConsideredPlayer`)
- Enums: PascalCase (e.g., `Platform`, `DailyStatus`)
- Unions: `*` or suffix with name (e.g., `Platform = "fantrax" | "yahoo"`)

**Database:**
- Tables: snake_case (e.g., `fantrax_league`, `user_league`, `team_roster`)
- Columns: snake_case (e.g., `fantrax_league_id`, `my_fantrax_team_id`)
- Exported table constants: camelCase (e.g., `fantraxLeagues`, `userLeagues`)

## Where to Add New Code

**New Feature (e.g., Trade evaluator):**
- Create domain directory: `lib/trade-eval/`
- Place core logic: `lib/trade-eval/evaluate-trade.ts`
- Add types: `lib/trade-eval/types.ts` (if significant)
- Add tests: `lib/trade-eval/evaluate-trade.test.ts`
- Wire into server actions: `lib/actions/league-actions.ts` (add `evaluateTradeAction()`)
- Create/update page: `app/leagues/[userLeagueId]/trade-eval/page.tsx` (if UI needed)

**New Page (e.g., Player comparisons):**
- Create route directory: `app/leagues/[userLeagueId]/compare/`
- Add page component: `page.tsx` (server component, auth check, data loading)
- Create supporting lib functions: `lib/comparison/` if analysis-heavy
- Add server actions to: `lib/actions/league-actions.ts` (if mutations needed)
- Reuse existing components from `components/` where applicable

**New Component (e.g., Trade approval form):**
- Create file: `components/TradeApprovalForm.tsx`
- Use server actions: Import from `lib/actions/league-actions.ts`
- Pattern: Async client component with form, submitted via server action, revalidates path

**New Utility (e.g., player name fuzzy-match):**
- Place in existing domain or create new: `lib/util/` is not used; place in domain
- Add to: `lib/import/match-players.ts` (if import-related) or appropriate domain
- Export for reuse across modules
- Add tests co-located: `lib/import/match-players.test.ts`

**New Database Table:**
- Add to: `lib/db/schema.ts`
- Export const (camelCase): `export const myTable = pgTable(...)`
- Run: `npm run db:generate` to create migration
- Run: `npm run db:apply` to apply migration
- Update related queries: `lib/fantrax/import-league.ts`, etc.

**New API Integration (e.g., Slack webhook for draft alerts):**
- Create client: `lib/slack/client.ts` (or new domain)
- Add methods: `sendDraftAlert(teamId, pick)`, etc.
- Wire into sync: `lib/fantrax/draft-sync.ts` → call after picks inserted
- Add env var: `.env.local` and `.env.example` (e.g., `SLACK_WEBHOOK_URL`)
- Handle secrets: Never commit `.env.local` or hardcode secrets

## Special Directories

**app/api/auth/**
- Purpose: NextAuth routes (auto-handled by NextAuth)
- Generated: No—manually created following NextAuth conventions
- Committed: Yes

**app/api/yahoo/**
- Purpose: Yahoo OAuth callback handling
- Generated: No—manually created
- Committed: Yes

**drizzle/meta/**
- Purpose: Migration metadata (auto-generated)
- Generated: Yes, by `drizzle-kit generate`
- Committed: Yes (migrations must be versioned)

**.next/**
- Purpose: Build output
- Generated: Yes, by `npm run build` and `next dev`
- Committed: No (in `.gitignore`)

**node_modules/**
- Purpose: Dependencies
- Generated: Yes, by `npm install`
- Committed: No (in `.gitignore`)

---

*Structure analysis: 2026-10-11*
