// ── SUPABASE PUSH : intégration ─────────────────────────────────────────
// Enregistrement des tokens Expo Push dans la table `push_tokens`
// (schema.sql §13). L'envoi est fait côté serveur par l'Edge Function
// `activity-push` branchée sur activity_log (voir supabase/PUSH.md §2-3).
//
// Limites assumées :
//  - Web : pas de push (la fonction renvoie null silencieusement) ;
//  - Expo Go : ne reçoit plus les push distants → dev build EAS requis
//    (eas build --profile development) ;
//  - Simulateur/émulateur : token souvent indisponible → test sur appareil.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Affichage quand l'app est OUVERTE (foreground) : bannière + son.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

/**
 * Demande la permission, récupère le token Expo Push et l'enregistre
 * dans push_tokens (PK user_id+token → upsert idempotent).
 * @returns le token, ou null si refusé/indisponible/web.
 */
export async function registerPushToken() {
  if (!supabase) return null;
  if (Platform.OS === 'web') return null; // pas de push sur web
  if (!Device.isDevice) {
    console.log('🔕 Push : simulateur/émulateur, token indisponible (teste sur appareil)');
    return null;
  }

  // 1. Permission (ne redemande que si jamais décidée)
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    console.log('🔕 Push : permission refusée');
    return null;
  }

  // 2. Canal Android (obligatoire pour afficher quoi que ce soit)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications SharePix',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // 3. Token Expo Push (nécessite extra.eas.projectId dans app.json)
  let token;
  try {
    ({ data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    }));
  } catch (e) {
    console.log('📛 Push : getExpoPushTokenAsync a échoué (dev build EAS requis ?)', e?.message || e);
    return null;
  }

  // 4. Enregistrement côté serveur (user_id rempli par défaut auth.uid())
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, platform: Platform.OS, updated_at: new Date().toISOString() });
  if (error) {
    console.log('📛 Push : enregistrement du token refusé', error.message);
    return null;
  }

  console.log('🔔 Push : token enregistré', token.slice(0, 24) + '…');
  return token;
}

/**
 * Retrait du token de CET appareil (quand l'utilisateur désactive les
 * notifications push dans le profil). Les autres appareils continuent.
 */
export async function unregisterPushToken() {
  if (!supabase || Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });
    await supabase.from('push_tokens').delete().eq('token', token);
    console.log('🔕 Push : token retiré pour cet appareil');
  } catch (e) {
    console.log('📛 Push : retrait du token impossible', e?.message || e);
  }
}
// ── SUPABASE PUSH : fin ──
