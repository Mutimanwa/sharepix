const {
  describeError,
  isNetworkFailure,
  isPermissionDenied,
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

  it('laisse une erreur vide non concluante plutôt que de l’appeler refus RLS', () => {
    const error = { name: 'AuthApiError', message: '' };
    expect(isPermissionDenied(error)).toBe(false);
    expect(isNetworkFailure(error)).toBe(false);
    expect(describeError(error)).toContain('message et code absents');
  });
});
