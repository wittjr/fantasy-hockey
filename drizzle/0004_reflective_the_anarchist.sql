CREATE TABLE "yahoo_connection" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"yahoo_guid" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"redirect_uri" text NOT NULL,
	"connected_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "fantrax_league" ADD COLUMN "provider" text DEFAULT 'fantrax' NOT NULL;--> statement-breakpoint
ALTER TABLE "yahoo_connection" ADD CONSTRAINT "yahoo_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;