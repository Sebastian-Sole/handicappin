-- Migration: Add nine_hole_section column to round table
-- Purpose:
--   Track which 9-hole section (front or back) was played for 9-hole rounds, so
--   USGA Rule 5.1b calculations can pick the correct front9/back9 ratings, slope
--   and par. Null is allowed and means "not specified" -- legacy 9-hole rows
--   default to the front-9 in app code, and 18-hole rows have no section.

alter table public.round
  add column nine_hole_section text;

alter table public.round
  add constraint round_nine_hole_section_check
  check (nine_hole_section is null or nine_hole_section in ('front', 'back'));

alter table public.round
  add constraint round_nine_hole_section_requires_9
  check (nine_hole_section is null or holes_played = 9);

comment on column public.round.nine_hole_section is
  '''front''/''back'' for 9-hole rounds (USGA Rule 5.1b). Null for 18-hole rounds and for legacy 9-hole rows -- app code treats null as ''front'' for backward compat.';
