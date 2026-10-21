-- ═══════════════════════════════════════════════════════════════════════
-- SharePix — correctif de la policy DELETE sur storage.objects
--
-- CONSTAT (audit P0-01, vérifié en production le 21/10/2026)
-- ---------------------------------------------------------------
-- La policy `album_photos_auth_delete` interrogeait :
--
--     storage.foldername(a.name)
--
-- où `a` est l'alias de la table `public.albums`. Autrement dit elle lisait
-- le TITRE DE L'ALBUM au lieu du CHEMIN DU FICHIER.
--
-- Vérifié en base :
--     select storage.foldername('Vacances Corse');        -- {}
--     select (storage.foldername('Vacances Corse'))[1];   -- NULL
--
-- Donc `a.id = NULL` → EXISTS faux → la branche CASE valait toujours false.
-- Seule la condition `owner = auth.uid()` pouvait être vraie : le propriétaire
-- d'un album ne pouvait PAS supprimer les fichiers envoyés par les autres
-- membres, alors que c'est précisément le cas d'usage prévu.
--
-- Le client supprimait quand même la ligne SQL (la policy `photos_delete`
-- l'autorise), d'où des fichiers orphelins dans le bucket.
--
-- CORRECTIF
-- ---------
-- 1. Fonction `is_album_owner(uuid)` en SECURITY DEFINER (même schéma que
--    `is_album_member`) pour éviter toute sensibilité à la RLS de `albums`.
-- 2. Policy réécrite avec un CASE qui protège le cast ::uuid (aucune erreur
--    possible sur un chemin non-UUID : la branche ELSE renvoie false).
--
-- Idempotent : peut être rejoué sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.is_album_owner(p_album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.albums a
    where a.id = p_album_id
      and a.user_id = auth.uid()
  );
$$;

comment on function public.is_album_owner(uuid) is
  'Vrai si l''utilisateur courant est le propriétaire de l''album. SECURITY DEFINER pour rester insensible à la RLS de public.albums.';

drop policy if exists "album_photos_auth_delete" on storage.objects;
drop policy if exists "album_photos_delete" on storage.objects;

create policy "album_photos_delete"
  on storage.objects
  for delete
  to authenticated
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
