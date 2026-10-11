---
last_mapped_commit: 71dcf6bf8b83733ab5a0ba6dd1f08cc26a801652
last_mapped_at: 2026-10-11
---
# Technology Stack

**Analysis Date:** 2026-10-11

## Languages

**Primary:**
- TypeScript 5.x - All source code in `app/`, `lib/`, and `auth.ts`
- JavaScript - Build and config files (`next.config.ts`, `drizzle.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js (via Next.js; version specified in `.nvmrc` or inferred from deployment target)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present, committed)

## Frameworks

**Core:**
- Next.js 16.3.4 - Full-stack React framework with server actions, API routes, and built-in build pipeline
- React 19.2.8 - UI component library

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS via `@tailwindcss/postcss`
- PostCSS 4.x - CSS processing (configured in `postcss.config.mjs`)

**Database:**
- Drizzle ORM 0.45.2 - Type-safe SQL query builder and schema management in `lib/db/schema.ts`
- Drizzle Kit 0.31.10 - Migration generation and management

**Authentication:**
- next-auth 5.0.0-beta.32 - Session management with Discord OAuth provider (configured in `auth.ts`)
- @auth/drizzle-adapter 1.11.3 - Drizzle ORM adapter for next-auth session/account/user storage

**Validation & Utilities:**
- Zod 4.5.4 - Runtime schema validation for API payloads
- exceljs 4.4.0 - Excel file parsing for projection imports
- fuzzysort 4.0.2 - Fuzzy string matching for player name resolution

**Testing:**
- tsx 4.23.13 - TypeScript execution with built-in test runner (Node.js native `--test` flag)

## Key Dependencies

**Critical:**
- @neondatabase/serverless 1.1.0 - Serverless PostgreSQL client for Neon database connections

**Infrastructure:**
- eslint 9.x - Code linting (config: `eslint.config.mjs`)
- eslint-config-next 16.3.4 - Next.js-specific ESLint rules and presets

## Configuration

**Environment:**
- `.env.local` - Local development secrets (DATABASE_URL, AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, AUTH_SECRET, YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REDIRECT_URI)
- `.env.example` - Template showing all required environment variables
- TypeScript path aliases: `@/*` maps to project root (configured in `tsconfig.json`)

**Build:**
- `tsconfig.json` - TypeScript compiler configuration (target: ES2017, module: esnext)
- `next.config.ts` - Next.js configuration with 10MB server action body size limit (for projection file uploads)
- `drizzle.config.ts` - Drizzle ORM configuration (schema: `lib/db/schema.ts`, out: `drizzle/`)

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- npm or equivalent
- Postgres-compatible database for local testing (Neon for dev; see DATABASE_URL setup)

**Production:**
- Vercel (primary deployment target per AGENTS.md)
- Neon PostgreSQL database
- Discord app credentials (OAuth)
- Yahoo Fantasy app credentials (optional, for league import feature)

---

*Stack analysis: 2026-10-11*
