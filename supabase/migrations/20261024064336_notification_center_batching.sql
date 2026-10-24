-- SharePix — batching des événements, préférences de souvenirs/rappels et horaires locaux.
-- Les événements collaboratifs sont placés dans une file avec une fenêtre de
-- regroupement; le worker Edge les envoie au lieu d'appeler Expo par ligne.

alter table public.profiles
  add column if not exists push_memories boolean not null default true,
  add column if not exists push_reminders boolean not null default true,
  add column if not exists timezone text;

-- Les anciens profils n'ont pas leur fuseau connu : on attend que la nouvelle
-- app le synchronise plutôt que d'envoyer à tort sur la base de l'UTC.
alter table public.profiles alter column timezone drop not null;
alter table public.profiles alter column timezone drop default;

comment on column public.profiles.push_memories is
  'Opt-in de catégorie pour les souvenirs d’anniversaire d’album et de photo.';
comment on column public.profiles.push_reminders is
  'Opt-in de catégorie pour les rappels d’invitation, une seule fois par album vide.';
comment on column public.profiles.timezone is
  'Fuseau IANA de l’appareil principal, utilisé pour différer les notifications programmées entre 22 h et 8 h.';

create table if not exists public.push_notification_queue (
  id bigint generated always as identity primary key,
  activity_id uuid not null unique references public.activity_log(id) on delete cascade,
  kind text not null,
  album_id uuid not null,
  actor_id uuid,
  actor_name text not null default '',
  album_name text not null default '',
  photo_id uuid,
  event_created_at timestamptz not null,
  available_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  processing_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists push_notification_queue_ready_idx
  on public.push_notification_queue (available_at, event_created_at)
  where status = 'pending';
create index if not exists push_notification_queue_processing_idx
  on public.push_notification_queue (processing_at)
  where status = 'processing';
create index if not exists albums_created_at_notification_idx
  on public.albums (created_at);
create index if not exists photos_created_at_notification_idx
  on public.photos (created_at);

create or replace function public.due_empty_album_reminders()
returns table (album_id uuid, album_name text, owner_id uuid, album_created_at timestamptz)
language sql
stable
security definer
set search_path = 'public'
as $$
  select a.id, a.name, a.user_id, a.created_at
    from public.albums a
   where a.user_id is not null
     and a.created_at is not null
     and a.created_at <= now() - interval '24 hours'
     and not exists (
       select 1 from public.photos p where p.album_id = a.id
     );
$$;

create or replace function public.notification_memory_candidates(p_from timestamptz, p_to timestamptz)
returns table (
  kind text,
  event_id uuid,
  album_id uuid,
  album_name text,
  event_created_at timestamptz,
  actor_name text,
  user_id uuid
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select 'album_anniversary'::text, a.id, a.id, a.name, a.created_at,
         coalesce(a.creator_name, 'Un membre'), am.user_id
    from public.albums a
    join public.album_members am on am.album_id = a.id
   where a.created_at >= p_from and a.created_at < p_to
  union all
  select 'photo_anniversary'::text, p.id, p.album_id, a.name, p.created_at,
         coalesce(p.author_name, 'Un membre'), am.user_id
    from public.photos p
    join public.albums a on a.id = p.album_id
    join public.album_members am on am.album_id = a.id
   where p.created_at >= p_from and p.created_at < p_to;
$$;

revoke all on function public.due_empty_album_reminders() from public, anon, authenticated;
revoke all on function public.notification_memory_candidates(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.due_empty_album_reminders() to service_role;
grant execute on function public.notification_memory_candidates(timestamptz, timestamptz) to service_role;

-- Une ligne par utilisateur et événement évite de répéter un souvenir ou le
-- rappel unique d'un album lors de chaque passage du cron.
create table if not exists public.push_notification_delivery_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  category text not null check (category in ('memories', 'reminders')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  primary key (user_id, event_key)
);

alter table public.push_notification_queue enable row level security;
alter table public.push_notification_delivery_log enable row level security;
revoke all on public.push_notification_queue from anon, authenticated;
revoke all on public.push_notification_delivery_log from anon, authenticated;
grant all on public.push_notification_queue to service_role;
grant all on public.push_notification_delivery_log to service_role;
grant usage, select on sequence public.push_notification_queue_id_seq to service_role;

create or replace function public.push_activity_webhook()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  -- La file reste le point de passage unique. Pour les photos, chaque nouvel
  -- ajout repousse le délai des événements du même album/membre : une rafale
  -- de téléversements est envoyée ensemble, et non une notification par photo.
  if new.kind = 'photo_added' then
    update public.push_notification_queue q
       set available_at = greatest(q.available_at, now() + interval '60 seconds')
     where q.status = 'pending'
       and q.kind = new.kind
       and q.album_id = new.album_id
       and q.actor_id is not distinct from new.actor_id
       and q.event_created_at >= now() - interval '60 seconds';
  end if;

  insert into public.push_notification_queue (
    activity_id, kind, album_id, actor_id, actor_name, album_name,
    photo_id, event_created_at, available_at
  ) values (
    new.id, new.kind, new.album_id, new.actor_id, new.actor_name,
    new.album_name, new.photo_id, new.created_at,
    now() + case when new.kind = 'photo_added' then interval '60 seconds' else interval '5 seconds' end
  ) on conflict (activity_id) do nothing;

  return new;
end;
$$;

create or replace function public.claim_push_notification_queue(p_limit integer default 500)
returns setof public.push_notification_queue
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  return query
  with candidates as (
    select q.id
      from public.push_notification_queue q
     where (q.status = 'pending' and q.available_at <= now())
        or (q.status = 'processing' and q.processing_at < now() - interval '5 minutes')
     order by q.event_created_at, q.id
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 500), 1000))
  ), claimed as (
    update public.push_notification_queue q
       set status = 'processing', processing_at = now(), attempts = q.attempts + 1
      from candidates c
     where q.id = c.id
     returning q.*
  )
  select * from claimed;
end;
$$;

create or replace function public.finish_push_notification_queue(
  p_ids bigint[],
  p_status text,
  p_error text default null
)
returns integer
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_count integer;
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'Invalid queue status';
  end if;
  update public.push_notification_queue
     set status = p_status,
         processed_at = now(),
         processing_at = null,
         last_error = left(coalesce(p_error, ''), 300)
   where id = any(coalesce(p_ids, '{}'::bigint[]))
     and status = 'processing';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.release_push_notification_queue(
  p_ids bigint[],
  p_delay_seconds integer default 60,
  p_error text default null
)
returns integer
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_count integer;
begin
  update public.push_notification_queue
     set status = case when attempts >= 10 then 'failed' else 'pending' end,
         available_at = now() + make_interval(secs => greatest(15, least(coalesce(p_delay_seconds, 60), 3600))),
         processing_at = null,
         processed_at = case when attempts >= 10 then now() else null end,
         last_error = left(coalesce(p_error, ''), 300)
   where id = any(coalesce(p_ids, '{}'::bigint[]))
     and status = 'processing';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_push_notification_queue(integer) from public, anon, authenticated;
revoke all on function public.finish_push_notification_queue(bigint[], text, text) from public, anon, authenticated;
revoke all on function public.release_push_notification_queue(bigint[], integer, text) from public, anon, authenticated;
grant execute on function public.claim_push_notification_queue(integer) to service_role;
grant execute on function public.finish_push_notification_queue(bigint[], text, text) to service_role;
grant execute on function public.release_push_notification_queue(bigint[], integer, text) to service_role;

-- pg_net est déjà utilisé par la configuration push existante; pg_cron est
-- disponible sur le projet de production et pilote les workers à intervalle fixe.
create extension if not exists pg_cron with schema pg_catalog;

do $schedule$
declare
  v_url text;
  v_secret text;
  v_job_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'activity_webhook_url'
   limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'activity_webhook_secret'
   limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise notice 'SharePix notification cron was not scheduled: webhook secrets are missing.';
  else
    for v_job_id in
      select jobid from cron.job
       where jobname in ('sharepix-push-dispatch', 'sharepix-scheduled-notifications')
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'sharepix-push-dispatch',
      '* * * * *',
      $dispatch$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'activity_webhook_url' limit 1),
          body := jsonb_build_object('action', 'dispatch'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'activity_webhook_secret' limit 1)
          ),
          timeout_milliseconds := 10000
        );
      $dispatch$
    );

    perform cron.schedule(
      'sharepix-scheduled-notifications',
      '*/15 * * * *',
      $scheduled$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'activity_webhook_url' limit 1),
          body := jsonb_build_object('action', 'scheduled'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'activity_webhook_secret' limit 1)
          ),
          timeout_milliseconds := 20000
        );
      $scheduled$
    );
  end if;
end;
$schedule$;
