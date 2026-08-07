-- Migration: Fix notify_round_approval_change() vault read + make it non-blocking
-- Purpose:
--   Approving a course raised
--     "URL using bad/illegal format or missing URL"
--   from net.http_post and rolled back the whole approval:
--     course approve -> cascade_approval_to_rounds() -> round.approvalStatus update
--       -> notify_round_approval_change() -> net.http_post(url := <ciphertext>)
--
--   Two defects:
--   1. It selected vault.decrypted_secrets.secret (the base64 CIPHERTEXT)
--      instead of .decrypted_secret (the plaintext). The URL was therefore
--      never a URL, and the bearer token was never the service role key.
--      The cron migrations (20260430120000 / 20260502094814) already use
--      .decrypted_secret correctly; this function copied the pattern from
--      notify_handicap_engine(), which was dropped in 20251207150152.
--   2. A notification failure aborted the transaction that triggered it.
--      Emailing someone must never be able to block an approval, so the
--      dispatch is now wrapped and downgraded to a warning.
--
--   Also validates the URL shape before handing it to pg_net, so a
--   misconfigured vault entry warns instead of erroring.

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
  -- treat this as a local environment.
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
    begin
      perform net.http_post(
        url := 'http://host.docker.internal:3000/api/notifications/round-approval',
        body := payload,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      raise warning 'round-approval notification failed for round % (local): %', new.id, sqlerrm;
    end;

    return new;
  end if;

  -- Production: read URL + bearer from vault. decrypted_secret is the
  -- plaintext; the `secret` column holds the ciphertext.
  select btrim(decrypted_secret) into target_url
  from vault.decrypted_secrets
  where name = 'ROUND_APPROVAL_NOTIFICATION_URL'
  order by created_at desc
  limit 1;

  if target_url is null or target_url = '' then
    raise warning 'ROUND_APPROVAL_NOTIFICATION_URL not found in vault.decrypted_secrets; skipping notification for round %', new.id;
    return new;
  end if;

  if target_url !~ '^https?://' then
    raise warning 'ROUND_APPROVAL_NOTIFICATION_URL is not a valid http(s) URL; skipping notification for round %', new.id;
    return new;
  end if;

  select btrim(decrypted_secret) into service_role_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_SERVICE_ROLE_KEY'
  order by created_at desc
  limit 1;

  if service_role_key is null or service_role_key = '' then
    raise warning 'SUPABASE_SERVICE_ROLE_KEY not found in vault.decrypted_secrets; skipping notification for round %', new.id;
    return new;
  end if;

  -- A failed notification must never roll back the approval that caused it.
  begin
    perform net.http_post(
      url := target_url,
      body := payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );
  exception when others then
    raise warning 'round-approval notification failed for round %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.notify_round_approval_change() is
  'Fires an HTTP POST to the round-approval notification endpoint when round.approvalStatus transitions to approved or rejected. Reads vault.decrypted_secrets.decrypted_secret (plaintext). Dispatch failures warn rather than aborting the approval transaction.';
