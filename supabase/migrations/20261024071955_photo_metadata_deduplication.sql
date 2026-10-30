-- Métadonnées source pour l'aperçu et la détection de doublons possibles.
-- Les colonnes restent nullable pour préserver les lignes déjà enregistrées.
alter table public.photos
  add column if not exists original_name text,
  add column if not exists duplicate_key text,
  add column if not exists file_size bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists mime_type text,
  add column if not exists captured_at timestamptz;

-- Les noms d'origine ne peuvent pas être reconstruits pour les anciennes
-- lignes (les chemins de Storage ne contiennent qu'un timestamp), mais le
-- Storage conserve la taille et le MIME de ces objets.
update public.photos p
set file_size = case
      when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
      else p.file_size
    end,
    mime_type = coalesce(p.mime_type, o.metadata->>'mimetype')
from storage.objects o
where o.bucket_id = 'album-photos'
  and o.name = p.storage_path
  and (p.file_size is null or p.mime_type is null);

create index if not exists photos_album_duplicate_idx
  on public.photos (album_id, duplicate_key, file_size)
  where duplicate_key is not null;

create index if not exists photos_album_size_legacy_idx
  on public.photos (album_id, file_size)
  where original_name is null and file_size is not null;
