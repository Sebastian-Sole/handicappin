-- Migration: Notify users when a round's approval status changes
-- Purpose:
--   Emails the round's owner when round."approvalStatus" transitions to
--   'approved' or 'rejected'. Uses the same vault + pg_net pattern as
--   notify_handicap_engine().
--
-- Environments:
--   Local: detects that SUPABASE_SERVICE_ROLE_KEY is not in vault and calls
--     http://host.docker.internal:3000/api/notifications/round-approval
--     without auth. Safe because localhost isn't publicly reachable.
--   Production: reads ROUND_APPROVAL_NOTIFICATION_URL + SUPABASE_SERVICE_ROLE_KEY
--     from vault.decrypted_secrets and sends Authorization: Bearer <key>.
--
-- One-time production setup (run once in Supabase SQL editor):
--   select vault.create_secret(
--     'https://handicappin.com/api/notifications/round-approval',
--     'ROUND_APPROVAL_NOTIFICATION_URL'
--   );

create or replace function public.notify_round_approval_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_url text;
  service_role_key text;
  payload jsonb;
  is_local boolean;
begin
  -- Only fire on actual transitions INTO a terminal state.
  if new."approvalStatus" not in ('approved', 'rejected') then
    return new;
  end if;

  if new."approvalStatus" is not distinct from old."approvalStatus" then
    return new;
  end if;

  -- Detect local development: if SUPABASE_SERVICE_ROLE_KEY isn't in vault,
  -- treat this as a local environment (matches notify_handicap_engine logic).
  begin
    select count(*) > 0 into is_local
    from vault.decrypted_secrets
    where name = 'SUPABASE_SERVICE_ROLE_KEY';

    is_local := not is_local;
  exception when others then
    is_local := true;
  end;

  payload := jsonb_build_object(
    'roundId', new.id,
    'userId', new."userId",
    'approvalStatus', new."approvalStatus",
    'previousStatus', old."approvalStatus"
  );

  if is_local then
    -- Local development: hit the Next.js dev server on the host machine.
    -- No auth -- the endpoint allows unauthenticated requests when
    -- NODE_ENV !== 'production'. host.docker.internal resolves to the
    -- Docker host from inside the Supabase Postgres container.
    perform net.http_post(
      url := 'http://host.docker.internal:3000/api/notifications/round-approval',
      body := payload,
      headers := jsonb_build_object('Content-Type', 'application/json')
    );

    return new;
  end if;

  -- Production: read URL + bearer from vault.
  select secret into target_url
  from vault.decrypted_secrets
  where name = 'ROUND_APPROVAL_NOTIFICATION_URL'
  order by created_at desc
  limit 1;

  if target_url is null then
    raise warning 'ROUND_APPROVAL_NOTIFICATION_URL not found in vault.decrypted_secrets; skipping notification for round %', new.id;
    return new;
  end if;

  select secret into service_role_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_SERVICE_ROLE_KEY'
  order by created_at desc
  limit 1;

  if service_role_key is null then
    raise warning 'SUPABASE_SERVICE_ROLE_KEY not found in vault.decrypted_secrets; skipping notification for round %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := target_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  );

  return new;
end;
$$;

comment on function public.notify_round_approval_change() is
  'Fires an HTTP POST to the round-approval notification endpoint when round.approvalStatus transitions to approved or rejected. Auto-detects local vs production via vault.';

drop trigger if exists trigger_notify_round_approval_change on public.round;

create trigger trigger_notify_round_approval_change
  after update of "approvalStatus" on public.round
  for each row
  execute function public.notify_round_approval_change();
