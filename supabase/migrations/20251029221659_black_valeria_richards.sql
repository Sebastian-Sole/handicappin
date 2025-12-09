CREATE TABLE "pending_lifetime_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"checkout_session_id" text NOT NULL,
	"payment_intent_id" text,
	"price_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "pending_lifetime_purchases_checkout_session_id_unique" UNIQUE("checkout_session_id")
);
--> statement-breakpoint
ALTER TABLE "pending_lifetime_purchases" ADD CONSTRAINT "pending_lifetime_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_pending_lifetime_user" ON "pending_lifetime_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pending_lifetime_payment_intent" ON "pending_lifetime_purchases" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_pending_lifetime_status" ON "pending_lifetime_purchases" USING btree ("status");