CREATE TABLE "watched_player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_league_id" uuid NOT NULL,
	"fantrax_player_id" text NOT NULL,
	"watched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "watched_player" ADD CONSTRAINT "watched_player_user_league_id_user_league_id_fk" FOREIGN KEY ("user_league_id") REFERENCES "public"."user_league"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watched_player_league_player_idx" ON "watched_player" USING btree ("user_league_id","fantrax_player_id");