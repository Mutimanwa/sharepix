const { sanitizeSentryData } = require('../src/lib/sentrySanitization');

describe('sanitisation des événements Sentry', () => {
  it('masque les callbacks OAuth SharePix dans les champs imbriqués', () => {
    const result = sanitizeSentryData({
      request: { url: 'sharepix://auth/callback?code=one-time-code' },
      breadcrumbs: [{ data: { url: 'sharepix://auth/callback#access_token=secret' } }],
    });

    expect(result.request.url).toMatch(/masquée/);
    expect(result.breadcrumbs[0].data.url).toMatch(/masquée/);
    expect(JSON.stringify(result)).not.toContain('one-time-code');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('masque les jetons en paramètres de requête ou de fragment, y compris encodés', () => {
    const result = sanitizeSentryData({
      query: 'https://sharepix.app/auth/callback?access_token=access-secret',
      fragment: 'https://sharepix.app/auth/callback#refresh_token=refresh-secret',
      encoded: 'https://sharepix.app/auth/callback%3Fcode%3Dencoded-secret',
    });

    expect(JSON.stringify(result)).not.toContain('access-secret');
    expect(JSON.stringify(result)).not.toContain('refresh-secret');
    expect(JSON.stringify(result)).not.toContain('encoded-secret');
  });

  it('masque les champs sensibles même s’ils ne sont pas intégrés à une URL', () => {
    const result = sanitizeSentryData({
      context: { access_token: 'secret', password: 'password-secret', code: 'oauth-code' },
    });

    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('password-secret');
    expect(JSON.stringify(result)).not.toContain('oauth-code');
  });

  it('conserve les URL ordinaires et les données non sensibles', () => {
    const result = sanitizeSentryData({
      url: 'https://sharepix.app/privacy',
      albumName: 'Vacances en famille',
    });

    expect(result.url).toBe('https://sharepix.app/privacy');
    expect(result.albumName).toBe('Vacances en famille');
  });
});
