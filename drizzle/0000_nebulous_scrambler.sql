CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "fantrax_league" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fantrax_league_id" text NOT NULL,
	"name" text NOT NULL,
	"sport" text DEFAULT 'NHL' NOT NULL,
	"season_year" text,
	"start_date" date,
	"end_date" date,
	"settings_json" jsonb,
	"last_synced_at" timestamp,
	CONSTRAINT "fantrax_league_fantrax_league_id_unique" UNIQUE("fantrax_league_id")
);
--> statement-breakpoint
CREATE TABLE "fantrax_player" (
	"fantrax_player_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"nhl_team_abbrev" text,
	"nhl_player_id" text
);
--> statement-breakpoint
CREATE TABLE "fantrax_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"fantrax_team_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nhl_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nhl_game_id" text NOT NULL,
	"season" text NOT NULL,
	"game_date" date NOT NULL,
	"home_team_abbrev" text NOT NULL,
	"away_team_abbrev" text NOT NULL,
	CONSTRAINT "nhl_game_nhl_game_id_unique" UNIQUE("nhl_game_id")
);
--> statement-breakpoint
CREATE TABLE "nhl_team" (
	"abbrev" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"conference" text,
	"division" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_projection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"imported_at" timestamp DEFAULT now(),
	"rank" integer,
	"name" text NOT NULL,
	"position" text,
	"nhl_team_abbrev" text,
	"age" integer,
	"salary" double precision,
	"fantasy_points" double precision,
	"fantasy_points_per_gp" double precision,
	"vorp" double precision,
	"adp" double precision,
	"fantrax_player_id" text,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "team_roster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_league_id" uuid NOT NULL,
	"fantrax_player_id" text NOT NULL,
	"roster_position" text NOT NULL,
	"is_keeper" boolean DEFAULT false NOT NULL,
	"is_considered" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_league" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"league_id" uuid NOT NULL,
	"my_fantrax_team_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantrax_team" ADD CONSTRAINT "fantrax_team_league_id_fantrax_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."fantrax_league"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nhl_game" ADD CONSTRAINT "nhl_game_home_team_abbrev_nhl_team_abbrev_fk" FOREIGN KEY ("home_team_abbrev") REFERENCES "public"."nhl_team"("abbrev") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nhl_game" ADD CONSTRAINT "nhl_game_away_team_abbrev_nhl_team_abbrev_fk" FOREIGN KEY ("away_team_abbrev") REFERENCES "public"."nhl_team"("abbrev") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_projection" ADD CONSTRAINT "spreadsheet_projection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_projection" ADD CONSTRAINT "spreadsheet_projection_fantrax_player_id_fantrax_player_fantrax_player_id_fk" FOREIGN KEY ("fantrax_player_id") REFERENCES "public"."fantrax_player"("fantrax_player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_roster" ADD CONSTRAINT "team_roster_user_league_id_user_league_id_fk" FOREIGN KEY ("user_league_id") REFERENCES "public"."user_league"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_roster" ADD CONSTRAINT "team_roster_fantrax_player_id_fantrax_player_fantrax_player_id_fk" FOREIGN KEY ("fantrax_player_id") REFERENCES "public"."fantrax_player"("fantrax_player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_league" ADD CONSTRAINT "user_league_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_league" ADD CONSTRAINT "user_league_league_id_fantrax_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."fantrax_league"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fantrax_team_league_team_idx" ON "fantrax_team" USING btree ("league_id","fantrax_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nhl_game_season_date_teams_idx" ON "nhl_game" USING btree ("season","game_date","home_team_abbrev","away_team_abbrev");--> statement-breakpoint
CREATE UNIQUE INDEX "team_roster_league_player_idx" ON "team_roster" USING btree ("user_league_id","fantrax_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_league_user_league_idx" ON "user_league" USING btree ("user_id","league_id");