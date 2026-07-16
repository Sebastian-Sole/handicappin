-- Fix Ballerud Golf "Yellow" (mens) tee data.
--
-- The original ingest (pre-validator parse_scorecard.py) stored a 9-hole
-- course rating (26.4) in the 18-hole field and halved it into impossible
-- per-nine ratings (13.2 — a scratch golfer cannot shoot 13.2 over nine
-- par-3 holes). The slope (89) and hole distances/stroke indexes were also
-- stale: the course was re-measured and officially re-rated in August 2024.
--
-- Corrected values, verified 2026-07-16 against the club's official pages:
--   https://ballerud.no/bane/slopetabeller  (Gul / HERRER: Par 54, CR/Slope 53,6/93)
--   https://ballerud.no/bane/scorekort      (Gul distances, stroke index, par)
-- The playing-handicap table on the slope page is internally consistent with
-- CR 53.6 / slope 93 (e.g. HCP 54.0 -> MS 44 = 54*(93/113) + (53.6-54)).
--
-- Per-nine convention (matches the ingest pipeline): CR halves (26.8 per
-- nine), slope does not (93 per nine). Back-nine holes mirror the front with
-- stroke index +1, per the official scorecard's holes 10-18.
--
-- After correcting the tee, every user with a round on it is (re)queued in
-- handicap_calculation_queue; the scheduled processor recomputes course
-- handicaps, score differentials, and the rolling handicap index from the
-- corrected ratings (see process-handicap-queue edge function).

do $$
declare
  v_tee_ids integer[];
  v_queued integer;
begin
  -- All versions of the tee (approved/archived/pending), so rounds that
  -- reference an archived version are also recomputed from corrected data.
  select array_agg(t.id) into v_tee_ids
  from public."teeInfo" t
  join public.course c on c.id = t."courseId"
  where c.name = 'Ballerud Golf'
    and c.country = 'Norway'
    and c."approvalStatus" = 'approved'
    and t.name = 'Yellow'
    and t.gender = 'mens';

  if v_tee_ids is null then
    raise notice 'Ballerud Golf Yellow (mens) tee not found — nothing to fix in this environment';
    return;
  end if;

  update public."teeInfo" set
    "courseRating18" = 53.6,
    "slopeRating18" = 93,
    "courseRatingFront9" = 26.8,
    "slopeRatingFront9" = 93,
    "courseRatingBack9" = 26.8,
    "slopeRatingBack9" = 93,
    "outDistance" = 960,
    "inDistance" = 960,
    "totalDistance" = 1920
  where id = any(v_tee_ids);

  update public.hole h set
    distance = v.distance,
    hcp = v.hcp
  from (values
    ( 1, 148,  1), ( 2, 128,  3), ( 3,  67, 13),
    ( 4,  99, 17), ( 5, 100, 15), ( 6,  97, 11),
    ( 7, 114,  7), ( 8, 109,  5), ( 9,  98,  9),
    (10, 148,  2), (11, 128,  4), (12,  67, 14),
    (13,  99, 18), (14, 100, 16), (15,  97, 12),
    (16, 114,  8), (17, 109,  6), (18,  98, 10)
  ) as v("holeNumber", distance, hcp)
  where h."teeId" = any(v_tee_ids)
    and h."holeNumber" = v."holeNumber";

  -- Queue a handicap recalculation for every user who has a round on this
  -- tee. Mirrors enqueue_handicap_calculation()'s upsert; resetting status
  -- and attempts re-activates entries the processor already completed.
  insert into public.handicap_calculation_queue (user_id, event_type, last_updated)
  select distinct r."userId", 'round_update', now()
  from public.round r
  where r."teeId" = any(v_tee_ids)
  on conflict (user_id) do update set
    event_type = excluded.event_type,
    last_updated = excluded.last_updated,
    status = 'pending',
    attempts = 0,
    error_message = null;

  get diagnostics v_queued = row_count;
  raise notice 'Corrected Ballerud Yellow (mens) tee(s) %; queued % user(s) for handicap recalculation',
    v_tee_ids, v_queued;
end $$;
