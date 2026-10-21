// Contrat du deep link OAuth : le schéma déclaré dans `app.json` doit être
// celui que le code utilise pour construire l'URL de retour. Une divergence
// ici casse silencieusement la connexion Google sur mobile (le navigateur
// revient vers un schéma que l'application n'enregistre pas).

const appJson = require('../app.json');
const { APP_SCHEME, REDIRECT_URI, isSupabaseConfigured } = require('../src/config');

describe('configuration du deep link', () => {
  it('le schéma de app.json correspond à APP_SCHEME', () => {
    expect(appJson.expo.scheme).toBe(APP_SCHEME);
  });

  it('REDIRECT_URI suit le format attendu par Supabase', () => {
    expect(REDIRECT_URI).toBe(`${APP_SCHEME}://auth/callback`);
  });

  it('le projet Supabase est configuré (sinon l’auth est muette)', () => {
    expect(isSupabaseConfigured).toBe(true);
  });
});
