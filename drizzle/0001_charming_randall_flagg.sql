CREATE TABLE "draft_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_league_id" uuid NOT NULL,
	"fantrax_player_id" text NOT NULL,
	"roster_position" text NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "draft_target" ADD CONSTRAINT "draft_target_user_league_id_user_league_id_fk" FOREIGN KEY ("user_league_id") REFERENCES "public"."user_league"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_target" ADD CONSTRAINT "draft_target_fantrax_player_id_fantrax_player_fantrax_player_id_fk" FOREIGN KEY ("fantrax_player_id") REFERENCES "public"."fantrax_player"("fantrax_player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_target_league_player_idx" ON "draft_target" USING btree ("user_league_id","fantrax_player_id");