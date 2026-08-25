import { supabase } from '../lib/supabase';
import { APP_SCHEME, REDIRECT_URI } from '../config';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// ── Helpers ──────────────────────────────────────────────────────────────

function toAppUser(supaUser, profile) {
  if (!supaUser) return null;
  const meta = supaUser.user_metadata || {};
  
  return {
    id: supaUser.id,
    email: supaUser.email || '',
    // On prend le prénom depuis le profil, sinon depuis les metadatas Google, sinon on découpe le nom complet
    firstName: profile?.first_name ?? meta?.first_name ?? (meta?.full_name || '').split(' ')[0] ?? '',
    lastName: profile?.last_name ?? meta?.last_name ?? (meta?.full_name || '').split(' ').slice(1).join(' ') ?? '',
    // ON REGARDE ICI : D'abord le profil custom, SINON les metadatas Google ('picture' ou 'avatar_url')
    avatarUrl: profile?.avatar_url ?? meta?.avatar_url ?? meta?.picture ?? null,
    isAnonymous: supaUser.is_anonymous ?? false,
  };
}

// ── Initialisation Automatique (Anonyme ou Réel) ─────────────────────

export async function initializeAuth() {
  if (!supabase) return null;
  
  // 1. Essayer de restaurer une vraie session (Google/Email)
  let user = await restoreSession();
  
  // 2. Si personne n'est connecté, on crée le compte fantôme
  if (!user) {
    console.log('No session found, creating anonymous account...');
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (!error && data.user) {
      user = toAppUser(data.user, null);
    }
  }
  
  return user;
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

// ── SUPABASE ALBUMS : intégration ──
// Lier une identité Google au compte anonyme existant (linkIdentity).
// Comme pour l'email, le compte invité devient permanent en gardant le
// MÊME id utilisateur : albums/photos/likes déjà synchronisés sont
// conservés. Pré-requis dashboard : Authentication → « Allow manual
// linking » (désactivé par défaut).
export async function linkGoogleIdentity() {
  if (!supabase) throw new Error('Supabase non configuré');

  const isWeb = Platform.OS === 'web' || typeof window !== 'undefined';

  if (isWeb) {
    const webRedirectUrl = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: webRedirectUrl },
    });

    if (error) throw error;

    console.log('Redirecting to Google (link identity, Web):', data.url);
    window.location.replace(data.url);
    // La page va être remplacée par Google puis rechargée au retour
    return new Promise(() => {});
  }

  // ── Version Mobile/Native ──
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true },
  });

  if (error) throw error;

  console.log('Opening Google link URL (Mobile):', data.url);

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI, {
    showInRecents: false,
    preferEphemeralSession: false,
    createTask: true,
  });

  // La liaison peut être refusée côté serveur (ex : compte Google déjà
  // lié à un autre utilisateur) → l'erreur revient dans l'URL de retour.
  if (result.url) {
    const errDesc = result.url.match(/[?&#]error_description=([^&]+)/);
    if (errDesc) {
      throw new Error(
        decodeURIComponent(errDesc[1].replace(/\+/g, ' ')) || 'La liaison Google a échoué'
      );
    }
  }

  // Établir la session depuis l'URL de retour (code PKCE ou tokens)
  if (result.type === 'success' && result.url) {
    const codeMatch = result.url.match(/[?&#]code=([^&]+)/);
    const accessMatch = result.url.match(/[?&#]access_token=([^&]+)/);
    const refreshMatch = result.url.match(/[?&#]refresh_token=([^&]+)/);
    try {
      if (codeMatch) {
        await supabase.auth.exchangeCodeForSession(codeMatch[1]);
      } else if (accessMatch && refreshMatch) {
        await supabase.auth.setSession({
          access_token: decodeURIComponent(accessMatch[1]),
          refresh_token: decodeURIComponent(refreshMatch[1]),
        });
      }
    } catch (e) {
      console.log('⚠️ link session error:', e?.message || e);
    }
  }

  // Quel que soit le type de retour (Android peut dire "cancel" même en
  // cas de succès), on relit la session : is_anonymous doit être passé
  // à false pour confirmer la liaison.
  const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: null }));
  const user = refreshed?.user;

  if (user && user.is_anonymous === false) {
    return { success: true };
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Liaison Google annulée');
  }
  throw new Error("La liaison Google n'a pas abouti. Réessaie.");
}
// ── SUPABASE ALBUMS : fin ──

// ── SUPABASE ALBUMS : intégration ──
// Web : lit (puis retire) une erreur OAuth renvoyée dans l'URL — ex. une
// liaison Google refusée revient avec ?error=...&error_description=...
// Sans cela l'échec était SILENCIEUX : session invité restaurée, rien dit.
export function consumeOAuthErrorFromUrl() {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const description =
      searchParams.get('error_description') || hashParams.get('error_description');
    const code = searchParams.get('error_code') || hashParams.get('error_code');
    if (!description && !code) return null;
    // Nettoie l'URL pour ne pas ré-afficher l'erreur à chaque rechargement
    window.history.replaceState({}, document.title, window.location.pathname);
    return (description || code || '').replace(/\+/g, ' ');
  } catch {
    return null;
  }
}
// ── SUPABASE ALBUMS : fin ──

/**
 * Version Web - Redirige la page entière (standard pour le Web)
 */
export async function signInWithGoogleWeb() {
  if (!supabase) throw new Error('Supabase non configuré');

  try {
    // SUR LE WEB : On doit absolument utiliser une URL http/https valide.
    // On prend l'URL actuelle du navigateur (ex: http://localhost:8081)
    const webRedirectUrl = `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: webRedirectUrl,
      },
    });

    if (error) throw error;

    console.log('Redirecting to Google OAuth (Web):', data.url);

    // Au lieu de window.open (bloqué), on redirige l'onglet actuel
    window.location.replace(data.url);

    // La page va changer, on retourne une promesse en attente pour éviter 
    // que l'application ne crashe avant que la redirection ne se fasse
    return new Promise(() => {});

  } catch (error) {
    console.error('❌ Google OAuth error (Web):', error);
    throw error;
  }
}

/**
 * Version Mobile/Native - Utilise WebBrowser
 */
export async function signInWithGoogleMobile() {
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

    console.log('Opening Google OAuth URL (Mobile):', data.url);

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

    console.log('Google OAuth result type:', result.type);

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
    console.error(' Google OAuth error (Mobile):', error);
    throw error;
  }
}

/**
 * Version unifiée - Détecte automatiquement l'environnement
 */
export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase non configuré');

  // Détecter si on est sur Web ou Mobile
  const isWeb = Platform.OS === 'web' || typeof window !== 'undefined';

  if (isWeb) {
    return signInWithGoogleWeb();
  } else {
    return signInWithGoogleMobile();
  }
}

// ── Restauration de session ────────────────────────────────────────────

export async function restoreSession() {
  if (!supabase) return null;
  
  try {
    return new Promise((resolve) => {
      let resolved = false;
      
      // Fonction pour terminer la promesse proprement
      const finish = (user) => {
        if (resolved) return;
        resolved = true;
        resolve(user);
      };

      // 1. Vérifier immédiatement si une session existe déjà en cache
      supabase.auth.getSession().then(async ({ data }) => {
        if (data?.session) {
          const profile = await fetchProfile(data.session.user.id);
          finish(toAppUser(data.session.user, profile));
          return;
        }
      });

      // 2. Écouter les changements (C'est ici que le Web va capturer l'échange du code)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const profile = await fetchProfile(session.user.id);
          finish(toAppUser(session.user, profile));
        }
      });

      // 3. Sécurité : au bout de 2.5 secondes, si toujours rien, on abandonne
      setTimeout(() => {
        subscription.unsubscribe();
        finish(null);
      }, 2500);

    });
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
    console.log('Sign out error:', error);
  }
}

// ── Suppression du compte ─────────────────────────────────────────────
// Appelle la fonction SQL `delete_own_account` (voir supabase/schema.sql,
// section 4) : supprime le profil + le user auth du compte connecté,
// sans jamais exposer la clé service_role côté client.
export async function deleteAccount() {
  if (!supabase) throw new Error('Supabase non configuré');

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  // Nettoie la session locale après suppression
  try { await supabase.auth.signOut(); } catch {}
}

// ── SUPABASE ALBUMS : intégration ──
// Conversion d'un compte invité (anonyme) en compte permanent.
// auth.updateUser() conserve le MÊME id utilisateur : tous les albums,
// photos, likes et commentaires déjà synchronisés restent attachés —
// aucune donnée n'est perdue, contrairement à une nouvelle inscription.
export async function convertAnonymousUser(email, password, metadata = {}) {
  if (!supabase) throw new Error('Supabase non configuré');

  const { firstName, lastName } = metadata;

  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
    data: {
      first_name: firstName || '',
      last_name: lastName || '',
    },
  });

  if (error) throw error;
  if (!data?.user) throw new Error('Aucun utilisateur retourné');

  // Si « Confirm email » est activé côté projet, l'email n'est appliqué
  // qu'après clic sur le lien : tant que is_anonymous reste vrai ou que
  // l'email n'est pas encore celui demandé, on le signale à l'écran.
  const needsEmailConfirm =
    (data.user.is_anonymous ?? false) ||
    (data.user.email || '').toLowerCase() !== email.trim().toLowerCase();

  // Prénom/nom synchronisés dans le profil tout de suite
  if (firstName || lastName) {
    await syncProfile(data.user.id, { firstName, lastName });
  }

  const profile = await fetchProfile(data.user.id);

  return {
    user: toAppUser(data.user, profile),
    needsEmailConfirm,
  };
}
// ── SUPABASE ALBUMS : fin ──

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
    console.log('Profile sync error:', error);
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
  // ── SUPABASE ALBUMS : intégration ──
  // Inclut le cas de la conversion invité vers un email déjà pris
  if (msg.includes('already registered') || msg.includes('already in use')) {
    return 'Un compte existe déjà avec cet email. Connectez-vous plutôt avec cet email.';
  }
  // ── SUPABASE ALBUMS : fin ──
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
  // ── SUPABASE ALBUMS : intégration ──
  // Liaison Google refusée : ce Google appartient déjà à un autre compte
  if (msg.includes('already linked')) {
    return 'Ce compte Google est déjà lié à un autre compte SharePix. Utilisez « Se connecter » pour y accéder.';
  }
  if (msg.includes('manual linking')) {
    return "La liaison de compte n'est pas activée (Dashboard : Authentication → Allow manual linking).";
  }
  // ── SUPABASE ALBUMS : fin ──
  if (msg.includes('oauth') || msg.includes('google') || msg.includes('callback')) {
    return 'Erreur de connexion Google. Réessaie.';
  }
  if (msg.includes('cancelled') || msg.includes('cancel')) {
    return 'Connexion annulée.';
  }
  if (msg.includes('popup') || msg.includes('blocked')) {
    return 'La fenêtre de connexion a été bloquée. Autorisez les popups et réessayez.';
  }
  
  return error?.message || 'Une erreur est survenue. Réessaie.';
}