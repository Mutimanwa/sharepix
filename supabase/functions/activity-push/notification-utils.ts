export interface ActivityQueueEvent {
  id: number | string;
  kind: string;
  album_id: string;
  actor_id: string | null;
  actor_name: string | null;
  album_name: string | null;
  photo_id: string | null;
  event_created_at: string;
}

const BATCH_WINDOW_MS = 60_000;

export function groupActivityEvents(events: ActivityQueueEvent[]) {
  const streams = new Map<string, ActivityQueueEvent[]>();
  for (const event of events) {
    const key = `${event.kind}|${event.album_id}|${event.actor_id || ''}`;
    const stream = streams.get(key);
    if (stream) stream.push(event);
    else streams.set(key, [event]);
  }

  const groups: ActivityQueueEvent[][] = [];
  for (const stream of streams.values()) {
    const ordered = [...stream].sort(
      (left, right) => Date.parse(left.event_created_at) - Date.parse(right.event_created_at)
    );
    let group: ActivityQueueEvent[] = [];
    for (const event of ordered) {
      const lastEvent = group[group.length - 1];
      if (lastEvent && Date.parse(event.event_created_at) - Date.parse(lastEvent.event_created_at) <= BATCH_WINDOW_MS) {
        group.push(event);
      } else {
        if (group.length) groups.push(group);
        group = [event];
      }
    }
    if (group.length) groups.push(group);
  }
  return groups.sort((left, right) =>
    Date.parse(left[0].event_created_at) - Date.parse(right[0].event_created_at)
  );
}

function label(value: string | null | undefined, fallback: string, maxLength: number) {
  return String(value || fallback).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, maxLength);
}

export function buildActivityPushMessage(events: ActivityQueueEvent[]) {
  if (!events.length) return null;
  const first = events[0];
  const count = events.length;
  const actor = label(first.actor_name, 'Un membre', 48);
  const album = label(first.album_name, 'votre album', 56);
  let title: string;
  let body: string;

  switch (first.kind) {
    case 'photo_added':
      title = count > 1 ? 'Nouvelles photos' : 'Nouvelle photo';
      body = `${actor} a ajouté ${count} ${count > 1 ? 'photos' : 'photo'} à l’album « ${album} »`;
      break;
    case 'member_joined':
      title = count > 1 ? 'Nouveaux membres' : 'Nouveau membre';
      body = count > 1
        ? `${actor} et d’autres membres ont rejoint l’album « ${album} »`
        : `${actor} a rejoint votre album « ${album} »`;
      break;
    case 'comment_added':
      title = count > 1 ? 'Nouveaux commentaires' : 'Nouveau commentaire';
      body = count > 1
        ? `${actor} a ajouté ${count} commentaires dans « ${album} »`
        : `${actor} a commenté une photo dans « ${album} »`;
      break;
    case 'photo_liked':
      title = count > 1 ? 'Nouvelles réactions' : 'Nouvelle réaction';
      body = count > 1
        ? `${actor} a réagi à ${count} photos dans « ${album} »`
        : `${actor} a réagi à une photo dans « ${album} »`;
      break;
    default:
      return null;
  }

  return {
    title,
    body,
    data: {
      albumId: first.album_id,
      activityId: String(first.id),
      photoId: first.photo_id || null,
      kind: first.kind,
      count,
    },
  };
}

export function getLocalDateTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
  };
}

export function isQuietHour(date: Date, timeZone: string) {
  try {
    const { hour } = getLocalDateTime(date, timeZone);
    return hour >= 22 || hour < 8;
  } catch {
    return true;
  }
}

export function isOneYearAnniversary(createdAt: string, now: Date, timeZone: string) {
  try {
    const created = getLocalDateTime(new Date(createdAt), timeZone);
    const current = getLocalDateTime(now, timeZone);
    const matchingDay = created.month === current.month && created.day === current.day;
    const leapDayFallback = created.month === 2 && created.day === 29 && current.month === 2 && current.day === 28;
    return current.year - created.year === 1 && (matchingDay || leapDayFallback);
  } catch {
    return false;
  }
}
