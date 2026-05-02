-- Migration: Add nine_hole_section column to round table
-- Purpose:
--   Track which 9-hole section (front or back) was played for 9-hole rounds, so
--   USGA Rule 5.1b calculations can pick the correct front9/back9 ratings, slope
--   and par. Null is allowed and means "not specified" -- legacy 9-hole rows
--   default to the front-9 in app code, and 18-hole rows have no section.
--
-- Idempotency: this migration is wrapped to be safe to re-run against a
-- database that already has the column/constraints (e.g. local
-- `supabase db reset` against a DB that has them from a previous run).
-- Postgres supports `ADD COLUMN IF NOT EXISTS` natively but does NOT
-- support `ADD CONSTRAINT IF NOT EXISTS`, so the constraints are added
-- via DO blocks that swallow `duplicate_object`.

alter table public.round
  add column if not exists nine_hole_section text;

do $$
begin
  alter table public.round
    add constraint round_nine_hole_section_check
    check (nine_hole_section is null or nine_hole_section in ('front', 'back'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.round
    add constraint round_nine_hole_section_requires_9
    check (nine_hole_section is null or holes_played = 9);
exception
  when duplicate_object then null;
end
$$;

comment on column public.round.nine_hole_section is
  '''front''/''back'' for 9-hole rounds (USGA Rule 5.1b). Null for 18-hole rounds and for legacy 9-hole rows -- app code treats null as ''front'' for backward compat.';
