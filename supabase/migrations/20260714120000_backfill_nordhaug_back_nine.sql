-- =============================================================================
-- Migration: Backfill Nordhaug Golfklubb back nine (holes 10-18)
-- Purpose: Nordhaug Golfklubb is a 9-hole course that was ingested with only 9
--   hole rows per tee. The scorecard tee schema requires 18 holes
--   (teeSchema.holes.min(18)), so every attempt to submit a round on this
--   course failed client-side validation with `teePlayed.holes` = "All 18 holes
--   must be defined" (Sentry HANDICAPPIN-44).
--
--   Fix: expand each tee to 18 holes by repeating the front nine as the back
--   nine (WHS 9-hole loop). Par and distance are copied; the stroke index is
--   +1 so the front nine keeps its odd stroke indexes (1-17) and the back nine
--   gets the evens (2-18), leaving all 18 unique (matches the Ballerud pattern
--   and the seed.sql fix). The tee-level outPar/inPar/totalPar and distance
--   aggregates were already stored for 18 holes, so they need no change.
--
-- Idempotent: only patches a tee that has exactly the 9 front holes and no
--   hole beyond number 9, so re-running is a no-op.
-- =============================================================================

do $$
declare
  v_tee   record;
  v_added integer := 0;
begin
  for v_tee in
    select t.id
    from public."teeInfo" t
    join public.course c on c.id = t."courseId"
    where c.name = 'Nordhaug Golfklubb'
  loop
    if not exists (
         select 1 from public.hole h
         where h."teeId" = v_tee.id and h."holeNumber" > 9
       )
       and (
         select count(*) from public.hole h
         where h."teeId" = v_tee.id and h."holeNumber" between 1 and 9
       ) = 9
    then
      insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
      select v_tee.id, h."holeNumber" + 9, h.par, h.distance, h.hcp + 1
      from public.hole h
      where h."teeId" = v_tee.id and h."holeNumber" between 1 and 9;

      v_added := v_added + 1;
    end if;
  end loop;

  raise notice 'Backfilled back nine for % Nordhaug tee(s)', v_added;
end $$;
