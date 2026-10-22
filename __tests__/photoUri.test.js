const { classifyPhotoUri } = require('../src/lib/photoUri');

describe('classifyPhotoUri', () => {
  it('only classifies HTTP(S) URLs as requiring a download', () => {
    expect(classifyPhotoUri('https://cdn.example.com/photo.jpg')).toBe('remote');
    expect(classifyPhotoUri('http://cdn.example.com/photo.jpg')).toBe('remote');
  });

  it('keeps existing file URIs local instead of sending them to downloadAsync', () => {
    expect(classifyPhotoUri('file:///data/user/0/sharepix/cache/photo.jpg')).toBe('file');
  });

  it('classifies Android content URIs for copying into cache', () => {
    expect(classifyPhotoUri('content://media/external/images/123')).toBe('content');
  });

  it('rejects empty and unsupported schemes', () => {
    expect(classifyPhotoUri('')).toBe('unsupported');
    expect(classifyPhotoUri('ftp://example.com/photo.jpg')).toBe('unsupported');
  });
});
