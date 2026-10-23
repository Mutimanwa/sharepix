jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  createDownloadResumable: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn(),
  getAlbumAsync: jest.fn(),
  createAssetAsync: jest.fn(),
  createAlbumAsync: jest.fn(),
  addAssetsToAlbumAsync: jest.fn(),
}));

jest.mock('../src/services/albums', () => ({
  cloudPhotoUrl: jest.fn(),
}));

const FileSystem = require('expo-file-system/legacy');
const MediaLibrary = require('expo-media-library/legacy');
const { cloudPhotoUrl } = require('../src/services/albums');
const {
  SHAREPIX_GALLERY_ALBUM,
  requestSharePixGalleryPermission,
  savePhotoToSharePix,
} = require('../src/services/galleryDownloads');

describe('enregistrement des photos dans l’album SharePix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MediaLibrary.createAssetAsync.mockResolvedValue({ id: 'asset-1' });
    MediaLibrary.createAlbumAsync.mockResolvedValue({ id: 'sharepix-album' });
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    FileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  it('demande l’autorisation lecture/écriture sur les photos', async () => {
    MediaLibrary.requestPermissionsAsync.mockResolvedValue({ granted: true });
    await requestSharePixGalleryPermission();
    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(false, ['photo']);
  });

  it('ajoute une photo à l’album SharePix déjà existant', async () => {
    const album = { id: 'sharepix-album' };
    MediaLibrary.getAlbumAsync.mockResolvedValue(album);

    await savePhotoToSharePix(
      { id: 'photo-1', uri: 'file:///photos/one.jpg' },
      { permissionGranted: true }
    );

    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///photos/one.jpg', album);
    expect(MediaLibrary.createAlbumAsync).not.toHaveBeenCalled();
  });

  it('crée le premier album SharePix avec le premier asset sans dupliquer celui-ci', async () => {
    MediaLibrary.getAlbumAsync.mockResolvedValue(null);
    const asset = { id: 'asset-1' };
    MediaLibrary.createAssetAsync.mockResolvedValue(asset);

    await savePhotoToSharePix(
      { id: 'photo-1', uri: 'file:///photos/one.jpg' },
      { permissionGranted: true }
    );

    expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith(SHAREPIX_GALLERY_ALBUM, asset, false);
  });

  it('télécharge un média distant en cache, rapporte sa progression puis nettoie le fichier temporaire', async () => {
    const album = { id: 'sharepix-album' };
    MediaLibrary.getAlbumAsync.mockResolvedValue(album);
    cloudPhotoUrl.mockResolvedValue('https://storage.example/photo.jpg');
    FileSystem.createDownloadResumable.mockImplementation((url, target, _options, onProgress) => {
      onProgress({ totalBytesExpectedToWrite: 100, totalBytesWritten: 50 });
      return {
        downloadAsync: async () => ({ uri: target, status: 200 }),
      };
    });
    const onProgress = jest.fn();

    await savePhotoToSharePix(
      { id: 'photo-2', storagePath: 'album/photo.jpg', uri: 'https://old.example/photo.jpg' },
      { permissionGranted: true, onProgress }
    );

    expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
      'https://storage.example/photo.jpg',
      expect.stringMatching(/^file:\/\/\/cache\/SharePix-photo-2-/),
      {},
      expect.any(Function)
    );
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(expect.stringContaining('file:///cache/'), album);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(expect.stringContaining('file:///cache/'), { idempotent: true });
  });

  it('refuse les vidéos pour laisser ce lot consacré aux images', async () => {
    await expect(
      savePhotoToSharePix(
        { id: 'video-1', uri: 'file:///videos/clip.mp4' },
        { permissionGranted: true }
      )
    ).rejects.toThrow('vidéos n’est pas encore disponible');
  });
});
