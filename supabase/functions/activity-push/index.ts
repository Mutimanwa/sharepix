// ── Supabase Edge Function: activity-push ────────────────────────────────
// Called by the activity_log INSERT trigger. It sends only the activity
// categories enabled on each recipient's profile.
import { createClient } from '@supabase/supabase-js';

interface ActivityRecord {
  id?: string;
  album_id: string;
  photo_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  album_name?: string | null;
  kind?: string | null;
}

type PushPreferenceColumn = 'push_members' | 'push_new_photos' | 'push_comments' | 'push_likes';

const PUSH_PREFERENCE_COLUMNS: Record<string, PushPreferenceColumn> = {
  member_joined: 'push_members',
  photo_added: 'push_new_photos',
  comment_added: 'push_comments',
  photo_liked: 'push_likes',
};

const PUSH_COPY: Record<string, { title: string; body: (actor: string, album: string) => string }> = {
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
};

function safeLabel(value: string | null | undefined, fallback: string, maxLength: number) {
  const normalized = String(value || fallback).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (normalized || fallback).slice(0, maxLength);
}

function buildPushNotification(record: ActivityRecord) {
  const template = record.kind ? PUSH_COPY[record.kind] : null;
  if (!template) return null;
  const actor = safeLabel(record.actor_name, 'Un membre', 48);
  const album = safeLabel(record.album_name, 'votre album', 56);
  return { title: template.title, body: template.body(actor, album) };
}

interface MemberRow {
  user_id: string;
}

interface PreferenceRow extends Record<PushPreferenceColumn, boolean> {
  id: string;
  push_enabled: boolean;
}

interface TokenRow {
  user_id: string;
  token: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ANDROID_CHANNEL_ID = 'sharepix-activity';
const MAX_MESSAGES_PER_REQUEST = 100;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // This function is public at the gateway (verify_jwt=false); fail closed
  // because only the database trigger should be able to invoke it.
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('WEBHOOK_SECRET missing; refusing webhook');
    return new Response('server misconfigured', { status: 500 });
  }
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('unauthorized', { status: 401 });
  }

  let record: ActivityRecord | undefined;
  try {
    const payload = await req.json() as { record?: ActivityRecord };
    record = payload.record;
  } catch {
    return new Response('bad json', { status: 400 });
  }
  if (!record?.album_id || !record.kind) return new Response('invalid activity', { status: 400 });

  const preferenceColumn = record.kind ? PUSH_PREFERENCE_COLUMNS[record.kind] : undefined;
  const notification = buildPushNotification(record);
  if (!preferenceColumn || !notification) {
    return jsonResponse({ sent: 0, reason: 'unsupported activity kind' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase service environment is incomplete');
    return new Response('server misconfigured', { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Find album members but never notify the person who caused the activity.
  let membersQuery = admin
    .from('album_members')
    .select('user_id')
    .eq('album_id', record.album_id);
  if (record.actor_id) membersQuery = membersQuery.neq('user_id', record.actor_id);
  const { data: members, error: membersError } = await membersQuery;
  if (membersError) {
    console.error('Could not load album members:', membersError.message);
    return new Response('recipient lookup failed', { status: 500 });
  }
  const memberIds = [...new Set(((members ?? []) as MemberRow[]).map((member) => member.user_id))];
  if (!memberIds.length) return jsonResponse({ sent: 0, reason: 'no recipients' });

  // Notification settings are account-scoped and enforced server-side, so a
  // disabled switch cannot be bypassed by another device or a stale token.
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select(`id,push_enabled,${preferenceColumn}`)
    .in('id', memberIds);
  if (profilesError) {
    console.error('Could not load notification preferences:', profilesError.message);
    return new Response('preferences lookup failed', { status: 500 });
  }
  const eligibleIds = ((profiles ?? []) as unknown as PreferenceRow[])
    .filter((profile) => profile.push_enabled && profile[preferenceColumn])
    .map((profile) => profile.id);
  if (!eligibleIds.length) return jsonResponse({ sent: 0, reason: 'notifications disabled' });

  const { data: tokenRows, error: tokensError } = await admin
    .from('push_tokens')
    .select('user_id,token')
    .in('user_id', eligibleIds);
  if (tokensError) {
    console.error('Could not load Expo tokens:', tokensError.message);
    return new Response('token lookup failed', { status: 500 });
  }
  const tokens = [...new Set(((tokenRows ?? []) as TokenRow[]).map((row) => row.token))];
  if (!tokens.length) return jsonResponse({ sent: 0, reason: 'no registered devices' });

  const messages = tokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.body,
    sound: 'default',
    priority: 'default',
    channelId: ANDROID_CHANNEL_ID,
    data: {
      albumId: record.album_id,
      activityId: record.id || null,
      photoId: record.photo_id || null,
      kind: record.kind,
    },
  }));

  let accepted = 0;
  let failed = 0;
  const expiredTokens = new Set<string>();

  for (let start = 0; start < messages.length; start += MAX_MESSAGES_PER_REQUEST) {
    const batch = messages.slice(start, start + MAX_MESSAGES_PER_REQUEST);
    let response: Response;
    try {
      response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    } catch (error) {
      console.error('Expo Push request failed:', error instanceof Error ? error.message : 'network error');
      return new Response('push provider unavailable', { status: 502 });
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      console.error('Expo Push rejected the batch:', response.status);
      return new Response('push provider rejected request', { status: 502 });
    }

    const tickets = Array.isArray(result.data) ? result.data : [];
    tickets.forEach((ticket: { status?: string; details?: { error?: string } }, index: number) => {
      if (ticket.status === 'ok') accepted += 1;
      else {
        failed += 1;
        if (ticket.details?.error === 'DeviceNotRegistered') {
          expiredTokens.add(batch[index].to);
        }
      }
    });
  }

  if (expiredTokens.size) {
    const { error } = await admin
      .from('push_tokens')
      .delete()
      .in('token', [...expiredTokens]);
    if (error) console.error('Could not clean expired push tokens:', error.message);
  }

  // Never log Expo tokens or message bodies.
  console.log(`activity-push: accepted=${accepted}, failed=${failed}, expired=${expiredTokens.size}`);
  return jsonResponse({ sent: accepted, failed, expired: expiredTokens.size });
});
