// @ts-check
// ── P1-11 : redimensionnement des images avant envoi ────────────────────
//
// Pourquoi : les photos sorties d'un téléphone font 3000 à 4000 px de côté
// et pèsent 3 à 8 Mo. Le quota gratuit est de 1 Go et la connexion mobile
// n'est pas toujours rapide (Bujumbura : 3G/4G). Envoyer l'original coûte
// cher, lentement, pour un affichage qui ne dépasse jamais ~1200 px.
//
// Le redimensionnement se fait AVANT la lecture base64 : c'est là que se
// joue la mémoire. Lire un fichier de 8 Mo en base64 en crée un second de
// ~11 Mo en JS ; sur un appareil Android modeste, plusieurs envois en
// parallèle suffisent à faire tomber l'application.
//
// Garde-fous :
//  • les vidéos et GIF ne sont jamais touchés (perte d'animation / de son) ;
//  • le web n'est pas concerné (le chemin d'envoi y passe par des Blob) ;
//  • toute erreur renvoie `null` → on envoie l'original plutôt que d'échouer.

import { Image, Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// 2048 px sur le grand côté : au-delà, aucun détail n'est visible sur un
// téléphone, même en zoomant, et le gain de poids devient marginal.
export const MAX_IMAGE_DIMENSION = 2048;

// 0.82 : seuil où l'œil ne distingue plus la recompression JPEG.
export const JPEG_QUALITY = 0.82;

// En dessous de ce poids ET de cette dimension, recompresser ne gagne rien.
export const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;

const RESIZABLE_MIME = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

/** Vrai si le type MIME est une image qu'on sait (et qu'on veut) réduire. */
export function isResizableImage(mime) {
  return RESIZABLE_MIME.test(String(mime || ''));
}

/**
 * Calcule la taille cible sans jamais agrandir une image.
 * Fonction pure → couverte par les tests.
 * @returns {{width:number,height:number}|null} null si déjà sous la limite
 */
export function targetSize(width, height, maxDimension = MAX_IMAGE_DIMENSION) {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return null;
  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Dimensions d'une image locale, ou null si illisible. */
function getLocalImageSize(uri) {
  return new Promise((resolve) => {
    // L'API `Image.getSize` est callback ; on l'enveloppe pour pouvoir
    // l'attendre et ne jamais rester bloqué sur un fichier corrompu.
    const timer = setTimeout(() => resolve(null), 5000);
    try {
      Image.getSize(
        uri,
        (width, height) => {
          clearTimeout(timer);
          resolve({ width, height });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        }
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Produit une version allégée de l'image si c'est utile.
 *
 * @param {string} uri fichier local (file://)
 * @param {string} mime type MIME d'origine
 * @param {{ sizeBytes?: number, maxDimension?: number, quality?: number }} [options]
 * @returns {Promise<{ uri:string, mime:string, ext:string, width?:number, height?:number } | null>}
 *          null → envoyer l'original tel quel
 */
export async function resizeForUpload(uri, mime, options = {}) {
  // Le web n'utilise pas ce chemin, et le module natif n'y est pas toujours là.
  if (Platform.OS === 'web') return null;
  if (!uri || !isResizableImage(mime)) return null;
  if (!/^file:/i.test(uri)) return null;

  const maxDimension = options.maxDimension ?? MAX_IMAGE_DIMENSION;
  const quality = options.quality ?? JPEG_QUALITY;
  const sizeBytes = options.sizeBytes ?? 0;

  const isPng = /^image\/png$/i.test(mime);
  const size = await getLocalImageSize(uri);
  const target = size ? targetSize(size.width, size.height, maxDimension) : null;

  // Rien à gagner : petite image, déjà légère, et pas de conversion à faire.
  const alreadySmall = !target && sizeBytes > 0 && sizeBytes <= SKIP_BELOW_BYTES;
  if (alreadySmall) return null;
  // Une PNG peut être énorme en octets pour peu de pixels : on la garde en
  // PNG (transparence), mais seulement si elle dépasse la limite de poids.
  if (!target && isPng && sizeBytes <= SKIP_BELOW_BYTES) return null;

  try {
    const context = ImageManipulator.manipulate(uri);
    if (target) context.resize(target);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      compress: quality,
      format: isPng ? SaveFormat.PNG : SaveFormat.JPEG,
    });
    if (!saved?.uri) return null;
    return {
      uri: saved.uri,
      mime: isPng ? 'image/png' : 'image/jpeg',
      ext: isPng ? 'png' : 'jpg',
      width: saved.width,
      height: saved.height,
    };
  } catch {
    // Format exotique (HEIC sur certains Android, fichier tronqué…) :
    // l'original reste envoyable, on ne bloque pas l'utilisateur.
    return null;
  }
}
