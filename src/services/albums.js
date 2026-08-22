// ── SUPABASE ALBUMS : intégration ─────────────────────────────────────
// Repository cloud des albums (étape 2).
// Règle d'architecture (api.md) : les écrans / le store n'écrivent jamais
// de requêtes Supabase directement — tout passe par ces fonctions.
// Tout est "safe offline" : si Supabase n'est pas configuré ou que le
// réseau lâche, les fonctions renvoient { data: null, error } et le store
// bascule en mode 100 % local.

import { supabase } from '../lib/supabase';

/** Normalise une ligne Supabase `albums` en objet album de l'app. */
export function mapCloudAlbum(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    ownerId: row.user_id, // propriétaire (droits de gestion)
    photos: [], // chargées à l'entrée dans l'album
    createdAt: new Date(row.created_at).getTime(),
    members: row.creator_name ? [{ name: row.creator_name, role: 'admin' }] : [],
    cloud: true,
  };
}

/**
 * Création cloud : RPC `create_album` (atomique : album + membre owner).
 * En cas de collision sur le code (rare), le store regénère et réessaie.
 */
export async function cloudCreateAlbum({ name, code, creatorName }) {
  if (!supabase) return { data: null, error: new Error('Supabase non configuré') };
  const { data, error } = await supabase.rpc('create_album', {
    p_name: name,
    p_code: code,
    p_creator_name: creatorName || '',
  });
  return { data, error };
}

/** Vrai si l'erreur est une collision de code (contrainte unique). */
export function isCodeCollision(error) {
  return error && (error.code === '23505' || /duplicate key/i.test(error.message || ''));
}

/**
 * Rejoindre par code : RPC `join_album_by_code`.
 * Le code est validé côté serveur ; l'appartenance est créée (ou ignorée
 * si déjà membre). Erreur 'CODE_INCONNU' si le code n'existe pas.
 */
export async function cloudJoinAlbum(code) {
  if (!supabase) return { data: null, error: new Error('Supabase non configuré') };
  const { data, error } = await supabase.rpc('join_album_by_code', { p_code: code });
  if (error && String(error.message || '').includes('CODE_INCONNU')) {
    return { data: null, error: Object.assign(error, { isUnknownCode: true }) };
  }
  return { data, error };
}

/**
 * Restauration multi-appareils : tous les albums dont l'utilisateur
 * connecté est membre (owner ou invité), du plus récent au plus ancien.
 * La RLS filtre automatiquement — aucune condition côté client.
 */
export async function cloudFetchMyAlbums() {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: (data || []).map(mapCloudAlbum), error };
}

// ── Gestion de l'album (owner / membre) ──────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un id non-UUID = album purement local (hors-ligne), pas d'appel cloud. */
export function isCloudId(id) {
  return UUID_RE.test(String(id || ''));
}

/** Renommer un album (policy : propriétaire uniquement). */
export async function cloudRenameAlbum(albumId, name) {
  if (!supabase || !isCloudId(albumId)) return { error: null };
  const { error } = await supabase
    .from('albums')
    .update({ name: name.trim() })
    .eq('id', albumId);
  return { error };
}

/**
 * Supprimer un album cloud :
 * 1. supprime les fichiers du Storage (bucket album-photos/<albumId>/)
 * 2. supprime la ligne albums → cascade sur album_members + photos
 * (policy : propriétaire uniquement)
 */
export async function cloudDeleteAlbum(albumId) {
  if (!supabase || !isCloudId(albumId)) return { error: null };
  const { data: rows } = await supabase
    .from('photos')
    .select('storage_path')
    .eq('album_id', albumId);
  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from('album-photos').remove(paths);
  }
  const { error } = await supabase.from('albums').delete().eq('id', albumId);
  return { error };
}

/** Quitter un album rejoint (supprime sa ligne album_members). */
export async function cloudLeaveAlbum(albumId) {
  if (!supabase || !isCloudId(albumId)) return { error: null };
  const { error } = await supabase
    .from('album_members')
    .delete()
    .eq('album_id', albumId);
  return { error };
}

// ── Photos cloud ─────────────────────────────────────────────────────

/** Normalise une ligne `photos` en objet photo de l'app. */
export function mapCloudPhoto(row) {
  const { data: url } = supabase.storage
    .from('album-photos')
    .getPublicUrl(row.storage_path);
  return {
    id: row.id,
    uri: url?.publicUrl || '',
    storagePath: row.storage_path,
    cloud: true,
    createdAt: new Date(row.created_at).getTime(),
    liked: false,
    favorite: false,
    comments: [],
  };
}

/** Photos d'un album cloud, de la plus récente à la plus ancienne. */
export async function cloudFetchAlbumPhotos(albumId) {
  if (!supabase || !isCloudId(albumId)) return { data: [], error: null };
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false });
  return { data: (data || []).map(mapCloudPhoto), error };
}

/** Supprime une photo : fichier Storage + ligne (policy : auteur ou owner). */
export async function cloudDeletePhoto(photo) {
  if (!supabase || !photo?.cloud) return { error: null };
  if (photo.storagePath) {
    await supabase.storage.from('album-photos').remove([photo.storagePath]);
  }
  const { error } = await supabase.from('photos').delete().eq('id', photo.id);
  return { error };
}
// ── SUPABASE ALBUMS : fin ──
