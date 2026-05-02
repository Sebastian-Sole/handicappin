-- Convert enqueue_handicap_calculation to SECURITY DEFINER so it bypasses
-- per-user permissions on handicap_calculation_queue. The lockdown migration
-- (20260502095010_lock_handicap_queue.sql) revokes table privileges from the
-- `authenticated` role. As SECURITY INVOKER the trigger ran as the round
-- inserter and could no longer write to the queue, breaking round
-- submissions. SECURITY DEFINER runs as the function owner (postgres /
-- service role), which retains write privileges on the queue.
--
-- The function body was already audited and is bounded: an UPSERT into the
-- queue + an existence check on the profile. No user-controlled SQL.

create or replace function public.enqueue_handicap_calculation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  event_type_value text;
  profile_exists boolean;
begin
  -- Determine user_id and event type based on operation
  if TG_OP = 'DELETE' then
    target_user_id := OLD."userId";
    event_type_value := 'round_delete';
  else
    target_user_id := NEW."userId";
    if TG_OP = 'INSERT' then
      event_type_value := 'round_insert';
    else
      event_type_value := 'round_update';
    end if;
  end if;

  -- For DELETE operations, verify the profile still exists.
  -- During a cascade delete (profile deletion), the profile row is already
  -- marked for deletion, so inserting into the queue would violate the FK
  -- constraint. Skip enqueuing in that case.
  if TG_OP = 'DELETE' then
    select exists(
      select 1 from public.profile where id = target_user_id
    ) into profile_exists;

    if not profile_exists then
      return OLD;
    end if;
  end if;

  -- UPSERT into queue: if user already queued, just update timestamp
  -- This ensures only one entry per user regardless of how many rounds change
  insert into public.handicap_calculation_queue (
    user_id,
    event_type,
    last_updated
  )
  values (
    target_user_id,
    event_type_value,
    NOW()
  )
  on conflict (user_id)
  do update set
    last_updated = NOW(),
    event_type = EXCLUDED.event_type,
    status = 'pending',
    attempts = 0;

  -- Return appropriate value for trigger
  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

comment on function public.enqueue_handicap_calculation() is
  'Lightweight trigger that enqueues users for handicap recalculation. Uses UPSERT to ensure only one queue entry per user. Handles cascade deletes gracefully by checking profile existence. SECURITY DEFINER so it can write to handicap_calculation_queue regardless of caller privileges (the queue is locked down to service_role; only this trigger and the cron processor write to it).';
