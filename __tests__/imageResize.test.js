// Tests du calcul de taille avant envoi (P1-11).
// On ne teste que la logique pure : la manipulation native ne peut pas
// s'exécuter dans Node, et c'est justement `targetSize` qui porte la règle
// métier (jamais d'agrandissement, grand côté plafonné).

import { targetSize, isResizableImage, MAX_IMAGE_DIMENSION } from '../src/lib/imageResize';

describe('targetSize', () => {
  it('laisse intacte une image déjà sous la limite', () => {
    expect(targetSize(1200, 900)).toBeNull();
    expect(targetSize(MAX_IMAGE_DIMENSION, 800)).toBeNull();
  });

  it('réduit une photo de téléphone en paysage', () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 2048, height: 1536 });
  });

  it('réduit une photo en portrait sans déformer les proportions', () => {
    const out = targetSize(3024, 4032);
    expect(out.width).toBe(1536);
    expect(out.height).toBe(2048);
    // ratio conservé à l'arrondi près
    expect(out.width / out.height).toBeCloseTo(3024 / 4032, 2);
  });

  it('ne produit jamais une dimension nulle sur une image très allongée', () => {
    const out = targetSize(8000, 3);
    expect(out.width).toBe(2048);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it('ignore les dimensions invalides', () => {
    expect(targetSize(0, 0)).toBeNull();
    expect(targetSize(undefined, 3000)).toBeNull();
    expect(targetSize(-10, 5000)).toBeNull();
  });

  it('respecte une limite personnalisée', () => {
    expect(targetSize(1600, 1200, 800)).toEqual({ width: 800, height: 600 });
  });
});

describe('isResizableImage', () => {
  it('accepte les images photo', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
      expect(isResizableImage(mime)).toBe(true);
    }
  });

  it('refuse les vidéos et les GIF animés', () => {
    for (const mime of ['video/mp4', 'video/quicktime', 'image/gif', 'application/pdf', '', null]) {
      expect(isResizableImage(mime)).toBe(false);
    }
  });
});
