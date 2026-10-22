// @ts-check
// ── Sentry : rapport de crash, facultatif ───────────────────────────────
//
// La politique de confidentialité publiée annonce Sentry ; le code ne
// l'avait pas. Ce module comble l'écart sans rendre le service obligatoire :
// **sans `EXPO_PUBLIC_SENTRY_DSN`, rien n'est initialisé** et l'application
// se comporte exactement comme avant.
//
// Créer le DSN :
//   sentry.io → Projects → Create project → React Native
//   puis `.env` : EXPO_PUBLIC_SENTRY_DSN=https://…@o…ingest.sentry.io/…
//
// Le SDK est natif : il faut un build (EAS / dev client), pas Expo Go.

import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

/** Vrai si un DSN est configuré. */
export const isSentryEnabled = Boolean(DSN);

let initialized = false;

/** Initialise Sentry une seule fois, au tout début de l'application. */
export function initSentry() {
  if (initialized || !isSentryEnabled) return;
  initialized = true;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',

    // Échantillonnage volontairement bas : on veut repérer les régressions,
    // pas financer un service d'observabilité.
    tracesSampleRate: 0.1,

    // Aucune donnée personnelle dans un service tiers : ni e-mail, ni nom,
    // ni contenu. Les identifiants d'album suffisent au diagnostic.
    sendDefaultPii: false,

    // Une URL de retour OAuth (`sharepix://auth/callback?code=…`) est un
    // justificatif à usage unique : elle ne doit jamais sortir de l'appareil.
    beforeSend(event) {
      try {
        const dropUrl = (holder) => {
          if (holder && typeof holder.url === 'string' && /[?&]code=/.test(holder.url)) {
            holder.url = holder.url.split('?')[0];
          }
        };
        dropUrl(event.request);
        for (const crumb of event.breadcrumbs || []) dropUrl(crumb.data);
      } catch {
        // Le filtre ne doit jamais empêcher l'envoi d'un rapport.
      }
      return event;
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
