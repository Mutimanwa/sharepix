jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return {
    getItem: jest.fn(async (key) => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => { values.set(key, value); }),
    removeItem: jest.fn(async (key) => { values.delete(key); }),
    __reset: () => values.clear(),
    __get: (key) => values.get(key),
  };
});

jest.mock('expo-file-system/legacy', () => {
  const files = new Map();
  return {
    documentDirectory: 'file:///documents/',
    makeDirectoryAsync: jest.fn(async () => {}),
    getInfoAsync: jest.fn(async (uri) => files.has(uri)
      ? { exists: true, isDirectory: false, size: files.get(uri).size }
      : { exists: false }),
    downloadAsync: jest.fn(async (_url, target) => {
      files.set(target, { size: 512 });
      return { uri: target, status: 200 };
    }),
    deleteAsync: jest.fn(async (uri) => { files.delete(uri); }),
    __reset: () => files.clear(),
  };
});

const AsyncStorage = require('@react-native-async-storage/async-storage');
const FileSystem = require('expo-file-system/legacy');
const {
  cachePhotosForOffline,
  clearOfflinePhotoCache,
  loadCachedAlbumPhotos,
  loadCachedRecentPhotos,
  saveRecentPhotoMetadata,
} = require('../src/services/offlinePhotos');

const recentPhoto = (id = 'photo-1', userAlbum = 'album-1') => ({
  id,
  albumId: userAlbum,
  albumName: 'Souvenirs',
  storagePath: `${userAlbum}/${id}.jpg`,
  uri: `https://storage.example/${id}.jpg?token=temporary-secret`,
  authorName: 'Ami',
  createdAt: Date.now(),
  fileSize: 512,
});

describe('cache privé des photos hors ligne', () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    FileSystem.__reset();
    jest.clearAllMocks();
  });

  it('conserve les dernières photos et leurs fichiers pour la prochaine ouverture hors ligne', async () => {
    const feed = await saveRecentPhotoMetadata('user-a', [recentPhoto()]);
    const onCached = jest.fn();
    await cachePhotosForOffline('user-a', feed, onCached);

    const cachedRecent = await loadCachedRecentPhotos('user-a');
    const cachedAlbum = await loadCachedAlbumPhotos('user-a', 'album-1');

    expect(cachedRecent).toHaveLength(1);
    expect(cachedRecent[0].uri).toMatch(/^file:\/\/\/documents\//);
    expect(cachedAlbum[0].localUri).toBe(cachedRecent[0].localUri);
    expect(onCached).toHaveBeenCalledWith(expect.objectContaining({ id: 'photo-1', localUri: cachedRecent[0].localUri }));

    const index = AsyncStorage.__get('sharepix.offline-photos.v1:user-a');
    expect(index).not.toContain('temporary-secret');
  });

  it('sépare strictement les caches par compte et efface le dossier à la déconnexion', async () => {
    const feed = await saveRecentPhotoMetadata('user-a', [recentPhoto()]);
    await cachePhotosForOffline('user-a', feed);

    expect(await loadCachedRecentPhotos('user-b')).toEqual([]);
    await clearOfflinePhotoCache('user-a');
    expect(await loadCachedRecentPhotos('user-a')).toEqual([]);
  });

  it('garde les métadonnées en mémoire locale même si le téléchargement échoue', async () => {
    const feed = await saveRecentPhotoMetadata('user-a', [recentPhoto()]);
    FileSystem.downloadAsync.mockRejectedValueOnce(new Error('offline'));

    await cachePhotosForOffline('user-a', feed);

    const cached = await loadCachedRecentPhotos('user-a');
    expect(cached).toHaveLength(1);
    expect(cached[0].uri).toBe('');
    expect(cached[0].albumName).toBe('Souvenirs');
  });
});
