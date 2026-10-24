jest.mock('../src/lib/supabase', () => ({ supabase: null }));

const { mapCloudPhoto, photoDuplicateKey } = require('../src/services/albums');

describe('métadonnées des photos partagées', () => {
  it('normalise les noms pour détecter le même fichier sans tenir compte du chemin ou de la casse', () => {
    expect(photoDuplicateKey('DCIM\\Camera\\IMG_0042.JPG')).toBe('img_0042.jpg');
    expect(photoDuplicateKey(' Vacances été.jpg ')).toBe('vacances été.jpg');
  });

  it('garde l’URL signée et expose les métadonnées utiles du fil récent', () => {
    const photo = mapCloudPhoto({
      id: 'photo-1',
      album_id: 'album-1',
      albums: { name: 'Vacances' },
      storage_path: 'album-1/file.jpg',
      author_name: 'Aline',
      original_name: 'IMG_0042 (copie).jpg',
      file_size: 2048,
      width: 1200,
      height: 800,
      mime_type: 'image/jpeg',
      captured_at: '2026-10-20T10:00:00.000Z',
      created_at: '2026-10-24T10:00:00.000Z',
    }, 'https://signed.example/photo.jpg');

    expect(photo).toMatchObject({
      uri: 'https://signed.example/photo.jpg',
      albumId: 'album-1',
      albumName: 'Vacances',
      authorName: 'Aline',
      originalName: 'IMG_0042 (copie).jpg',
      fileSize: 2048,
      width: 1200,
      height: 800,
      mimeType: 'image/jpeg',
    });
    expect(photo.capturedAt).toBe(new Date('2026-10-20T10:00:00.000Z').getTime());
  });

  it('reste compatible avec les photos créées avant l’ajout des métadonnées', () => {
    const photo = mapCloudPhoto({
      id: 'old-photo',
      album_id: 'album-1',
      storage_path: 'album-1/123.jpg',
      created_at: '2026-10-20T10:00:00.000Z',
    });
    expect(photo.originalName).toBe('');
    expect(photo.fileSize).toBeNull();
    expect(photo.width).toBeNull();
  });
});
