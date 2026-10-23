// ── Push notifications SharePix ────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

export const PUSH_CHANNEL_ID = 'sharepix-activity';
const CACHED_TOKEN_KEY = 'sharepix.pushToken.v1';
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: 'Activités SharePix',
    description: 'Photos, commentaires, réactions et nouveaux membres de vos albums',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 100, 180],
    lightColor: '#2BA3A8',
    sound: 'default',
  });
}

/**
 * Demande la permission, crée le canal Android et enregistre le jeton Expo
 * sur le compte connecté. Retourne le jeton ou null si l’activation échoue.
 */
export async function registerPushToken({ requestPermission = true } = {}) {
  if (!supabase || Platform.OS === 'web' || !Device.isDevice || !PROJECT_ID) return null;

  try {
    // Android 13+ doit avoir un canal avant l'affichage de la demande système.
    await ensureAndroidChannel();

    let permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted' && requestPermission && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (permissions.status !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    if (!token) return null;

    const previousToken = await AsyncStorage.getItem(CACHED_TOKEN_KEY);
    if (previousToken && previousToken !== token) {
      const { error: removeOldError } = await supabase
        .from('push_tokens')
        .delete()
        .eq('token', previousToken);
      if (removeOldError) throw removeOldError;
    }

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { token, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );
    if (error) throw error;

    await AsyncStorage.setItem(CACHED_TOKEN_KEY, token);
    return token;
  } catch (error) {
    console.warn('Push registration failed:', error?.message || 'unknown error');
    return null;
  }
}

/** Remove only this installation’s token for the currently authenticated user. */
export async function unregisterPushToken() {
  if (!supabase || Platform.OS === 'web' || !Device.isDevice) return true;

  try {
    let token = await AsyncStorage.getItem(CACHED_TOKEN_KEY);
    if (!token && PROJECT_ID) {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== 'granted') return true;
      const response = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
      token = response.data;
    }
    if (!token) return true;

    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) throw error;
    await AsyncStorage.removeItem(CACHED_TOKEN_KEY);
    return true;
  } catch (error) {
    console.warn('Push token removal failed:', error?.message || 'unknown error');
    return false;
  }
}
