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
    // ── Résumé pour l'écran d'accueil (SANS entrer dans l'album) ──
    // Remplis par cloudFetchMyAlbums ; resynchronisés par le store
    // (refreshAlbumPhotos / addPhoto / deletePhoto…).
    photoCount: 0, // nombre réel de photos
    coverUrl: '', // URL signée de la photo la plus récente (couverture)
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
  if (error) return { data: [], error };
  const albums = (data || []).map(mapCloudAlbum);
  // Compteurs + couvertures dès l'accueil : l'utilisateur voit le contenu
  // de chaque album SANS avoir à y entrer.
  await fillAlbumsSummary(albums);
  return { data: albums, error: null };
}

/**
 * Complète EN PLACE une liste d'albums cloud avec, pour chacun :
 *  - photoCount : nombre réel de photos
 *  - coverUrl   : URL signée (1 h) de la photo la plus récente
 * Coût fixe : 1 requête SQL + 1 requête de signature, quel que soit
 * le nombre d'albums (pas de requête par album).
 */
async function fillAlbumsSummary(albums) {
  const ids = albums.map((a) => a.id).filter(isCloudId);
  if (!ids.length) return;
  const { data: rows, error } = await supabase
    .from('photos')
    .select('album_id, storage_path, created_at')
    .in('album_id', ids)
    .order('created_at', { ascending: false }); // la 1re vue = la plus récente
  if (error) {
    console.log('📛 albums summary error:', error.message);
    return; // échec silencieux : l'accueil affiche juste les albums sans compteur
  }
  const counts = {};
  const covers = new Map(); // album_id -> storage_path de la photo la plus récente
  (rows || []).forEach((r) => {
    counts[r.album_id] = (counts[r.album_id] || 0) + 1;
    if (!covers.has(r.album_id)) covers.set(r.album_id, r.storage_path);
  });
  // Bucket privé : on signe EN LOT les chemins de couverture (1 requête)
  const signed = new Map();
  const paths = [...covers.values()].filter(Boolean);
  if (paths.length) {
    const { data: sData, error: sErr } = await supabase.storage
      .from('album-photos')
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (sErr) console.log('📛 signed covers error:', sErr.message);
    (sData || []).forEach((s) => {
      if (s?.path && s?.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }
  albums.forEach((a) => {
    a.photoCount = counts[a.id] || 0;
    a.coverUrl = signed.get(covers.get(a.id)) || '';
  });
}

/**
 * Résumé SEUL (sans re-fetcher les albums) : utilisé par le Realtime de
 * l'écran d'accueil pour rafraîchir compteurs + couvertures en direct.
 * → { data: [{ id, photoCount, coverUrl }] }
 */
export async function cloudFetchAlbumsSummary(albumIds) {
  const albums = (albumIds || []).filter(isCloudId).map((id) => ({ id }));
  if (!supabase || !albums.length) return { data: [], error: null };
  await fillAlbumsSummary(albums);
  return {
    data: albums.map((a) => ({ id: a.id, photoCount: a.photoCount, coverUrl: a.coverUrl })),
    error: null,
  };
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

// ── Bucket PRIVÉ (V2 sécurité) : les photos ne sont lisibles que via des
// URLs signées, créées ici APRÈS contrôle RLS (membre de l'album requis).
export const SIGNED_URL_TTL = 60 * 60; // 1 h — régénérées à chaque refresh

/** Normalise une ligne `photos` en objet photo de l'app. */
export function mapCloudPhoto(row, signedUrl = '') {
  return {
    id: row.id,
    uri: signedUrl, // URL signée (1 h), pas d'URL publique
    storagePath: row.storage_path,
    cloud: true,
    createdAt: new Date(row.created_at).getTime(),
    liked: false,
    likesCount: 0,
    favorite: false,
    comments: [],
  };
}

/** Signe l'URL d'UNE photo (appelé juste après un upload, store.addPhoto). */
export async function cloudPhotoUrl(storagePath) {
  if (!supabase || !storagePath) return '';
  const { data, error } = await supabase.storage
    .from('album-photos')
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error) console.log('📛 signed url error:', error.message);
  return data?.signedUrl || '';
}

/** Signe EN LOT les URLs des lignes photos (une seule requête Storage). */
async function withSignedUrls(rows) {
  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean);
  const signed = new Map();
  if (paths.length) {
    const { data, error } = await supabase.storage
      .from('album-photos')
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) console.log('📛 signed urls error:', error.message);
    (data || []).forEach((s) => {
      if (s?.path && s?.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }
  return (rows || []).map((r) => mapCloudPhoto(r, signed.get(r.storage_path) || ''));
}

/** Photos d'un album cloud, de la plus récente à la plus ancienne. */
export async function cloudFetchAlbumPhotos(albumId) {
  if (!supabase || !isCloudId(albumId)) return { data: [], error: null };
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error };
  // Bucket privé : les URLs signées sont renouvelées à chaque fetch
  return { data: await withSignedUrls(data || []), error: null };
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

/**
 * Realtime de l'écran d'accueil : UN abonnement global à la table photos.
 * La RLS Realtime ne laisse passer que les événements des albums dont on
 * est membre (pas de filtre serveur nécessaire). `onChange` est appelée à
 * chaque INSERT/DELETE (sur DELETE, payload.old ne contient que la PK :
 * on ne peut pas toujours y lire album_id — d'où un refresh global du
 * résumé côté store, débouncé).
 * Retourne la fonction de désabonnement.
 */
export function subscribePhotosSummary(onChange) {
  if (!supabase) return () => {};

  // Topic unique : voir subscribeAlbumChanges (supabase-js rendrait un
  // canal déjà souscrit sinon, et .on() après subscribe() lève une erreur).
  const topic = `photos-summary:${Math.random().toString(36).slice(2, 8)}`;

  const channel = supabase
    .channel(topic)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, onChange)
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
    id: row.id, // id du journal d'activité (nécessaire pour masquer)
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
 * du plus récent au plus ancien (RPC my_activity), moins les éléments
 * que j'ai masqués (« supprimés »).
 */
export async function cloudFetchActivity(limit = 50) {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase.rpc('my_activity', { p_limit: limit });
  return { data: (data || []).map(mapCloudActivity), error };
}

/** « Supprimer » une activité : la masque pour moi seulement. */
export async function cloudDismissActivity(activityId) {
  if (!supabase || !isCloudId(activityId)) return { error: null };
  const { error } = await supabase
    .from('activity_acks')
    .upsert({ activity_id: activityId });
  return { error };
}

/** Même chose en lot (sélection multiple). */
export async function cloudDismissActivities(activityIds) {
  if (!supabase || !activityIds?.length) return { error: null };
  const rows = activityIds.filter(isCloudId).map((id) => ({ activity_id: id }));
  if (!rows.length) return { error: null };
  const { error } = await supabase.from('activity_acks').upsert(rows);
  return { error };
}

/**
 * Realtime du centre d'activités : prévient dès qu'un événement est
 * journalisé dans activity_log (publication activée dans schema.sql §12).
 * Pas de filtre serveur possible (l'écran agrège plusieurs albums) :
 * la RLS Realtime limite déjà aux albums dont on est membre.
 * `onChange` doit debouncer puis re-fetcher (cloudFetchActivity).
 */
export function subscribeActivityChanges(onChange) {
  if (!supabase) return () => {};

  // Topic unique : voir subscribeAlbumChanges (supabase-js rendrait un
  // canal déjà souscrit sinon, et .on() après subscribe() lève une erreur).
  const topic = `activity:${Math.random().toString(36).slice(2, 8)}`;

  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
// ── SUPABASE ALBUMS : fin ──
