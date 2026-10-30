# Plan — finaliser l’intégration Sentry de SharePix

## État confirmé avant intervention
- Le SDK `@sentry/react-native` est déjà une dépendance du projet (version `~7.11.0`, Expo `~57.0.31`).
- `src/lib/sentry.js` contient déjà `initSentry`, `wrapRoot`, `reportError` et `addBreadcrumb`; `App.js` initialise Sentry et utilise un `ErrorBoundary`.
- Le DSN `EXPO_PUBLIC_SENTRY_DSN` et `SENTRY_AUTH_TOKEN` ont été ajoutés par l’utilisateur aux variables EAS pour Preview et Production. Ne jamais lire, afficher ou enregistrer leurs valeurs.
- Organisation et projet Sentry communiqués : `calvindev` / `sharepix`.

## Travaux réalisés dans le dépôt
1. Ajout du plugin Expo Sentry à `app.json` avec `calvindev/sharepix`, sans retirer les autres plugins.
2. Création de `metro.config.js` à partir de `getSentryExpoConfig` de la version installée.
3. Renforcement du filtrage Sentry pour masquer récursivement les deep links SharePix, codes, jetons et champs de secret dans les événements et breadcrumbs; si le filtre échoue, l’événement est abandonné.
4. Remplacement des journaux d’URL de deep links par des messages génériques dans `App.js` et `src/lib/supabase.js`.
5. Ajout des environnements EAS explicites `development`, `preview` et `production`.
6. Ajout d’une variable non secrète `EXPO_PUBLIC_SENTRY_ENVIRONMENT` pour différencier les événements Preview et Production.
7. Ajout de tests ciblés sur le masquage des URL/tokens.

## Vérifications
- `npm run verify` : TypeScript, ESLint et Jest réussis (32 tests).
- `npx expo config --type public --json` : configuration Expo résolue; plugin Sentry présent.
- Chargement Node de `metro.config.js` : réussi.
- Les variables EAS privées n’ont pas été lues ni modifiées; l’intégration réelle, l’upload des source maps et la réception d’un événement restent à valider par une build EAS Preview.

## Vérifications externes restant à faire
- Dans EAS, ajouter `EXPO_PUBLIC_SENTRY_ENVIRONMENT=preview` à l’environnement Preview et `EXPO_PUBLIC_SENTRY_ENVIRONMENT=production` à Production. Il s’agit d’une étiquette publique, pas d’un secret.
- Confirmer dans EAS que `EXPO_PUBLIC_SENTRY_DSN` et `SENTRY_AUTH_TOKEN` sont associés aux environnements Preview et Production. Ne pas partager leurs valeurs.
- Lancer une build EAS Preview, puis confirmer l’arrivée d’un événement de test et la lisibilité de sa stack trace/source map dans Sentry.
- Configurer et tester les alertes du dashboard; elles ne peuvent pas être certifiées par une vérification locale seule.

## Hors périmètre / précautions
- Ne pas lire, afficher, modifier ni demander les valeurs des variables EAS secrètes dans le chat.
- Ne pas toucher à l’onboarding ni à ses boutons/feuilles popup.
- Ne pas ajouter de bouton de test dans une version de production.

## Critères d’acceptation
- Le plugin et Metro sont configurés pour le projet `calvindev/sharepix`.
- Les URL OAuth/deep-link et leurs paramètres de jeton/code ne sont pas envoyés dans les breadcrumbs ou événements Sentry; `App.js` ne journalise plus l’URL complète.
- La configuration locale Expo se résout et les contrôles/test locaux pertinents passent, ou les blocages externes sont clairement signalés.
