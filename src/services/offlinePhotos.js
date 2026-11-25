import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const INDEX_PREFIX = 'sharepix.offline-photos.v1:';
const CACHE_FOLDER = 'sharepix-offline-photos/';
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const DOWNLOAD_CONCURRENCY = 2;
const indexQueues = new Map();
const cacheEpochs = new Map();

function cacheEpoch(userId) {
  return cacheEpochs.get(cacheKey(userId)) || 0;
}

function safePart(value) {
  return String(value || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'user';
}

function cacheKey(userId) {
  return `${INDEX_PREFIX}${safePart(userId)}`;
}

function userDirectory(userId) {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${CACHE_FOLDER}${safePart(userId)}/`;
}

function emptyIndex() {
  return { version: 1, recentPhotos: [], albums: {}, files: {} };
}

async function readIndex(userId) {
  if (!userId) return emptyIndex();
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== 1) return emptyIndex();
    return {
      ...emptyIndex(),
      ...parsed,
      recentPhotos: Array.isArray(parsed.recentPhotos) ? parsed.recentPhotos : [],
      albums: parsed.albums && typeof parsed.albums === 'object' ? parsed.albums : {},
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {},
    };
  } catch {
    return emptyIndex();
  }
}

function withIndex(userId, mutate) {
  if (!userId) return Promise.resolve(null);
  const key = cacheKey(userId);
  const previous = indexQueues.get(key) || Promise.resolve();
  const next = previous.then(async () => {
    const index = await readIndex(userId);
    const result = await mutate(index);
    await AsyncStorage.setItem(key, JSON.stringify(index));
    return result;
  });
  indexQueues.set(key, next.catch(() => {}));
  return next;
}

function photoRecord(photo, localUri = photo?.localUri || '') {
  return {
    id: photo?.id,
    albumId: photo?.albumId,
    albumName: photo?.albumName || '',
    storagePath: photo?.storagePath || '',
    localUri: localUri || '',
    authorName: photo?.authorName || '',
    originalName: photo?.originalName || '',
    fileSize: photo?.fileSize ?? null,
    width: photo?.width ?? null,
    height: photo?.height ?? null,
    mimeType: photo?.mimeType || '',
    capturedAt: photo?.capturedAt ?? null,
    createdAt: photo?.createdAt ?? null,
  };
}

async function fileExists(uri) {
  if (!uri || !/^file:/i.test(uri)) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !!info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

async function resolveLocalUri(index, photo) {
  if (await fileExists(photo?.localUri)) return photo.localUri;
  const entry = photo?.storagePath ? index.files[photo.storagePath] : null;
  if (entry?.localUri && await fileExists(entry.localUri)) return entry.localUri;
  return '';
}

async function hydrateList(index, photos) {
  const output = [];
  for (const photo of photos || []) {
    const localUri = await resolveLocalUri(index, photo);
    output.push({ ...photo, localUri, uri: localUri || photo.uri || '' });
  }
  return output;
}

export async function loadCachedRecentPhotos(userId) {
  if (!userId) return [];
  const index = await readIndex(userId);
  return hydrateList(index, index.recentPhotos);
}

export async function loadCachedAlbumPhotos(userId, albumId) {
  if (!userId || !albumId) return [];
  const index = await readIndex(userId);
  return hydrateList(index, index.albums[albumId] || []);
}

/** Attach valid app-private local image files to freshly fetched cloud records. */
export async function attachOfflinePhotoFiles(userId, photos) {
  if (!userId || !photos?.length) return photos || [];
  const index = await readIndex(userId);
  const result = [];
  for (const photo of photos) {
    const localUri = await resolveLocalUri(index, photo);
    result.push({ ...photo, localUri });
  }
  return result;
}

/** Persist recent-feed metadata without persisting expiring signed URLs. */
export async function saveRecentPhotoMetadata(userId, photos) {
  if (!userId) return photos || [];
  return withIndex(userId, async (index) => {
    const current = [];
    for (const photo of (photos || []).slice(0, 12)) {
      const localUri = await resolveLocalUri(index, photo);
      current.push({ ...photo, localUri, uri: localUri || photo.uri || '' });
    }
    index.recentPhotos = current.map((photo) => photoRecord(photo, photo.localUri));
    return current;
  });
}

/** Persist the last cloud snapshot of an album for offline opening. */
export async function saveAlbumPhotoMetadata(userId, albumId, photos) {
  if (!userId || !albumId) return photos || [];
  return withIndex(userId, async (index) => {
    const records = [];
    for (const photo of photos || []) {
      records.push({
        ...photoRecord(photo, await resolveLocalUri(index, photo)),
        liked: !!photo.liked,
        likesCount: Number(photo.likesCount) || 0,
        favorite: !!photo.favorite,
        comments: Array.isArray(photo.comments) ? photo.comments : [],
      });
    }
    index.albums[albumId] = records;
    return hydrateList(index, records);
  });
}

function imageExtension(photo) {
  const path = String(photo?.storagePath || photo?.originalName || '');
  const match = path.match(/\.([a-zA-Z0-9]{2,5})(?:[?#].*)?$/);
  const ext = (match?.[1] || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg';
}

function upsertById(list, photo, localUri) {
  const record = photoRecord(photo, localUri);
  const at = list.findIndex((item) => item.id === record.id);
  if (at >= 0) list[at] = { ...list[at], ...record };
  else list.push(record);
}

async function trimCache(index) {
  const entries = Object.entries(index.files);
  let total = entries.reduce((sum, [, entry]) => sum + (Number(entry.size) || 0), 0);
  if (total <= MAX_CACHE_BYTES) return;
  entries.sort((a, b) => (a[1].lastUsedAt || 0) - (b[1].lastUsedAt || 0));
  for (const [storagePath, entry] of entries) {
    if (total <= MAX_CACHE_BYTES) break;
    await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => {});
    total -= Number(entry.size) || 0;
    delete index.files[storagePath];
    index.recentPhotos = index.recentPhotos.map((photo) =>
      photo.storagePath === storagePath ? { ...photo, localUri: '' } : photo
    );
    Object.keys(index.albums).forEach((albumId) => {
      index.albums[albumId] = index.albums[albumId].map((photo) =>
        photo.storagePath === storagePath ? { ...photo, localUri: '' } : photo
      );
    });
  }
}

async function saveDownloadedFile(userId, photo, localUri, size) {
  return withIndex(userId, async (index) => {
    const storagePath = photo.storagePath || `photo:${photo.id}`;
    index.files[storagePath] = {
      photoId: photo.id,
      storagePath,
      localUri,
      size: Number(size) || 0,
      lastUsedAt: Date.now(),
    };
    const recentEntry = index.recentPhotos.find((item) => item.id === photo.id);
    if (recentEntry) recentEntry.localUri = localUri;
    if (photo.albumId) {
      const albumPhotos = index.albums[photo.albumId] || [];
      upsertById(albumPhotos, photo, localUri);
      index.albums[photo.albumId] = albumPhotos;
    }
    await trimCache(index);
    return index.files[storagePath]?.localUri || '';
  });
}

/** Download app-private copies in a small background pool; never block the UI. */
export async function cachePhotosForOffline(userId, photos, onCached) {
  if (!userId || !FileSystem.documentDirectory) return;
  const directory = userDirectory(userId);
  if (!directory) return;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});

  const epoch = cacheEpoch(userId);
  const pending = (photos || []).filter((photo) =>
    photo?.storagePath && /^https?:/i.test(photo.uri || '')
  );
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const photo = pending[cursor++];
      if (epoch !== cacheEpoch(userId)) return;
      const knownUri = await attachOfflinePhotoFiles(userId, [photo]).then((list) => list[0]?.localUri || '');
      if (knownUri) {
        if (epoch !== cacheEpoch(userId)) return;
        onCached?.({ id: photo.id, albumId: photo.albumId, storagePath: photo.storagePath, localUri: knownUri });
        continue;
      }
      const ext = imageExtension(photo);
      const target = `${directory}${safePart(photo.id)}.${ext}`;
      try {
        const result = await FileSystem.downloadAsync(photo.uri, target);
        if (!result || result.status < 200 || result.status >= 300) {
          await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
          continue;
        }
        const info = await FileSystem.getInfoAsync(result.uri);
        if (!info.exists || info.isDirectory) continue;
        if (epoch !== cacheEpoch(userId)) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
          return;
        }
        const localUri = await saveDownloadedFile(userId, photo, result.uri, info.size);
        if (localUri) onCached?.({ id: photo.id, albumId: photo.albumId, storagePath: photo.storagePath, localUri });
      } catch {
        // Offline, quota atteint ou URL signée expirée : le cache existant reste intact.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, pending.length) }, worker));
}

/** Drop this account's private offline copies on explicit sign-out. */
export async function clearOfflinePhotoCache(userId) {
  if (!userId) return;
  const key = cacheKey(userId);
  const directory = userDirectory(userId);
  cacheEpochs.set(key, cacheEpoch(userId) + 1);
  await (indexQueues.get(key) || Promise.resolve()).catch(() => {});
  await AsyncStorage.removeItem(key).catch(() => {});
  if (directory) await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
}
