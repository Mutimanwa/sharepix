-- Préférences push stockées par compte. Le master est opt-in; les catégories
-- sont présélectionnées pour que l'activation globale soit utile immédiatement.
alter table public.profiles
  add column if not exists push_enabled boolean not null default false,
  add column if not exists push_new_photos boolean not null default true,
  add column if not exists push_likes boolean not null default true,
  add column if not exists push_comments boolean not null default true,
  add column if not exists push_members boolean not null default true;

comment on column public.profiles.push_enabled is
  'Opt-in global aux notifications push SharePix.';
comment on column public.profiles.push_new_photos is
  'Préférence push pour les photos ajoutées.';
comment on column public.profiles.push_likes is
  'Préférence push pour les réactions J’aime.';
comment on column public.profiles.push_comments is
  'Préférence push pour les commentaires; le contenu du commentaire n’est jamais inclus dans la notification.';
comment on column public.profiles.push_members is
  'Préférence push pour les nouveaux membres d’un album.';
