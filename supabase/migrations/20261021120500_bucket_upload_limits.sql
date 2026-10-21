-- ═══════════════════════════════════════════════════════════════════════
-- SharePix — limites d'abus sur le bucket `album-photos`
--
-- CONSTAT (audit P1-04)
-- --------------------
--   file_size_limit      = null   → aucune limite de taille
--   allowed_mime_types   = null   → n'importe quel type de fichier
--   external_anonymous_users_enabled = true
--   rate_limit_anonymous_users       = 30 / heure / IP
--
-- Un compte anonyme (créé sans friction à la première ouverture) pouvait donc
-- créer un album et y déposer des fichiers de taille arbitraire, sans plafond
-- ni côté serveur ni côté client (store.js ne limitait rien non plus).
--
-- CORRECTIF
-- ---------
-- 25 Mo par fichier et une liste blanche de types image/vidéo. Les formats
-- HEIC/HEIF sont inclus car les iPhone les produisent nativement.
--
-- Le plafond client correspondant est appliqué dans src/store.js
-- (MAX_UPLOAD_BYTES) : on refuse AVANT de lire le fichier en mémoire.
-- ═══════════════════════════════════════════════════════════════════════

update storage.buckets
set file_size_limit = 26214400, -- 25 Mo
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif'
    ]
where id = 'album-photos';
