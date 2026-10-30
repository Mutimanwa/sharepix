# Notifications SharePix — audit, mise en œuvre et déploiement

## Autorisation et état initial
- L’utilisateur a choisi explicitement **« Corriger aussi la production »** : les changements de production ne devaient être faits qu’après vérification du code local.
- Projet audité : Supabase `sharepix` (`bpillwvvxqiduxtkftuh`), également confirmé dans `src/config.js`.
- Avant changement, la production possédait `push_tokens`, `activity_log`, `activity_acks`, `profiles`, les déclencheurs d’activité et le webhook `activity-push`.
- La fonction était active en version 3; elle n’échouait pas fermée si `WEBHOOK_SECRET` manquait et n’appliquait pas les préférences de notification.
- `profiles` n’avait aucune colonne de préférences push et `push_tokens` contenait zéro jeton. Les secrets requis existaient dans Vault; leurs valeurs n’ont pas été lues ni affichées.

## Mise en œuvre
1. Migration additive : réglage global et quatre catégories dans `profiles`; opt-in global à `false`, catégories à `true` par défaut. Aucun compte ni contenu existant n’a été supprimé.
2. Préférences partagées entre Profil et Activités, rechargées par compte et appliquées côté serveur. Le fil d’activités continue à fonctionner lorsque les push sont désactivés.
3. Enregistrement du jeton Expo après accord système; création du canal Android `sharepix-activity`; suppression du jeton avant déconnexion ou changement de compte; réinscription silencieuse au démarrage si les préférences et l’autorisation système sont déjà actives.
4. Edge Function mise à jour : authentification webhook fail-closed, filtre global/catégorie, exclusion de l’auteur, envoi Expo par lots, nettoyage des jetons expirés, aucun contenu de commentaire dans le push ni journalisation de jeton.
5. Icône Android monochrome dédiée et routage du tap vers l’album, y compris après le démarrage à froid. La dernière réponse de notification est effacée après traitement pour éviter une navigation répétée.
6. Tests unitaires de formatage et validation des contrôles locaux.

## Forme des notifications
- **Nouvelle photo** — « Amina a ajouté une photo dans “Album”. »
- **Nouveau commentaire** — « Amina a commenté une photo dans “Album”. » (aucun texte du commentaire sur l’écran verrouillé)
- **Nouvelle réaction** — « Amina a aimé une photo dans “Album”. »
- **Nouveau membre** — « Amina a rejoint “Album”. »
- Tap : ouvrir l’album concerné. Canal Android unique `sharepix-activity`, priorité par défaut; rendu final contrôlé par le système.

## Production — appliqué et vérifié
- Migration enregistrée sous `20261023122932 / notification_preferences`; les cinq colonnes existent avec les valeurs par défaut et contraintes attendues.
- `activity-push` est active en **version 4**, avec `verify_jwt=false` comme auparavant; le contrôle du secret reste obligatoire dans le code.
- Une vérification après déploiement confirme **0 jeton Expo enregistré** en production. Aucun test d’envoi réel n’a donc pu être effectué.

## Vérifications locales
- `npm run verify` : typecheck, ESLint et Jest réussis; 6 suites, 37 tests.
- Vérification TypeScript ciblée de l’Edge Function réussie.
- `npx expo config --type public --json`, `git diff --check` réussis; export Metro Android réussi (7 797 modules).
- Un build EAS ni un test sur appareil n’ont été exécutés par l’agent. Expo Push requiert un build natif installé, un jeton enregistré et l’autorisation système accordée.

## Critères de validation restants
- Sur l’APK EAS Preview, activer les notifications et vérifier l’apparition d’un jeton dans `push_tokens` sans l’exposer.
- Déclencher une activité de chaque catégorie, vérifier le filtrage et le contenu affiché, toucher le push pour confirmer l’ouverture de l’album, puis désactiver une catégorie/le réglage global et vérifier l’absence d’envoi.
- Tester la déconnexion et le changement de compte : le jeton de l’ancien compte doit être supprimé.
- Le résultat des vérifications ci-dessus dépend d’un test sur appareil; ne pas annoncer la livraison réelle tant qu’il n’a pas été réalisé.

## Mise à jour ultérieure — diagnostic push (2026-10-24)

Les constats « zéro jeton » et « aucun envoi réel » ci-dessus décrivent l'état
au moment de cette première livraison. Le diagnostic ultérieur est consigné dans
[`PUSH_NOTIFICATIONS_DIAGNOSTIC_PLAN.md`](PUSH_NOTIFICATIONS_DIAGNOSTIC_PLAN.md) :
la fonction a été corrigée/redéployée, un événement réel a produit `sent:1`,
et l'utilisateur a confirmé la réception. Cette validation concerne le parcours
Android testé; elle ne valide pas encore APNs ni les push iOS.
