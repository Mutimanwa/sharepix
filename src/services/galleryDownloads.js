import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { classifyPhotoUri } from '../lib/photoUri';
import { cloudPhotoUrl } from './albums';

export const SHAREPIX_GALLERY_ALBUM = 'SharePix';

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi', '3gp']);

function extensionFromPath(value) {
  const clean = String(value || '').split(/[?#]/)[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function cacheFilename(photo) {
  const source = photo.storagePath || photo.uri;
  const extension = extensionFromPath(source);
  const id = String(photo.id || 'photo').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'photo';
  return `SharePix-${id}-${Date.now()}.${extension}`;
}

/** Request read/write photo access because locating and reusing the SharePix album requires it. */
export async function requestSharePixGalleryPermission() {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (!permission.granted) {
    throw new Error('Autorisez l’accès aux photos pour enregistrer les fichiers dans l’album SharePix.');
  }
}

async function addAssetToSharePix(localUri) {
  const existingAlbum = await MediaLibrary.getAlbumAsync(SHAREPIX_GALLERY_ALBUM);
  if (existingAlbum) {
    return MediaLibrary.createAssetAsync(localUri, existingAlbum);
  }

  // Android ne permet pas de créer un album vide. Le premier asset sert à
  // créer Pictures/SharePix; le déplacer évite de garder une seconde copie.
  const asset = await MediaLibrary.createAssetAsync(localUri);
  try {
    await MediaLibrary.createAlbumAsync(SHAREPIX_GALLERY_ALBUM, asset, false);
  } catch (error) {
    // Tolère une création simultanée par une autre action de téléchargement.
    const albumAfterRace = await MediaLibrary.getAlbumAsync(SHAREPIX_GALLERY_ALBUM).catch(() => null);
    if (!albumAfterRace) throw error;
    await MediaLibrary.addAssetsToAlbumAsync(asset, albumAfterRace, false);
  }
  return asset;
}

/** Download or copy an image into the device's SharePix gallery album. */
export async function savePhotoToSharePix(photo, { permissionGranted = false, onProgress } = {}) {
  if (!photo) throw new Error('Aucune photo à enregistrer.');
  if (!permissionGranted) await requestSharePixGalleryPermission();

  const sourcePath = photo.storagePath || photo.uri;
  if (VIDEO_EXTENSIONS.has(extensionFromPath(sourcePath))) {
    throw new Error('Le téléchargement multiple des vidéos n’est pas encore disponible.');
  }

  const sourceUri = photo.storagePath ? await cloudPhotoUrl(photo.storagePath) : photo.uri;
  if (!sourceUri) throw new Error('La photo n’est plus disponible. Actualisez l’album puis réessayez.');

  const sourceType = classifyPhotoUri(sourceUri);
  const filename = cacheFilename({ ...photo, uri: sourceUri });
  let localUri = sourceUri;
  let temporaryUri = null;

  try {
    if (sourceType === 'remote') {
      const target = `${FileSystem.cacheDirectory}${filename}`;
      const task = FileSystem.createDownloadResumable(sourceUri, target, {}, (progress) => {
        const total = progress.totalBytesExpectedToWrite;
        const fraction = total > 0 ? progress.totalBytesWritten / total : null;
        onProgress?.(fraction === null ? null : Math.max(0, Math.min(1, fraction)));
      });
      const result = await task.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error(`Le serveur a refusé le téléchargement (${result?.status || 'inconnu'}).`);
      }
      localUri = result.uri;
      temporaryUri = result.uri;
    } else if (sourceType === 'content') {
      const target = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({ from: sourceUri, to: target });
      localUri = target;
      temporaryUri = target;
    } else if (sourceType === 'file') {
      const localFile = await FileSystem.getInfoAsync(sourceUri);
      if (!localFile.exists) throw new Error('Le fichier photo n’existe plus sur cet appareil.');
    } else {
      throw new Error('Format de photo non pris en charge pour l’enregistrement.');
    }

    onProgress?.(0.98);
    const asset = await addAssetToSharePix(localUri);
    onProgress?.(1);
    return asset;
  } finally {
    if (temporaryUri) {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => {});
    }
  }
}
