ALTER TABLE "Score" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER POLICY "Enable delete for users based on user_id" ON "Profile" RENAME TO "Enable delete for users based on their own user_id";--> statement-breakpoint
CREATE POLICY "Enable insert for users based on userId" ON "Score" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = "userId"));--> statement-breakpoint
CREATE POLICY "Enable users to view their own data only" ON "Score" AS PERMISSIVE FOR SELECT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = "userId"));--> statement-breakpoint
ALTER POLICY "Enable insert for authenticated users only" ON "Profile" TO authenticated WITH CHECK (true);--> statement-breakpoint
ALTER POLICY "Enable users to view their own data only" ON "Profile" TO authenticated WITH CHECK ((auth.uid() = id));--> statement-breakpoint
ALTER POLICY "Enable users to view their own data only" ON "Round" TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = "userId"));