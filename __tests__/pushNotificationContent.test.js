const {
  PUSH_PREFERENCE_COLUMNS,
  buildPushNotification,
} = require('../supabase/functions/_shared/push-content');

describe('contenu des notifications push SharePix', () => {
  it('associe chaque activité à sa préférence de compte', () => {
    expect(PUSH_PREFERENCE_COLUMNS).toEqual({
      member_joined: 'push_members',
      photo_added: 'push_new_photos',
      comment_added: 'push_comments',
      photo_liked: 'push_likes',
    });
  });

  it('formate des messages courts et localisés sans divulguer le contenu d’un commentaire', () => {
    expect(buildPushNotification({
      kind: 'comment_added',
      actor_name: 'Amina',
      album_name: 'Vacances',
      comment: 'ne doit jamais apparaître',
    })).toEqual({
      title: 'Nouveau commentaire',
      body: 'Amina a commenté une photo dans « Vacances »',
    });
  });

  it('couvre les types photo, réaction et nouveau membre', () => {
    expect(buildPushNotification({ kind: 'photo_added', actor_name: 'Amina', album_name: 'Famille' }).title)
      .toBe('Nouvelle photo');
    expect(buildPushNotification({ kind: 'photo_liked', actor_name: 'Amina', album_name: 'Famille' }).title)
      .toBe('Nouvelle réaction');
    expect(buildPushNotification({ kind: 'member_joined', actor_name: 'Amina', album_name: 'Famille' }).body)
      .toBe('Amina a rejoint « Famille »');
  });

  it('utilise des valeurs de repli, nettoie les retours à la ligne et limite les libellés', () => {
    expect(buildPushNotification({ kind: 'photo_added', actor_name: '\n', album_name: '  ' })).toEqual({
      title: 'Nouvelle photo',
      body: 'Un membre a ajouté une photo dans « votre album »',
    });

    const long = buildPushNotification({ kind: 'member_joined', actor_name: 'A'.repeat(100), album_name: 'B'.repeat(100) });
    expect(long.body.length).toBeLessThan(130);
  });

  it('n’envoie pas de copie générique pour un type d’activité inconnu', () => {
    expect(buildPushNotification({ kind: 'unknown' })).toBeNull();
  });
});
