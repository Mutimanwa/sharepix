// ── Configuration Supabase ──────────────────────────────────────────────

export const SUPABASE_URL = 'https://bpillwvvxqiduxtkftuh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwaWxsd3Z2eHFpZHV4dGtmdHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMTg3ODAsImV4cCI6MjEwMjc5NDc4MH0.Z0FgpDdI3ltOv80X7YCgC71Qzo50fWFCyJ7kNkjzdPo'; // clé "anon" / "public"


// Le schéma de l'application (doit correspondre à app.json)
export const APP_SCHEME = 'sharepix';

// URL de redirection pour le callback OAuth
// Format: [scheme]://[path]
export const REDIRECT_URI = `${APP_SCHEME}://auth/callback`;

export const REDIRECT_URI_WEB = 'http://localhost:8081/auth/callback';

// Tant que ces clés sont vides, l'app fonctionne en mode 100% local
// (offline-first) : l'écran d'auth est ignoré et tout reste sur l'appareil.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
