import { supabase } from '../lib/supabase';
import { APP_SCHEME, REDIRECT_URI } from '../config';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// ── Helpers ──────────────────────────────────────────────────────────────

function toAppUser(supaUser, profile) {
  if (!supaUser) return null;
  const meta = supaUser.user_metadata || {};
  return {
    id: supaUser.id,
    email: supaUser.email || '',
    firstName: profile?.first_name ?? meta?.first_name ?? '',
    lastName: profile?.last_name ?? meta?.last_name ?? '',
    avatarUrl: profile?.avatar_url ?? null,
  };
}

async function fetchProfile(userId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Email/Password Auth ─────────────────────────────────────────────────

export async function signUpWithEmail(email, password, metadata = {}) {
  if (!supabase) throw new Error('Supabase non configuré');
  
  const { firstName, lastName } = metadata;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName || '',
        last_name: lastName || '',
      },
    },
  });

  if (error) throw error;

  if (!data.session) {
    return {
      user: null,
      needsEmailConfirm: true,
    };
  }

  const profile = await fetchProfile(data.user.id);
  
  return {
    user: toAppUser(data.user, profile),
    needsEmailConfirm: false,
    session: data.session,
  };
}

export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error('Supabase non configuré');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  const profile = await fetchProfile(data.user.id);
  
  return {
    user: toAppUser(data.user, profile),
    session: data.session,
  };
}

// ── Google OAuth ────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase non configuré');

  try {
    // 1. Démarrer l'authentification OAuth avec Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: REDIRECT_URI,
        skipBrowserRedirect: false,
      },
    });

    if (error) throw error;

    console.log('🔐 Opening Google OAuth URL:', data.url);

    // 2. Ouvrir le navigateur pour l'authentification
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      REDIRECT_URI,
      {
        showInRecents: false,
        preferEphemeralSession: false,
        createTask: true,
      }
    );

    console.log('🔐 Google OAuth result type:', result.type);

    // 3. Gérer le retour
    if (result.type === 'success') {
      return {
        success: true,
        url: result.url,
      };
    } else if (result.type === 'cancel') {
      throw new Error('Connexion Google annulée');
    } else if (result.type === 'dismiss') {
      throw new Error('Connexion Google fermée');
    } else {
      throw new Error('Erreur lors de la connexion Google');
    }
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    throw error;
  }
}

// ── Restauration de session ────────────────────────────────────────────

export async function restoreSession() {
  if (!supabase) return null;
  
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    
    if (!session?.user) return null;
    
    const profile = await fetchProfile(session.user.id);
    return toAppUser(session.user, profile);
  } catch (error) {
    console.log('❌ Session restore error:', error);
    return null;
  }
}

// ── Déconnexion ─────────────────────────────────────────────────────────

export async function signOut() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.log('❌ Sign out error:', error);
  }
}

// ── Mise à jour du profil ──────────────────────────────────────────────

export async function syncProfile(userId, { firstName, lastName }) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('profiles').upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log('❌ Profile sync error:', error);
  }
}

// ── Traduction des erreurs ─────────────────────────────────────────────

export function translateAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  
  if (msg.includes('non configuré')) {
    return "Backend non configuré (clés manquantes).";
  }
  if (msg.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (msg.includes('user already registered')) {
    return 'Un compte existe déjà avec cet email.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirme ton email avant de te connecter.';
  }
  if (msg.includes('password')) {
    return 'Mot de passe trop court (6 caractères minimum).';
  }
  if (msg.includes('invalid email')) {
    return 'Adresse email invalide.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Problème réseau. Vérifie ta connexion internet.';
  }
  if (msg.includes('oauth') || msg.includes('google') || msg.includes('callback')) {
    return 'Erreur de connexion Google. Réessaie.';
  }
  if (msg.includes('cancelled') || msg.includes('cancel')) {
    return 'Connexion annulée.';
  }
  
  return error?.message || 'Une erreur est survenue. Réessaie.';
}