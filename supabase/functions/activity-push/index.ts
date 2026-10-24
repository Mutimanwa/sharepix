// ── Supabase Edge Function: activity-push ────────────────────────────────
// Le worker accepte encore l'ancien webhook `record` pendant le déploiement,
// puis traite la file SQL pour grouper les événements et les notifications
// programmées (souvenirs / rappel unique d'album vide).
import { createClient } from '@supabase/supabase-js';

import {
  buildActivityPushMessage,
  groupActivityEvents,
  isOneYearAnniversary,
  isQuietHour,
  type ActivityQueueEvent,
} from './notification-utils.ts';

const PUSH_PREFERENCE_COLUMNS: Record<string, string> = {
  member_joined: 'push_members',
  photo_added: 'push_new_photos',
  comment_added: 'push_comments',
  photo_liked: 'push_likes',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ANDROID_CHANNEL_ID = 'sharepix-activity';
const MAX_MESSAGES_PER_REQUEST = 100;
const MAX_QUEUE_BATCH = 500;
const RETRY_SECONDS = 60;

interface ActivityRecord {
  id?: string;
  album_id: string;
  photo_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  album_name?: string | null;
  kind?: string | null;
}

interface MemberRow {
  user_id: string;
}

interface ProfileRow {
  id: string;
  push_enabled: boolean;
  push_new_photos?: boolean;
  push_likes?: boolean;
  push_comments?: boolean;
  push_members?: boolean;
  push_memories?: boolean;
  push_reminders?: boolean;
  timezone?: string;
}

interface TokenRow {
  user_id: string;
  token: string;
}

interface MemoryCandidate {
  kind: 'album_anniversary' | 'photo_anniversary';
  event_id: string;
  album_id: string;
  album_name: string;
  event_created_at: string;
  actor_name: string;
  user_id: string;
}

interface ReminderCandidate {
  album_id: string;
  album_name: string;
  owner_id: string;
  album_created_at: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'default';
  channelId: string;
  data: Record<string, unknown>;
}

interface ExpoSendResult {
  accepted: number;
  failed: number;
  expired: number;
  providerErrors: Record<string, number>;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service environment is incomplete');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizeProviderError(value: unknown) {
  return typeof value === 'string' && /^[A-Z][A-Za-z0-9]{0,63}$/.test(value) ? value : 'Unknown';
}

async function sendExpoMessages(admin: ReturnType<typeof makeAdminClient>, messages: ExpoMessage[]): Promise<ExpoSendResult> {
  let accepted = 0;
  let failed = 0;
  const providerErrors: Record<string, number> = {};
  const expiredTokens = new Set<string>();

  for (let start = 0; start < messages.length; start += MAX_MESSAGES_PER_REQUEST) {
    const batch = messages.slice(start, start + MAX_MESSAGES_PER_REQUEST);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    }).catch((error) => {
      throw new Error(`Expo Push network error: ${error instanceof Error ? error.message : 'unknown'}`);
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(`Expo Push rejected request (${response.status})`);

    const tickets = Array.isArray(result.data) ? result.data : [];
    tickets.forEach((ticket: { status?: string; details?: { error?: string } }, index: number) => {
      if (ticket.status === 'ok') accepted += 1;
      else {
        failed += 1;
        const code = sanitizeProviderError(ticket.details?.error);
        providerErrors[code] = (providerErrors[code] ?? 0) + 1;
        if (ticket.details?.error === 'DeviceNotRegistered' && batch[index]?.to) {
          expiredTokens.add(batch[index].to);
        }
      }
    });
  }

  if (expiredTokens.size) {
    const { error } = await admin.from('push_tokens').delete().in('token', [...expiredTokens]);
    if (error) console.error('Could not clean expired push tokens:', error.message);
  }
  return { accepted, failed, expired: expiredTokens.size, providerErrors };
}

async function findEligibleTokens(
  admin: ReturnType<typeof makeAdminClient>,
  userIds: string[],
  preferenceColumn: string,
) {
  if (!userIds.length) return [] as TokenRow[];
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select(`id,push_enabled,${preferenceColumn}`)
    .in('id', userIds);
  if (profileError) throw new Error(`Preference lookup failed: ${profileError.message}`);

  const eligibleIds = ((profiles ?? []) as unknown as ProfileRow[])
    .filter((profile) => profile.push_enabled && profile[preferenceColumn as keyof ProfileRow] === true)
    .map((profile) => profile.id);
  if (!eligibleIds.length) return [] as TokenRow[];

  const { data: tokenRows, error: tokenError } = await admin
    .from('push_tokens')
    .select('user_id,token')
    .in('user_id', eligibleIds);
  if (tokenError) throw new Error(`Token lookup failed: ${tokenError.message}`);
  return (tokenRows ?? []) as TokenRow[];
}

function activityMessagesForTokens(
  events: ActivityQueueEvent[],
  tokens: TokenRow[],
) {
  const notification = buildActivityPushMessage(events);
  if (!notification) return [] as ExpoMessage[];
  return [...new Map(tokens.map((row) => [row.token, row])).values()].map((row) => ({
    to: row.token,
    title: notification.title,
    body: notification.body,
    sound: 'default' as const,
    priority: 'default' as const,
    channelId: ANDROID_CHANNEL_ID,
    data: notification.data,
  }));
}

async function sendActivityGroup(
  admin: ReturnType<typeof makeAdminClient>,
  events: ActivityQueueEvent[],
) {
  if (!events.length) return { accepted: 0, failed: 0, expired: 0, providerErrors: {} } as ExpoSendResult;
  const first = events[0];
  const preferenceColumn = PUSH_PREFERENCE_COLUMNS[first.kind];
  if (!preferenceColumn) return { accepted: 0, failed: 0, expired: 0, providerErrors: {} } as ExpoSendResult;

  let memberQuery = admin.from('album_members').select('user_id').eq('album_id', first.album_id);
  if (first.actor_id) memberQuery = memberQuery.neq('user_id', first.actor_id);
  const { data: members, error: memberError } = await memberQuery;
  if (memberError) throw new Error(`Recipient lookup failed: ${memberError.message}`);
  const userIds = [...new Set(((members ?? []) as MemberRow[]).map((member) => member.user_id))];
  if (!userIds.length) return { accepted: 0, failed: 0, expired: 0, providerErrors: {} } as ExpoSendResult;

  const tokens = await findEligibleTokens(admin, userIds, preferenceColumn);
  const messages = activityMessagesForTokens(events, tokens);
  return sendExpoMessages(admin, messages);
}

async function dispatchActivityQueue(admin: ReturnType<typeof makeAdminClient>) {
  const { data, error } = await admin.rpc('claim_push_notification_queue', { p_limit: MAX_QUEUE_BATCH });
  if (error) throw new Error(`Queue claim failed: ${error.message}`);
  const events = (data ?? []) as ActivityQueueEvent[];
  if (!events.length) return { queued: 0, batches: 0, sent: 0, failed: 0, expired: 0 };

  const groups = groupActivityEvents(events);
  let accepted = 0;
  let failed = 0;
  let expired = 0;
  let completed = 0;
  let retried = 0;

  for (const group of groups) {
    const ids = group.map((event) => Number(event.id)).filter(Number.isFinite);
    try {
      const result = await sendActivityGroup(admin, group);
      accepted += result.accepted;
      failed += result.failed;
      expired += result.expired;
      const { error: finishError } = await admin.rpc('finish_push_notification_queue', {
        p_ids: ids,
        p_status: 'sent',
        p_error: result.failed ? 'provider_ticket_error' : null,
      });
      if (finishError) throw new Error(`Queue finish failed: ${finishError.message}`);
      completed += ids.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'worker_error';
      const { error: releaseError } = await admin.rpc('release_push_notification_queue', {
        p_ids: ids,
        p_delay_seconds: RETRY_SECONDS,
        p_error: message.slice(0, 250),
      });
      if (releaseError) console.error('Could not release queue batch:', releaseError.message);
      retried += ids.length;
      console.error('Activity push batch deferred:', message);
    }
  }

  return { queued: events.length, batches: groups.length, completed, retried, sent: accepted, failed, expired };
}

async function sendLegacyActivity(admin: ReturnType<typeof makeAdminClient>, record: ActivityRecord) {
  if (!record.album_id || !record.kind) return jsonResponse({ sent: 0, reason: 'invalid activity' }, 400);
  const event: ActivityQueueEvent = {
    id: record.id || 'legacy',
    kind: record.kind,
    album_id: record.album_id,
    actor_id: record.actor_id || null,
    actor_name: record.actor_name || '',
    album_name: record.album_name || '',
    photo_id: record.photo_id || null,
    event_created_at: new Date().toISOString(),
  };
  const result = await sendActivityGroup(admin, [event]);
  return jsonResponse({ sent: result.accepted, failed: result.failed, expired: result.expired, providerErrors: result.providerErrors });
}

function memoryEventKey(candidate: MemoryCandidate) {
  return candidate.kind === 'album_anniversary'
    ? `album-anniversary:${candidate.event_id}:1y`
    : `photo-anniversary:${candidate.event_id}:1y`;
}

interface DeliveryCandidate {
  user_id: string;
  event_key: string;
  category: 'memories' | 'reminders';
}

interface PlannedScheduledMessage {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  deliveryKeys: string[];
}

async function reserveDeliveryRows(
  admin: ReturnType<typeof makeAdminClient>,
  rows: DeliveryCandidate[],
) {
  if (!rows.length) return new Set<string>();
  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await admin
      .from('push_notification_delivery_log')
      .upsert(rows.slice(start, start + 500), {
        onConflict: 'user_id,event_key',
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`Delivery reservation failed: ${error.message}`);
  }

  const keys = new Set(rows.map((row) => row.event_key));
  const users = [...new Set(rows.map((row) => row.user_id))];
  const { data, error } = await admin
    .from('push_notification_delivery_log')
    .select('user_id,event_key,status')
    .in('user_id', users)
    .in('event_key', [...keys]);
  if (error) throw new Error(`Delivery log lookup failed: ${error.message}`);
  return new Set((data ?? [])
    .filter((row: { status: string }) => row.status === 'queued')
    .map((row: { user_id: string; event_key: string }) => `${row.user_id}|${row.event_key}`));
}

async function generateScheduledNotifications(admin: ReturnType<typeof makeAdminClient>) {
  const now = new Date();
  const memoryFrom = new Date(now.getTime() - 368 * 24 * 60 * 60 * 1000).toISOString();
  const memoryTo = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: memoryRows, error: memoryError }, { data: reminderRows, error: reminderError }] = await Promise.all([
    admin.rpc('notification_memory_candidates', { p_from: memoryFrom, p_to: memoryTo }),
    admin.rpc('due_empty_album_reminders'),
  ]);
  if (memoryError) throw new Error(`Memory lookup failed: ${memoryError.message}`);
  if (reminderError) throw new Error(`Reminder lookup failed: ${reminderError.message}`);

  const memories = (memoryRows ?? []) as MemoryCandidate[];
  const reminders = (reminderRows ?? []) as ReminderCandidate[];
  const userIds = [...new Set([
    ...memories.map((row) => row.user_id),
    ...reminders.map((row) => row.owner_id),
  ])];
  if (!userIds.length) return { candidates: 0, sent: 0, failed: 0, expired: 0 };

  const { data: profileRows, error: profileError } = await admin
    .from('profiles')
    .select('id,push_enabled,push_memories,push_reminders,timezone')
    .in('id', userIds);
  if (profileError) throw new Error(`Scheduled preference lookup failed: ${profileError.message}`);
  const profileById = new Map(((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));

  const allowedMemory = memories.filter((row) => {
    const profile = profileById.get(row.user_id);
    const timezone = profile?.timezone;
    return Boolean(profile?.push_enabled && profile.push_memories && timezone &&
      !isQuietHour(now, timezone) &&
      isOneYearAnniversary(row.event_created_at, now, timezone));
  });
  const allowedReminders = reminders.filter((row) => {
    const profile = profileById.get(row.owner_id);
    const timezone = profile?.timezone;
    return Boolean(profile?.push_enabled && profile.push_reminders && timezone &&
      !isQuietHour(now, timezone));
  });

  const eligibleUsers = [...new Set([
    ...allowedMemory.map((row) => row.user_id),
    ...allowedReminders.map((row) => row.owner_id),
  ])];
  if (!eligibleUsers.length) return { candidates: 0, sent: 0, failed: 0, expired: 0 };
  const { data: tokensData, error: tokensError } = await admin
    .from('push_tokens')
    .select('user_id,token')
    .in('user_id', eligibleUsers);
  if (tokensError) throw new Error(`Scheduled token lookup failed: ${tokensError.message}`);
  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokensData ?? []) as TokenRow[]) {
    const current = tokensByUser.get(row.user_id) ?? [];
    if (!current.includes(row.token)) current.push(row.token);
    tokensByUser.set(row.user_id, current);
  }

  const candidates: DeliveryCandidate[] = [];
  const memoryBuckets = new Map<string, { userId: string; albumId: string; albumName: string; events: MemoryCandidate[] }>();
  for (const row of allowedMemory) {
    if (!tokensByUser.get(row.user_id)?.length) continue;
    const key = `${row.user_id}|${row.album_id}`;
    const bucket = memoryBuckets.get(key) ?? {
      userId: row.user_id,
      albumId: row.album_id,
      albumName: row.album_name || 'votre album',
      events: [],
    };
    bucket.events.push(row);
    memoryBuckets.set(key, bucket);
    candidates.push({ user_id: row.user_id, event_key: memoryEventKey(row), category: 'memories' });
  }

  for (const row of allowedReminders) {
    if (!tokensByUser.get(row.owner_id)?.length) continue;
    candidates.push({
      user_id: row.owner_id,
      event_key: `empty-album-invite-reminder:${row.album_id}`,
      category: 'reminders',
    });
  }

  const queuedKeys = await reserveDeliveryRows(admin, candidates);
  const planned: PlannedScheduledMessage[] = [];
  for (const bucket of memoryBuckets.values()) {
    const dueEvents = bucket.events.filter((event) => queuedKeys.has(`${bucket.userId}|${memoryEventKey(event)}`));
    if (!dueEvents.length) continue;
    const albumMemory = dueEvents.some((event) => event.kind === 'album_anniversary');
    const photos = dueEvents.filter((event) => event.kind === 'photo_anniversary');
    const sentences: string[] = [];
    if (albumMemory) sentences.push(`Il y a un an, vous créiez l’album « ${bucket.albumName} ».`);
    if (photos.length) {
      const count = photos.length;
      const actor = photos[0].actor_name || 'Un membre';
      sentences.push(`Il y a un an, ${actor} ajoutait ${count} ${count === 1 ? 'photo' : 'photos'} dans « ${bucket.albumName} ».`);
    }
    planned.push({
      userId: bucket.userId,
      title: 'Un souvenir SharePix',
      body: sentences.join(' '),
      data: { kind: 'memory', albumId: bucket.albumId, count: photos.length },
      deliveryKeys: dueEvents.map(memoryEventKey),
    });
  }

  for (const row of allowedReminders) {
    const eventKey = `empty-album-invite-reminder:${row.album_id}`;
    if (!queuedKeys.has(`${row.owner_id}|${eventKey}`) || !tokensByUser.get(row.owner_id)?.length) continue;
    const hoursOld = Math.floor((now.getTime() - Date.parse(row.album_created_at)) / (60 * 60 * 1000));
    if (hoursOld < 24) continue;
    planned.push({
      userId: row.owner_id,
      title: 'Votre album attend ses premières photos',
      body: `L’album « ${row.album_name || 'Sans titre'} » est toujours vide. Invitez vos proches à y ajouter leurs photos.`,
      data: { kind: 'invite_reminder', albumId: row.album_id },
      deliveryKeys: [eventKey],
    });
  }

  const messages: ExpoMessage[] = [];
  for (const item of planned) {
    for (const token of tokensByUser.get(item.userId) ?? []) {
      messages.push({
        to: token,
        title: item.title,
        body: item.body,
        sound: 'default',
        priority: 'default',
        channelId: ANDROID_CHANNEL_ID,
        data: item.data,
      });
    }
  }
  if (!messages.length) return { candidates: candidates.length, sent: 0, failed: 0, expired: 0 };

  const result = await sendExpoMessages(admin, messages);
  const deliveredAt = new Date().toISOString();
  for (const item of planned) {
    const { error } = await admin
      .from('push_notification_delivery_log')
      .update({ status: 'sent', delivered_at: deliveredAt, last_error: null })
      .eq('user_id', item.userId)
      .in('event_key', item.deliveryKeys)
      .eq('status', 'queued');
    if (error) console.error('Could not update scheduled delivery state:', error.message);
  }
  return { candidates: candidates.length, sent: result.accepted, failed: result.failed, expired: result.expired };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('WEBHOOK_SECRET missing; refusing webhook');
    return new Response('server misconfigured', { status: 500 });
  }
  if (req.headers.get('x-webhook-secret') !== webhookSecret) return new Response('unauthorized', { status: 401 });

  let payload: { action?: string; record?: ActivityRecord };
  try {
    payload = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  let admin: ReturnType<typeof makeAdminClient>;
  try {
    admin = makeAdminClient();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Supabase service environment is incomplete');
    return new Response('server misconfigured', { status: 500 });
  }

  try {
    if (payload.action === 'dispatch') {
      const result = await dispatchActivityQueue(admin);
      console.log(`activity-push dispatch: ${JSON.stringify(result)}`);
      return jsonResponse(result);
    }
    if (payload.action === 'scheduled') {
      const result = await generateScheduledNotifications(admin);
      console.log(`activity-push scheduled: ${JSON.stringify(result)}`);
      return jsonResponse(result);
    }
    if (payload.record) return await sendLegacyActivity(admin, payload.record);
    return jsonResponse({ error: 'invalid action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'notification worker failed';
    console.error('activity-push worker failed:', message);
    return jsonResponse({ error: 'notification worker failed' }, 500);
  }
});
