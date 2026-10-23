// @ts-check
// ── Sentry : rapport de crash, facultatif ───────────────────────────────
// Sans `EXPO_PUBLIC_SENTRY_DSN`, Sentry n'est pas initialisé.

import * as Sentry from '@sentry/react-native';
import { sanitizeSentryData } from './sentrySanitization';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || '';

/** Vrai si un DSN est configuré. */
export const isSentryEnabled = Boolean(DSN);

let initialized = false;

/** Initialise Sentry une seule fois, au tout début de l'application. */
export function initSentry() {
  if (initialized || !isSentryEnabled) return;
  initialized = true;

  Sentry.init({
    dsn: DSN,
    // Permet de distinguer les builds Preview de Production sans publier
    // d'identifiants différents ni modifier l'app entre les deux profils.
    environment: SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),

    // Échantillonnage volontairement bas pour le suivi de performance.
    tracesSampleRate: 0.1,

    // Ne pas envoyer automatiquement les données personnelles usuelles.
    sendDefaultPii: false,

    // Les liens SharePix peuvent contenir des codes d'album ou des données
    // d'authentification dans la query ou le fragment. Échec du filtre =
    // abandon de l'événement (fail closed), jamais envoi de la valeur brute.
    beforeSend(event) {
      try {
        return sanitizeSentryData(event);
      } catch {
        return null;
      }
    },
    beforeBreadcrumb(crumb) {
      try {
        return sanitizeSentryData(crumb);
      } catch {
        return null;
      }
    },
  });
}

/**
 * Enveloppe le composant racine (gestes, contexte d'erreur).
 * Sans DSN, on renvoie le composant tel quel : zéro surcoût.
 */
export function wrapRoot(Component) {
  return isSentryEnabled ? Sentry.wrap(Component) : Component;
}

/** Signale une exception sans jamais faire échouer l'appelant. */
export function reportError(error, context = {}) {
  if (!isSentryEnabled) {
    if (__DEV__) console.error('💥', error, context);
    return;
  }
  try {
    Sentry.captureException(error, { extra: context });
  } catch {
    // Le rapport de crash ne doit pas provoquer de crash.
  }
}

/** Ajoute un fil d'Ariane (action utilisateur) au prochain rapport. */
export function addBreadcrumb(message, data = {}) {
  if (!isSentryEnabled) return;
  try {
    Sentry.addBreadcrumb({ message, data, level: 'info' });
  } catch {
    // ignoré volontairement
  }
}
