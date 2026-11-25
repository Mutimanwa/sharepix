# CI-PR38 — échec des contrôles Expo Doctor et RLS/Storage

**Périmètre :** corriger les dépendances Expo désalignées et identifier la cause réelle du contrôle RLS impossible sans affaiblir le test ni le détourner vers la production.

## Éléments observés

- La CI du PR #38 échoue sur le contrôle Expo Doctor : dix paquets Expo ont des correctifs de version disponibles pour le SDK 57.
- La CI RLS/Storage sort avec le code `2`. Le script rapporte `fetch failed` pour les requêtes anon et la création du compte anonyme; il indique explicitement que rien n’a été vérifié. Ce n’est donc ni une preuve de fuite ni une preuve de protection RLS.
- Le workflow passe des secrets `STAGING_SUPABASE_URL` et `STAGING_SUPABASE_ANON_KEY`; la cible doit rester un projet de test dédié.

## Vérification Supabase live

- Le projet `sharepix-staging` est actuellement `INACTIVE`; la lecture de sa configuration Auth indique que les comptes anonymes y sont activés.
- La vérification de santé Supabase a répondu qu’il n’y avait pas de services actifs pour ce projet. Cela correspond aux échecs `fetch failed`; le test n’a pas pu atteindre la base.
- Ne pas restaurer le projet automatiquement, ne pas changer les secrets GitHub à l’aveugle, et ne pas pointer le test sur la production. Il faut que le projet de staging soit réactivé et que les deux secrets de staging pointent bien vers lui.

## Travail effectué / restant

- Mise à jour des dix dépendances du SDK 57 vers les versions correctives listées ci-dessous; lockfile régénéré par npm.
- `npm ci` puis `npm run verify` réussissent : TypeScript, ESLint et 9 suites / 48 tests.
- `npm ls` confirme exactement les dix versions attendues dans le log.
- Expo Doctor local n’a pas pu achever deux vérifications qui requièrent des services Expo externes (échec TLS/fetch dans l’environnement). Cela ne démontre pas de défaut de configuration; la CI GitHub peut réessayer ces contrôles.
- Le code de sortie `2` du test RLS est conservé : un test injoignable ne doit jamais être présenté comme réussi.
- Action requise côté Supabase : réactiver manuellement le projet de staging `sharepix-staging` et confirmer que `STAGING_SUPABASE_URL` et `STAGING_SUPABASE_ANON_KEY` pointent vers ce projet de test. Ne pas pointer le test sur la production. Après réactivation, relancer la CI pour exécuter vraiment le contrôle RLS/Storage.

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
