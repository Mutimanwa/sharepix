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
- Après le push `bf01481`, le run `45678864160` était vert, mais le script permettait encore que des étapes de préparation Storage échouent sans rendre le job non concluant; le journal Actions est par ailleurs inaccessible via `gh` (EOF).
- Le script corrige ce faux positif potentiel : création de l’album, upload, URL publique et URL signée membre/non-membre doivent désormais être effectivement testés; réseau, erreurs inconnues ou préparation impossible renvoient le code 2. Les refus d’accès reconnus seulement sont acceptés comme protection.
- Le run `45679208260` a échoué en code 2. La dernière annotation du run `45679495216` fournit le diagnostic exact : `StorageApiError; HTTP 400; code NoSuchKey; Object not found` lors de la demande d’URL signée par un non-membre.
- Ce résultat est le refus attendu de Supabase Storage : après que le compte membre a créé l’album, téléversé l’objet et obtenu son URL signée, Storage masque l’objet à l’utilisateur étranger en renvoyant `NoSuchKey` / « Object not found ». Le test le classait à tort comme indéterminé; cela n’indique pas une fuite, ni un échec Auth.
- Le contrôle accepte maintenant uniquement cette signature précise (HTTP 400 + `NoSuchKey`) comme refus Storage masqué pour le non-membre. Les autres erreurs non reconnues restent non vérifiées et bloquantes.
- Les logs Actions restent inaccessibles via `gh` (EOF), mais l’annotation diagnostic a permis de récupérer le code, le statut HTTP et le message sans exposer les secrets.
- Des tests unitaires couvrent les erreurs RLS/réseau, les erreurs Auth sans détails et le cas `NoSuchKey`. La CI sera relancée après ce correctif final.
- Le workflow impose la présence des deux secrets et bloque toute URL dont l’hôte n’est pas celui du projet de test `sharepix-staging`; aucune URL ni clé n’est imprimée. Le staging Supabase reste sain et l’Auth anonyme activée; aucune modification de configuration Supabase n’a été faite.
- `gh secret list` est refusé par GitHub (HTTP 403, droits de l’intégration insuffisants) : impossible de lire ou comparer directement les valeurs, mais le run a validé URL/clé présentes et la création d’un utilisateur anonyme.

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
