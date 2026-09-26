import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  primaryKey,
  uuid,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// --- Auth.js (NextAuth) required tables ---

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// --- Fantrax league data ---

export const fantraxLeagues = pgTable("fantrax_league", {
  id: uuid("id").defaultRandom().primaryKey(),
  fantraxLeagueId: text("fantrax_league_id").notNull().unique(),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("NHL"),
  seasonYear: text("season_year"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  // Raw rosterInfo.positionConstraints + maxTotalPlayers/maxTotalActivePlayers from fxea getLeagueInfo
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>(),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
});

export const fantraxTeams = pgTable(
  "fantrax_team",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => fantraxLeagues.id, { onDelete: "cascade" }),
    fantraxTeamId: text("fantrax_team_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("fantrax_team_league_team_idx").on(t.leagueId, t.fantraxTeamId)]
);

// Which league(s) a user has imported, and which imported team is theirs
export const userLeagues = pgTable(
  "user_league",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => fantraxLeagues.id, { onDelete: "cascade" }),
    myFantraxTeamId: text("my_fantrax_team_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [uniqueIndex("user_league_user_league_idx").on(t.userId, t.leagueId)]
);

// --- NHL reference data ---

export const nhlTeams = pgTable("nhl_team", {
  abbrev: text("abbrev").primaryKey(), // e.g. "TOR"
  name: text("name").notNull(),
  conference: text("conference"),
  division: text("division"),
});

export const nhlGames = pgTable(
  "nhl_game",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nhlGameId: text("nhl_game_id").notNull().unique(),
    season: text("season").notNull(), // e.g. "20262027"
    gameDate: date("game_date").notNull(),
    homeTeamAbbrev: text("home_team_abbrev")
      .notNull()
      .references(() => nhlTeams.abbrev),
    awayTeamAbbrev: text("away_team_abbrev")
      .notNull()
      .references(() => nhlTeams.abbrev),
  },
  (t) => [uniqueIndex("nhl_game_season_date_teams_idx").on(t.season, t.gameDate, t.homeTeamAbbrev, t.awayTeamAbbrev)]
);

// --- Player data ---

// One row per player as known to Fantrax (from fxea getPlayerIds), shared across leagues/users
export const fantraxPlayers = pgTable("fantrax_player", {
  fantraxPlayerId: text("fantrax_player_id").primaryKey(),
  name: text("name").notNull(), // "Last, First" as returned by Fantrax
  position: text("position"), // granular: C / LW / RW / D / G
  nhlTeamAbbrev: text("nhl_team_abbrev"),
  nhlPlayerId: text("nhl_player_id"), // filled in by name/team matching against the NHL API
});

// A user's imported roster for a given league, with keeper + consideration flags
export const teamRosters = pgTable(
  "team_roster",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userLeagueId: uuid("user_league_id")
      .notNull()
      .references(() => userLeagues.id, { onDelete: "cascade" }),
    fantraxPlayerId: text("fantrax_player_id")
      .notNull()
      .references(() => fantraxPlayers.fantraxPlayerId),
    // The league's own active-roster bucket for this player (e.g. "F"/"D"/"G"),
    // as returned by fxea getTeamRosters - not the granular C/LW/RW position.
    // This is what roster-slot limits (fantraxLeagues.settingsJson) are keyed by.
    rosterPosition: text("roster_position").notNull(),
    isKeeper: boolean("is_keeper").notNull().default(false),
    isConsidered: boolean("is_considered").notNull().default(true),
  },
  (t) => [uniqueIndex("team_roster_league_player_idx").on(t.userLeagueId, t.fantraxPlayerId)]
);

// Hypothetical draft targets: players NOT on the user's actual Fantrax roster, added here
// to see how drafting them would change the gap/surplus analysis. Separate from team_roster
// since these aren't real roster moves - just what-if additions for draft-day planning.
export const draftTargets = pgTable(
  "draft_target",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userLeagueId: uuid("user_league_id")
      .notNull()
      .references(() => userLeagues.id, { onDelete: "cascade" }),
    fantraxPlayerId: text("fantrax_player_id")
      .notNull()
      .references(() => fantraxPlayers.fantraxPlayerId),
    // Roster-slot bucket (e.g. "F"/"D"/"G") this player was mapped to when added -
    // see mapPositionToBucket in lib/fantrax/position-mapping.ts.
    rosterPosition: text("roster_position").notNull(),
    addedAt: timestamp("added_at", { mode: "date" }).defaultNow(),
  },
  (t) => [uniqueIndex("draft_target_league_player_idx").on(t.userLeagueId, t.fantraxPlayerId)]
);

// Manual override of whether a player on ANOTHER team's roster is actually being kept.
// Fantrax doesn't expose real Keeper Admin picks via any API, so the default guess (top 6
// by live ADP per team - see lib/analysis/likely-keepers.ts) is just a heuristic; this lets
// the user correct it once real keeper lists are set. No FK to fantrax_player - these are
// opponents' players, which the app doesn't otherwise need to persist.
export const keeperOverrides = pgTable(
  "keeper_override",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userLeagueId: uuid("user_league_id")
      .notNull()
      .references(() => userLeagues.id, { onDelete: "cascade" }),
    fantraxPlayerId: text("fantrax_player_id").notNull(),
    isKept: boolean("is_kept").notNull(),
  },
  (t) => [uniqueIndex("keeper_override_league_player_idx").on(t.userLeagueId, t.fantraxPlayerId)]
);

// Players manually removed from the "best-fit" draft board - typically because they got
// drafted by someone else during a live draft. No FK to fantrax_player, same reasoning as
// keeper_override: these are drawn from the spreadsheet-matched player pool, not
// necessarily players the app has otherwise persisted.
export const removedPlayers = pgTable(
  "removed_player",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userLeagueId: uuid("user_league_id")
      .notNull()
      .references(() => userLeagues.id, { onDelete: "cascade" }),
    fantraxPlayerId: text("fantrax_player_id").notNull(),
    removedAt: timestamp("removed_at", { mode: "date" }).defaultNow(),
  },
  (t) => [uniqueIndex("removed_player_league_player_idx").on(t.userLeagueId, t.fantraxPlayerId)]
);

// Cached rows from the user's uploaded "The List" projections spreadsheet
export const spreadsheetProjections = pgTable("spreadsheet_projection", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  importedAt: timestamp("imported_at", { mode: "date" }).defaultNow(),
  rank: integer("rank"),
  name: text("name").notNull(),
  position: text("position"),
  nhlTeamAbbrev: text("nhl_team_abbrev"),
  age: integer("age"),
  salary: doublePrecision("salary"),
  fantasyPoints: doublePrecision("fantasy_points"),
  fantasyPointsPerGp: doublePrecision("fantasy_points_per_gp"),
  vorp: doublePrecision("vorp"),
  adp: doublePrecision("adp"),
  fantraxPlayerId: text("fantrax_player_id").references(() => fantraxPlayers.fantraxPlayerId),
  // Everything else from the sheet (GP, TOI, G/A/PTS, SOG, PPG/PPP, SHG/SHP, BLK, HIT, +/-, PIM, GWG,
  // FOW/FOL/FO%, and goalie GP/W/L/OTL/SO/SV/GA/SV%/GAA) kept as-is rather than one column per stat.
  stats: jsonb("stats").$type<Record<string, number | null>>(),
});
