const {
  describeError,
  isNetworkFailure,
  isPermissionDenied,
  isStorageObjectHidden,
} = require('../supabase/rls-check-utils.cjs');

describe('diagnostic des erreurs RLS/Auth de Supabase', () => {
  it('reconnaît une erreur PostgreSQL de permission comme un refus d’accès', () => {
    const error = { code: '42501', status: 403, message: 'permission denied for table albums' };
    expect(isPermissionDenied(error)).toBe(true);
    expect(isNetworkFailure(error)).toBe(false);
  });

  it('ne traite pas une clé API invalide comme une preuve de protection RLS', () => {
    const error = { code: 'PGRST301', status: 401, message: 'Invalid API key' };
    expect(isPermissionDenied(error)).toBe(false);
    expect(isNetworkFailure(error)).toBe(false);
  });

  it('reconnaît et décrit les erreurs réseau', () => {
    const error = { name: 'TypeError', message: 'fetch failed' };
    expect(isNetworkFailure(error)).toBe(true);
    expect(describeError(error)).toContain('fetch failed');
  });

  it('reconnaît le NoSuchKey HTTP 400 de Storage comme un refus masqué pour le non-membre', () => {
    expect(isStorageObjectHidden({ status: 400, code: 'NoSuchKey', message: 'Object not found' })).toBe(true);
    expect(isStorageObjectHidden({ status: 400, code: 'PayloadTooLarge', message: 'Object not found' })).toBe(false);
    expect(isStorageObjectHidden({ status: 404, code: 'NoSuchKey', message: 'Object not found' })).toBe(false);
  });

  it('laisse une erreur vide non concluante plutôt que de l’appeler refus RLS', () => {
    const error = { name: 'AuthApiError', message: '' };
    expect(isPermissionDenied(error)).toBe(false);
    expect(isNetworkFailure(error)).toBe(false);
    expect(describeError(error)).toContain('message et code absents');
  });
});
