CREATE TABLE "keeper_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_league_id" uuid NOT NULL,
	"fantrax_player_id" text NOT NULL,
	"is_kept" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keeper_override" ADD CONSTRAINT "keeper_override_user_league_id_user_league_id_fk" FOREIGN KEY ("user_league_id") REFERENCES "public"."user_league"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keeper_override_league_player_idx" ON "keeper_override" USING btree ("user_league_id","fantrax_player_id");