-- ════════════════════════════════════════════════════════════════════
-- SharePix · Supabase — Étape 1 : Auth & Profils
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- (le script est rejouable : tu peux le relancer sans erreur)
-- ════════════════════════════════════════════════════════════════════

-- 1. Table des profils ---------------------------------------------------
-- Un profil par utilisateur. `id` reprend l'id de auth.users.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Sécurité : Row Level Security ---------------------------------------
-- Chacun ne voit/modifie que SON profil.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3. Trigger : profil créé automatiquement à l'inscription ----------------
-- Récupère first_name / last_name envoyés dans les metadata du signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Suppression de compte par l'utilisateur (RPC) ---------------------------
-- Permet au client (clé anon) de supprimer SON propre compte,
-- sans jamais exposer la clé service_role dans l'app.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifie';
  end if;

  -- Donnees applicatives (les futurs albums/photos cascaderont ici)
  delete from public.profiles where id = auth.uid();
  -- Compte auth (definitif)
  delete from auth.users where id = auth.uid();
end;
$$;

-- Uniquement appelable par un utilisateur authentifie (anonyme inclus)
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;


-- ════════════════════════════════════════════════════════════════════
-- SharePix · Etape 2 : Albums, membres, codes d'invitation, photos
-- (rejouable : relance le script entier sans erreur)
-- Correspondance avec ton modele long-terme (model.md) :
--   albums         -> events       (l'album SharePix = l'evenement du MVP)
--   album_members  -> event_members
--   albums.code    -> invite_code
--   photos         -> media (version photos d'abord)
-- ════════════════════════════════════════════════════════════════════

-- 5.1 Table albums --------------------------------------------------------
create table if not exists public.albums (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade, -- proprietaire
  name         text not null check (char_length(trim(name)) between 1 and 80),
  code         text not null unique check (char_length(code) = 8), -- code d'invitation 8 caracteres
  creator_name text not null default '',
  created_at   timestamptz not null default now()
);

-- 5.2 Table album_members -------------------------------------------------
-- Relation plusieurs-a-plusieurs (jamais une liste d'ids dans une colonne).
create table if not exists public.album_members (
  album_id  uuid not null references public.albums(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

-- 5.3 Index (requetes principales + colonnes utilisees par la RLS)
create index if not exists album_members_user_idx  on public.album_members(user_id);
create index if not exists album_members_album_idx on public.album_members(album_id);

-- 5.4 Fonction utilitaire RLS ---------------------------------------------
-- Evite la recursion infinie des policies autoreferences sur album_members.
create or replace function public.is_album_member(p_album_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.album_members
    where album_id = p_album_id and user_id = auth.uid()
  );
$$;

-- 5.5 RLS albums ----------------------------------------------------------
alter table public.albums enable row level security;

-- Lecture : uniquement si on est membre de l'album.
-- => Le code seul ne donne PAS acces aux donnees : la recherche par code
--    passe par la RPC join_album_by_code (validation serveur).
drop policy if exists "albums_select_member" on public.albums;
create policy "albums_select_member"
  on public.albums for select
  using (public.is_album_member(id));

-- Pas de policy insert/update/delete : les ecritures passent par les RPC
-- create_album / join_album_by_code (security definer), comme decide
-- dans api.md (creation atomique : album + membre owner, tout ou rien).

-- 5.6 RLS album_members ---------------------------------------------------
alter table public.album_members enable row level security;

-- Lecture : ses propres lignes + celles des albums dont on est membre.
drop policy if exists "album_members_select" on public.album_members;
create policy "album_members_select"
  on public.album_members for select
  using (user_id = auth.uid() or public.is_album_member(album_id));

-- Quitter un album : on peut supprimer SA propre ligne (sauf le owner).
drop policy if exists "album_members_delete_self" on public.album_members;
create policy "album_members_delete_self"
  on public.album_members for delete
  using (user_id = auth.uid() and role = 'member');

-- 5.7 RPC create_album ----------------------------------------------------
-- Transaction atomique : cree l'album ET l'appartenance owner,
-- sinon rien n'est cree (jamais d'album sans proprietaire).
create or replace function public.create_album(p_name text, p_code text, p_creator_name text default '')
returns json
language plpgsql
security definer
set search_path = public
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
  -- Si le code existe deja : violation de la contrainte unique -> erreur
  -- (le client regenere un code et reessaie).

  insert into public.album_members (album_id, user_id, role)
  values (v_album.id, auth.uid(), 'owner');

  return row_to_json(v_album);
end;
$$;

revoke all on function public.create_album(text, text, text) from public;
grant execute on function public.create_album(text, text, text) to authenticated;

-- 5.8 RPC join_album_by_code ----------------------------------------------
-- Valide le code cote serveur puis cree l'appartenance : code -> membership,
-- sans lecture directe de la table par un non-membre.
create or replace function public.join_album_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
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

  -- Rejoindre deux fois n'est pas une erreur : on ignore le doublon.
  insert into public.album_members (album_id, user_id, role)
  values (v_album.id, auth.uid(), 'member')
  on conflict (album_id, user_id) do nothing;

  return row_to_json(v_album);
end;
$$;

revoke all on function public.join_album_by_code(text) from public;
grant execute on function public.join_album_by_code(text) to authenticated;

-- 5.9 Table photos (metadonnees) -----------------------------------------
-- Le fichier est dans le Storage ; la table porte les metadonnees.
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums(id) on delete cascade,
  uploader_id  uuid not null references auth.users(id) on delete cascade default auth.uid(),
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);

create index if not exists photos_album_idx on public.photos(album_id, created_at desc);

alter table public.photos enable row level security;

-- Lecture : membres de l'album uniquement.
drop policy if exists "photos_select_member" on public.photos;
create policy "photos_select_member"
  on public.photos for select
  using (public.is_album_member(album_id));

-- Envoi : membre de l'album, sous son propre id.
drop policy if exists "photos_insert_member" on public.photos;
create policy "photos_insert_member"
  on public.photos for insert
  with check (public.is_album_member(album_id) and uploader_id = auth.uid());

-- Suppression : l'auteur de la photo, ou le proprietaire de l'album
-- (ton RM-004 : proprietaire ou administrateur autorise).
drop policy if exists "photos_delete_owner" on public.photos;
create policy "photos_delete_owner"
  on public.photos for delete
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.albums a
      where a.id = photos.album_id and a.user_id = auth.uid()
    )
  );

-- 5.10 Bucket Storage 'album-photos' --------------------------------------
-- Le fichier et les metadonnees sont separes (Storage != base).
insert into storage.buckets (id, name, public)
values ('album-photos', 'album-photos', true)
on conflict (id) do nothing;

-- Lecture publique (l'app utilise getPublicUrl ; URLs longues et aleatoires).
-- V2 : passer le bucket en prive + URLs signees (ton doc "securite.md").
drop policy if exists "album_photos_public_read" on storage.objects;
create policy "album_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'album-photos');

-- Upload / suppression : uniquement authentifie (compte anonyme inclus).
drop policy if exists "album_photos_auth_insert" on storage.objects;
create policy "album_photos_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'album-photos');

drop policy if exists "album_photos_auth_delete" on storage.objects;
create policy "album_photos_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'album-photos');
