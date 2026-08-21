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
