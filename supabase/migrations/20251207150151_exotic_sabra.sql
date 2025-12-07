CREATE TABLE "handicap_calculation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_updated" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	CONSTRAINT "handicap_calculation_queue_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "handicap_calculation_queue" ADD CONSTRAINT "handicap_calculation_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_handicap_queue_status_created" ON "handicap_calculation_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_handicap_queue_user_id" ON "handicap_calculation_queue" USING btree ("user_id");