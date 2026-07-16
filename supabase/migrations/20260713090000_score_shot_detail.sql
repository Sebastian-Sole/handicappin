-- =============================================================================
-- Migration: Shot-level stats v1 (plans/010-shot-level-stats-v1)
-- Purpose:
--   Add three OPTIONAL per-hole shot-detail columns to `score`:
--     - "putts"          integer  NULL — putts taken on the hole
--     - "fairwayHit"     boolean  NULL — tee shot found the fairway
--                                        (NULL also covers par-3s, where
--                                        "fairway" does not apply)
--     - "penaltyStrokes" integer  NULL — penalty strokes incurred (already
--                                        included in `strokes`; informational
--                                        only — NOT a handicap-engine input)
--   No GIR column: greens in regulation is derived at read time as
--   (strokes - putts) <= (par - 2) when putts is present.
--   All columns are nullable with no default, so every existing row and every
--   non-detailed submission is unchanged. New columns inherit the row's
--   existing RLS policies.
-- =============================================================================

alter table public.score
  add column if not exists "putts" integer,
  add column if not exists "fairwayHit" boolean,
  add column if not exists "penaltyStrokes" integer;

comment on column public.score."putts" is
  'Putts taken on the hole (optional detailed scoring; NULL = not tracked)';
comment on column public.score."fairwayHit" is
  'Tee shot hit the fairway (optional detailed scoring; NULL = not tracked or par-3)';
comment on column public.score."penaltyStrokes" is
  'Penalty strokes on the hole, already counted inside strokes (optional detailed scoring; NULL = not tracked)';
