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
export async function cloudJoinAlbum(code, memberName) {
  if (!supabase) return { data: null, error: new Error('Supabase non configuré') };
  const { data, error } = await supabase.rpc('join_album_by_code', {
    p_code: code,
    p_member_name: memberName || '',
  });
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
    likesCount: 0,
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

// ── Interactions (likes + commentaires) ──────────────────────────────

export function mapCloudComment(row) {
  return {
    id: row.id,
    author: row.author_name || 'Membre',
    authorId: row.author_id, // droit de suppression côté UI
    parentId: row.parent_id || null, // réponse ?
    text: row.content,
    createdAt: new Date(row.created_at).getTime(),
    replies: [],
    cloud: true,
  };
}

/**
 * Charge commentaires (arborescence) + likes (compteurs + les miens)
 * pour une liste de photos. Appelé par refreshAlbumPhotos.
 * → { comments: { [photoId]: Comment[] }, likes: Set, likeCounts: {}, error }
 */
export async function cloudFetchInteractions(photoIds) {
  const empty = { comments: {}, likes: new Set(), likeCounts: {}, error: null };
  if (!supabase || !photoIds?.length) return empty;

  const { data: cData, error: cErr } = await supabase
    .from('photo_comments')
    .select('*')
    .in('photo_id', photoIds)
    .order('created_at', { ascending: true });

  // ── Arborescence : racines (parent_id null) + réponses rattachées ──
  const comments = {};
  const byPhoto = {};
  (cData || []).forEach((r) => {
    (byPhoto[r.photo_id] = byPhoto[r.photo_id] || []).push(mapCloudComment(r));
  });
  Object.entries(byPhoto).forEach(([photoId, list]) => {
    const byId = {};
    list.forEach((c) => (byId[c.id] = c));
    const roots = [];
    list.forEach((c) => {
      if (c.parentId && byId[c.parentId]) byId[c.parentId].replies.push(c);
      else roots.push(c); // parent supprimé/inconnu → remonté au premier niveau
    });
    comments[photoId] = roots;
  });

  // ── Likes : compteurs (tous) + état "moi" ──
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id || '';
  const { data: lData } = await supabase
    .from('photo_likes')
    .select('photo_id, user_id')
    .in('photo_id', photoIds);

  const likes = new Set();
  const likeCounts = {};
  (lData || []).forEach((r) => {
    likeCounts[r.photo_id] = (likeCounts[r.photo_id] || 0) + 1;
    if (r.user_id === uid) likes.add(r.photo_id);
  });

  return { comments, likes, likeCounts, error: cErr };
}

/** Ajoute un commentaire (ou une réponse si parentId est fourni). */
export async function cloudAddComment(photoId, text, authorName, parentId = null) {
  if (!supabase || !isCloudId(photoId)) return { data: null, error: null };
  const row = { photo_id: photoId, content: text, author_name: authorName || '' };
  if (parentId && isCloudId(parentId)) row.parent_id = parentId;
  const { data, error } = await supabase
    .from('photo_comments')
    .insert(row)
    .select()
    .single();
  return { data, error };
}

/** Supprime un commentaire (et ses réponses en cascade). Policy : auteur ou owner. */
export async function cloudDeleteComment(commentId) {
  if (!supabase || !isCloudId(commentId)) return { error: null };
  const { error } = await supabase.from('photo_comments').delete().eq('id', commentId);
  return { error };
}

/** Pose ou retire le like de l'utilisateur courant (avec son prénom affiché). */
export async function cloudSetLike(photoId, liked, userName = '') {
  if (!supabase || !isCloudId(photoId)) return { error: null };
  if (liked) {
    // upsert : ré-exécution idempotente (pas de doublon possible, PK photo+user)
    const { error } = await supabase
      .from('photo_likes')
      .upsert({ photo_id: photoId, user_name: userName || '' });
    return { error };
  }
  const { error } = await supabase
    .from('photo_likes')
    .delete()
    .eq('photo_id', photoId);
  return { error };
}

// ── Realtime ─────────────────────────────────────────────────────────

/**
 * S'abonne aux changements d'un album (photos + commentaires + likes +
 * la ligne album elle-même pour renommage/suppression).
 * La fonction `onChange` est appelée à chaque événement (à toi de
 * debouncer / rafraîchir). Retourne la fonction de désabonnement.
 *
 * Note : photos/albums sont filtrés côté serveur ; comments/likes
 * n'ont pas de album_id → filtrage RLS côté Supabase (tu ne recevras
 * que les événements des albums dont tu es membre).
 */
export function subscribeAlbumChanges(albumId, onChange) {
  if (!supabase || !isCloudId(albumId)) return () => {};

  // Nom de canal UNIQUE par abonné : supabase-js peut rendre un canal déjà
  // souscrit si le nom est identique (écrans Album + Photo en même temps),
  // et ".on()" après "subscribe()" lève une erreur.
  const topic = `album:${albumId}:${Math.random().toString(36).slice(2, 8)}`;

  const channel = supabase
    .channel(topic)
    // Photos de CET album (filtre serveur possible : colonne album_id)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'photos', filter: `album_id=eq.${albumId}` },
      onChange
    )
    // Renommage / suppression de l'album lui-même
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'albums', filter: `id=eq.${albumId}` },
      onChange
    )
    // Commentaires + likes (filtrés par la RLS Realtime, pas de colonne album_id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_comments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_likes' }, onChange)
    // Membres de CET album (colonne album_id -> filtre serveur possible)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'album_members', filter: `album_id=eq.${albumId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Membres ──────────────────────────────────────────────────────────

/** Normalise une ligne album_members -> membre de l'app. */
export function mapCloudMember(row) {
  return {
    userId: row.user_id,
    name: row.member_name || 'Membre',
    role: row.role, // 'owner' | 'member'
    joinedAt: new Date(row.joined_at).getTime(),
    cloud: true,
  };
}

/** Membres réels d'un album (propriétaire en premier, puis ordre d'arrivée). */
export async function cloudFetchAlbumMembers(albumId) {
  if (!supabase || !isCloudId(albumId)) return { data: [], error: null };
  const { data, error } = await supabase
    .from('album_members')
    .select('*')
    .eq('album_id', albumId)
    .order('joined_at', { ascending: true });
  const members = (data || []).map(mapCloudMember);
  members.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.joinedAt - b.joinedAt));
  return { data: members, error };
}

/** Le propriétaire retire un membre (policy : role member + son album). */
export async function cloudRemoveMember(albumId, userId) {
  if (!supabase || !isCloudId(albumId)) return { error: null };
  const { error } = await supabase
    .from('album_members')
    .delete()
    .eq('album_id', albumId)
    .eq('user_id', userId);
  return { error };
}

// ── Centre d'activités ───────────────────────────────────────────────

export function mapCloudActivity(row) {
  return {
    // Clé composite : un même type peut se répéter sur une même photo
    id: `${row.kind}:${row.album_id}:${row.photo_id || ''}:${row.actor_name}:${row.created_at}`,
    kind: row.kind, // member_joined | photo_added | comment_added | photo_liked
    actor: row.actor_name || 'Un membre',
    albumName: row.album_name || '',
    albumId: row.album_id,
    photoId: row.photo_id,
    at: new Date(row.created_at).getTime(),
  };
}

/**
 * Flux d'activité : ce que les AUTRES membres ont fait sur mes albums,
 * du plus récent au plus ancien (RPC my_activity).
 */
export async function cloudFetchActivity(limit = 50) {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase.rpc('my_activity', { p_limit: limit });
  return { data: (data || []).map(mapCloudActivity), error };
}
// ── SUPABASE ALBUMS : fin ──
