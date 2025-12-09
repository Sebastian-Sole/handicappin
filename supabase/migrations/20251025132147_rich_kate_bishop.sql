-- Migration: Create round index and remove deprecated profile column
-- Purpose: Optimize queries on round table by userId and cleanup deprecated tracking
-- Affected tables: round, profile
-- WARNING: This will permanently remove rounds_used column data

-- create index for round queries by user
create index "idx_round_user_id" on "round" using btree ("userId");

-- remove deprecated rounds tracking column
-- note: this column is being replaced by subscription-based limits
alter table "profile" drop column "rounds_used";