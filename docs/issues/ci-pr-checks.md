# CI-PR38 — échec des contrôles Expo Doctor et RLS/Storage

**Périmètre :** corriger les dépendances Expo désalignées et identifier la cause réelle du contrôle RLS impossible sans affaiblir le test ni le détourner vers la production.

## Éléments observés

- La CI du PR #38 échoue sur le contrôle Expo Doctor : dix paquets Expo ont des correctifs de version disponibles pour le SDK 57.
- La CI RLS/Storage sort avec le code `2`. Le script rapporte `fetch failed` pour les requêtes anon et la création du compte anonyme; il indique explicitement que rien n’a été vérifié. Ce n’est donc ni une preuve de fuite ni une preuve de protection RLS.
- Le workflow passe des secrets `STAGING_SUPABASE_URL` et `STAGING_SUPABASE_ANON_KEY`; la cible doit rester un projet de test dédié.

## Vérification Supabase live

- Après autorisation explicite, `sharepix-staging` a été restauré. Supabase le déclare maintenant `ACTIVE_HEALTHY` pour Auth, DB et Storage.
- `external_anonymous_users_enabled` vaut `true` sur le staging.
- Les tables `profiles`, `albums`, `photos`, `album_members`, `photo_comments` et `photo_likes` existent; le trigger `on_auth_user_created` appelle bien `handle_new_user()`.
- L’historique exposé par Supabase ne correspond pas exactement aux six fichiers de migration locaux; ne pas déduire que les tables ou objets manquent sans consulter le schéma réel.
- Le nouveau journal montre des erreurs de requête sans message exploitable (« refusé () ») puis une erreur Auth sans détail (« <none> »). Le secret URL/clé est masqué par GitHub et ne peut pas être vérifié ici.

## Travail effectué / restant

- Mise à jour des dix dépendances du SDK 57 vers les versions correctives listées ci-dessous; lockfile régénéré par npm.
- `npm ci` puis `npm run verify` réussissent : TypeScript, ESLint et 9 suites / 48 tests.
- `npm ls` confirme exactement les dix versions attendues; le contrôle Expo Doctor GitHub est maintenant vert.
- Restauration du projet de test avec autorisation; Supabase le déclare maintenant `ACTIVE_HEALTHY` et les connexions anonymes sont activées.
- Après le push `bf01481`, le run GitHub `45678864160` est vert sur les trois jobs, y compris « RLS & Storage ». Cela confirme que la configuration du workflow est présente et que le contrôle a retourné le code 0. GitHub renvoie néanmoins `EOF` lors de la récupération du journal détaillé.
- Relecture du script après ce run : les échecs de préparation album/upload Storage pouvaient être seulement avertis et laisser un code 0. Pour éviter toute fausse validation, le correctif suivant transforme ces étapes manquées ainsi que les réponses réseau/HTTP ambiguës en vérifications non concluantes (code 2).
- Le script journalise maintenant nom/code/statut/message sans afficher d’identifiants; seules les erreurs de permission reconnues comptent comme refus, les erreurs inconnues restent non vérifiées. Des tests unitaires couvrent les erreurs RLS, réseau et Auth sans détails.
- Le workflow impose la présence des deux secrets et bloque toute URL dont l’hôte n’est pas celui du projet de test `sharepix-staging`; aucune URL ni clé n’est imprimée.
- `gh secret list` est refusé par GitHub (HTTP 403, droits de l’intégration insuffisants) : impossible de lire ou comparer les secrets. L’exécution CI précédente a toutefois traversé le contrôle Auth; la nouvelle exécution confirmera aussi sans ambiguïté chaque sous-étape Storage.

## Versions Expo signalées dans le log

- `@expo/metro-runtime` 57.0.19
- `expo` 57.0.34
- `expo-constants` 57.0.25
- `expo-dev-client` 57.0.22
- `expo-image-manipulator` 57.0.23
- `expo-image-picker` 57.0.22
- `expo-linking` 57.0.14
- `expo-media-library` 57.0.6
- `expo-notifications` 57.0.26
- `expo-splash-screen` 57.0.12
