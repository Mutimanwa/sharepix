import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../config';
import * as Linking from 'expo-linking';

// Le client Supabase avec gestion du deep link
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Permet de traiter les URLs de callback
        flowType: 'pkce',
      },
    })
  : null;

// Initialiser le listener de deep links
if (supabase) {
  // Gérer les deep links entrants
  Linking.addEventListener('url', ({ url }) => {
    console.log('🔗 Deep link received in client:', url);
    // Le SDK Supabase traite automatiquement les tokens OAuth
  });
}

export function isSupabaseReady() {
  return isSupabaseConfigured && supabase !== null;
}

export function getSupabaseClient() {
  if (!isSupabaseReady()) {
    throw new Error('Supabase n\'est pas configuré');
  }
  return supabase;
}