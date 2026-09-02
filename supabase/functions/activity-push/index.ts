// ── SUPABASE PUSH : Edge Function « activity-push » ─────────────────────
// Appelée par le Database Webhook « activity_log INSERT » (PUSH.md §3).
// À chaque événement journalisé, elle envoie une notification Expo Push à
// tous les membres de l'album — sauf l'auteur de l'action.
//
// Secrets : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont auto-injectés
// par la plateforme (jamais côté app). WEBHOOK_SECRET est posé via
// `supabase secrets set` et vérifié en header : sans lui, l'URL publique
// de la fonction permettrait à quiconque de spammer des notifications.
//
// Dépendance : `@supabase/supabase-js` est déclarée dans l'import map de
// `supabase/functions/deno.json` (specifier nu, conforme au lint Deno).
import { createClient } from '@supabase/supabase-js';

// Ligne journalisée « activity_log » telle qu'envoyée par le Database Webhook.
interface ActivityRecord {
  album_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  album_name?: string | null;
  kind?: string | null;
}

// Formes minimales des lignes lues (seuls les champs utilisés sont typés).
interface MemberRow {
  user_id: string;
}

interface TokenRow {
  token: string;
}

const TITLES: Record<string, string> = {
  member_joined: 'Nouveau membre',
  photo_added: 'Nouvelle photo',
  comment_added: 'Nouveau commentaire',
  photo_liked: "J'aime",
};

const BODIES: Record<string, (r: ActivityRecord) => string> = {
  member_joined: (r) => `${r.actor_name || 'Un membre'} a rejoint « ${r.album_name} »`,
  photo_added: (r) => `${r.actor_name || 'Un membre'} a ajouté une photo dans « ${r.album_name} »`,
  comment_added: (r) => `${r.actor_name || 'Un membre'} a commenté une photo dans « ${r.album_name} »`,
  photo_liked: (r) => `${r.actor_name || 'Un membre'} a aimé une photo dans « ${r.album_name} »`,
};

Deno.serve(async (req) => {
  // 0. Secret partagé avec le Database Webhook (anti-rejeu / anti-spam)
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  // 1. Payload du webhook : { type: 'INSERT', record: {…} }
  let record: ActivityRecord | undefined;
  try {
    const payload = (await req.json()) as { record?: ActivityRecord };
    record = payload.record;
  } catch {
    return new Response('bad json', { status: 400 });
  }
  if (!record?.album_id) return new Response('no record', { status: 400 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service_role : lecture cross-utilisateurs, serveur uniquement
  );

  // 2. Membres de l'album, sauf l'auteur de l'action (actor_id peut être nul)
  let q = admin
    .from('album_members')
    .select('user_id')
    .eq('album_id', record.album_id);
  if (record.actor_id) q = q.neq('user_id', record.actor_id);
  const { data: members, error: mErr } = await q;
  if (mErr) return new Response(JSON.stringify({ error: mErr.message }), { status: 500 });

  const userIds = ((members ?? []) as MemberRow[]).map((m) => m.user_id);
  if (!userIds.length) return new Response('no recipients');

  // 3. Leurs tokens Expo Push (tous appareils confondus)
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds);
  if (!tokens?.length) return new Response('no tokens');

  // 4. Messages Expo Push (l'API Expo relaie vers FCM/APNs — aucun secret
  //    FCM/APNs dans l'app, conformément à api.md §13.6)
  const kind = String(record.kind || '');
  const body = (BODIES[kind] || ((r: ActivityRecord) => `Nouvelle activité dans « ${r.album_name} »`))(record);
  const messages = ((tokens ?? []) as TokenRow[]).map((t) => ({
    to: t.token,
    sound: 'default',
    title: `${TITLES[kind] || 'SharePix'}`,
    body,
    data: { albumId: record.album_id },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  const expo = await res.json().catch(() => null);
  console.log('expo push →', res.status, JSON.stringify(expo));

  return new Response(JSON.stringify({ sent: messages.length, status: res.status }));
});
