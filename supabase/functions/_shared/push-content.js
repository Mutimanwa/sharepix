// Reference implementation for compact, privacy-safe push copy; kept in sync with the Edge Function.
export const PUSH_PREFERENCE_COLUMNS = Object.freeze({
  member_joined: 'push_members',
  photo_added: 'push_new_photos',
  comment_added: 'push_comments',
  photo_liked: 'push_likes',
});

const copy = Object.freeze({
  member_joined: {
    title: 'Nouveau membre',
    body: (actor, album) => `${actor} a rejoint « ${album} »`,
  },
  photo_added: {
    title: 'Nouvelle photo',
    body: (actor, album) => `${actor} a ajouté une photo dans « ${album} »`,
  },
  comment_added: {
    title: 'Nouveau commentaire',
    body: (actor, album) => `${actor} a commenté une photo dans « ${album} »`,
  },
  photo_liked: {
    title: 'Nouvelle réaction',
    body: (actor, album) => `${actor} a aimé une photo dans « ${album} »`,
  },
});

function safeLabel(value, fallback, maxLength) {
  const normalized = String(value || fallback).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (normalized || fallback).slice(0, maxLength);
}

/** Create privacy-safe, compact copy for an OS push notification. */
export function buildPushNotification(record) {
  const template = copy[record?.kind];
  if (!template) return null;

  const actor = safeLabel(record.actor_name, 'Un membre', 48);
  const album = safeLabel(record.album_name, 'votre album', 56);
  return {
    title: template.title,
    body: template.body(actor, album),
  };
}
