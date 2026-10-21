-- ════════════════════════════════════════════════════════════════════════
-- SharePix · Migration initiale — état réel de la production
-- ────────────────────────────────────────────────────────────────────────
-- Relevée directement depuis le catalogue PostgreSQL du projet
-- `bpillwvvxqiduxtkftuh` (PG 17.6.1) le 21/10/2026 :
--   pg_class, pg_attribute, pg_constraint, pg_indexes, pg_proc,
--   pg_trigger, pg_policies, information_schema.role_table_grants,
--   storage.buckets.
--
-- Remplace supabase/schema.sql, supprimé : ce dernier réécrivait les
-- policies Storage SANS le contrôle d'appartenance et recréait une
-- surcharge de join_album_by_code (erreur PGRST203). Il n'était donc plus
-- une source de vérité, mais un piège.
--
-- Le script est IDEMPOTENT : il peut être rejoué sans erreur sur une base
-- déjà à jour (create ... if not exists, drop policy if exists, create or
-- replace). Il sert à provisionner un environnement de test (staging) à
-- partir du dépôt.
--
-- ⚠️ Ne pas exécuter contre la production : tout y est déjà appliqué. Les
-- évolutions passent par de nouvelles migrations horodatées.
-- ════════════════════════════════════════════════════════════════════════

-- ── 0. Extensions ──────────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── 1. Profils ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 2. Albums, membres, codes d'invitation ─────────────────────────────
create table if not exists public.albums (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null,
  code         text not null unique,
  creator_name text default 'Anonyme',
  created_at   timestamptz default now()
);

create table if not exists public.album_members (
  album_id    uuid not null references public.albums(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  joined_at   timestamptz not null default now(),
  member_name text not null default '',
  primary key (album_id, user_id)
);

-- ── 3. Photos, commentaires, likes ─────────────────────────────────────
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid references public.albums(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz default now(),
  uploader_id  uuid references auth.users(id) on delete cascade default auth.uid(),
  author_name  text not null default ''
);

create table if not exists public.photo_comments (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.photos(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  author_name text not null default '',
  content     text not null check (
    char_length(trim(content)) >= 1 and char_length(trim(content)) <= 1000
  ),
  created_at  timestamptz not null default now(),
  parent_id   uuid references public.photo_comments(id) on delete cascade
);

create table if not exists public.photo_likes (
  photo_id   uuid not null references public.photos(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  user_name  text not null default '',
  primary key (photo_id, user_id)
);

-- ── 4. Journal d'activité + accusés de lecture ─────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (
    kind in ('member_joined', 'photo_added', 'comment_added', 'photo_liked')
  ),
  actor_id    uuid references auth.users(id) on delete cascade,
  actor_name  text not null default '',
  album_id    uuid not null references public.albums(id) on delete cascade,
  album_name  text not null default '',
  photo_id    uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.activity_acks (
  activity_id uuid not null references public.activity_log(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- ── 5. Jetons push ─────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  token      text not null,
  platform   text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ── 6. Index ───────────────────────────────────────────────────────────
create index if not exists album_members_album_idx   on public.album_members (album_id);
create index if not exists album_members_user_idx    on public.album_members (user_id);
create index if not exists photos_album_idx          on public.photos (album_id, created_at desc);
create unique index if not exists photos_storage_path_unique on public.photos (storage_path);
create index if not exists photo_comments_photo_idx  on public.photo_comments (photo_id, created_at);
create index if not exists photo_comments_parent_idx on public.photo_comments (parent_id);
create index if not exists photo_likes_user_idx      on public.photo_likes (user_id);
create index if not exists activity_log_album_idx    on public.activity_log (album_id, created_at desc);

-- Index manquants identifiés à l'audit (accès par auteur / uploader)
create index if not exists photos_uploader_idx        on public.photos (uploader_id);
create index if not exists photo_comments_author_idx  on public.photo_comments (author_id);
create index if not exists activity_log_actor_idx     on public.activity_log (actor_id);
create index if not exists activity_log_photo_idx     on public.activity_log (photo_id);

-- ── 7. Fonctions ───────────────────────────────────────────────────────

-- Profil créé automatiquement à l'inscription (anonyme incluse)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Prédicats d'appartenance, utilisés par les policies et le Storage
create or replace function public.is_album_member(p_album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.album_members
    where album_id = p_album_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_album_owner(p_album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.albums a
    where a.id = p_album_id and a.user_id = auth.uid()
  );
$$;

-- Création atomique : album + adhésion du créateur en propriétaire
create or replace function public.create_album(
  p_name text,
  p_code text,
  p_creator_name text default ''
)
returns json
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_album public.albums%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Non authentifie';
  end if;

  insert into public.albums (user_id, name, code, creator_name)
  values (auth.uid(), trim(p_name), upper(trim(p_code)), coalesce(p_creator_name, ''))
  returning * into v_album;

  insert into public.album_members (album_id, user_id, role, member_name)
  values (v_album.id, auth.uid(), 'owner', coalesce(p_creator_name, ''));

  return row_to_json(v_album);
end;
$$;

-- Rejoindre par code : idempotent, ne révèle pas l'existence d'un album
create or replace function public.join_album_by_code(
  p_code text,
  p_member_name text default ''
)
returns json
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_album public.albums%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Non authentifie';
  end if;

  select * into v_album from public.albums where code = upper(trim(p_code));
  if not found then
    raise exception 'CODE_INCONNU';
  end if;

  insert into public.album_members (album_id, user_id, role, member_name)
  values (v_album.id, auth.uid(), 'member', coalesce(p_member_name, ''))
  on conflict (album_id, user_id) do nothing;

  return row_to_json(v_album);
end;
$$;

-- Journalisation des événements (alimente activity_log et les pushs)
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_kind       text;
  v_album_id   uuid;
  v_photo_id   uuid := null;
  v_actor_name text := '';
  v_actor_id   uuid;
begin
  if tg_table_name = 'album_members' then
    v_kind := 'member_joined';
    v_album_id := new.album_id;
    v_actor_id := new.user_id;
    v_actor_name := new.member_name;
  elsif tg_table_name = 'photos' then
    v_kind := 'photo_added';
    v_album_id := new.album_id;
    v_photo_id := new.id;
    v_actor_id := new.uploader_id;
    v_actor_name := new.author_name;
  elsif tg_table_name = 'photo_comments' then
    v_kind := 'comment_added';
    select p.album_id into v_album_id from public.photos p where p.id = new.photo_id;
    v_photo_id := new.photo_id;
    v_actor_id := new.author_id;
    v_actor_name := new.author_name;
  elsif tg_table_name = 'photo_likes' then
    v_kind := 'photo_liked';
    select p.album_id into v_album_id from public.photos p where p.id = new.photo_id;
    v_photo_id := new.photo_id;
    v_actor_id := new.user_id;
    v_actor_name := new.user_name;
  else
    return new;
  end if;

  insert into public.activity_log (kind, actor_id, actor_name, album_id, album_name, photo_id)
  select v_kind, v_actor_id, coalesce(v_actor_name, ''), v_album_id, a.name, v_photo_id
  from public.albums a
  where a.id = v_album_id;

  return new;
end;
$$;

-- Fil d'activité de l'appelant : ses albums, hors ses propres actions,
-- hors éléments déjà acquittés.
create or replace function public.my_activity(p_limit integer default 50)
returns table (
  id uuid,
  kind text,
  actor_name text,
  album_name text,
  album_id uuid,
  photo_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select l.id, l.kind, l.actor_name, l.album_name, l.album_id, l.photo_id, l.created_at
  from public.activity_log l
  where public.is_album_member(l.album_id)
    and (l.actor_id is null or l.actor_id <> auth.uid())
    and not exists (
      select 1 from public.activity_acks k
      where k.activity_id = l.id and k.user_id = auth.uid()
    )
  order by l.created_at desc
  limit p_limit;
$$;

-- P1-06 : chemins Storage que l'appelant peut effacer. Postgres ne peut
-- pas supprimer les octets d'un bucket ; le client appelle storage.remove()
-- avec cette liste AVANT de supprimer son compte.
create or replace function public.my_storage_paths()
returns setof text
language sql
stable
security definer
set search_path = 'public'
as $$
  select p.storage_path
  from public.photos p
  where p.storage_path is not null
    and (
      p.uploader_id = auth.uid()
      or public.is_album_owner(p.album_id)
    );
$$;

-- Suppression du compte par l'utilisateur lui-même (pas de service_role
-- côté client). Les lignes partent en cascade ; les octets sont purgés
-- par le client via my_storage_paths().
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifie';
  end if;

  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- ── 8. Webhook de notification (P1-04) ─────────────────────────────────
-- Ni le secret ni l'URL ne sont figés dans le schéma : tous deux sont lus
-- dans vault.decrypted_secrets à l'émission. Un environnement sans ces
-- secrets (staging, poste local) reste donc inerte et ne peut pas, par
-- accident, notifier la production. C'est ce qui rend cette migration
-- réellement transposable d'un projet à l'autre.
create or replace function public.push_activity_webhook()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_secret text;
  v_url    text;
begin
  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.name = 'activity_webhook_secret'
  limit 1;

  select s.decrypted_secret into v_url
  from vault.decrypted_secrets s
  where s.name = 'activity_webhook_url'
  limit 1;

  if v_secret is null or v_secret = '' or v_url is null or v_url = '' then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'old_record', null,
      'record', to_jsonb(new),
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

-- ── 9. Triggers ────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists trg_activity_member on public.album_members;
create trigger trg_activity_member
after insert on public.album_members
for each row execute function public.log_activity();

drop trigger if exists trg_activity_photo on public.photos;
create trigger trg_activity_photo
after insert on public.photos
for each row execute function public.log_activity();

drop trigger if exists trg_activity_comment on public.photo_comments;
create trigger trg_activity_comment
after insert on public.photo_comments
for each row execute function public.log_activity();

drop trigger if exists trg_activity_like on public.photo_likes;
create trigger trg_activity_like
after insert on public.photo_likes
for each row execute function public.log_activity();

drop trigger if exists "activity-push" on public.activity_log;
create trigger "activity-push"
after insert on public.activity_log
for each row execute function public.push_activity_webhook();

-- ── 10. Row Level Security ─────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.albums         enable row level security;
alter table public.album_members  enable row level security;
alter table public.photos         enable row level security;
alter table public.photo_comments enable row level security;
alter table public.photo_likes    enable row level security;
alter table public.activity_log   enable row level security;
alter table public.activity_acks  enable row level security;
alter table public.push_tokens    enable row level security;

-- Profils : chacun ne voit et ne modifie que le sien
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Albums : visibles uniquement par leurs membres
drop policy if exists albums_select_member on public.albums;
create policy albums_select_member on public.albums
  for select using (public.is_album_member(id));

drop policy if exists albums_update_owner on public.albums;
create policy albums_update_owner on public.albums
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists albums_delete_owner on public.albums;
create policy albums_delete_owner on public.albums
  for delete using (user_id = auth.uid());

-- Membres : soi-même, ou n'importe quel membre de ses albums
drop policy if exists album_members_select on public.album_members;
create policy album_members_select on public.album_members
  for select using (user_id = auth.uid() or public.is_album_member(album_id));

-- Le propriétaire peut retirer un membre (jamais un autre propriétaire)
drop policy if exists album_members_delete_owner on public.album_members;
create policy album_members_delete_owner on public.album_members
  for delete using (
    role = 'member'
    and exists (select 1 from public.albums a
                where a.id = album_members.album_id and a.user_id = auth.uid())
  );

-- Chacun peut quitter un album dont il est simple membre
drop policy if exists album_members_delete_self on public.album_members;
create policy album_members_delete_self on public.album_members
  for delete using (user_id = auth.uid() and role = 'member');

-- Photos : lecture par les membres, écriture en son nom
drop policy if exists photos_select_member on public.photos;
create policy photos_select_member on public.photos
  for select using (public.is_album_member(album_id));

drop policy if exists photos_insert_member on public.photos;
create policy photos_insert_member on public.photos
  for insert with check (
    public.is_album_member(album_id) and uploader_id = auth.uid()
  );

drop policy if exists photos_delete_owner on public.photos;
create policy photos_delete_owner on public.photos
  for delete using (
    uploader_id = auth.uid()
    or exists (select 1 from public.albums a
               where a.id = photos.album_id and a.user_id = auth.uid())
  );

-- Commentaires
drop policy if exists photo_comments_select on public.photo_comments;
create policy photo_comments_select on public.photo_comments
  for select using (
    exists (select 1 from public.photos p
            where p.id = photo_comments.photo_id and public.is_album_member(p.album_id))
  );

drop policy if exists photo_comments_insert on public.photo_comments;
create policy photo_comments_insert on public.photo_comments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.photos p
                where p.id = photo_comments.photo_id and public.is_album_member(p.album_id))
  );

drop policy if exists photo_comments_delete on public.photo_comments;
create policy photo_comments_delete on public.photo_comments
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from public.photos p
      join public.albums a on a.id = p.album_id
      where p.id = photo_comments.photo_id and a.user_id = auth.uid()
    )
  );

-- Likes
drop policy if exists photo_likes_select on public.photo_likes;
create policy photo_likes_select on public.photo_likes
  for select using (
    exists (select 1 from public.photos p
            where p.id = photo_likes.photo_id and public.is_album_member(p.album_id))
  );

drop policy if exists photo_likes_insert on public.photo_likes;
create policy photo_likes_insert on public.photo_likes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.photos p
                where p.id = photo_likes.photo_id and public.is_album_member(p.album_id))
  );

drop policy if exists photo_likes_delete on public.photo_likes;
create policy photo_likes_delete on public.photo_likes
  for delete using (user_id = auth.uid());

-- Activité : lecture par les membres de l'album concerné
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select using (public.is_album_member(album_id));

drop policy if exists activity_acks_all on public.activity_acks;
create policy activity_acks_all on public.activity_acks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Jetons push : strictement personnels
drop policy if exists push_tokens_self on public.push_tokens;
create policy push_tokens_self on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 11. Storage : bucket privé + policies ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'album-photos',
  'album-photos',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Le chemin est « <album_id>/<fichier> ». Le premier segment est validé
-- comme UUID avant d'être converti : sans ce garde-fou, un dossier nommé
-- librement faisait échouer le cast et donc toute la policy.
drop policy if exists album_photos_member_read on storage.objects;
create policy album_photos_member_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'album-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        then public.is_album_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

drop policy if exists album_photos_auth_insert on storage.objects;
create policy album_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'album-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        then public.is_album_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

-- Correctif P0-01 : l'auteur du fichier, ou le propriétaire de l'album.
drop policy if exists album_photos_delete on storage.objects;
create policy album_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'album-photos'
    and (
      owner = auth.uid()
      or case
        when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then public.is_album_owner(((storage.foldername(name))[1])::uuid)
        else false
      end
    )
  );

-- ── 12. Droits d'exécution des fonctions ───────────────────────────────
-- Aucune de ces fonctions n'est réservée à service_role : elles sont
-- conçues pour être appelées par le client authentifié, avec auth.uid().
revoke all on function public.create_album(text, text, text)      from public, anon;
revoke all on function public.join_album_by_code(text, text)      from public, anon;
revoke all on function public.my_activity(integer)                from public, anon;
revoke all on function public.my_storage_paths()                  from public, anon;
revoke all on function public.delete_own_account()                from public, anon;
revoke all on function public.push_activity_webhook()             from public, anon, authenticated;

grant execute on function public.create_album(text, text, text)   to authenticated;
grant execute on function public.join_album_by_code(text, text)   to authenticated;
grant execute on function public.my_activity(integer)             to authenticated;
grant execute on function public.my_storage_paths()               to authenticated;
grant execute on function public.delete_own_account()             to authenticated;
