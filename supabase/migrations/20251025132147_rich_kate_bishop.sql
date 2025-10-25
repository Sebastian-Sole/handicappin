CREATE INDEX "idx_round_userId" ON "round" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "rounds_used";