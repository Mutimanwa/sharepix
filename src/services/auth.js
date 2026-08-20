import { supabase } from '../lib/supabase';

// ── Helpers ──────────────────────────────────────────────────────────────

// Convertit l'utilisateur Supabase (+ ligne `profiles`) vers le format app
function toAppUser(supaUser, profile) {
  if (!supaUser) return null;
  const meta = supaUser.user_metadata || {};
  return {
    id: supaUser.id,
    email: supaUser.email || '',
    firstName: profile?.first_name ?? meta.first_name ?? '',
    lastName: profile?.last_name ?? meta.last_name ?? '',
  };
}

async function fetchProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null; // profil pas encore visible : non bloquant
    return data;
  } catch {
    return null;
  }
}

// ── API Auth ─────────────────────────────────────────────────────────────

// Inscription : prénom/nom envoyés dans les metadata, le trigger SQL
// `handle_new_user` crée la ligne `profiles` automatiquement.
export async function signUp({ email, password, firstName, lastName }) {
  if (!supabase) throw new Error('Supabase non configuré');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error) throw error;
  const profile = data.user ? await fetchProfile(data.user.id) : null;
  return {
    user: toAppUser(data.user, profile),
    // null si le projet impose la confirmation d'email (pas de session immédiate)
    needsEmailConfirm: !data.session,
  };
}

export async function signIn({ email, password }) {
  if (!supabase) throw new Error('Supabase non configuré');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = await fetchProfile(data.user.id);
  return { user: toAppUser(data.user, profile), session: data.session };
}

// Restaure la session persistée au démarrage (null si déconnecté)
export async function restoreSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  return toAppUser(session.user, profile);
}

export async function signOut() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {}
}

// Synchronisation douce du profil (prénom/nom) vers la table `profiles`
export async function syncProfile(userId, { firstName, lastName }) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('profiles').upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

// ── Messages d'erreur traduits ───────────────────────────────────────────

export function translateAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('non configuré')) return "Backend non configuré (clés manquantes).";
  if (msg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('user already registered')) return 'Un compte existe déjà avec cet email.';
  if (msg.includes('email not confirmed')) return 'Confirme ton email avant de te connecter.';
  if (msg.includes('password')) return 'Mot de passe trop court (6 caractères minimum).';
  if (msg.includes('unable to validate email') || msg.includes('invalid email'))
    return 'Adresse email invalide.';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('request failed'))
    return 'Problème réseau. Vérifie ta connexion internet.';
  return error?.message || 'Une erreur est survenue. Réessaie.';
}
