CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE TABLE "billing"."customers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
ALTER TABLE "billing"."customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing"."events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing"."events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing"."subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp,
	"is_lifetime" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing"."customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "Users can view their own customer record" ON "billing"."customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = user_id));--> statement-breakpoint
CREATE POLICY "Service role can insert events" ON "billing"."events" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view their own subscription" ON "billing"."subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid()::uuid = user_id));