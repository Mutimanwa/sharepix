import {
  buildActivityPushMessage,
  groupActivityEvents,
  isOneYearAnniversary,
  isQuietHour,
  type ActivityQueueEvent,
} from './notification-utils.ts';

function event(id: number, createdAt: string, kind = 'photo_added'): ActivityQueueEvent {
  return {
    id,
    kind,
    album_id: 'album-1',
    actor_id: 'user-1',
    actor_name: 'Amina',
    album_name: 'Vacances',
    photo_id: `photo-${id}`,
    event_created_at: createdAt,
  };
}

Deno.test('regroupe les photos du même membre et album dans une fenêtre de 60 secondes', () => {
  const groups = groupActivityEvents([
    event(3, '2026-10-23T10:00:40.000Z'),
    event(1, '2026-10-23T10:00:00.000Z'),
    event(2, '2026-10-23T10:00:20.000Z'),
  ]);
  if (groups.length !== 1 || groups[0].length !== 3) throw new Error('Les événements n’ont pas été regroupés');
  const message = buildActivityPushMessage(groups[0]);
  if (message?.body !== 'Amina a ajouté 3 photos à l’album « Vacances »') {
    throw new Error(`Texte inattendu : ${message?.body}`);
  }
});

Deno.test('sépare les lots au-delà de 60 secondes et entre albums ou membres', () => {
  const groups = groupActivityEvents([
    event(1, '2026-10-23T10:00:00.000Z'),
    event(2, '2026-10-23T10:01:01.000Z'),
    { ...event(3, '2026-10-23T10:01:02.000Z'), actor_id: 'user-2' },
    { ...event(4, '2026-10-23T10:01:03.000Z'), album_id: 'album-2' },
  ]);
  if (groups.length !== 4) throw new Error(`Quatre lots attendus, ${groups.length} obtenus`);
});

Deno.test('applique la plage silencieuse au fuseau local', () => {
  const atSeven = new Date('2026-10-24T05:00:00.000Z'); // 07:00 à Bujumbura
  const atEight = new Date('2026-10-24T06:00:00.000Z'); // 08:00 à Bujumbura
  const atTwentyTwo = new Date('2026-10-24T20:00:00.000Z'); // 22:00 à Bujumbura
  if (!isQuietHour(atSeven, 'Africa/Bujumbura')) throw new Error('07:00 doit être silencieux');
  if (isQuietHour(atEight, 'Africa/Bujumbura')) throw new Error('08:00 doit être autorisé');
  if (!isQuietHour(atTwentyTwo, 'Africa/Bujumbura')) throw new Error('22:00 doit être silencieux');
  if (!isQuietHour(atEight, 'fuseau-invalide')) throw new Error('Un fuseau inconnu doit bloquer les push programmés');
});

Deno.test('détecte le jour anniversaire local, même en traversant UTC', () => {
  const createdAt = '2025-03-09T07:30:00.000Z';
  const anniversary = new Date('2026-03-09T07:30:00.000Z');
  if (!isOneYearAnniversary(createdAt, anniversary, 'Africa/Bujumbura')) {
    throw new Error('L’anniversaire local à Bujumbura doit correspondre');
  }
  if (isOneYearAnniversary(createdAt, anniversary, 'America/Los_Angeles')) {
    throw new Error('Le changement d’heure décale la date locale à Los Angeles');
  }
});

Deno.test('conserve le regroupement quand un autre membre intervient entre deux photos', () => {
  const groups = groupActivityEvents([
    event(1, '2026-10-23T10:00:00.000Z'),
    { ...event(2, '2026-10-23T10:00:10.000Z'), actor_id: 'user-2' },
    event(3, '2026-10-23T10:00:20.000Z'),
  ]);
  const sameActorBatch = groups.find((group) => group[0].actor_id === 'user-1');
  if (sameActorBatch?.length !== 2) throw new Error('Les photos de user-1 auraient dû rester regroupées');
});
