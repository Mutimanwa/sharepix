import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../config';

// Client Supabase unique.
// NB : vaut `null` tant que les clés ne sont pas renseignées dans src/config.js
// -> tous les appels doivent passer par src/services/auth.js qui gère ce cas.
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // La session (tokens) est persistée dans AsyncStorage :
        // l'utilisateur reste connecté entre les lancements de l'app.
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // inutile en React Native
      },
    })
  : null;
